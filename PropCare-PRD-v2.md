# PropCare (working title)

**Landlord Maintenance Booking & Tracking Service — Product Requirements Document**

Prepared by Hai (CEO), revised with Claude (CTO) | Draft v3 — decisions finalised | 4 July 2026 | Target market: **London, UK**

> **What changed from v2:** All blocking product decisions are now made (see Decision Log). Phase A (off-the-shelf pilot) is **skipped by CEO decision** — the custom app is the validation experiment, so the build is held strictly to lean P0 scope and the first 90 days post-launch serve as the go/no-go gate. Platform is an **Expo universal app** (iOS + Android + web from one codebase). Pricing is **flat-rate per job type** with in-app variation re-approval.

---

## 0. Decision Log (finalised 4 July 2026)

| # | Decision | Choice | Notes |
|---|---|---|---|
| 1 | Pilot region | **London** | CTO condition: launch dispatch limited to one borough cluster (see #5). |
| 2 | Technician model | **CIS subcontractors** | Self-billing + CIS deduction statements handled manually at launch; vetting + insurance checks mandatory before first job. |
| 3 | Pricing model | **Flat-rate per job type** | Rate card is the core pricing artifact; no per-job quoting engine. |
| 4 | Phase A off-the-shelf pilot | **Skipped — build now** | CEO decision, accepted with conditions: strict P0 scope, 90-day post-launch gate replaces the Phase A gate. |
| 5 | Dispatch zone | **One borough cluster (2–3 adjacent boroughs)** | Specific cluster TBD — pick where the first vetted technicians live. |
| 6 | Launch categories | **Plumbing, general handyman, electrical** | Electrical requires NICEIC/NAPIT-registered techs + Part P on notifiable work. Gas/boiler (CP12) deferred until supply is proven. |
| 7 | Platform | **Expo universal app** | One React Native codebase → iOS, Android, and web. Native camera + push from day one; allow ~2 weeks for app-store review in the launch plan. |
| 8 | Out-of-scope work | **In-app variation re-approval** | Tech reports variation → landlord approves updated fixed price in app → work resumes. Adds a `variation pending` state. |
| 9 | Build team | **CEO + Claude Code** | Built together in this repo. Realistic: 6–8 weeks part-time to launchable P0 (+ store review). |
| 10 | Backend | **Supabase** | Postgres + auth + photo storage + row-level security (tenant isolation at the DB layer) + realtime status. Free tier for pilot. |
| 11 | Emergencies | **Out-of-hours surcharge tier** | 1.5–2× flat rate, **best-effort, no response-time promise**, technicians opt in to the on-call pool. If no tech accepts, app falls back to emergency signposting (water shut-off guidance, National Gas Emergency 0800 111 999). |
| 12 | Payments | **Stripe only** | Payment links on invoices (cards, Apple/Google Pay, Pay-by-Bank). Auto-capture 72h after completion if no dispute. GoCardless direct debit considered at P1. |

---

## 1. Problem Statement

Landlords managing a small number of properties (typically 1–10 units) rely on ad hoc phone calls, texts, and personal contacts to arrange repairs and maintenance. This creates:

- No visibility into request status.
- Inconsistent pricing and quality.
- No centralized maintenance record for tax, insurance, or resale purposes.
- Constant follow-up chasing to get an update.

**The cost of not solving this:** delayed repairs (tenant dissatisfaction and potential health & safety / legal exposure), wasted landlord time, and no defensible maintenance history when a property is sold, refinanced, or inspected.

**A note on what this business is:** with in-house vetted technicians and manual dispatch, PropCare v1 is a *field-services operation*, not a software product. The hard problems — technician supply, utilisation, insurance, certification, pricing — live off-app. The app exists to make the operation visible, trustworthy, and repeatable.

---

## 2. Strategy: Build-First with a 90-Day Gate

The off-the-shelf validation pilot (v2's Phase A) is skipped by CEO decision. In exchange, the build is disciplined two ways:

1. **Strict P0 scope** (Section 6) — nothing outside it ships before the gate.
2. **The first 90 days after launch are the validation gate.** Continue investing (P1 features, more categories, gas, wider zone) only if:

| Gate criterion | Target (owner to finalise) |
|---|---|
| Completed jobs | ≥ 30 |
| 30-day repeat booking rate | ≥ 25% (placeholder — confirm) |
| Per-job margin | Positive after technician cost + platform overhead |
| Landlord acquisition | Evidence landlords beyond friends/family will book through the app |

If the gate fails, fix the business model before writing more software.

---

## 3. Goals

- **User goal:** Reduce time-to-first-response on a maintenance request to under 2 business hours (within business hours).
- **User goal:** Give landlords real-time status visibility so most requests require zero phone calls.
- **Business goal:** Prove positive unit economics per completed job within the 90-day gate.
- **Business goal:** Onboard a target number of landlords and 3–5 vetted technicians in the launch borough cluster within 90 days.
- **Business goal:** Establish a repeatable dispatch and quality process before widening the zone or adding categories.

## 4. Non-Goals (launch)

- No open marketplace — vetted CIS subcontractors only.
- No tenant-facing app — tenants interact only via the no-login access-slot link.
- No automated dispatch — admin assigns jobs manually.
- No expansion beyond the launch borough cluster until the gate passes.
- No gas/boiler category at launch (Gas Safe vetting bar; add after gate).
- No bundled financing/insurance products.
- No card-on-file — Stripe payment links on invoices (card-on-file is P1).
- No in-app messaging at launch (P1).
- No guaranteed out-of-hours SLA — the surcharge tier is explicitly best-effort.

---

## 5. User Personas & Stories

### Landlord (customer)

- As a landlord, I want to submit a maintenance request with photos and a description so the technician understands the issue before arriving.
- As a landlord, I want to see the **flat-rate price for the job type up front** and approve it before work is scheduled, so I'm never surprised by the bill.
- As a landlord, I want to **approve any variation** (updated fixed price) in the app before extra work proceeds.
- As a landlord, I want to see the real-time status of my request so I don't have to call to check.
- As a landlord with multiple properties, I want request history per property so I have a maintenance record for tax, insurance, or resale.
- As a landlord, I want an invoice with a payment link so I have clean accounting records.
- As a landlord, I want to request an **out-of-hours emergency job at the published surcharge**, understanding it's best-effort.
- As a landlord, I want to rate the technician after the job so I can flag quality issues.

### Tenant (not an app user, but part of the workflow)

- As a tenant, I want to pick an access time slot via a no-login SMS/web link so the technician can get in without me needing an app or account.

### Technician (CIS subcontractor)

- As a technician, I want to see my assigned jobs with property and access details so I can plan my day.
- As a technician, I want to update job status and upload before/after photos from my phone so the landlord and admin have visibility.
- As a technician, I want to **flag a variation with photos** when the real job exceeds the flat-rate scope, so I'm paid for the actual work.
- As a technician, I want to **opt in/out of the out-of-hours on-call pool** so surcharge work is my choice.
- As a technician, I want to log time and materials so my self-billing statement and the invoice are accurate.

> Because the platform is an Expo universal app, technicians get a proper mobile experience (camera, push) from day one — the v2 "WhatsApp + admin entry" fallback is no longer needed, but admin can still record updates on a technician's behalf.

### Admin (business owner / dispatcher)

- As the admin, I want to assign incoming requests to available technicians so jobs get covered.
- As the admin, I want to manage the **rate card** (flat price per job type, surcharge multiplier) so pricing is consistent.
- As the admin, I want to review/approve technician-flagged variations before they reach the landlord, so pricing stays controlled.
- As the admin, I want to see technician utilisation and job completion rates so I can manage capacity.
- As the admin, I want to record certification details (NICEIC/NAPIT, insurance expiry) per technician, and be blocked from assigning uncertified techs to electrical jobs.

---

## 6. Requirements

### Job lifecycle

```
requested → priced (flat-rate shown) → approved → scheduled → in progress → completed → paid
                                                        ↕
                                              variation pending → variation approved / declined
```

Exception states: **cancelled**, **declined** (landlord rejects price), **no-show / access failed** (returns to *scheduled*), **awaiting parts**, **rescheduled**, **disputed** (blocks payment capture pending admin resolution).

### P0 — Must-have (launch scope, frozen)

- Landlord signup/login, property management (address, tenant contact for access coordination).
- Submit request: category (plumbing / handyman / electrical), description, photo upload, urgency (standard vs out-of-hours emergency), preferred time.
- **Flat-rate pricing:** price from the rate card shown at submission; landlord approves before scheduling. Out-of-hours requests show the surcharge multiplier.
- **Variation flow:** technician flags variation with photos → admin reviews → landlord taps to approve updated fixed price → work resumes. Full audit trail.
- Status tracking per the lifecycle, with **push notification** (native) and email on each change.
- Tenant access slot picker: no-login link sent by SMS/email to the tenant contact.
- Admin dashboard: incoming requests, assign/reassign technicians, rate-card management, technician certification & insurance registry with category-level assignment enforcement, variation review.
- Technician app surface: job list, accept/decline, status updates, before/after photos, variation flagging, time & materials log, on-call pool opt-in.
- **Payments:** Stripe invoice + payment link on completion; captured after landlord confirms, or **automatically after 72 hours with no dispute**.
- Post-job rating (1–5 stars) with optional comment.
- Per-property maintenance history export (PDF/CSV).
- Out-of-hours fallback: if no on-call technician accepts within a defined window, show emergency signposting (water shut-off guidance, National Gas Emergency 0800 111 999).

### P1 — Fast follow (only after the 90-day gate passes)

- Gas/boiler category (Gas Safe vetting workflow, CP12 certificate storage + annual renewal reminders — the recurring-revenue hook).
- Card-on-file.
- In-app messaging between landlord and technician.
- Recurring/scheduled maintenance.
- Multi-property bulk dashboard.
- Technician availability calendar and self-scheduling.
- CIS self-billing statement generation (manual until then).
- GoCardless direct debit.
- Automated smart dispatch.

### P2 — Future considerations

- Tenant-facing portal for direct issue reporting.
- Marketplace expansion to vetted third-party contractors.
- Predictive maintenance suggestions from job history.
- Insurance/warranty bundling.
- Second zone / multi-region / franchise model.

### Acceptance Criteria (P0 sample)

- ☐ Landlord can submit a request with at least one photo attached and sees the flat-rate price before confirming.
- ☐ A job cannot enter *scheduled* until the landlord has approved the price (admin override logged with reason).
- ☐ A variation pauses work status and requires landlord approval before *in progress* resumes; the price history is auditable.
- ☐ Landlord receives a push/email notification within a few minutes of any status change.
- ☐ An uncertified technician cannot be assigned to an electrical job.
- ☐ Admin can reassign a job if a technician declines or no-shows.
- ☐ Payment is captured only after landlord confirmation, or automatically after 72 hours with no dispute.
- ☐ A disputed job blocks payment capture until admin resolution.
- ☐ Row-level security: a landlord can only ever read their own properties/jobs; a technician only their assigned jobs (enforced in Supabase RLS, verified by tests).
- ☐ Landlord can export a property's maintenance history as PDF/CSV.
- ☐ An out-of-hours request with no on-call acceptance shows emergency signposting within the defined window.

---

## 7. Technical Architecture (CTO)

- **App:** Expo (React Native) universal — single codebase for iOS, Android, and web. Expo Router for navigation; EAS for builds and store submission.
- **Backend:** Supabase — Postgres, Auth, Storage (job photos), Row-Level Security for landlord/technician isolation, Realtime for live status.
- **Payments:** Stripe (invoices + payment links; Pay-by-Bank for low-fee transfers).
- **Notifications:** Expo push + email (Resend or similar); SMS for tenant access links (Twilio or similar).
- **Team:** CEO + Claude Code in this repo. **Estimate: 6–8 weeks part-time to launchable P0, plus ~2 weeks App Store / Play Store review buffer.** Web build deploys immediately, so web can soft-launch while stores review.

---

## 8. Success Metrics (90-day gate + ongoing)

**Leading:** % of requests priced instantly from rate card (target ~100%); % approved-to-scheduled within 1 business hour; admin phone-call volume per job; variation rate per job (rate-card accuracy signal); job completion rate; technician response time from assignment to arrival; app adoption among pilot landlords.

**Lagging:** repeat booking rate at 30/60/90 days; landlord NPS; revenue margin per completed job; dispute/rework rate; technician retention; out-of-hours acceptance rate (tells us if the surcharge tier is a real promise or needs retiring).

---

## 9. Remaining Open Items (actions, not decisions)

| Item | Why it matters | Owner / Status |
|---|---|---|
| Pick the borough cluster | Determined by where the first 3–5 vetted technicians live/work. | CEO — before build week 4 |
| Public liability + employer's liability insurance; confirm each CIS sub carries own PL cover | Required before any technician enters a tenant's property. | CEO/legal — **blocking launch** |
| NICEIC/NAPIT verification process + Part P handling for notifiable electrical work | Legal requirement; drives the admin certification registry design. | CEO/compliance — **blocking electrical jobs** |
| GDPR: privacy policy, lawful basis, retention rules for job photos + tenant contact data; tenant notice on access link | Photos of occupied homes and tenant phone numbers are personal data. | CEO/legal — **blocking launch** |
| VAT registration decision and invoice treatment (inc/ex VAT display) | Affects rate card display and Stripe invoice configuration. | CEO/finance — blocking first invoice |
| Finalise gate targets (repeat rate %, landlord count) | Placeholder 25% needs a real number. | CEO — before launch |
| Rate card v1 (flat prices for ~15–25 common plumbing/handyman/electrical jobs + surcharge multiplier) | The product's core pricing artifact; needed for build week 2. | CEO with technician input — before build week 2 |
| Brand name (PropCare is a working title) + domain + app-store listings | Store review requires final branding. | CEO — before build week 5 |

---

## 10. Riskiest Assumptions (now tested in production)

1. **Demand-side trust:** London landlords will book through a new, unbranded app instead of calling "their guy". Skipping Phase A means the first marketing push tests this with real money — keep acquisition spend minimal until the gate reads positive.
2. **Supply-side liquidity:** 3–5 CIS subs can be kept utilised inside one borough cluster without breaking the 2-business-hour response promise. Manual dispatch is our cheapest instrument for learning the real utilisation curve.
3. **Rate-card accuracy:** flat-rate pricing only works if the variation rate stays low (say <20% of jobs); a high variation rate means the rate card is mispriced and the "no surprise bill" promise erodes into constant re-approvals.
