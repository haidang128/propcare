-- Week 9: rate-card integrity, VAT-conditional pricing, per-job margin
-- instrumentation, and a fix for profile role self-promotion.

-- =====================================================================
-- 1. Security: profiles role self-promotion
-- =====================================================================
-- profiles_update_own carried no WITH CHECK, and RLS cannot restrict individual
-- columns, so any landlord could PATCH their own row to role='admin' and then
-- read and write every job in the system. Confirmed against the live database.
-- A column-level trigger is the fix: RLS still decides which rows you may touch,
-- the trigger decides whether the role column may change.

create or replace function guard_profile_role() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.role is distinct from old.role
     -- service-role callers carry no JWT; they administer roles out of band
     and auth.uid() is not null
     and not is_admin() then
    raise exception 'role changes require an admin';
  end if;
  return new;
end $$;

create trigger profiles_guard_role before update of role on profiles
  for each row execute function guard_profile_role();

drop policy profiles_update_own on profiles;
create policy profiles_update_own on profiles for update
  using (id = auth.uid()) with check (id = auth.uid());

-- =====================================================================
-- 2. Pricing settings (single row)
-- =====================================================================
create table pricing_settings (
  id boolean primary key default true check (id),
  vat_registered boolean not null default false,
  vat_rate numeric(4,3) not null default 0.200,
  out_of_hours_multiplier numeric(4,2) not null default 1.75,
  minimum_job_inc_vat numeric(10,2) not null default 0,
  platform_overhead_per_job numeric(10,2) not null default 0,
  updated_at timestamptz not null default now()
);

comment on column pricing_settings.vat_registered is
  'PRD section 9 open item. Stays false until HMRC registration is confirmed: '
  'below the threshold no VAT may be charged, shown, or itemised on an invoice.';
comment on column pricing_settings.minimum_job_inc_vat is
  'Call-out floor. No active job type may be priced below it. 0 disables the check.';

insert into pricing_settings (id) values (true) on conflict do nothing;

alter table pricing_settings enable row level security;
create policy pricing_settings_read on pricing_settings for select using (auth.uid() is not null);
create policy pricing_settings_admin on pricing_settings for all using (is_admin());

-- =====================================================================
-- 3. Rate-card integrity
-- =====================================================================
-- Gas/boiler work is deferred until Gas Safe vetting exists (PRD decision #6),
-- and "no hot water" is a boiler fault in most flats. Selling it at a flat rate
-- commits a pool of non-Gas-Safe plumbers to a job they may not legally do.
update job_types set active = false where name = 'No hot water — diagnose & fix';

create or replace function enforce_min_job_price() returns trigger
language plpgsql set search_path = public as $$
declare floor_price numeric;
begin
  select minimum_job_inc_vat into floor_price from pricing_settings where id;
  if new.active and coalesce(floor_price, 0) > 0 and new.price_inc_vat < floor_price then
    raise exception 'price_inc_vat % is below the call-out floor of %',
      new.price_inc_vat, floor_price;
  end if;
  return new;
end $$;

create trigger job_types_min_price before insert or update on job_types
  for each row execute function enforce_min_job_price();

-- =====================================================================
-- 4. Margin instrumentation
-- =====================================================================
-- The 90-day gate (PRD section 2) requires "per-job margin, positive after
-- technician cost + platform overhead". Nothing captured technician cost, and
-- time_materials was written but never read by anything downstream.

alter table profiles add column if not exists pay_rate_per_hour numeric(10,2);
comment on column profiles.pay_rate_per_hour is
  'CIS subcontractor cost per hour. Drives per-job labour cost in job_margins.';

create or replace view job_margins with (security_invoker = true) as
select
  j.id                                as job_id,
  j.reference,
  j.status,
  j.created_at,
  j.completed_at,
  j.landlord_id,
  j.assigned_technician_id,
  coalesce(j.agreed_price_inc_vat, 0) as gross,
  case when s.vat_registered
       then round(coalesce(j.agreed_price_inc_vat, 0) / (1 + s.vat_rate), 2)
       else coalesce(j.agreed_price_inc_vat, 0)
  end                                 as net_revenue,
  coalesce(tm.minutes, 0)             as labour_minutes,
  round(coalesce(tm.minutes, 0) / 60.0 * coalesce(p.pay_rate_per_hour, 0), 2) as labour_cost,
  coalesce(tm.materials, 0)           as materials_cost,
  s.platform_overhead_per_job         as overhead,
  (case when s.vat_registered
        then round(coalesce(j.agreed_price_inc_vat, 0) / (1 + s.vat_rate), 2)
        else coalesce(j.agreed_price_inc_vat, 0) end)
    - round(coalesce(tm.minutes, 0) / 60.0 * coalesce(p.pay_rate_per_hour, 0), 2)
    - coalesce(tm.materials, 0)
    - s.platform_overhead_per_job     as margin,
  (p.pay_rate_per_hour is null)       as missing_pay_rate
from jobs j
cross join pricing_settings s
left join profiles p on p.id = j.assigned_technician_id
left join lateral (
  select sum(t.minutes) as minutes, sum(t.cost) as materials
  from time_materials t where t.job_id = j.id
) tm on true;

comment on view job_margins is
  'Per-job unit economics. security_invoker: RLS on jobs still applies, so a '
  'landlord sees only their own rows and an admin sees all.';

-- Gate + leading indicators in one admin-only call.
create or replace function pilot_metrics()
returns table (
  completed_jobs     bigint,
  total_jobs         bigint,
  variation_jobs     bigint,
  variation_rate     numeric,
  total_margin       numeric,
  avg_margin         numeric,
  jobs_missing_cost  bigint,
  repeat_landlords   bigint,
  cohort_landlords   bigint,
  repeat_rate        numeric
) language plpgsql security definer set search_path = public as $$
declare v_jobs bigint;
begin
  if not is_admin() then
    raise exception 'pilot_metrics is admin only';
  end if;

  select count(distinct v.job_id) into v_jobs from variations v;

  return query
  with s as (select * from pricing_settings where id),
  calc as (
    select
      j.status,
      j.landlord_id,
      p.pay_rate_per_hour,
      (case when s.vat_registered
            then round(coalesce(j.agreed_price_inc_vat, 0) / (1 + s.vat_rate), 2)
            else coalesce(j.agreed_price_inc_vat, 0) end)
        - round(coalesce(tm.minutes, 0) / 60.0 * coalesce(p.pay_rate_per_hour, 0), 2)
        - coalesce(tm.materials, 0)
        - s.platform_overhead_per_job as margin
    from jobs j
    cross join s
    left join profiles p on p.id = j.assigned_technician_id
    left join lateral (
      select sum(t.minutes) as minutes, sum(t.cost) as materials
      from time_materials t where t.job_id = j.id
    ) tm on true
  ),
  -- Cohort definition: of landlords whose first job is at least 30 days old,
  -- how many booked again within 30 days of that first job.
  cohort as (
    select f.landlord_id,
      exists (
        select 1 from jobs j2
        where j2.landlord_id = f.landlord_id
          and j2.created_at > f.first_at
          and j2.created_at <= f.first_at + interval '30 days'
      ) as repeated
    from (select landlord_id, min(created_at) as first_at from jobs group by landlord_id) f
    where f.first_at <= now() - interval '30 days'
  )
  select
    count(*) filter (where c.status in ('completed', 'paid')),
    count(*),
    v_jobs,
    case when count(*) = 0 then 0
         else round(100.0 * v_jobs / count(*), 1) end,
    coalesce(sum(c.margin) filter (where c.status in ('completed', 'paid')), 0),
    coalesce(round(avg(c.margin) filter (where c.status in ('completed', 'paid')), 2), 0),
    count(*) filter (where c.status in ('completed', 'paid') and c.pay_rate_per_hour is null),
    (select count(*) from cohort where repeated),
    (select count(*) from cohort),
    case when (select count(*) from cohort) = 0 then 0
         else round(100.0 * (select count(*) from cohort where repeated)
                          / (select count(*) from cohort), 1) end
  from calc c;
end $$;

revoke all on function pilot_metrics() from public;
grant execute on function pilot_metrics() to authenticated;
