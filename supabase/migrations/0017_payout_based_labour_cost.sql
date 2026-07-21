-- Margin was costing labour the wrong way.
--
-- 0013 made labour_cost real by deriving on-site minutes from the job timeline
-- and multiplying by profiles.pay_rate_per_hour. Mechanically correct, but it
-- models an hourly employee. business/rate-card-v1.md:9 says what actually
-- happens: "Technician payout is 75% of the flat rate, so PropCare keeps 25%",
-- and every rate-card table carries a "Tech payout (@75%)" column. The
-- liability is a fixed share of the price and does not move with the clock --
-- which is the whole point of selling a flat rate.
--
-- The gap was large. On a £130 job with a £40/h technician who took an hour:
--   hourly basis:  130 - 40 (labour) - 25 (overhead) = £65 margin
--   payout basis:  130 - 97 (labour) - 25 (overhead) =  £8 margin
-- Admin -> Gate was reporting eight times the truth, and £8 is before Stripe's
-- ~£2.15. rate-card-v1.md:63 independently lands at ~£30 net per job before
-- overhead, which agrees with the payout basis, not the hourly one.
--
-- Derived minutes are kept, and become more useful than before: they no longer
-- decide cost, they reveal whether a flat rate was priced sensibly. A £95 line
-- that repeatedly takes three hours is paying its technician ~£24/h and needs
-- repricing -- exactly the signal a flat-rate business needs, now surfaced as
-- effective_hourly_rate.

-- =====================================================================
-- 1. The payout share becomes configuration, not a constant
-- =====================================================================

alter table pricing_settings
  add column if not exists technician_payout_rate numeric(4,3) not null default 0.750;

comment on column pricing_settings.technician_payout_rate is
  'Technician share of the flat rate (rate card v1: 0.750, PropCare keeps 25%). '
  'Gross, before the CIS deduction the payer remits -- CIS moves who receives '
  'the money, not what the job costs PropCare.';

-- =====================================================================
-- 2. job_margins: cost labour at the payout share
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
  coalesce(tm.minutes, lab.minutes, 0) as labour_minutes,
  (tm.minutes is null and coalesce(lab.minutes, 0) > 0) as labour_minutes_derived,
  -- the payout follows the price the landlord agreed, including any variation
  round(coalesce(j.agreed_price_inc_vat, 0) * s.technician_payout_rate, 2) as labour_cost,
  -- what that payout works out to per hour on site; null when no time is known.
  -- Compare against profiles.pay_rate_per_hour to spot underpriced lines.
  case when coalesce(tm.minutes, lab.minutes, 0) > 0
       then round(
              (coalesce(j.agreed_price_inc_vat, 0) * s.technician_payout_rate)
              / (coalesce(tm.minutes, lab.minutes) / 60.0), 2)
  end                                 as effective_hourly_rate,
  p.pay_rate_per_hour                 as benchmark_hourly_rate,
  coalesce(tm.materials, 0)           as materials_cost,
  s.platform_overhead_per_job         as overhead,
  (case when s.vat_registered
        then round(coalesce(j.agreed_price_inc_vat, 0) / (1 + s.vat_rate), 2)
        else coalesce(j.agreed_price_inc_vat, 0) end)
    - round(coalesce(j.agreed_price_inc_vat, 0) * s.technician_payout_rate, 2)
    - coalesce(tm.materials, 0)
    - s.platform_overhead_per_job     as margin,
  -- labour cost is now a function of the price, so it is unknown only when the
  -- price is. Time being unknown no longer invalidates margin; it just means we
  -- cannot judge whether the line was priced well.
  (j.agreed_price_inc_vat is null)     as price_unknown,
  (coalesce(tm.minutes, lab.minutes, 0) = 0) as time_unknown
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
  'landlord sees only their own rows and an admin sees all. Labour is the '
  'technician payout share of the agreed price; labour_minutes is retained to '
  'expose effective_hourly_rate, which tells you if a flat rate is too low.';

-- =====================================================================
-- 3. pilot_metrics: same basis
-- =====================================================================
-- jobs_missing_cost previously counted a missing pay rate, then (0013) a
-- missing rate OR missing time. Neither affects cost now: the only thing that
-- can make a completed job's margin unknowable is a missing price.

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
      j.agreed_price_inc_vat,
      (case when s.vat_registered
            then round(coalesce(j.agreed_price_inc_vat, 0) / (1 + s.vat_rate), 2)
            else coalesce(j.agreed_price_inc_vat, 0) end)
        - round(coalesce(j.agreed_price_inc_vat, 0) * s.technician_payout_rate, 2)
        - coalesce(tm.materials, 0)
        - s.platform_overhead_per_job as margin
    from jobs j
    cross join s
    left join lateral (
      select sum(t.cost) as materials
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
                       and coalesce(c.agreed_price_inc_vat, 0) = 0),
    (select count(*) from cohort where repeated),
    (select count(*) from cohort),
    case when (select count(*) from cohort) = 0 then 0
         else round(100.0 * (select count(*) from cohort where repeated)
                          / (select count(*) from cohort), 1) end
  from calc c;
end $$;

revoke all on function pilot_metrics() from public;
grant execute on function pilot_metrics() to authenticated;
