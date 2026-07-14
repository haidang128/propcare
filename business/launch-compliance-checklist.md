# PropCare Launch Compliance Checklist

Items marked **[BLOCKING]** must be done before the first paying job. Verify current rules with an accountant/solicitor — this is a working checklist, not legal advice.

## 1. Company & finance

- [ ] **[BLOCKING]** Incorporate Ltd company (Companies House, ~£50 online). SIC codes: 43390 (other building completion), 81100 (facilities support) — confirm with accountant.
- [ ] **[BLOCKING]** Business bank account (Tide/Starling/Monzo Business are fastest).
- [ ] Appoint accountant familiar with CIS — worth it from day one; CIS returns are monthly and fiddly.
- [ ] **VAT decision:** registration threshold is **£90,000 rolling 12-month turnover** (unchanged through 2026/27). At £100–150/job you're nowhere near it at launch → **don't register voluntarily**; your customers are mostly non-VAT-registered landlords who can't reclaim, so registering would make you 20% more expensive or 20% less profitable. Display prices with no VAT line. Set a turnover alarm at £75k rolling.
- [ ] Confirm the **CIS domestic reverse charge doesn't apply** to you while unregistered for VAT (it only applies between VAT-registered construction businesses) — accountant to confirm invoice wording.

## 2. CIS (Construction Industry Scheme) — **[BLOCKING]** before first tech payment

- [ ] Register the company as a **CIS contractor** with HMRC.
- [ ] For each subcontractor: collect UTR + NI number, **verify with HMRC** (gives deduction rate: 20% registered / 30% unregistered / 0% gross status).
- [ ] Deduct CIS from **labour only** (not materials) on every payment.
- [ ] File **monthly CIS300 return by the 19th**; pay deductions to HMRC by the 22nd (electronic).
- [ ] Issue monthly **payment & deduction statements** to each sub.
- [ ] Signed **self-billing agreement** + subcontractor agreement per tech (status: self-employed — get the agreement checked so it doesn't create employment/IR35 risk; techs must be free to decline jobs, use own tools, work for others).

## 3. Insurance — **[BLOCKING]**

- [ ] **Public liability** for the company (£2m minimum, £5m preferred) covering arranging/coordinating trades in occupied homes. Be precise with the insurer about the model (you dispatch vetted subs) — mis-described cover is void cover.
- [ ] **Verify each sub carries own PL (£2m min)** — certificate + expiry date recorded in the app's certification registry before first assignment. Set renewal reminders.
- [ ] **Employers' liability (£5m)** — legally required the moment you have any employee (including casual dispatch help). Not needed for genuine subcontractors, but confirm status with insurer.
- [ ] Check whether you need **professional indemnity** (advice/coordination errors) — cheap add-on, often bundled.

## 4. Electrical compliance — **[BLOCKING]** for electrical category

- [ ] Verify electrician's **NICEIC or NAPIT registration** (check the public register online, not just their card). Record registration number + expiry in the app.
- [ ] **Part P:** notifiable work (new circuits, consumer units, work in bathrooms/special locations) must be self-certified by the registered tech or building-control notified. Rate card E1–E5 are scoped non-notifiable; anything notifiable = variation + confirm tech can self-certify.
- [ ] EICR jobs (E6): confirm the tech is competent/insured for periodic inspection and issues certificates in their registered capacity.

## 5. GDPR & data — **[BLOCKING]**

- [ ] **Register with the ICO** and pay the data protection fee (Tier 1, ~£52/yr).
- [ ] **Privacy policy** covering: landlord account data, tenant name/phone (shared by landlord — you must inform the tenant), job photos of occupied homes (special care — may capture people/possessions), retention periods (suggest: photos 6 years to match tax records; tenant contact deleted after job + 90 days).
- [ ] **Tenant notice on the access-slot link page**: one paragraph — who you are, why you have their number, link to policy. (Small app change: add to `visit/[token]` screen.)
- [ ] **Processor agreements (DPAs):** Supabase, Stripe, Twilio/SMS provider, Resend — all standard-click DPAs; confirm **Supabase project is in an EU/UK region**.
- [ ] Photo hygiene rule for techs: photograph the fault, not the room; never people.

## 6. Consumer law & terms — **[BLOCKING]** before first invoice

- [ ] **Terms of service**: scope per rate card, variation process, 72h auto-capture, abort fee, complaints process, OOH best-effort disclaimer (no response-time guarantee — matches PRD decision #11).
- [ ] **Cancellation rights:** individual landlords are consumers; contracts made online carry a **14-day cooling-off right**. Get express consent to start work within the period and acknowledge loss of cancellation once the job is done — one checkbox at booking. Solicitor to confirm wording.
- [ ] **Consumer Rights Act 2015:** services must be performed with reasonable care and skill — your redo/refund policy should say what happens when a job fails (free return visit first).
- [ ] Workmanship guarantee (suggest 12 months on labour, backed by tech agreement).

## 7. App stores & operations

- [ ] Apple Developer (£79/yr) + Google Play (£25 one-off) accounts under the Ltd.
- [ ] Final **brand name + domain** — clear of "Fiixit" (fiixit.co.uk operates in this exact space) and trademark-check on IPO.gov.uk. Needed before store submission.
- [ ] App privacy labels (Apple) / Data safety form (Google) consistent with privacy policy.
- [ ] Stripe account activated on the Ltd, live keys, payout schedule set.
- [ ] Remove any secrets from git history; confirm `.env` never committed.

## 8. Marketing accuracy (avoid trouble later)

- [ ] **Renters' Rights Act 2025** commenced for tenancies **1 May 2026** — fine to reference landlord repair-record pressure.
- [ ] **Awaab's Law** applies to *social* landlords now; extension to private landlords is in the Act but **commencement not yet dated** — say "coming to the private sector", never "already law for you".
- [ ] No "guaranteed response time" claims for OOH anywhere in copy.

## Suggested order (fastest path)

Week 1: Ltd + bank + ICO + CIS contractor registration (all parallel, all fast).
Week 2–3: insurance quotes bound; accountant engaged; VAT decision minuted.
Week 3–4: tech agreements signed, subs CIS-verified, certs recorded.
Week 4–5: privacy policy + T&Cs live on web app; tenant notice added; brand finalised.
