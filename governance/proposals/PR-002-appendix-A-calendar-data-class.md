# PR-002 Appendix A — Calendar data class (counsel packet, PENDING LEGAL + PRIVACY)

**Status:** DRAFT FOR COUNSEL · Founder approved 2026-08-12 (DR-011) ·
**Legal sign-off ☐ PENDING · Privacy sign-off ☐ PENDING.**
Until both sign: `moments_calendar_enabled` stays OFF in production, no
DATA-CLASSIFICATION-MATRIX rows are added, and no real user's calendar is
read. This document is the complete description of what would be collected,
why, and how — written to be reviewable without reading code.

> **Revision note — 2026-08-28 (outside-counsel-review pass).** This revision
> expands the counsel questions (multi-state consumer-health-data coverage,
> third-party ToS, telemetry, EU/UK scoping), records read-only engineering
> audit findings, places the classifier keyword list under change control, and
> adds Apple-deliverable and retention detail. **No signature or determination
> has been recorded, and no production behaviour has changed** —
> `moments_calendar_enabled` remains OFF. Every passage added or revised in
> this pass is marked **⟦Draft — counsel review required⟧**. All determination
> boxes below are intentionally left blank for Legal / Privacy.

---

## 0. How to use this packet ⟦Draft — counsel review required⟧

1. Work through the **§2 determinations** (`2a`–`2e`) and the **§4 retention**
   determination. Each has blank check-boxes and a signature line — these are
   the action items.
2. Confirm or revise the draft **privacy-policy** wording (§3) and
   **deletion/export** wording (§5).
3. Note the **§6 Apple deliverables** and **§8 open engineering items** — these
   are gated work that must complete before the flag flips, tracked for
   awareness, not for counsel sign-off.
4. Sign **§7** last. Activation proceeds only after both signatures, the
   recorded determinations, and the dependent canonical documents are committed
   to `governance/`. Signing this packet does not itself change any runtime
   behaviour.

---

## 1. Proposed data class (for the DATA-CLASSIFICATION-MATRIX, on approval)

| Field | Value |
|---|---|
| Class name | `calendar_event_metadata` |
| Proposed sensitivity | **S1 (proposed)** — contingent on the R0 in-memory invariant (see note) and on determination **2a**; reclassify **S3** if 2a finds a consumer-health-data inference ⟦Draft — counsel review required⟧ |
| Contents | Event **title**, **start/end time**, **calendar id/name**, all-day flag — from calendars the member individually selects |
| Explicitly excluded | Attendees, organizers, notes/descriptions, locations, attachments, URLs, recurrence metadata beyond occurrence times, event history |
| Source | On-device EventKit via expo-calendar, **read-only** permission |
| Purpose (purpose-bound, §6 of the Constitution) | Sole purpose: derive preparation Moments (§43) — prep windows + one hydration-first action |
| Processing | **On-device only.** Never transmitted, never server-side |
| Persistence | **None** for event data (in-memory, re-read on demand). Persisted: member preferences (selected calendar ids, category toggles) and prepared-marks (event-id → timestamp) — no event content |
| Retention | See **§4** (R0 for event data; R2 for the preference/prepared-mark records; R7 for the consent record) |
| Deletion | See **§5** |
| Consent surface | OS calendar permission (Apple-mediated) + in-app CONNECT step + per-calendar and per-category toggles + persistent privacy footer + MANAGE CALENDAR ACCESS deep link |

> **Note — S1 is contingent on the R0 in-memory invariant.** ⟦Draft — counsel
> review required⟧ The S1 rating holds only while event data is transient
> (R0, §4): titles are read into memory, classified, and discarded. Because
> member-authored titles are **unbounded free text**, any proposal to *persist*
> event content would void this S1 classification and requires re-review of the
> class (and likely an S3 rating) before it could ship.

## 2. Counsel determinations

*All boxes below are intentionally blank. No determination has been recorded.*

### 2a. Consumer-health-data / sensitive-inference analysis ⟦Draft — counsel review required⟧

Event titles are member-authored and may incidentally contain health-flavoured
terms. The classifier maps a **fixed** keyword list (§2a.1) to a preparation
category and **skips everything else**; classification is on-device only and the
derived category is never transmitted (see §2c). The health-flavoured terms
presently in the list are concentrated in the `recovery` category
(`massage`, `sauna`, `recovery`, `physio`, `stretch`, `ice bath`, `sleep`).

**Question.** Is the derived preparation category (e.g. `training`, `recovery`)
a consumer-health-data inference under any of the following, and if so does the
consumer-health-data-privacy disclosure inventory need a calendar-events entry
before activation?

- [ ] **WA** — My Health My Data Act (RCW 19.373) — consumer health data? ______
- [ ] **NV** — SB 370 — consumer health data? ______
- [ ] **CT** — CTDPA consumer-health-data provisions — consumer health data? ______
- [ ] Disclosure-inventory entry required before activation? ______

**NY monitoring clause.** NYHIPA (S929) was **vetoed December 2025**; a revised
bill (**S9269, February 2026**) would take effect **6 months after enactment**
and covers health *inferences*. **If any New York consumer-health-data law is
enacted, determination 2a automatically reopens** and must be re-answered before
(or, if already live, to keep) activation.

**Recommended mitigation (counsel option).** Removing the health-flavoured terms
from the fixed keyword list before activation — i.e. dropping the `recovery`
category (`massage`, `sauna`, `recovery`, `physio`, `stretch`, `ice bath`,
`sleep`) and any health-adjacent training term — would leave only
non-health categories (`work`, generic `training`, `travel`, `performance`) and
would **largely moot 2a**, since no derived category would encode a health
inference. Counsel elects one:

- [ ] **Keyword list amended** — health-flavoured terms removed (see revised
  list, to be attached); 2a narrows to residual free-text-title risk.
- [ ] **Keywords retained** — the consumer-health-data determination above
  governs, and (if any box is YES) the disclosure-inventory entry is required
  before activation.

#### 2a.1 Keyword-list change control ⟦Draft — counsel review required⟧

The classifier keyword list (`artifacts/aforce-os/services/momentClassification.ts`,
`CATEGORY_KEYWORDS`) is placed under change control **referencing this
determination**. **Any addition to the list reopens 2a before ship** (see the
companion note added to `INTELLIGENCE-CHANGE-CONTROL.md`). Counsel signs 2a
against the **exact current list**, reproduced verbatim so the signed set is
unambiguous:

```
work:        meeting, call, sync, standup, presentation, demo, review,
             interview, deadline, investor, board, leadership, 1:1, one-on-one
training:    gym, run, workout, training, practice, lift, session,
             class, yoga, swim, ride, spin, crossfit
travel:      flight, fly, airport, train, drive, hotel, travel,
             depart, departure, trip
recovery:    massage, sauna, recovery, physio, stretch, ice bath, sleep
performance: game, race, match, competition, audition, exam, speech,
             keynote, talk
```

Matching is whole-word, lowercased; a title matching no keyword is skipped
(no category, no Moment).

### 2b. Third-party calendar Terms of Service ⟦Draft — counsel review required⟧

**Recorded reasoning.** AForce reads the **device calendar store** via Apple
EventKit (`expo-calendar`). Google Calendar and Microsoft Outlook accounts
appear there only because the member added them to the device and iOS syncs
them. **AForce never calls the Google Calendar API or Microsoft Graph.**
Provider API terms attach to *API access* — that access is Apple's sync layer,
not AForce's.

**Engineering audit (this branch, read-only).** A repository scan found **no**
`googleapis`, `graph.microsoft`, `calendar/v3`, `outlook.office`, or
`login.microsoftonline` reference anywhere in the app. Recorded in the PR
description.

**Question / condition.**

- [ ] No additional third-party API-terms obligations attach. ______
- [ ] **Condition:** engineering certifies no direct Google/Microsoft calendar
  API calls exist (audited above); **any future direct provider-API
  integration reopens 2b** before ship.

### 2c. Telemetry / no-egress verification ⟦Draft — counsel review required⟧

**Determination is contingent on verification** that no analytics/telemetry
event fired by the calendar connect flow or any Moments surface carries
event-ids, event content, or derived categories.

**Engineering audit (this branch, read-only).** The seven calendar/Moments
services (`calendarBridge`, `calendarMoments`, `momentClassification`,
`momentNotifications`, `momentFeedback`, `momentRecommendation`, `momentsStore`)
and all `components/moments/*` screens/hooks were scanned for the app's
analytics primitives (`emit` / `event_dispatcher`, `@/services/analytics`,
`recordLogAction`) and for any network call (`fetch`, `axios`). **Result: zero
analytics events and zero network calls in the entire calendar/Moments
surface.** Full findings recorded in the PR description.

**Engineering attestation checklist (to accompany sign-off):**

- [ ] Verified: no analytics/telemetry event in the calendar connect flow or
  Moments surface carries event-ids, event content, or derived categories —
  audit result attached in the PR description. ______ *(engineering, date)*

### 2d. EU / UK scoping ⟦Draft — counsel review required⟧

**Question.** Is AForce OS offered to EU / UK users?

- [ ] **No** — recorded so the omission of a GDPR/UK-GDPR workstream is a
  deliberate, documented scoping decision.
- [ ] **Yes** — a **GDPR / UK-GDPR workstream is required before activation**:
  lawful basis for processing calendar-derived data (consent), and a DPIA for
  the calendar → Moments inference. (Relates to the open **SS-04**
  export/deletion path.)

### 2e. COPPA / minor users ⟦Draft — counsel review required⟧

**Question.** For users under the app's age floor, is there any COPPA
interaction from calendar reading beyond the existing **SS-08** item?

- [ ] No interaction beyond SS-08. ______
- [ ] Additional handling required (see notes). ______

## 3. Draft privacy-policy addition (for counsel wording review) ⟦Draft — counsel review required⟧

*Replaces the prior draft clause. Destination: `privacy-policy.md` §1.3
"Information collected with your permission" (a new **Calendar** row) plus the
§6 withdraw-consent list. This section also satisfies the earlier "privacy-policy
delta — confirm wording" question.*

> **Calendar (optional).** If you connect your calendar, AForce reads event
> titles and times from the calendars you select — only on your device, only
> to prepare you for upcoming moments. We never read attendees, notes,
> locations, or attachments. We never store or transmit your calendar event
> content; the only things we keep, on your device, are your calendar
> selections and a record of which moments you've prepared for. You can
> disconnect at any time, which immediately stops all reading and deletes your
> calendar preferences.

**Contingency.** If determination **2a = YES** (consumer health data), this
clause must be **expanded to meet the separate consumer-health-data disclosure
requirements** (e.g. a distinct consumer-health-data notice/authorization)
**before approval**.

- [ ] Wording approved as drafted. ______
- [ ] Revised — see redline. ______

## 4. Retention — R0 / R2 mapping and the R7 determination ⟦Draft — counsel review required⟧

Proposed mapping onto existing DR-005 classes (a product-policy default,
"subject to legal, privacy and beta review" per DR-005):

| Data | Proposed class | Window | Basis |
|---|---|---|---|
| Calendar event data (title, times, calendar id) | **R0** — transient computation | Memory / job lifetime only | In-memory, re-read on demand; never persisted |
| Calendar preference record (selected ids, category toggles) | **R2** — normalized personal events | 24 months | Persisted locally as member preference |
| Prepared-marks (event-id → timestamp) | **R2** — normalized personal events | 24 months | Persisted locally; no event content |

**R7 — consent / permission-decision record (determination required).** The
calendar consent record falls under DR-005 class **R7** (Privacy, consent &
security records), whose retention is currently *"TBD — LEGAL AND PRIVACY POLICY
REQUIRED."*

**Recommended default (for counsel):** retain consent/permission-decision
records for **account lifetime + 6 years** — covering the WA CPA 4-year statute
of limitations and New York's contemplated 6-year window — decided as the
**global R7 rule** (setting precedent for camera, location, and Apple Health
consent records), **not** as a calendar one-off. **Requirement:** the consent
record contains **only** the decision, timestamp, and the policy version shown —
**never calendar names or ids.**

- [ ] R7 window set to: ______  *(global rule)*
- [ ] R0 / R2 mapping confirmed as proposed / revised (see notes): ______
- [ ] Consent record limited to {decision, timestamp, policy version}. ______

## 5. Draft deletion / export wording ⟦Draft — counsel review required⟧

*Accuracy note: the wording below reflects the **current** implementation as
audited on this branch, not an aspirational state. Gaps are flagged as open
engineering items in §8, not papered over here.*

> **Calendar.** Your calendar selections and prepared-moment marks are stored
> **only on your device**. No calendar **event content** is stored by AForce, so
> there is no event data to delete or export. Disconnecting the calendar
> immediately removes your calendar preferences. A data export contains only
> **internal identifiers** — your selected calendar ids and event-id prepared
> marks — **not readable event content**.

**Audited today (read-only):**
- `disconnectCalendar()` removes the preferences key (`@aforce/calendarPrefs`)
  immediately — **verified**.
- It does **not** clear prepared-marks (`@aforce/momentPrepared`) — **open item (§8)**.
- Sign-out does **not** purge either key; `scopedStorage` **isolates** data per
  user (`key:userId`) but does not delete on sign-out — **open item (§8)**.
- Account-wide local deletion is the unbuilt **SS-04** path (`forgetAnalytics`
  today reaches only a server endpoint) — **open item (§8)**.
- Uninstalling the app removes all local calendar data — **verified** (standard
  OS behaviour).

*(The founder-proposed sentence "…removed when you disconnect, sign out, or
delete the app" is **not** accurate today for sign-out or for prepared-marks;
per instruction these are flagged in §8 and not implemented in this PR.)*

## 6. Apple App Store deliverables (blocking, pre-flag-flip) ⟦Draft — counsel review required⟧

These must complete before the flag flips; tracked in §8's return path.

1. **iOS calendar purpose string** — `NSCalendarsUsageDescription` justifying
   preparation-only use. Reading events on iOS 17+ requires the **full-access**
   calendar authorization (there is no read-only tier); request the minimum
   access that permits reading and no more, with a purpose string scoped to
   preparation.
2. **App Privacy "nutrition label"** — update the App Store privacy label to
   declare calendar data usage (purpose, linkage, tracking = none).
3. **Guideline 5.1.1 alignment check** — confirm the purpose string, the App
   Privacy label, and the privacy-policy Calendar clause (§3) are mutually
   consistent.

## 7. Sign-off

*No signature has been added or altered in this revision. Both remain PENDING.*

- Founder — Brandon ☑ 2026-08-12 (DR-011)
- Legal — ☐ PENDING
- Privacy — ☐ PENDING

**Engineering certification (to accompany sign-off) ⟦Draft — counsel review required⟧.**
The calendar invariants are enforced/verified as of commit **`d64f1319`** (the
base of this branch):
- **Test-enforced** — read-only scope (no write/create/delete, no reminders),
  field minimization (no excluded fields), and no event-data persistence
  (storage keys limited to `@aforce/calendarPrefs` and `@aforce/momentPrepared`):
  `calendarBridge.scopes.test.ts`. Flag stays OFF / build-dark clamp:
  `momentsLaunchFlip.test.ts`. Consent-revocation lifecycle:
  `intelligenceEvalS18Calendar.test.ts`.
- **Audit-verified this branch (read-only, recorded in the PR description)** —
  no network egress and no telemetry carrying event-derived data across the
  calendar/Moments surface (§2c); no direct Google/Microsoft calendar API calls
  (§2b).

Signatures are given in reliance on this certification. *(Engineering to
re-confirm the suite green at the sign-off commit; hash updated then if it has
advanced.)*

## 8. Engineering return path (after sign-off — for reference) ⟦Draft — counsel review required⟧

Happens **only once §2/§4 determinations are recorded and §7 is signed**:

1. Founder returns the signed packet; signatures and recorded determinations are
   committed into §7 and §2.
2. Engineering adds the approved matrix rows, sets R0/R2 + the ruled R7 window in
   `DR-005`, and lands the approved privacy-policy (§3) and deletion/export (§5)
   wording — **as approved, nothing more**.
3. Complete the **§6 Apple deliverables** (purpose string, App Privacy label,
   5.1.1 alignment) — blocking, pre-flag-flip.
4. Flip `moments_calendar_enabled → true`; rewrite `momentsLaunchFlip.test.ts` to
   pin the approved ON state, referencing the committed sign-off record.
5. Run the full consent / withdrawal / privacy / notification / regression
   suites; verify the #857 Home doorway + connect flow end-to-end; return a PR +
   evidence for founder review **before any deploy**. No new data or permissions.

**Open engineering items (surfaced by the §5 audit — do NOT implement in this PR):**
- **O-1** Prepared-marks (`@aforce/momentPrepared`) are not cleared by
  `disconnectCalendar()`; decide whether disconnect should also drop them.
- **O-2** Sign-out does not purge scoped calendar data (it is scope-isolated,
  not deleted); decide the intended sign-out behaviour.
- **O-3** Account-wide local deletion of scoped calendar data is part of the
  unbuilt **SS-04** GDPR/CCPA export+deletion path; ensure calendar keys are in
  scope when SS-04 is built.

## 9. Standing state

**Nothing in this packet is approved, and nothing about runtime behaviour has
changed.** `moments_calendar_enabled` remains **OFF**; no signature or
determination has been recorded; no product code was modified; and this is a
**PR only — not a merge and not a deploy**. Calendar remains a strategic AForce
capability, held solely on this documented Legal + Privacy gate. Activation
follows only after the signed artifacts and dependent canonical documents are
committed to `governance/`.
