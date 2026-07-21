-- Set the per-job platform overhead so Admin -> Gate stops reporting margin
-- that has not paid for the business around the job.
--
-- Formula is the one in business/rate-card-v1.md:
--   platform_overhead_per_job = (insurance + accountant + infra)
--                               / expected jobs in 90 days
--
-- CEO chose the running-costs basis on 21/07/2026:
--
--   Public liability insurance (~£65/mo, £1-2m, dispatch model)      ~£200
--   Accountant (CIS monthly returns + year end, ~£125/mo)            ~£375
--   Infra: Supabase, Expo, Twilio, domain (~£58/mo)                  ~£175
--                                                                   ------
--   One quarter                                                      ~£750
--   / 30 jobs (the 90-day gate target)                          =  £25/job
--
-- What this does to the gate: the rate card's worked example nets ~£30 per job
-- before overhead, so real margin lands near ~£5/job, or ~£150 across the 30
-- gate jobs rather than ~£900. That is the point of the number.
--
-- TWO CAVEATS, both deliberate, both still flattering the figure:
--
--   1. These are ESTIMATES. launch-compliance-checklist.md still has "request 3
--      public liability quotes" open, so the insurance line is a placeholder.
--      Revisit once quotes are bound.
--   2. It EXCLUDES the CEO's own ~30 min of dispatch per job, which
--      rate-card-v1.md:65 calls out explicitly. Costed at £20/h that is another
--      £10/job and would put per-job margin at roughly -£5. Margin here is
--      therefore still better than the business actually earns, by about the
--      value of the founder's time.
--
-- The denominator is the gate TARGET, not actual volume. If 90-day volume comes
-- in under 30 jobs the true per-job overhead is higher, because these costs are
-- fixed and do not scale down.

update pricing_settings
  set platform_overhead_per_job = 25,
      updated_at = now()
  where id;

comment on column pricing_settings.platform_overhead_per_job is
  'Fixed business cost apportioned to each job: (insurance + accountant + infra) '
  '/ expected 90-day job count. Excludes founder dispatch time, so margin is '
  'still optimistic by roughly that hourly value. Re-derive when insurance '
  'quotes are bound or expected volume changes.';
