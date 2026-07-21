-- Rate card v1 goes live. CEO instructed this on 21/07/2026.
--
-- Executable form of business/rate-card-v1.md, which remains the source of
-- truth for scope, London benchmarks, the 75% technician payout and CIS
-- handling. The body below was generated from supabase/rate-card-v1.sql rather
-- than retyped, so the 23 prices cannot drift in transcription.
--
-- What this replaces: prod was still serving the v0 placeholder seed from the
-- design mockups. Three problems with it, all fixed here:
--   * every v0 row carried a fake 20% VAT split (e.g. 50.00 ex / 60.00 inc)
--     while pricing_settings.vat_registered is false. We are under the £90k
--     threshold and charge no VAT, so v1 keeps ex = inc on every line and no
--     screen, invoice or export can imply a tax split we do not charge.
--   * not one v0 row had out_of_hours_eligible, so canBookOutOfHours() was
--     false everywhere and the whole emergency tier -- the 1.75x surcharge,
--     the OOH booking path, the fallback screen -- was unreachable. v1 makes
--     exactly one line eligible: 'Isolate + make safe (leak emergency)'.
--   * v0 prices were mockup placeholders (£180 for a leaking tap against v1's
--     £95, £150 for a running toilet against £110).
--
-- v0 rows are deactivated, never deleted: jobs.job_type_id still points at them
-- for historic work. Two names appear on both cards, so those exist twice --
-- once retired, once live. job_types has no unique constraint on name and the
-- app filters on active, so only the v1 row is reachable.
--
-- Already-booked jobs are unaffected: every job carries its own
-- agreed_price_inc_vat snapshot, which is never recomputed from the card.
--
-- The floor update must stay last. enforce_min_job_price (0009) only rejects
-- rows where NEW.active, so deactivating v0 lines priced below £75 is fine,
-- and every v1 line is >= £75 (flat-pack assembly, the cheapest).

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
