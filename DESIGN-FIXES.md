# Design fixes — from review of `Design app/` (05/07/2026)

Status: **all applied 05/07/2026**. Files reviewed: 01–05 `.dc.html` against PropCare-PRD-v2.md (v3 decisions) and PropCare-design-prompt.md.

> Fix #2 was applied with an assumed policy: **declining a variation pauses the job at no charge, and the office calls to rearrange or cancel**. CEO to confirm (see open question at the bottom) — copy is a one-line change if the policy differs.

## Must fix (scope/logic conflicts)

### 1. Remove in-app messaging icon from landlord Job Detail
- **File:** `Design app/03 Landlord - Core Screens & States.dc.html` (line ~168, technician card on screen D)
- **Problem:** Message-circle button next to Sam's technician card. PRD lists in-app messaging as a non-goal at launch (P1 fast-follow).
- **Fix:** Remove it, or replace with a phone/call button (matches the technician side, T1 job card).

### 2. Fix contradictory decline copy on Variation Approval
- **File:** `Design app/02 Landlord - Request to Payment.dc.html` (line ~293, screen 7)
- **Problem:** Sam's note says the seized valve "needs replacing **before** I can fit the new tap", but the decline caption says "Sam finishes the tap and leaves the valve as-is". Both can't be true.
- **Fix:** Decline copy must state the real consequence — e.g. "Declining means Sam can't complete the tap repair today. You'll only be charged for the call-out/diagnosis, and the job returns to us to re-scope." (Exact policy TBD by CEO — what does a declined variation cost the landlord? Decide, then write the copy.)

## Minor (mock-data nits, fix when convenient)

### 3. Gas job in property history sample data
- **File:** `03 ... .dc.html` (screen E, history list): "Annual gas safety check · CP12 attached"
- Gas is a post-gate (P1) category — this record couldn't exist at launch. Swap for a plumbing/electrical/handyman entry.

### 4. Unverified pricing claim in onboarding
- **File:** `03 ... .dc.html` (screen A): "Free for landlords with up to 10 properties"
- Not in the PRD. Confirm this is the intended pricing message before it becomes real copy.

### 5. Dispatch board mixes a 23:12 emergency with 08:30–09:00 requests
- **File:** `05 Admin Dashboard.dc.html` (A1, incoming column)
- Harmless in a mock; just odd sample data in one view.

## Open policy question raised by fix #2
What happens commercially when a landlord **declines** a variation mid-job? Options: (a) original job completes if physically possible, (b) reduced call-out/diagnosis fee, (c) job cancelled with no charge. This drives both the UI copy and the `variation declined` branch of the state machine — decide before build week 4.
