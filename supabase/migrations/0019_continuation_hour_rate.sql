-- Continuation hours cost less than the first one. CEO decision, 23/07/2026.
--
-- 0018 made the hourly lines (H1 general handyman hour, E5 fault-find first
-- hour) sellable by the hour, but left every hour at the first hour's price.
-- £95 for a fourth consecutive hour is well above the London market — the rate
-- card's own benchmark for H1 is £45–£70/hr — so a two-hour job priced itself
-- out of the market it was written for.
--
-- The first hour stays £95 because it carries the call-out: travel, parking,
-- the trip itself. Hours after it carry only the technician's time, so £70.
--
-- Margin still works, and improves with length. At the 75% payout and £25
-- platform overhead per job:
--     1 hour   £95   payout £71.25   margin  -£1.25   (underwater, as before)
--     2 hours  £165  payout £123.75  margin  £16.25
--     3 hours  £235  payout £176.25  margin  £33.75
-- Overhead is per job, not per hour, so every extra hour adds a clean 25%.
--
-- The call-out floor deliberately does not apply here: enforce_min_job_price
-- guards price_inc_vat, the first hour, which is the call-out. A continuation
-- hour is not a second call-out.

update job_types
  set additional_unit_price_inc_vat = 70.00
  where active and unit = 'hour';

comment on column job_types.additional_unit_price_inc_vat is
  'Price of each hour after the first (£70 as of 0019). The first hour carries the call-out; later hours carry only time. NULL means charge the first hour price again.';
