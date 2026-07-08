# PropCare — App Design Prompt

*Paste everything below the line into Claude (or your design tool) to generate the app design. Optionally attach the PRD (PropCare-PRD-v2.md) for full context.*

---

Design the complete UI/UX for **PropCare**, a landlord maintenance booking and tracking app launching in London, UK. Produce a design system plus high-fidelity screen designs for the flows listed below.

## Product context

PropCare lets small landlords (1–10 properties) book vetted repair technicians at **flat-rate, pre-approved prices** and track every job in real time — replacing phone calls, texts, and chasing. The core promises the design must communicate on every screen:

1. **No surprise bills** — the fixed price is always visible before, during, and after a job.
2. **Always know the status** — landlords should never feel the need to call.
3. **Vetted and certified** — technicians are insured and (for electrical) NICEIC/NAPIT registered; trust signals matter.

It is a three-sided app built with **Expo (React Native) for iOS, Android, and web** from one codebase:

- **Landlord app** (mobile-first, also web) — the customer.
- **Technician app** (mobile-only in practice — used on site, often one-handed, sometimes with dirty hands and poor light).
- **Admin dashboard** (web/desktop-first) — the dispatcher who assigns jobs, manages the rate card, and reviews price variations.

## Brand direction

- Working title "PropCare" (final name TBD — keep the wordmark easily swappable).
- Personality: **dependable, professional, straightforward** — a modern trade service, not a flashy consumer startup and not a corporate facilities giant. Think "the reliability of a British Gas engineer with the clarity of Monzo."
- UK conventions throughout: £ prices (state inc/ex VAT), DD/MM/YYYY dates, UK address formats, British English.
- Accessible: WCAG AA contrast, minimum 44pt touch targets, readable outdoors on a phone. Support light and dark mode.

## The job lifecycle (design status UI around this)

```
requested → priced → approved → scheduled → in progress → completed → paid
                                     ↕
                            variation pending → variation approved/declined
```

Exception states: cancelled, declined, no-show/access failed, awaiting parts, rescheduled, disputed.

Every state needs a distinct, colour-coded, plain-English presentation (e.g. "Waiting for your approval", "Sam is on the way", "Extra work needs your OK"). Status is the heartbeat of the product — design a status timeline component reused across landlord, technician, and admin views.

## Screens to design

### Landlord (mobile-first)

1. **Onboarding & sign-up** — add first property (address, tenant contact for access).
2. **Home/dashboard** — active jobs with live status, properties at a glance, "New request" CTA.
3. **New request flow** — pick property → category (Plumbing / Handyman / Electrical) → describe issue + photo upload → urgency (standard vs out-of-hours emergency at 1.5–2× surcharge, clearly labelled "best effort") → **flat-rate price shown up front** → confirm & approve. Price approval is the hero moment: make the fixed price large, unambiguous, and reassuring.
4. **Job detail** — status timeline, technician card (photo, name, certifications badge), scheduled slot, before/after photos, price breakdown.
5. **Variation approval** — push notification → screen showing technician's photos, what changed, old price vs new fixed price, Approve / Decline. This screen carries the "no surprise bills" promise — design it to feel like being asked, not billed.
6. **Completion & payment** — confirm completion, rate 1–5 stars + comment, invoice with Stripe payment link; note the 72-hour auto-confirm.
7. **Property history** — per-property maintenance record, filterable, with PDF/CSV export (the tax/insurance/resale record).
8. **Out-of-hours fallback** — if no on-call technician accepts an emergency request: calm, useful emergency guidance (water shut-off steps, National Gas Emergency 0800 111 999).

### Tenant (no account — one lightweight web page)

9. **Access slot picker** — opened from an SMS link, no login: choose a time slot for technician access, see who's coming, one-tap confirm. Must work flawlessly on any phone browser.

### Technician (mobile, on-site use)

10. **Job list / today view** — assigned jobs with time, address, access details, accept/decline. Big targets, glanceable.
11. **Active job screen** — one-tap status updates (on my way / started / paused-awaiting parts / done), before/after photo capture, time & materials log.
12. **Flag a variation** — photos + short description of extra work → sent to admin. Optimise for speed: a plumber standing in a wet kitchen.
13. **Profile & on-call opt-in** — certifications, insurance expiry, toggle for the out-of-hours surcharge pool.

### Admin (web/desktop)

14. **Dispatch board** — incoming requests, assign/reassign to technicians, capacity at a glance (utilisation per tech).
15. **Variation review queue** — technician's photos and note, edit/approve the new price before it goes to the landlord.
16. **Rate card manager** — flat price per job type per category, out-of-hours multiplier.
17. **Technician registry** — certifications (NICEIC/NAPIT), insurance expiry dates; the UI must visibly block assigning an uncertified tech to an electrical job.

## Deliverables

1. **Design system**: colour palette (light + dark), type scale, spacing, iconography style, and core components — status timeline, job card, price display, photo uploader, approval sheet, star rating.
2. **High-fidelity mockups** of the screens above (mobile frames for landlord/technician/tenant, desktop for admin).
3. **The three critical flows end-to-end**: (a) landlord submits → approves price → tracks → pays; (b) technician runs a job including flagging a variation; (c) admin dispatches and reviews a variation.
4. Empty, loading, and error states for the landlord home and job detail screens.

Start with the design system and the landlord "new request → price approval" flow — it's the heart of the product.
