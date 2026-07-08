# PropCare — P0 Implementation Plan

Draft v1 — 05/07/2026 · CEO (Hai) + Claude Code · Target: launchable P0 in 6–8 weeks part-time, then ~2 weeks store review. Scope is frozen to PRD §6 P0; anything else waits for the 90-day gate.

---

## 1. Architecture (per PRD §7)

| Layer | Choice | Notes |
|---|---|---|
| App | **Expo (React Native) universal** — one codebase for iOS / Android / web | Expo Router for navigation; EAS Build + Submit |
| Backend | **Supabase** — Postgres, Auth, Storage, Realtime | RLS is the security boundary; free tier for pilot |
| Server logic | **Supabase Edge Functions** | Stripe webhooks, SMS dispatch, auto-capture job, tenant link tokens |
| Payments | **Stripe** — invoices + payment links | Auto-capture 72h after completion if no dispute |
| Notifications | Expo Push + email (Resend) + SMS (Twilio, tenant links only) | Push/email on every status change |

One app, three role surfaces: the landlord and technician surfaces are route groups in the same Expo app gated by role; the admin dashboard is the same codebase's web build (desktop layout); the tenant slot picker is a public web route with token auth, no account.

## 2. Data model (Postgres)

Core tables (all with `created_at`, RLS on):

- **profiles** — `id (auth.users)`, `role: landlord | technician | admin`, name, phone
- **properties** — landlord_id, address fields, postcode, `tenant_name`, `tenant_phone` (access contact only)
- **job_types** (rate card) — category (`plumbing | electrical | handyman`), name, price_ex_vat, price_inc_vat, active, `requires_certification` flag; **rate_card_versions** so already-priced jobs keep their price
- **jobs** — property_id, landlord_id, job_type_id, description, urgency (`standard | out_of_hours`), status (enum below), agreed_price (snapshot, never recomputed), assigned_technician_id, scheduled_slot
- **job_events** — job_id, from_status, to_status, actor_id, reason — the audit trail and the status timeline's data source
- **job_photos** — job_id, kind (`request | before | after | variation`), storage_path
- **variations** — job_id, technician note, photos, suggested_price, admin_price, status (`flagged | admin_review | pending_landlord | approved | declined`), full price history
- **technician_certifications** — technician_id, type (`NICEIC | NAPIT | WRAS | insurance | ...`), reference, expiry_date — expiry drives assignment blocking
- **on_call_optins** — technician_id, active window
- **access_slots** — job_id, offered slots, chosen_slot, `token` (single-use, expiring) for the no-login tenant link
- **time_materials** — job_id, minutes, material lines (internal only — never exposed to landlord role)
- **invoices** — job_id, number, total, stripe_payment_link, status (`sent | paid | auto_captured | disputed`), capture_deadline
- **ratings** — job_id, stars 1–5, comment

**Job status enum** (PRD lifecycle): `requested → priced → approved → scheduled → in_progress → completed → paid`, plus `variation_pending`, `cancelled`, `declined`, `access_failed`, `awaiting_parts`, `rescheduled`, `disputed`. Transitions enforced in a single Postgres function (`transition_job()`) so every change writes a `job_events` row and illegal transitions are impossible — this is also what fires notifications.

**RLS policy sketch** (acceptance criterion: verified by tests):
- Landlord: rows where `landlord_id = auth.uid()` (properties, jobs, invoices, ratings); no access to time_materials.
- Technician: jobs where `assigned_technician_id = auth.uid()`; own certifications/opt-ins; time_materials for own jobs.
- Admin: role-gated full access.
- Tenant link: no Supabase auth — an Edge Function validates the `access_slots.token` and exposes only slot data + technician first name/photo.

## 3. Build sequence — 8 weekly milestones

Each milestone ends with something demoable. Order front-loads the riskiest integrations (payments is week 5, not week 8) and matches the PRD's open-item deadlines.

### Week 0 (now) — decisions & fixes *(no code)*
- Apply the 5 design fixes in `DESIGN-FIXES.md`; CEO decides the **declined-variation policy** (drives state machine + copy).
- CEO starts the launch blockers that have lead time: insurance, GDPR privacy policy, VAT decision (§9 PRD).

### Week 1 — foundation
- Init Expo app (Router, TypeScript), monorepo layout, design tokens from `01 Design System` (colours, type scale, spacing, status-chip + timeline + price components as the first shared components).
- Supabase project: schema above, RLS policies, `transition_job()`, seed script with the demo data from the mockups.
- Auth (email OTP) + role routing (landlord / technician / admin route groups).
- **Exit demo:** log in as each role, see themed empty states.

### Week 2 — landlord core: request → price → approve *(the hero flow)*
- Property management (add property w/ postcode lookup, tenant contact).
- New request wizard (5 steps from design 02): category, common-jobs chips from rate card, description + photo upload (Supabase Storage), urgency with surcharge display, **price approval screen**.
- Rate card admin CRUD (A3) — minimal version, because ⚠ **dependency: rate card v1 content from CEO due this week** (PRD §9).
- **Exit demo:** landlord books a job at a fixed price; job row hits `approved`.

### Week 3 — dispatch + technician surface
- Admin dispatch board (A1): incoming queue, assign/reassign with **certification blocking** (uncertified tech not assignable to electrical — enforced in the popover *and* by a DB constraint).
- Technician: today list, accept/decline, one-tap status updates (T1/T2), before/after photo capture, time & materials log.
- Status timeline component live on landlord job detail; **push + email on every `job_events` insert**.
- **Exit demo:** flow (a) end-to-end minus payment — book → assign → accept → in progress → completed, landlord watches live.

### Week 4 — tenant access + variation flow
- Access slot Edge Function + public web page (04 TN): Twilio SMS with tokenised link, slot pick, confirm; `access_failed` / rebook path.
- Variation end-to-end: tech flags with photos + dictation-friendly form (T3) → admin prices it in review queue (A2) → landlord approve/decline sheet (02 §7) → work resumes or declined branch per week-0 policy. Full price audit via `variations` + `job_events`.
- ⚠ **CEO dependency: borough cluster picked** (PRD §9).
- **Exit demo:** flows (b) and (c) complete; variation pauses and resumes a live job.

### Week 5 — payments
- Stripe: create invoice + payment link on completion; landlord confirm-and-pay screen (02 §8); webhook → `paid`.
- **72h auto-capture** scheduled job (Supabase cron/Edge): capture unless `disputed`; reminder push/email before capture.
- Dispute path: landlord raises dispute → blocks capture → admin resolution.
- Post-job rating (1–5 + comment).
- ⚠ **CEO dependency: VAT registration decision** — affects invoice display (PRD §9, blocking first real invoice, not blocking build).
- **Exit demo:** flow (a) truly end-to-end: booked → paid, including auto-capture in a time-warped test.

### Week 6 — remaining P0 + admin registry
- Property history screen with filters + **PDF/CSV export** (Edge Function renders PDF; CSV client-side).
- Out-of-hours: on-call pool opt-in (T4), on-call ping window, **fallback signposting screen** (03 F: water shut-off steps, National Gas Emergency 0800 111 999) when no acceptance within the window.
- Technician registry (A4): certifications, insurance expiry, auto-block on expiry, renewal warnings.
- Exception states wired: cancelled, declined, no-show/access-failed → back to scheduled, awaiting parts, rescheduled.
- **Exit demo:** every P0 acceptance criterion (PRD §6) demonstrable except polish.

### Week 7 — hardening & verification
- **RLS test suite** (the acceptance criterion): landlord A cannot read landlord B's anything; technician sees only assigned jobs; tenant token can't enumerate.
- Empty / loading (skeleton) / error / offline states per design 03; dark mode pass; accessibility pass (contrast, 44pt targets, screen-reader labels on status chips).
- Notification matrix test (every transition → push + email; SMS for tenant events).
- Seed a realistic pilot dataset; bug-bash the three critical flows on real iPhone + Android + web.

### Week 8 — launch prep
- ⚠ **CEO dependency: final brand name + domain** (PRD §9 — store listings need it).
- EAS production builds, App Store / Play submissions (~2-week review buffer starts here), **web build deploys immediately as soft launch**.
- Ops runbook for the dispatcher: manual dispatch procedure, variation SLA, dispute handling, CIS self-billing manual process.
- Launch checklist: insurance ✔, GDPR/privacy policy + tenant notice on access link ✔, gate targets finalised ✔.

## 4. Risks & mitigations

| Risk | Mitigation |
|---|---|
| Rate card content late (needed wk 2) | Build against seeded placeholder prices; content swap is data-only |
| Stripe auto-capture edge cases (disputes racing the 72h job) | Single `capture_deadline` + status check inside one transaction; tested with clock injection in week 5 |
| Part-time schedule slips | Weeks 6–7 contain the only compressible work (polish before hardening — never cut the RLS tests) |
| Store review rejection | Web is the fallback launch surface (deploys day 1 of week 8); native follows |
| Declined-variation policy undecided | Blocks week 4 copy + state machine branch — decide in week 0 |

## 5. Explicitly not being built (guardrail)

No in-app messaging, no card-on-file, no gas category, no automated dispatch, no recurring maintenance, no tenant portal, no GoCardless, no self-scheduling calendar. If it's not in PRD §6 P0, it waits for the gate.
