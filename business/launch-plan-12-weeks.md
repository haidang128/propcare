# PropCare 12-Week Launch Plan

**Start:** Mon 13 July 2026 · **Target: first paying (stranger) jobs completed by Fri 2 October 2026.** Sized for part-time execution alongside a full-time job: ~8–10 hrs/week, front-loaded on weekends. The 90-day gate clock starts at public launch (Week 9), running to early January 2027.

**The one rule:** no new app features before the gate. Only bug fixes and the small compliance changes listed below.

---

## Phase 1 — Foundations (Weeks 1–2, 13–24 Jul)

**Week 1**
- Incorporate Ltd + business bank + ICO registration + HMRC CIS contractor registration (all parallel, ~3 evenings).
- Shortlist 5 brand names; check domains, IPO trademark register, and distance from "Fiixit". Decide by Sunday — everything downstream needs it.
- Request 3 public liability insurance quotes (describe the dispatch model precisely).
- Post technician openings: personal trade contacts first, then local trade WhatsApp/Facebook groups, Gumtree. Target pipeline: 10 conversations → 3–5 signed.

**Week 2**
- Engage a CIS-experienced accountant; minute the VAT decision (don't register; alarm at £75k rolling).
- First technician interviews. Vetting pack per tech: ID, UTR (HMRC CIS verify), PL insurance cert + expiry, NICEIC/NAPIT check for electricians, references from 2 recent jobs.
- Bind insurance.
- Draft subcontractor + self-billing agreement (template from accountant/solicitor).

**Exit criteria:** company exists, insured, brand chosen, ≥5 tech candidates in pipeline.

## Phase 2 — Supply & pricing (Weeks 3–4, 27 Jul–7 Aug)

**Week 3**
- Sign first 3 techs (1 plumber, 1 handyman, 1 electrician minimum). **Their postcodes pick your borough cluster** — lock it now.
- Rate card workshop (one evening, pay them for their time): walk every row of `rate-card-v1.md`, adjust scope + payouts until they'd take every job at that price. Freeze v1.

**Week 4**
- Privacy policy + T&Cs written (solicitor review or a vetted template service).
- Load final rate card into the app's admin rate-card screen. Seed technician records with certs + expiry dates.
- App changes (the only allowed ones): tenant privacy notice on `visit/[token]`, cooling-off consent checkbox at booking, rebrand (name, icon, splash).

**Exit criteria:** 3+ signed vetted techs, frozen rate card, borough cluster chosen, legal docs done.

## Phase 3 — Ship & dogfood (Weeks 5–6, 10–21 Aug)

**Week 5**
- Stripe live on the Ltd. EAS production builds; submit to App Store + Play Store (expect ~2 weeks with a re-review). Deploy web app to the final domain — **web is live from today**.
- Landing page live (copy from `landlord-pitch-and-landing-copy.md`).

**Week 6 — dogfood on your own properties**
- Run 3–5 real jobs end-to-end on your own units: request → price → tenant slot → tech on site → photos → variation (force one deliberately) → invoice → payment → rating → PDF export.
- Fix workflow breaks immediately. Write the dispatch runbook from what actually happened (assignment SLA, escalation, dispute steps).
- **Define your response window honestly**, e.g. "requests acknowledged within 2 business hours, 8am–6pm Mon–Fri" — with dispatch checks at 8am / 12:30 / 18:00 around your day job. Put it in the T&Cs and on the site.

**Exit criteria:** stores submitted, web live, 3–5 completed dogfood jobs, dispatch runbook v1.

## Phase 4 — Friendly launch (Weeks 7–8, 24 Aug–4 Sep)

- Recruit 5–10 friendly landlords (friends, colleagues, your own network) onto the web app; their jobs are real and paid, but feedback-heavy.
- First letting-agent meetings (email template ready) — aim for 2 agents agreeing to refer overflow.
- Join/attend NRLA branch + 2 local landlord Facebook groups *as a member* — contribute before you pitch.
- Watch the leading metrics from day one: time-to-acknowledge, variation rate, tech acceptance time.
- App-store approvals should land here; fix rejections same-week.

**Exit criteria:** ≥8 completed paid jobs total, ≥5 distinct landlords, apps approved, 2 referral channels warm.

## Phase 5 — Public launch (Weeks 9–10, 7–18 Sep) — *90-day gate clock starts*

- Founding-landlord offer live (free EICR with first two repairs — see pitch doc).
- Post to landlord groups + Property Tribes; NRLA branch intro; agent referrals switched on.
- Target: **first stranger booking within 10 days.** If nobody bites, the problem is trust or channel, not product — iterate the offer/copy weekly, don't touch the app.
- Weekly Sunday review (30 min): jobs completed, margin per job, variation rate, response-time misses, repeat bookings. Keep it in a simple sheet.

## Phase 6 — Prove & tune (Weeks 11–12, 21 Sep–2 Oct)

- Push to **≥12–15 cumulative completed jobs** and ≥3 landlords outside your network by 2 Oct.
- Reprice any rate-card row with >30% variation rate.
- Ask every completing landlord for the next booking ("want the EICR done while we're at it?") — repeat rate is the gate metric that matters most.
- Decide nothing new: gas, second cluster, P1 features all wait for the gate reading in January.

---

## The 90-day gate (public launch → ~6 Dec 2026, read in early Jan 2027)

| Criterion | Target | Kill/fix signal |
|---|---|---|
| Completed jobs | ≥30 | <15 → demand problem: channels/trust, not features |
| 30-day repeat booking | ≥25% | <10% → service quality or pricing problem |
| Margin per job | Positive after tech + Stripe + infra | Negative → rate card or payout split wrong |
| Landlords beyond your network | Meaningful share of bookings | ~0 → you have a friends-and-family service, not a business |
| Variation rate | <20% | >30% → rate card scopes are fiction |

Gate passes → P1 roadmap starts with **gas/CP12** (the recurring-revenue engine) and card-on-file. Gate fails → fix the named problem above before writing any more software.

## Weekly operating rhythm (from Week 6, ~7 hrs/wk)

- **Daily:** dispatch checks 8am / 12:30 / 18:00 (10 min each from your phone).
- **Tue + Thu evening:** outreach — one group post, one agent follow-up, reply to every comment.
- **Sunday 30 min:** metrics review + next week's three priorities.
- **Monthly (by 19th):** CIS300 return + deduction statements (accountant), insurance/cert expiry sweep.

## Top risks & mitigations

1. **Dispatch vs day job** — the response window is defined around your calendar, published honestly, and the first-touch acknowledgement should be automated ("Received — priced and confirmed by [time]"). If volume grows, a technician on a small retainer becomes dispatcher before you hire anyone.
2. **Tech churn with 3 subs** — one leaver kills a category. Keep recruiting continuously; target 5 signed by Week 10 even if under-utilised.
3. **Slow app-store review** — web app is the primary channel until stores clear; nothing in the plan depends on native.
4. **Zero stranger demand by Week 11** — pre-agreed response: double down on agents (they have demand already) rather than more consumer marketing.
