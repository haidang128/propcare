  -- PropCare: full database setup (migrations 0001+0002 + seed). Paste into the Supabase SQL editor and Run.

  -- PropCare P0 schema · Week 1 foundation
  -- Job lifecycle (PRD §6): requested → priced → approved → scheduled → in progress → completed → paid
  --                          with variation_pending branch and exception states.
  -- Every status change goes through transition_job() so it is validated and audited in job_events.

  -- ========== Enums ==========

  create type user_role as enum ('landlord', 'technician', 'admin');
  create type job_category as enum ('plumbing', 'electrical', 'handyman');
  create type job_urgency as enum ('standard', 'out_of_hours');
  create type job_status as enum (
    'requested', 'priced', 'approved', 'scheduled', 'in_progress',
    'variation_pending', 'awaiting_parts', 'rescheduled',
    'completed', 'paid',
    'cancelled', 'declined', 'access_failed', 'disputed'
  );
  create type variation_status as enum ('flagged', 'admin_review', 'pending_landlord', 'approved', 'declined');
  create type photo_kind as enum ('request', 'before', 'after', 'variation');
  create type invoice_status as enum ('draft', 'sent', 'paid', 'auto_captured', 'disputed');
  create type cert_type as enum ('niceic', 'napit', 'wras', 'gas_safe', 'public_liability', 'other');

  -- ========== Tables ==========

  create table profiles (
    id uuid primary key references auth.users (id) on delete cascade,
    role user_role not null,
    full_name text not null default '',
    phone text,
    created_at timestamptz not null default now()
  );

  create table properties (
    id uuid primary key default gen_random_uuid(),
    landlord_id uuid not null references profiles (id),
    address_line1 text not null,
    address_line2 text,
    city text not null default 'London',
    postcode text not null,
    -- tenant contact is for access coordination only; tenants never see prices (PRD §5)
    tenant_name text,
    tenant_phone text,
    created_at timestamptz not null default now()
  );

  -- Rate card: the core pricing artifact. Prices are snapshots on jobs, so editing
  -- the rate card never changes an already-priced job (design A3 warning).
  create table job_types (
    id uuid primary key default gen_random_uuid(),
    category job_category not null,
    name text not null,
    price_ex_vat numeric(10,2) not null,
    price_inc_vat numeric(10,2) not null,
    requires_certification boolean not null default false, -- true for electrical (NICEIC/NAPIT)
    active boolean not null default true,
    created_at timestamptz not null default now()
  );

  create table jobs (
    id uuid primary key default gen_random_uuid(),
    reference text unique, -- e.g. PC-2041, assigned by sequence trigger below
    property_id uuid not null references properties (id),
    landlord_id uuid not null references profiles (id),
    job_type_id uuid references job_types (id),
    category job_category not null,
    description text not null default '',
    urgency job_urgency not null default 'standard',
    status job_status not null default 'requested',
    -- price snapshot at approval; never recomputed from the rate card
    agreed_price_inc_vat numeric(10,2),
    surcharge_multiplier numeric(4,2) not null default 1.0, -- 1.75 for out_of_hours
    assigned_technician_id uuid references profiles (id),
    scheduled_start timestamptz,
    scheduled_end timestamptz,
    completed_at timestamptz,
    created_at timestamptz not null default now()
  );

  create sequence job_reference_seq start 2041;
  create or replace function assign_job_reference() returns trigger
  language plpgsql as $$
  begin
    new.reference := 'PC-' || nextval('job_reference_seq');
    return new;
  end $$;
  create trigger jobs_reference before insert on jobs
    for each row when (new.reference is null) execute function assign_job_reference();

  -- Audit trail: one row per status change; feeds the status timeline component.
  create table job_events (
    id uuid primary key default gen_random_uuid(),
    job_id uuid not null references jobs (id) on delete cascade,
    from_status job_status,
    to_status job_status not null,
    actor_id uuid references profiles (id),
    note text,
    created_at timestamptz not null default now()
  );

  create table job_photos (
    id uuid primary key default gen_random_uuid(),
    job_id uuid not null references jobs (id) on delete cascade,
    kind photo_kind not null,
    storage_path text not null,
    uploaded_by uuid references profiles (id),
    created_at timestamptz not null default now()
  );

  create table variations (
    id uuid primary key default gen_random_uuid(),
    job_id uuid not null references jobs (id) on delete cascade,
    technician_id uuid not null references profiles (id),
    note text not null,
    status variation_status not null default 'flagged',
    suggested_price_inc_vat numeric(10,2), -- from rate card, shown to admin
    admin_price_inc_vat numeric(10,2),     -- what admin sends to the landlord
    old_job_price_inc_vat numeric(10,2) not null,
    new_job_price_inc_vat numeric(10,2),
    decided_by uuid references profiles (id),
    decided_at timestamptz,
    created_at timestamptz not null default now()
  );

  create table technician_certifications (
    id uuid primary key default gen_random_uuid(),
    technician_id uuid not null references profiles (id) on delete cascade,
    type cert_type not null,
    reference text,
    expires_on date not null,
    verified boolean not null default false,
    created_at timestamptz not null default now()
  );

  create table on_call_optins (
    technician_id uuid primary key references profiles (id) on delete cascade,
    active boolean not null default false,
    updated_at timestamptz not null default now()
  );

  -- Tenant no-login access link: token is the only credential; consumed via Edge Function
  -- with the service role, so no RLS policy exposes this to anon.
  create table access_slots (
    id uuid primary key default gen_random_uuid(),
    job_id uuid not null references jobs (id) on delete cascade,
    token uuid not null unique default gen_random_uuid(),
    offered_slots jsonb not null default '[]', -- [{start, end}]
    chosen_start timestamptz,
    chosen_end timestamptz,
    confirmed_at timestamptz,
    expires_at timestamptz not null default now() + interval '7 days',
    created_at timestamptz not null default now()
  );

  -- Internal only: landlord role must never read this (they see the fixed price only).
  create table time_materials (
    id uuid primary key default gen_random_uuid(),
    job_id uuid not null references jobs (id) on delete cascade,
    technician_id uuid not null references profiles (id),
    minutes integer,
    description text not null,
    cost numeric(10,2),
    created_at timestamptz not null default now()
  );

  create table invoices (
    id uuid primary key default gen_random_uuid(),
    job_id uuid not null unique references jobs (id),
    number text not null unique,
    total_inc_vat numeric(10,2) not null,
    stripe_payment_link text,
    status invoice_status not null default 'draft',
    capture_deadline timestamptz, -- completion + 72h; capture blocked while disputed
    created_at timestamptz not null default now()
  );

  create table ratings (
    id uuid primary key default gen_random_uuid(),
    job_id uuid not null unique references jobs (id),
    landlord_id uuid not null references profiles (id),
    stars integer not null check (stars between 1 and 5),
    comment text,
    created_at timestamptz not null default now()
  );

  -- ========== State machine ==========

  create or replace function allowed_transition(from_s job_status, to_s job_status)
  returns boolean language sql immutable as $$
    select (from_s, to_s) in (
      ('requested', 'priced'), ('requested', 'cancelled'),
      ('priced', 'approved'), ('priced', 'declined'), ('priced', 'cancelled'),
      ('approved', 'scheduled'), ('approved', 'cancelled'),
      ('scheduled', 'in_progress'), ('scheduled', 'access_failed'),
      ('scheduled', 'rescheduled'), ('scheduled', 'cancelled'),
      ('access_failed', 'scheduled'), ('access_failed', 'cancelled'),
      ('rescheduled', 'scheduled'),
      ('in_progress', 'variation_pending'), ('in_progress', 'awaiting_parts'),
      ('in_progress', 'completed'), ('in_progress', 'cancelled'),
      ('variation_pending', 'in_progress'), ('variation_pending', 'cancelled'),
      ('awaiting_parts', 'in_progress'), ('awaiting_parts', 'rescheduled'),
      ('completed', 'paid'), ('completed', 'disputed'),
      ('disputed', 'completed'), ('disputed', 'paid')
    )
  $$;

  -- The single entry point for status changes. SECURITY DEFINER so clients call this
  -- RPC instead of updating jobs.status directly (direct status updates are blocked below).
  create or replace function transition_job(p_job_id uuid, p_to job_status, p_note text default null)
  returns jobs
  language plpgsql security definer set search_path = public as $$
  declare
    v_job jobs;
    v_from job_status;
    v_role user_role;
  begin
    select role into v_role from profiles where id = auth.uid();
    select * into v_job from jobs where id = p_job_id for update;
    v_from := v_job.status;
    if v_job.id is null then
      raise exception 'job not found';
    end if;

    -- caller must be a party to the job (RLS does not apply inside security definer)
    if not (v_role = 'admin'
            or v_job.landlord_id = auth.uid()
            or v_job.assigned_technician_id = auth.uid()) then
      raise exception 'not authorised for this job';
    end if;

    if not allowed_transition(v_job.status, p_to) then
      raise exception 'illegal transition % -> %', v_job.status, p_to;
    end if;

    -- role guards on money-critical transitions (PRD acceptance criteria)
    if p_to = 'scheduled' and v_job.status = 'approved' and v_role not in ('admin') then
      -- scheduling is an admin/dispatch action once price is approved
      raise exception 'only admin can schedule';
    end if;
    if p_to = 'approved' and v_role <> 'landlord' and v_role <> 'admin' then
      raise exception 'only the landlord approves the price'; -- admin override is logged via note
    end if;
    if p_to = 'approved' and v_role = 'admin' and coalesce(p_note, '') = '' then
      raise exception 'admin override approval requires a reason note';
    end if;

    update jobs set status = p_to,
      completed_at = case when p_to = 'completed' then now() else completed_at end
      where id = p_job_id
      returning * into v_job;

    insert into job_events (job_id, from_status, to_status, actor_id, note)
      values (p_job_id, v_from, p_to, auth.uid(), p_note);

    return v_job;
  end $$;

  -- Certification enforcement: an uncertified technician can never be assigned to
  -- an electrical job (PRD acceptance criterion) — enforced at the DB, not just UI.
  create or replace function check_technician_certified() returns trigger
  language plpgsql as $$
  begin
    if new.assigned_technician_id is not null and new.category = 'electrical' then
      if not exists (
        select 1 from technician_certifications c
        where c.technician_id = new.assigned_technician_id
          and c.type in ('niceic', 'napit')
          and c.verified
          and c.expires_on >= current_date
      ) then
        raise exception 'technician % has no valid NICEIC/NAPIT certification for electrical work',
          new.assigned_technician_id;
      end if;
    end if;
    return new;
  end $$;
  create trigger jobs_certification_check before insert or update of assigned_technician_id, category on jobs
    for each row execute function check_technician_certified();

  -- ========== New-user provisioning ==========

  -- Landlords self-serve sign-up (PRD P0); technician/admin roles are set by an
  -- admin afterwards. Every new auth user gets a landlord profile automatically.
  create or replace function handle_new_user() returns trigger
  language plpgsql security definer set search_path = public as $$
  begin
    insert into profiles (id, role, full_name)
    values (new.id, 'landlord', coalesce(new.raw_user_meta_data ->> 'full_name', ''))
    on conflict (id) do nothing;
    return new;
  end $$;
  create trigger on_auth_user_created after insert on auth.users
    for each row execute function handle_new_user();

  -- ========== Row-level security ==========

  alter table profiles enable row level security;
  alter table properties enable row level security;
  alter table job_types enable row level security;
  alter table jobs enable row level security;
  alter table job_events enable row level security;
  alter table job_photos enable row level security;
  alter table variations enable row level security;
  alter table technician_certifications enable row level security;
  alter table on_call_optins enable row level security;
  alter table access_slots enable row level security;
  alter table time_materials enable row level security;
  alter table invoices enable row level security;
  alter table ratings enable row level security;

  -- security definer helper avoids recursive RLS lookups on profiles
  create or replace function is_admin() returns boolean
  language sql security definer set search_path = public stable as $$
    select exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  $$;

  -- profiles: read own; admin reads all; users update own non-role fields via app logic
  create policy profiles_select_own on profiles for select using (id = auth.uid() or is_admin());
  create policy profiles_update_own on profiles for update using (id = auth.uid());
  create policy profiles_admin_all on profiles for all using (is_admin());

  -- properties: landlord owns; technician can read the property of an assigned job (address for the visit)
  create policy properties_landlord on properties for all using (landlord_id = auth.uid());
  create policy properties_admin on properties for all using (is_admin());
  create policy properties_technician_read on properties for select using (
    exists (select 1 from jobs j where j.property_id = properties.id and j.assigned_technician_id = auth.uid())
  );

  -- rate card: any signed-in user can read active prices; only admin writes
  create policy job_types_read on job_types for select using (auth.uid() is not null);
  create policy job_types_admin_write on job_types for all using (is_admin());

  -- jobs: landlord own; technician assigned; admin all. Inserts only by the landlord for their property.
  create policy jobs_landlord on jobs for select using (landlord_id = auth.uid());
  create policy jobs_landlord_insert on jobs for insert with check (
    landlord_id = auth.uid()
    and exists (select 1 from properties p where p.id = property_id and p.landlord_id = auth.uid())
  );
  create policy jobs_technician on jobs for select using (assigned_technician_id = auth.uid());
  create policy jobs_admin on jobs for all using (is_admin());
  -- no generic UPDATE policy for landlord/technician: status moves via transition_job() RPC only

  -- job_events / photos: visible to the job's parties
  create policy job_events_read on job_events for select using (
    is_admin() or exists (
      select 1 from jobs j where j.id = job_events.job_id
        and (j.landlord_id = auth.uid() or j.assigned_technician_id = auth.uid())
    )
  );
  create policy job_photos_read on job_photos for select using (
    is_admin() or exists (
      select 1 from jobs j where j.id = job_photos.job_id
        and (j.landlord_id = auth.uid() or j.assigned_technician_id = auth.uid())
    )
  );
  create policy job_photos_insert on job_photos for insert with check (
    uploaded_by = auth.uid() and (
      is_admin() or exists (
        select 1 from jobs j where j.id = job_photos.job_id
          and (j.landlord_id = auth.uid() or j.assigned_technician_id = auth.uid())
      )
    )
  );

  -- variations: technician writes own flags; landlord sees them once they leave admin review; admin all
  create policy variations_technician on variations for select using (technician_id = auth.uid());
  create policy variations_technician_insert on variations for insert with check (
    technician_id = auth.uid() and exists (
      select 1 from jobs j where j.id = variations.job_id and j.assigned_technician_id = auth.uid()
    )
  );
  create policy variations_landlord_read on variations for select using (
    status in ('pending_landlord', 'approved', 'declined') and exists (
      select 1 from jobs j where j.id = variations.job_id and j.landlord_id = auth.uid()
    )
  );
  create policy variations_admin on variations for all using (is_admin());

  -- certifications & on-call: technician manages own; admin all; landlords have no access
  create policy certs_technician on technician_certifications for select using (technician_id = auth.uid());
  create policy certs_admin on technician_certifications for all using (is_admin());
  create policy oncall_technician on on_call_optins for all using (technician_id = auth.uid());
  create policy oncall_admin on on_call_optins for all using (is_admin());

  -- access_slots: admin only. Tenants use the token through an Edge Function (service role);
  -- deliberately no anon policy so tokens cannot be enumerated.
  create policy access_slots_admin on access_slots for all using (is_admin());

  -- time & materials: internal — technician own jobs + admin. Landlord role: NO policy = no access.
  create policy tm_technician on time_materials for all using (technician_id = auth.uid());
  create policy tm_admin on time_materials for all using (is_admin());

  -- invoices & ratings: landlord own; admin all
  create policy invoices_landlord on invoices for select using (
    exists (select 1 from jobs j where j.id = invoices.job_id and j.landlord_id = auth.uid())
  );
  create policy invoices_admin on invoices for all using (is_admin());
  create policy ratings_landlord on ratings for all using (landlord_id = auth.uid());
  create policy ratings_admin on ratings for all using (is_admin());
  create policy ratings_technician_read on ratings for select using (
    exists (select 1 from jobs j where j.id = ratings.job_id and j.assigned_technician_id = auth.uid())
  );

  -- Job photos bucket. Private: signed URLs / authenticated reads only.
  -- P0 policy is simple (any signed-in user, path convention job-photos/{job_id}/...);
  -- tightened to per-job path checks in hardening week 7.

  insert into storage.buckets (id, name, public)
  values ('job-photos', 'job-photos', false)
  on conflict (id) do nothing;

  create policy "job photos upload by signed-in users" on storage.objects
    for insert with check (bucket_id = 'job-photos' and auth.uid() is not null);

  create policy "job photos read by signed-in users" on storage.objects
    for select using (bucket_id = 'job-photos' and auth.uid() is not null);

  -- ========== Seed data ==========

  -- PropCare seed — rate card v0 (placeholder prices from design mockups).
  -- ⚠ Content dependency: real rate card v1 from CEO due build week 2 (PRD §9).
  -- Prices are data-only; swapping them touches no code.
  -- Demo users/properties/jobs are created via the app once auth exists (auth.users
  -- rows can't be seeded portably from SQL).

  insert into job_types (category, name, price_ex_vat, price_inc_vat, requires_certification) values
    -- Plumbing
    ('plumbing',  'Leaking / dripping tap',            150.00, 180.00, false),
    ('plumbing',  'Blocked drain / waste',             133.33, 160.00, false),
    ('plumbing',  'No hot water — diagnose & fix',     183.33, 220.00, false),
    ('plumbing',  'Replace isolator valve',             50.00,  60.00, false),
    ('plumbing',  'Toilet not flushing / running',     125.00, 150.00, false),
    ('plumbing',  'Radiator not heating',              100.00, 120.00, false),
    -- Electrical (NICEIC/NAPIT enforced by jobs_certification_check trigger)
    ('electrical', 'Socket not working',               116.67, 140.00, true),
    ('electrical', 'Light fitting replacement',        108.33, 130.00, true),
    ('electrical', 'Extractor fan install/replace',    133.33, 160.00, true),
    ('electrical', 'Consumer unit inspection',         150.00, 180.00, true),
    -- Handyman
    ('handyman',  'Sticking / misaligned door',         79.17,  95.00, false),
    ('handyman',  'Lock change',                        87.50, 105.00, false),
    ('handyman',  'Rehang door + new lock',            120.83, 145.00, false),
    ('handyman',  'Shelf / fixture mounting',           70.83,  85.00, false),
    ('handyman',  'Small repairs (up to 1h)',           79.17,  95.00, false);

  -- Global settings live in code/config for P0: out-of-hours multiplier = 1.75
