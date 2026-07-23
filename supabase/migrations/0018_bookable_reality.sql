-- Week 10: make the booking flow match what a landlord actually wants to book.
--
-- CEO walkthrough of the live app (23/07/2026) surfaced four gaps that all sit
-- between the rate card and the booking wizard:
--
--   * The tenant's access link offered times the landlord never picked. Root
--     cause: guard_job_insert (0011) nulls scheduled_start on a landlord insert
--     — correctly, because scheduling is the office's decision — but the wizard
--     had nowhere else to put the landlord's preference, so it was silently
--     thrown away and offeredSlotsFor() fell back to "tomorrow, at whatever
--     o'clock it is now". Verified on PC-2131: booked 10:57, offered 10:58.
--   * Nothing could be booked that is not a rate-card line. The wizard shows
--     the card and stops, so "my shed door is hanging off" has no route in.
--   * The two hourly lines (H1 general handyman hour, E5 fault-find first hour)
--     could only be bought one hour at a time.
--   * A technician who leaves could not be taken off the roster.
--
-- Prices stay derived server-side throughout (the 0011 rule: RLS constrains
-- rows, never values).
--
-- ⚠ This file contains non-ASCII text that reaches users (the em-dash in the
-- "Something else" line name and in the quote note). Applying it through the
-- Management API with a script that reads the file in the Windows default
-- codepage instead of UTF-8 stores mojibake — it did, and prod had to be
-- repaired by hand. Read the file as UTF-8 when applying.

-- =====================================================================
-- 1. The landlord's preferred slot survives the insert
-- =====================================================================
-- scheduled_start/end remain the office's: they mean "this is when we are
-- coming", set when the tenant confirms. preferred_* means "this is when the
-- landlord's tenant is likely free", which is an input to that decision.

alter table jobs
  add column if not exists preferred_slot_start timestamptz,
  add column if not exists preferred_slot_end timestamptz;

comment on column jobs.preferred_slot_start is
  'The slot the landlord picked in the booking wizard. Advisory: the office schedules, the tenant confirms.';

-- =====================================================================
-- 2. Hourly lines, and lines that need a quote
-- =====================================================================

alter table job_types
  add column if not exists unit text not null default 'job',
  add column if not exists additional_unit_price_inc_vat numeric(10,2),
  add column if not exists requires_quote boolean not null default false;

do $$ begin
  alter table job_types add constraint job_types_unit_check check (unit in ('job', 'hour'));
exception when duplicate_object then null; end $$;

comment on column job_types.unit is
  'job = one flat price. hour = priced per hour on site, landlord picks how many up front.';
comment on column job_types.additional_unit_price_inc_vat is
  'Price of each hour after the first. NULL = same as the first hour. Set this to offer a lower continuation rate.';
comment on column job_types.requires_quote is
  'No fixed price: the office quotes it before the landlord approves. Exempt from the call-out floor.';

alter table jobs
  add column if not exists quantity integer not null default 1;

do $$ begin
  alter table jobs add constraint jobs_quantity_check check (quantity between 1 and 8);
exception when duplicate_object then null; end $$;

comment on column jobs.quantity is
  'Units bought at booking — hours for an hourly line, always 1 for a flat-price line.';

-- The two hourly lines of rate card v1 (business/rate-card-v1.md H1 and E5).
-- additional_unit_price_inc_vat stays NULL: each further hour costs the same as
-- the first until a continuation rate is agreed.
update job_types set unit = 'hour'
  where active and name in ('General handyman hour', 'Fault-find first hour');

-- The call-out floor cannot apply to a line that carries no price.
create or replace function enforce_min_job_price() returns trigger
language plpgsql set search_path = public as $$
declare floor_price numeric;
begin
  select minimum_job_inc_vat into floor_price from pricing_settings where id;
  if new.active and not new.requires_quote
     and coalesce(floor_price, 0) > 0 and new.price_inc_vat < floor_price then
    raise exception 'price_inc_vat % is below the call-out floor of %',
      new.price_inc_vat, floor_price;
  end if;
  return new;
end $$;

-- One "not on the list" line per category. Priced at 0 and never charged at 0:
-- guard_job_insert leaves agreed_price_inc_vat NULL, and the job cannot leave
-- 'requested' until the office prices it through price_quote_job().
insert into job_types (category, name, price_ex_vat, price_inc_vat, requires_certification, requires_quote, active)
select v.category::job_category, v.name, 0, 0, v.cert, true, true
from (values
  ('plumbing',   'Something else — we''ll quote it', false),
  ('electrical', 'Something else — we''ll quote it', true),
  ('handyman',   'Something else — we''ll quote it', false)
) as v(category, name, cert)
where not exists (
  select 1 from job_types t where t.category = v.category::job_category and t.requires_quote
);

-- =====================================================================
-- 3. Derive price from the card, the quantity and the quote flag
-- =====================================================================

create or replace function guard_job_insert() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_type job_types;
  v_settings pricing_settings;
  v_base numeric(10,2);
  v_extra numeric(10,2);
  v_qty integer;
begin
  -- service role (Edge Functions, seeds) and admins are trusted
  if auth.uid() is null or is_admin() then
    return new;
  end if;

  -- a landlord-created job is always a fresh request: never pre-assigned,
  -- never pre-scheduled, never already priced-and-approved. The landlord's
  -- preferred slot is kept — it is a preference, not a commitment.
  new.status := 'requested';
  new.assigned_technician_id := null;
  new.scheduled_start := null;
  new.scheduled_end := null;
  new.completed_at := null;

  if new.job_type_id is null then
    raise exception 'a job must reference a rate-card job type';
  end if;

  select * into v_type from job_types where id = new.job_type_id;
  if v_type.id is null or not v_type.active then
    raise exception 'unknown or inactive job type';
  end if;

  -- category drives the certification gate, so it comes from the rate card,
  -- not from the client
  new.category := v_type.category;

  select * into v_settings from pricing_settings where id;

  -- hours are only sold on hourly lines; everything else is one flat price
  if v_type.unit = 'hour' and not v_type.requires_quote then
    v_qty := least(greatest(coalesce(new.quantity, 1), 1), 8);
  else
    v_qty := 1;
  end if;
  new.quantity := v_qty;

  if v_type.requires_quote then
    -- no price exists yet: the office quotes it, the landlord approves it
    new.agreed_price_inc_vat := null;
    new.surcharge_multiplier := 1.0;
    new.urgency := 'standard';
    return new;
  end if;

  -- mirrors jobPrice() in propcare/src/lib/data.ts; the client's number is advisory
  v_base := greatest(v_type.price_inc_vat, coalesce(v_settings.minimum_job_inc_vat, 0));
  v_extra := coalesce(v_type.additional_unit_price_inc_vat, v_base);
  v_base := v_base + (v_qty - 1) * v_extra;

  if new.urgency = 'out_of_hours'
     and v_type.out_of_hours_eligible
     and coalesce(v_settings.out_of_hours_multiplier, 1) > 1 then
    new.surcharge_multiplier := v_settings.out_of_hours_multiplier;
    new.agreed_price_inc_vat := round(v_base * v_settings.out_of_hours_multiplier, 2);
  else
    new.surcharge_multiplier := 1.0;
    new.agreed_price_inc_vat := v_base;
  end if;

  return new;
end $$;

comment on function guard_job_insert is
  'Landlord-supplied price, category, quantity and lifecycle columns are overwritten from the rate card. RLS cannot constrain columns, only rows.';

-- =====================================================================
-- 4. The office quotes a job that has no rate-card price
-- =====================================================================

create or replace function price_quote_job(p_job_id uuid, p_price numeric, p_note text default null)
returns jobs
language plpgsql security definer set search_path = public as $$
declare
  v_job jobs;
  v_floor numeric;
begin
  if not is_admin() then
    raise exception 'only the office can quote a job';
  end if;

  select * into v_job from jobs where id = p_job_id for update;
  if v_job.id is null then
    raise exception 'job not found';
  end if;
  if v_job.status <> 'requested' then
    raise exception 'only a job still waiting for its quote can be priced';
  end if;
  if p_price is null or p_price <= 0 then
    raise exception 'a quote needs a price';
  end if;

  select minimum_job_inc_vat into v_floor from pricing_settings where id;
  if coalesce(v_floor, 0) > 0 and p_price < v_floor then
    raise exception 'quote % is below the call-out floor of %', p_price, v_floor;
  end if;

  update jobs set agreed_price_inc_vat = round(p_price, 2) where id = p_job_id;

  -- transition_job writes the job_event and re-checks the caller
  return transition_job(p_job_id, 'priced',
    coalesce(p_note, 'Quoted by the office — £' || round(p_price, 2)::text));
end $$;

comment on function price_quote_job is
  'Admin-only. Puts a price on a "something else" request and sends it to the landlord to approve.';

-- =====================================================================
-- 5. Technicians can be identified, and taken off the roster
-- =====================================================================
-- The registry had no way to tell two "Test Technician"s apart, and no way to
-- remove anyone: a leaver stayed assignable forever. Deleting a profile is not
-- an option (jobs.assigned_technician_id has no cascade, and the financial
-- record has to survive), so removal is deactivation.

alter table profiles
  add column if not exists email text,
  add column if not exists deactivated_at timestamptz;

comment on column profiles.deactivated_at is
  'Set when someone leaves the roster. Their history stays; they can no longer be assigned work.';

update profiles p set email = u.email
  from auth.users u where u.id = p.id and p.email is distinct from u.email;

create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, role, full_name, email)
  values (new.id, 'landlord', coalesce(new.raw_user_meta_data ->> 'full_name', ''), new.email)
  on conflict (id) do nothing;
  return new;
end $$;

-- Defence in depth, same shape as the certification gate: the UI hides a
-- deactivated technician, the database refuses to assign them.
create or replace function check_technician_active() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.assigned_technician_id is not null
     and (TG_OP = 'INSERT' or new.assigned_technician_id is distinct from old.assigned_technician_id)
     and exists (
       select 1 from profiles p
       where p.id = new.assigned_technician_id and p.deactivated_at is not null
     ) then
    raise exception 'technician % is no longer on the roster', new.assigned_technician_id;
  end if;
  return new;
end $$;

create trigger jobs_technician_active before insert or update of assigned_technician_id on jobs
  for each row execute function check_technician_active();

-- Deactivating is a roster decision, so it is the office's alone. Same class as
-- pay_rate_per_hour (0011): a column guard, because RLS cannot see columns.
create or replace function guard_profile_deactivation() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.deactivated_at is distinct from old.deactivated_at
     and auth.uid() is not null and not is_admin() then
    raise exception 'roster changes require an admin';
  end if;
  return new;
end $$;

create trigger profiles_guard_deactivation before update of deactivated_at on profiles
  for each row execute function guard_profile_deactivation();
