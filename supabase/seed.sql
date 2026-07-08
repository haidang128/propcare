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
