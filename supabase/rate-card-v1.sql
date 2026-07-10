-- Rate card v1 — APPLY ONLY AFTER CEO + TECHNICIAN SIGN-OFF.
--
-- Deliberately NOT a numbered migration: nothing should run this automatically.
-- This is the executable form of `business/rate-card-v1.md` — that document is
-- the source of truth for scope, benchmarks, technician payout and CIS handling.
-- If the two ever disagree, the markdown wins and this file is stale.
--
-- price_inc_vat is the only price the app shows: what the landlord pays.
-- price_ex_vat is bookkeeping and only becomes meaningful once
-- pricing_settings.vat_registered = true. While unregistered we keep the two
-- equal so no screen, invoice, or export can imply a tax split we don't charge.
-- (Compliance checklist: turnover is far below the £90k threshold; do not
-- register voluntarily; display no VAT line.)
--
-- Decisions taken during the 10/07 walkthrough:
--   * cost+10% materials is dropped. Every line is either parts-included or
--     landlord-supplies, so the flat price is genuinely flat and the invoice
--     (which can only carry one total) is always correct. Larger parts go
--     through the variation flow the landlord already has to approve.
--   * H1 "General handyman hour" repriced £75 -> £95 so it stops undercutting
--     H2/H3/H6. Its "then £45/half-hr" continuation becomes a variation, the
--     same pattern E5 already uses.
--   * Out-of-hours is now per job type (migration 0010). Only P10 is eligible.
--
-- STILL NOT HONOURED BY THE APP — handle these outside it for the pilot:
--   * "Access failure / no-show: £45 abort fee" — access_failed returns the job
--     to scheduled and charges nothing. Put it in the terms, collect manually.
--   * "Congestion/ULEZ: consider +£10 on zone 1/2 jobs" — properties have no
--     zone, so this cannot be priced per job without a schema change.

begin;

-- Retire the whole v0 placeholder card. Deactivating rather than deleting keeps
-- jobs.job_type_id intact for every historic job. ('No hot water — diagnose &
-- fix' stays retired: Gas Safe required, gas deferred per PRD decision #6.)
update job_types set active = false;

-- out_of_hours_eligible: emergency lines only. Everything else is weekday work,
-- and a 1.75x surcharge on a flat-pack assembly is not a product.
insert into job_types (category, name, price_ex_vat, price_inc_vat, requires_certification, out_of_hours_eligible) values
  -- Plumbing
  ('plumbing',   'Dripping / leaking tap repair',        95,  95, false, false),
  ('plumbing',   'Tap replacement',                     120, 120, false, false), -- landlord supplies the tap
  ('plumbing',   'Toilet not flushing / running',       110, 110, false, false),
  ('plumbing',   'Toilet unblock',                      130, 130, false, false),
  ('plumbing',   'Sink / bath / shower unblock',        105, 105, false, false),
  ('plumbing',   'Toilet replacement',                  220, 220, false, false), -- landlord supplies the WC unit
  ('plumbing',   'Leak under sink',                     110, 110, false, false),
  ('plumbing',   'Radiator: bleed / valve replace',      95,  95, false, false),
  ('plumbing',   'Washing machine install / plumb',      95,  95, false, false),
  ('plumbing',   'Isolate + make safe (leak emergency)',110, 110, false, true),  -- the only OOH line
  -- Handyman
  ('handyman',   'General handyman hour',                95,  95, false, false), -- was £75; continuation = variation
  ('handyman',   'Shelf / TV bracket mount',             85,  85, false, false),
  ('handyman',   'Internal door adjustment',             85,  85, false, false),
  ('handyman',   'Lock replacement',                     95,  95, false, false), -- landlord supplies the cylinder
  ('handyman',   'Blinds / curtain rail fitting',        90,  90, false, false),
  ('handyman',   'Re-seal bath / shower silicone',       95,  95, false, false),
  ('handyman',   'Flat-pack assembly',                   75,  75, false, false),
  -- Electrical — NICEIC/NAPIT enforced by the jobs_certification_check trigger
  ('electrical', 'Socket replacement',                   85,  85, true,  false),
  ('electrical', 'Light switch replacement',             80,  80, true,  false),
  ('electrical', 'Light fitting replacement',            95,  95, true,  false), -- landlord supplies the fitting
  ('electrical', 'Extractor fan replacement',           140, 140, true,  false),
  ('electrical', 'Fault-find first hour',                95,  95, true,  false),
  ('electrical', 'EICR (1–3 bed)',                      185, 185, true,  false);

-- Call-out floor. Must come last: the trigger from migration 0009 validates
-- every active line against this value. £75 = the cheapest line on the card
-- (flat-pack assembly).
update pricing_settings set minimum_job_inc_vat = 75, updated_at = now() where id;

commit;

-- Sanity checks — expect 23 active rows and zero floor violations.
select count(*) as active_lines from job_types where active;
select name, price_inc_vat
from job_types, pricing_settings
where job_types.active and job_types.price_inc_vat < pricing_settings.minimum_job_inc_vat;
