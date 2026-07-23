# PropCare Rate Card v1 (DRAFT — finalise with technicians)

Status: template with London market benchmarks (July 2026). The **Proposed flat rate** column is a starting position — walk through every line with your first technicians before launch. Their buy-in is what keeps the variation rate under 20%.

## Pricing principles

1. **Flat rate = labour + normal consumables** (washers, silicone, wire, fixings). Larger parts — taps, WC units, light fittings, lock cylinders — are **supplied by the landlord**, never marked up by us. If a job needs a part we didn't expect, the technician raises a variation and the landlord approves the new fixed price before work continues.
   > *No `cost + 10%` handling charge.* It cannot be itemised — an invoice carries a single total — so a "fixed price" that arrives higher would break the one promise this product is built on. Landlord-supplies also keeps CIS simple: the deduction applies to the whole payout, with no labour/materials split.
2. **Technician payout is 75% of the flat rate**, so PropCare keeps 25%. Payout shown is *before* CIS deduction (20% for registered subs, 30% unregistered).
3. **Out-of-hours (OOH) surcharge: 1.75× flat rate**, best-effort, tech opt-in pool. OOH = before 8am, after 6pm, weekends, bank holidays. **Only emergency lines are OOH-bookable** (currently P10) — enforced per job type in the database, not just hidden in the UI.
4. **No VAT** shown while unregistered (see compliance checklist). Rates are inclusive prices to the landlord.
5. **Variation trigger:** if on-site scope exceeds the job definition below, technician flags a variation in the app before proceeding. The scope column is the contract — keep it tight.
6. **Hourly lines (H1, E5) are bought by the hour up front: £95 for the first, £70 for each one after** (CEO decision 23/07/2026, migration 0019). The first hour carries the call-out — travel, parking, the trip itself; later hours carry only time, and £95 for a fourth consecutive hour sat above the market band this line is written for. Margin improves with length because the £25 platform overhead is per job, not per hour: 1hr = −£1.25, 2hr = £16.25, 3hr = £33.75. Going beyond the hours booked is still a variation the landlord approves first.
   > ⚠️ **E5 is the line to watch.** A continuation hour pays a NICEIC electrician £52.50, below the £60–£64 this card pays them on E1/E2 — it may get declined. Set E5's continuation rate higher on its own (`job_types.additional_unit_price_inc_vat`) if electricians push back.

## Plumbing

| # | Job | Scope (what's included) | London benchmark | Proposed flat rate | Tech payout (@75%) |
|---|---|---|---|---|---|
| P1 | Dripping/leaking tap repair | Re-washer/cartridge, 1 tap, parts <£15 incl. | £80–£150 | £95 | £71 |
| P2 | Tap replacement | Remove + fit landlord/PropCare-supplied tap, 1 tap | £100–£160 | £120 | £90 |
| P3 | Toilet not flushing / running | Replace flush or fill valve, standard cistern | £90–£150 | £110 | £82 |
| P4 | Toilet unblock | Manual/plunger/auger, 1 WC, no drain excavation | £120–£185 | £130 | £97 |
| P5 | Sink/bath/shower unblock | Trap clean + manual clear, 1 waste | £90–£150 | £105 | £79 |
| P6 | Toilet replacement | Remove + fit like-for-like close-coupled WC (**landlord supplies the unit**) | £200–£400 labour | £220 | £165 |
| P7 | Leak under sink | Diagnose + repair trap/compression joints | £90–£160 | £110 | £82 |
| P8 | Radiator: bleed / valve replace | Up to 3 rads bleed, or 1 TRV/lockshield swap | £80–£140 | £95 | £71 |
| P9 | Washing machine install/plumb | Connect to existing valves + waste, test | £80–£130 | £95 | £71 |
| P10 | Isolate + make safe (leak emergency) | Stop leak, isolate supply, report follow-up work | — | £110 (OOH £192.50) | £82 |

## Handyman

| # | Job | Scope | London benchmark | Proposed flat rate | Tech payout (@75%) |
|---|---|---|---|---|---|
| H1 | General handyman hour | First hour, any small task. Further hours bought up front at £70 (see principle 6) | £45–£70/hr | £95 first hr, then £70/hr | £71 / £52.50 |
| H2 | Shelf / TV bracket mount | 1 item, standard wall, fixings incl. | £60–£100 | £85 | £64 |
| H3 | Internal door adjustment | Ease/plane/rehang 1 door, adjust hinges | £60–£110 | £85 | £64 |
| H4 | Lock replacement | Like-for-like euro cylinder or nightlatch (**landlord supplies the lock**) | £70–£130 | £95 | £71 |
| H5 | Blinds / curtain rail fitting | Up to 2 windows, standard fix | £60–£110 | £90 | £67 |
| H6 | Re-seal bath/shower silicone | Strip + re-seal 1 bath or shower tray | £70–£120 | £95 | £71 |
| H7 | Flat-pack assembly | Per item up to 1.5h | £50–£90 | £75 | £56 |

## Electrical (NICEIC/NAPIT-registered techs only; app blocks others)

| # | Job | Scope | London benchmark | Proposed flat rate | Tech payout (@75%) |
|---|---|---|---|---|---|
| E1 | Socket replacement | Like-for-like, 1 socket, non-notifiable | £55–£95 | £85 | £64 |
| E2 | Light switch replacement | Like-for-like, 1 switch | £55–£85 | £80 | £60 |
| E3 | Light fitting replacement | Fit landlord/PropCare-supplied fitting, 1 point | £60–£120 | £95 | £71 |
| E4 | Extractor fan replacement | Like-for-like, existing wiring/ducting | £100–£180 | £140 | £105 |
| E5 | Fault-find first hour | Diagnose tripping/dead circuit; further hours bought up front at £70 (see principle 6) | £60–£100/hr | £95 first hr, then £70/hr | £71 / £52.50 |
| E6 | **EICR (1–3 bed)** | Full inspection + certificate | £150–£250 | £185 | £139 |

> **E6 is strategic:** landlords legally need an EICR every 5 years. It gets you into the property, into the maintenance record, and creates a renewal reminder — the same recurring hook as CP12 when gas launches post-gate.

## Rules

- **Congestion/ULEZ:** price it into the rate card, not as a line item — surprise fees break the promise. If the cluster straddles the CC zone, consider +£10 on all zone-1/2 jobs.
- **Access failure / no-show by tenant:** £45 abort fee to landlord (tech gets £35). State it at booking. *The app has no abort-fee path — for the pilot, put it in the terms and collect it manually.*
- **Materials:** consumables included in the flat rate; larger parts supplied by the landlord. Anything unforeseen goes through the variation flow — never straight onto the invoice.
- **Variation rate target:** <20% of jobs. Review monthly; a job type with >30% variation rate is mispriced or badly scoped — fix the row, don't blame the tech.

## Worked example (P4 toilet unblock)

Landlord pays £130 → tech labour £97 (CIS: pay £77.60, remit £19.40 to HMRC) → PropCare gross margin £33 (25%) → less Stripe ~£2.15 (1.5% + 20p) + SMS/infra ~£0.50 → **~£30 net per job before your time**. At 30 jobs (the gate), that's ~£900 gross profit — the gate is about proving the *model*, not the money.

> **That £30 does not carry insurance, the accountant, or your ~30 minutes of dispatch per job.** Price your own time at anything and per-job margin goes negative. Set `pricing_settings.platform_overhead_per_job` to `(insurance + accountant + infra) ÷ expected 90-day jobs`, or **Admin → Gate** will report a positive margin you did not earn.

> **Watch E1/E2.** £85 and £80, paying the tech £64 and £60, for work only an NICEIC/NAPIT-registered electrician may legally do. If those lines get declined it will look like a dispatch failure and it will actually be a pricing one.
