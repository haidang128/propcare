-- Week 9 hardening: stop trusting client-supplied values.
--
-- Audit (21/07/2026) found four exploitable holes, all the same shape: a column
-- the client sends is used as-is because RLS can only say "which rows", never
-- "which values". Each was confirmed against production with a throwaway
-- self-serve landlord account before this migration was written:
--
--   * a £180 job inserted with agreed_price_inc_vat = 0.50, then self-advanced
--     requested -> priced -> approved with the landlord's own JWT;
--   * an electrical job_type inserted with category = 'handyman', which dodges
--     the NICEIC/NAPIT certification gate because that gate keys off category
--     (safety issue, not just money);
--   * storage.objects on job-photos readable by ANY signed-in user, so one
--     self-serve sign-up enumerates every tenant's home photos;
--   * transition_job has no role guard on ('completed','paid'), so a landlord
--     can mark their own finished job paid without money moving.
--
-- The fix throughout is to derive the value server-side, or reject it, rather
-- than validate what arrives. Service-role callers (auth.uid() is null) are
-- exempt everywhere: Edge Functions and the Stripe webhook are trusted.

-- =====================================================================
-- 1. Jobs: derive price, category and lifecycle columns server-side
-- =====================================================================

create or replace function guard_job_insert() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_type job_types;
  v_settings pricing_settings;
  v_base numeric(10,2);
begin
  -- service role (Edge Functions, seeds) and admins are trusted
  if auth.uid() is null or is_admin() then
    return new;
  end if;

  -- a landlord-created job is always a fresh request: never pre-assigned,
  -- never pre-scheduled, never already priced-and-approved
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

  -- mirrors jobPrice() in propcare/src/lib/data.ts; the client's number is advisory
  v_base := greatest(v_type.price_inc_vat, coalesce(v_settings.minimum_job_inc_vat, 0));
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
  'Landlord-supplied price, category and lifecycle columns are overwritten from the rate card. RLS cannot constrain columns, only rows.';

-- runs before jobs_ooh_eligibility (0010) alphabetically, so that trigger
-- validates the normalised row
create trigger jobs_guard_insert before insert on jobs
  for each row execute function guard_job_insert();

-- =====================================================================
-- 2. transition_job: role guards on the remaining money/lifecycle edges
-- =====================================================================

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
    raise exception 'only admin can schedule';
  end if;
  if p_to = 'approved' and v_role <> 'landlord' and v_role <> 'admin' then
    raise exception 'only the landlord approves the price';
  end if;
  if p_to = 'approved' and v_role = 'admin' and coalesce(p_note, '') = '' then
    raise exception 'admin override approval requires a reason note';
  end if;

  -- Money only ever settles through Stripe. The webhook runs as service role
  -- and updates jobs directly, so nothing legitimate reaches this RPC with
  -- 'paid' except an admin correcting a record by hand.
  if p_to = 'paid' and v_role <> 'admin' then
    raise exception 'payment is confirmed by Stripe, not by hand';
  end if;

  -- only the technician on site (or admin) reports the work finished
  if p_to = 'completed' and v_role <> 'admin'
     and v_job.assigned_technician_id is distinct from auth.uid() then
    raise exception 'only the assigned technician can complete the job';
  end if;

  -- disputes are the landlord's remedy
  if p_to = 'disputed' and v_role <> 'admin' and v_job.landlord_id is distinct from auth.uid() then
    raise exception 'only the landlord can dispute the job';
  end if;

  -- a landlord may call off a job the technician has not started; once work is
  -- under way, cancelling is an office decision (it decides who pays for what)
  if p_to = 'cancelled'
     and v_job.status in ('scheduled', 'in_progress', 'variation_pending', 'awaiting_parts')
     and v_role <> 'admin' then
    raise exception 'cancelling work already under way is an office decision';
  end if;

  -- starting, pausing and resuming belong to the technician on site
  if p_to in ('in_progress', 'awaiting_parts', 'access_failed', 'variation_pending')
     and v_role <> 'admin'
     and v_job.assigned_technician_id is distinct from auth.uid() then
    raise exception 'only the assigned technician can report on-site progress';
  end if;

  update jobs set status = p_to,
    completed_at = case when p_to = 'completed' then now() else completed_at end
    where id = p_job_id
    returning * into v_job;

  insert into job_events (job_id, from_status, to_status, actor_id, note)
    values (p_job_id, v_from, p_to, auth.uid(), p_note);

  return v_job;
end $$;

-- =====================================================================
-- 3. Storage: job photos are visible to that job's parties only
-- =====================================================================
-- Path convention is '{job_id}/{kind}-{timestamp}.jpg' (uploadJobPhoto in
-- data.ts), so the first folder segment identifies the job. Compared as text
-- to avoid a cast error on any stray non-uuid path.

drop policy if exists "job photos upload by signed-in users" on storage.objects;
drop policy if exists "job photos read by signed-in users" on storage.objects;

create policy "job photos read by job parties" on storage.objects
  for select using (
    bucket_id = 'job-photos' and exists (
      select 1 from jobs j
      where j.id::text = (storage.foldername(name))[1]
        and (is_admin() or j.landlord_id = auth.uid() or j.assigned_technician_id = auth.uid())
    )
  );

create policy "job photos upload by job parties" on storage.objects
  for insert with check (
    bucket_id = 'job-photos' and exists (
      select 1 from jobs j
      where j.id::text = (storage.foldername(name))[1]
        and (is_admin() or j.landlord_id = auth.uid() or j.assigned_technician_id = auth.uid())
    )
  );

-- =====================================================================
-- 4. Variations: the technician flags, the office prices
-- =====================================================================
-- The landlord's approval screen renders "was X, now X+Y" from columns the
-- technician supplied, so a technician could inflate the "was" figure and have
-- the landlord approve a much larger number.

create or replace function guard_variation_insert() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_job jobs;
begin
  if auth.uid() is null or is_admin() then
    return new;
  end if;

  select * into v_job from jobs where id = new.job_id;
  if v_job.id is null then
    raise exception 'job not found';
  end if;

  -- a technician-raised variation always starts in the office queue, unpriced
  new.status := 'flagged';
  new.admin_price_inc_vat := null;
  new.new_job_price_inc_vat := null;
  new.decided_by := null;
  new.decided_at := null;
  -- the "was" price comes from the job, never from the client
  new.old_job_price_inc_vat := coalesce(v_job.agreed_price_inc_vat, 0);

  return new;
end $$;

create trigger variations_guard_insert before insert on variations
  for each row execute function guard_variation_insert();

-- Only the office may move a variation on, or set the price the landlord sees.
create or replace function guard_variation_update() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or is_admin() then
    return new;
  end if;
  if new.admin_price_inc_vat is distinct from old.admin_price_inc_vat
     or new.old_job_price_inc_vat is distinct from old.old_job_price_inc_vat
     or new.status is distinct from old.status then
    raise exception 'variation pricing and status are set by the office';
  end if;
  return new;
end $$;

create trigger variations_guard_update before update on variations
  for each row execute function guard_variation_update();

-- decide_variation trusted variations.old_job_price_inc_vat; take the live job
-- price instead so the approved figure cannot be pre-loaded.
create or replace function decide_variation(p_variation_id uuid, p_approve boolean, p_note text default null)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v variations;
  v_job jobs;
  v_new_price numeric(10,2);
begin
  select * into v from variations where id = p_variation_id for update;
  if v.id is null then
    raise exception 'variation not found';
  end if;
  select * into v_job from jobs where id = v.job_id for update;
  if v_job.landlord_id is distinct from auth.uid() then
    raise exception 'only the landlord can decide this variation';
  end if;
  if v.status <> 'pending_landlord' then
    raise exception 'variation is not awaiting a decision';
  end if;
  if p_approve and v.admin_price_inc_vat is null then
    raise exception 'variation has no admin price';
  end if;

  if p_approve then
    -- from the job, not from the variation row
    v_new_price := coalesce(v_job.agreed_price_inc_vat, 0) + v.admin_price_inc_vat;
    update variations
      set status = 'approved', decided_by = auth.uid(), decided_at = now(),
          old_job_price_inc_vat = coalesce(v_job.agreed_price_inc_vat, 0),
          new_job_price_inc_vat = v_new_price
      where id = p_variation_id;
    update jobs set agreed_price_inc_vat = v_new_price where id = v.job_id;
    if v_job.status = 'variation_pending' then
      update jobs set status = 'in_progress' where id = v.job_id;
      insert into job_events (job_id, from_status, to_status, actor_id, note)
        values (v.job_id, 'variation_pending', 'in_progress', auth.uid(),
                coalesce(p_note, 'Variation approved — new fixed price £' || v_new_price::text));
    end if;
  else
    update variations
      set status = 'declined', decided_by = auth.uid(), decided_at = now()
      where id = p_variation_id;
    insert into job_events (job_id, from_status, to_status, actor_id, note)
      values (v.job_id, v_job.status, v_job.status, auth.uid(),
              coalesce(p_note, 'Variation declined — office to rearrange or cancel (no charge)'));
  end if;
end $$;

-- =====================================================================
-- 5. profiles.pay_rate_per_hour is a cost input — admin only
-- =====================================================================
-- Same class as the role hole 0009 closed: guard_profile_role covers only the
-- role column, and pay_rate_per_hour was added to profiles in that same
-- migration. A technician could set their own rate and distort job_margins.

create or replace function guard_profile_pay_rate() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.pay_rate_per_hour is distinct from old.pay_rate_per_hour
     and auth.uid() is not null and not is_admin() then
    raise exception 'pay rate changes require an admin';
  end if;
  return new;
end $$;

create trigger profiles_guard_pay_rate before update of pay_rate_per_hour on profiles
  for each row execute function guard_profile_pay_rate();

-- =====================================================================
-- 6. ratings: one landlord cannot squat another landlord's job
-- =====================================================================
-- ratings.job_id is UNIQUE, so writing a row against someone else's job both
-- libels the technician and blocks the real landlord from ever rating it.

drop policy if exists ratings_landlord on ratings;
create policy ratings_landlord on ratings for all
  using (
    landlord_id = auth.uid()
    and exists (select 1 from jobs j where j.id = ratings.job_id and j.landlord_id = auth.uid())
  )
  with check (
    landlord_id = auth.uid()
    and exists (select 1 from jobs j where j.id = ratings.job_id and j.landlord_id = auth.uid())
  );
