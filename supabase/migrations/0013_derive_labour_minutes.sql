-- Week 9: make the 90-day gate's margin figure real.
--
-- job_margins.labour_cost was minutes/60 * pay_rate_per_hour, but NOTHING ever
-- wrote time_materials.minutes: the only writer is MaterialsLog in
-- (technician)/job/[id].tsx, whose onAdd takes (description, cost) only. So
-- labour_minutes was always 0, labour_cost was always 0, and every margin
-- reported by Admin -> Gate was gross revenue minus materials and overhead --
-- the technician's time, the single largest cost in the business, was free.
--
-- Worse, the "margin is overstated" warning keyed on `pay_rate_per_hour is
-- null`, so the moment an admin filled in a technician's pay rate the warning
-- disappeared while the number stayed just as wrong. That is a go/no-go gate
-- you could pass on a number that was never earned.
--
-- Rather than add a "minutes" field for technicians to fill in -- more friction
-- on site, easily forgotten, and self-reported by the person being paid for it
-- -- derive the time from the job's own event timeline. transition_job already
-- writes a job_events row for every status change, so the clock is already
-- running: a job accrues labour while it sits in 'in_progress', and stops
-- while it is paused in 'awaiting_parts' or waiting on a variation decision.

create or replace view job_labour as
select
  e.job_id,
  greatest(
    round(sum(extract(epoch from (e.next_at - e.created_at)) / 60.0)
          filter (where e.to_status = 'in_progress'))::int,
    0
  ) as minutes
from (
  select
    job_id,
    to_status,
    created_at,
    lead(created_at) over (partition by job_id order by created_at) as next_at
  from job_events
) e
group by e.job_id;

alter view job_labour set (security_invoker = true);

comment on view job_labour is
  'On-site minutes per job, summed from the time the job spent in in_progress '
  'in job_events. Paused states (awaiting_parts, variation_pending) do not '
  'accrue, and a job still in progress contributes nothing until it moves on.';

-- =====================================================================
-- job_margins: prefer explicitly logged minutes, fall back to derived
-- =====================================================================

drop view if exists job_margins;

create view job_margins
with (security_invoker = true) as
select
  j.id as job_id,
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
  -- logged minutes win when present; otherwise the timeline is the source
  coalesce(tm.minutes, lab.minutes, 0) as labour_minutes,
  (tm.minutes is null and coalesce(lab.minutes, 0) > 0) as labour_minutes_derived,
  round(coalesce(tm.minutes, lab.minutes, 0) / 60.0 * coalesce(p.pay_rate_per_hour, 0), 2) as labour_cost,
  coalesce(tm.materials, 0)           as materials_cost,
  s.platform_overhead_per_job         as overhead,
  (case when s.vat_registered
        then round(coalesce(j.agreed_price_inc_vat, 0) / (1 + s.vat_rate), 2)
        else coalesce(j.agreed_price_inc_vat, 0) end)
    - round(coalesce(tm.minutes, lab.minutes, 0) / 60.0 * coalesce(p.pay_rate_per_hour, 0), 2)
    - coalesce(tm.materials, 0)
    - s.platform_overhead_per_job     as margin,
  (p.pay_rate_per_hour is null)       as missing_pay_rate,
  -- the number is only trustworthy when we know BOTH the rate and the time
  (p.pay_rate_per_hour is null or coalesce(tm.minutes, lab.minutes, 0) = 0) as labour_cost_unknown
from jobs j
cross join pricing_settings s
left join profiles p on p.id = j.assigned_technician_id
left join job_labour lab on lab.job_id = j.id
left join lateral (
  select sum(t.minutes) as minutes, sum(t.cost) as materials
  from time_materials t where t.job_id = j.id
) tm on true;

comment on view job_margins is
  'Per-job unit economics. security_invoker: RLS on jobs still applies, so a '
  'landlord sees only their own rows and an admin sees all. labour_minutes '
  'falls back to the job_events timeline when nothing was logged by hand.';

-- =====================================================================
-- pilot_metrics: same fallback, and an honest "unknown cost" count
-- =====================================================================
-- jobs_missing_cost previously counted only a null pay rate. It now counts any
-- completed job whose labour cost cannot be established -- no rate OR no time --
-- so filling in a pay rate can no longer silence the warning on its own.

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
      coalesce(tm.minutes, lab.minutes, 0) as labour_minutes,
      (case when s.vat_registered
            then round(coalesce(j.agreed_price_inc_vat, 0) / (1 + s.vat_rate), 2)
            else coalesce(j.agreed_price_inc_vat, 0) end)
        - round(coalesce(tm.minutes, lab.minutes, 0) / 60.0 * coalesce(p.pay_rate_per_hour, 0), 2)
        - coalesce(tm.materials, 0)
        - s.platform_overhead_per_job as margin
    from jobs j
    cross join s
    left join profiles p on p.id = j.assigned_technician_id
    left join job_labour lab on lab.job_id = j.id
    left join lateral (
      select sum(t.minutes) as minutes, sum(t.cost) as materials
      from time_materials t where t.job_id = j.id
    ) tm on true
  ),
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
    count(*) filter (where c.status in ('completed', 'paid')
                       and (c.pay_rate_per_hour is null or c.labour_minutes = 0)),
    (select count(*) from cohort where repeated),
    (select count(*) from cohort),
    case when (select count(*) from cohort) = 0 then 0
         else round(100.0 * (select count(*) from cohort where repeated)
                          / (select count(*) from cohort), 1) end
  from calc c;
end $$;

revoke all on function pilot_metrics() from public;
grant execute on function pilot_metrics() to authenticated;
