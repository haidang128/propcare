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
-- THREE RULES IN THE MARKDOWN THAT THE APP CANNOT YET HONOUR — see the report:
--   1. "Materials: cost + 10%, receipt photo required" — the invoice total is
--      hard-wired to jobs.agreed_price_inc_vat. time_materials never reaches it.
--      Until invoices carry line items, parts above the included allowance have
--      to go through the variation flow, or margin silently absorbs them.
--   2. "Access failure / no-show: £45 abort fee" — access_failed returns the job
--      to scheduled and charges nothing. There is no abort-fee path.
--   3. "Congestion/ULEZ: consider +£10 on zone 1/2 jobs" — properties have no
--      zone, so this cannot be priced per job without a schema change.

begin;

-- Retire the whole v0 placeholder card. Deactivating rather than deleting keeps
-- jobs.job_type_id intact for every historic job. ('No hot water — diagnose &
-- fix' stays retired: Gas Safe required, gas deferred per PRD decision #6.)
update job_types set active = false;

insert into job_types (category, name, price_ex_vat, price_inc_vat, requires_certification) values
  -- Plumbing
  ('plumbing',   'Dripping / leaking tap repair',        95,  95, false),
  ('plumbing',   'Tap replacement',                     120, 120, false),
  ('plumbing',   'Toilet not flushing / running',       110, 110, false),
  ('plumbing',   'Toilet unblock',                      130, 130, false),
  ('plumbing',   'Sink / bath / shower unblock',        105, 105, false),
  ('plumbing',   'Toilet replacement',                  220, 220, false),
  ('plumbing',   'Leak under sink',                     110, 110, false),
  ('plumbing',   'Radiator: bleed / valve replace',      95,  95, false),
  ('plumbing',   'Washing machine install / plumb',      95,  95, false),
  ('plumbing',   'Isolate + make safe (leak emergency)',110, 110, false),
  -- Handyman
  ('handyman',   'General handyman hour',                75,  75, false),
  ('handyman',   'Shelf / TV bracket mount',             85,  85, false),
  ('handyman',   'Internal door adjustment',             85,  85, false),
  ('handyman',   'Lock replacement',                     95,  95, false),
  ('handyman',   'Blinds / curtain rail fitting',        90,  90, false),
  ('handyman',   'Re-seal bath / shower silicone',       95,  95, false),
  ('handyman',   'Flat-pack assembly',                   75,  75, false),
  -- Electrical — NICEIC/NAPIT enforced by the jobs_certification_check trigger
  ('electrical', 'Socket replacement',                   85,  85, true),
  ('electrical', 'Light switch replacement',             80,  80, true),
  ('electrical', 'Light fitting replacement',            95,  95, true),
  ('electrical', 'Extractor fan replacement',           140, 140, true),
  ('electrical', 'Fault-find first hour',                95,  95, true),
  ('electrical', 'EICR (1–3 bed)',                      185, 185, true);

-- Call-out floor. Must come last: the trigger from migration 0009 validates
-- every active line against this value. £75 = the cheapest line on the card
-- (general handyman hour / flat-pack assembly).
update pricing_settings set minimum_job_inc_vat = 75, updated_at = now() where id;

commit;

-- Sanity checks — expect 23 active rows and zero floor violations.
select count(*) as active_lines from job_types where active;
select name, price_inc_vat
from job_types, pricing_settings
where job_types.active and job_types.price_inc_vat < pricing_settings.minimum_job_inc_vat;
