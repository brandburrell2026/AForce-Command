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

> **Close-out addendum — 2026-08-28 (post-counsel-review). ⟦Draft — counsel
> review required⟧** O-1 and O-2 (§8) are now DECIDED and implemented in **PR A
> ([#860](https://github.com/brandburrell2026/AForce-Command/pull/860), commit
> `c81f22d6`)**: `disconnectCalendar()` clears prepared-marks, and sign-out
> purges the signing-out user's scoped calendar keys. The no-egress /
> no-provider-API invariants are now **test-enforced** by a standing guard
> (`calendarSurfaceNoEgress.guard.test.ts`, PR A), so §7's certification moves
> them from audit-verified to test-enforced. §3, §5, §6, §7 and §8 are updated
> accordingly. Still **no signature or determination recorded**; the flag
> remains **OFF**. PR A changed code; this close-out PR changes only this
> document.

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

*Close-out status (2026-08-28): O-1 and O-2 are implemented in PR A (#860); this
packet's §3, §5, §6, §7 and §8 reflect that. Only **O-3** (SS-04 account
export/deletion) remains open. The counsel action items in §2–§4 are unchanged.*

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

**Clarification.** The term `therapy` — cited illustratively in the original
packet — is **not** in the shipped keyword list (verify against §2a.1). The
health-adjacent terms actually present are `physio`, `ice bath`, and `sleep`
(note for counsel: **sleep** data is routinely treated as health-related under
consumer-health-data statutes).

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

**Founder preference:** _[FOUNDER TO COMPLETE — e.g. "retain recovery category
if defensible; if counsel determines CHD, prefer removing health terms over
building the disclosure inventory for v1" — or the reverse.]_ (Guidance for
counsel; does not decide the determination above — the checkboxes remain
counsel's.)

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

**Status.** Pending founder verification of App Store Connect availability
territories for `com.aforce.os` (ASC ID 6783984149). If availability includes
EU/UK territories, either **restrict territories before activation** or **open
the GDPR / UK-GDPR workstream**. (Both boxes above remain blank pending that
verification.)

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
> calendar preferences and prepared marks.

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
> immediately removes your calendar preferences and prepared marks. Calendar
> data does not appear in account data exports, because AForce stores no
> calendar data on its servers. When the on-device export path ships (SS-04),
> it will include only **internal identifiers** — your selected calendar ids and
> prepared-moment marks — **never readable event content**.

**Audited / implemented (this close-out):**
- `disconnectCalendar()` removes the preferences key (`@aforce/calendarPrefs`)
  immediately — **verified**.
- `disconnectCalendar()` **now also clears** prepared-marks
  (`@aforce/momentPrepared`) — **verified** (O-1, PR A `c81f22d6`).
- Sign-out **now purges** both scoped calendar keys for the signing-out user;
  a bystander user's keys survive — **verified** (O-2, PR A `c81f22d6`).
- Account-wide local deletion is the unbuilt **SS-04** path (`forgetAnalytics`
  today reaches only a server endpoint) — **open item O-3 (§8)**.
- Uninstalling the app removes all local calendar data — **verified** (standard
  OS behaviour).

*(The earlier accuracy caveat is resolved: with O-1 and O-2 implemented in PR A,
local calendar data is removed on **disconnect** (preferences + prepared marks)
and on **sign-out** (both scoped keys), as well as on app deletion. Only
account-wide export/deletion — **SS-04**, O-3 — remains to be built.)*

## 6. Apple App Store deliverables (blocking, pre-flag-flip) ⟦Draft — counsel review required⟧

These must complete before the flag flips; tracked in §8's return path.

1. **iOS calendar purpose string — already declared; verified.** iOS 17+
   requires `NSCalendarsFullAccessUsageDescription` (there is no read-only
   access tier); the legacy `NSCalendarsUsageDescription` covers pre-iOS-17.
   **Current build config (verified this close-out):** `app.json` configures the
   `expo-calendar` (~15.0.8) plugin with a single `calendarPermission` string,
   and the plugin's `withCalendar` maps it to **both**
   `NSCalendarsFullAccessUsageDescription` **and** `NSCalendarsUsageDescription`
   at prebuild — so the iOS 17+ key is already present, carrying the
   preparation-scoped copy ("…Event titles and times only — never attendees,
   notes, or attachments. You choose which calendars."). A matching
   `remindersPermission` string is also declared, disclaiming Reminders use (the
   module requires the entry; access is never requested). **No correction to the
   key is needed** — confirm the copy at sign-off. *Aside (Android, non-iOS):*
   the same plugin adds `READ_CALENDAR` **and** `WRITE_CALENDAR`; `WRITE_CALENDAR`
   is unused by the read-only bridge — a least-privilege trim to consider on the
   Android track (not iOS-blocking).
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
The calendar invariants are **test-enforced** as of commit **`c81f22d6`** (PR A
[#860](https://github.com/brandburrell2026/AForce-Command/pull/860)):
- Read-only scope (no write/create/delete, no reminders), field minimization
  (no excluded fields), and no event-data persistence (storage keys limited to
  `@aforce/calendarPrefs` and `@aforce/momentPrepared`):
  `calendarBridge.scopes.test.ts`.
- Flag stays OFF / build-dark clamp: `momentsLaunchFlip.test.ts`.
- Consent-revocation lifecycle: `intelligenceEvalS18Calendar.test.ts`.
- **No telemetry carrying event-derived data, no network egress, and no direct
  Google/Microsoft provider-API calls** across the calendar/Moments surface
  (§2b, §2c) — now a standing static-scan guard,
  `calendarSurfaceNoEgress.guard.test.ts` (PR A). *(Audit-verified in the prior
  revision; converted to a test in PR A so it fails CI on regression.)*
- Local deletion — disconnect clears both keys; sign-out purges the signing-out
  user's scoped keys: `calendarLocalDeletion.test.ts` (PR A; O-1/O-2).

Full suite green at `c81f22d6` (7887 passed). Signatures are given in reliance
on this certification.

## 8. Engineering return path (after sign-off — for reference) ⟦Draft — counsel review required⟧

Happens **only once §2/§4 determinations are recorded and §7 is signed**:

1. Founder returns the signed packet; signatures and recorded determinations are
   committed into §7 and §2.
2. Engineering adds the approved matrix rows, sets R0/R2 + the ruled R7 window in
   `DR-005`, and lands the approved privacy-policy (§3) and deletion/export (§5)
   wording — **as approved, nothing more**.
3. Complete the remaining **§6 Apple deliverables** (App Privacy label + 5.1.1
   alignment; the calendar purpose strings are already declared — §6) —
   blocking, pre-flag-flip.
4. Flip `moments_calendar_enabled → true`; rewrite `momentsLaunchFlip.test.ts` to
   pin the approved ON state, referencing the committed sign-off record.
5. Run the full consent / withdrawal / privacy / notification / regression
   suites; verify the #857 Home doorway + connect flow end-to-end; return a PR +
   evidence for founder review **before any deploy**. No new data or permissions.

**Engineering items:**
- **O-1 — DECIDED, implemented in PR A `c81f22d6`.** `disconnectCalendar()` now
  also clears prepared-marks (`@aforce/momentPrepared`).
- **O-2 — DECIDED, implemented in PR A `c81f22d6`.** Sign-out purges the
  signing-out user's scoped calendar keys (`@aforce/calendarPrefs`,
  `@aforce/momentPrepared`); a bystander user's keys survive.
- **O-3 — OPEN.** Account-wide local deletion / export of scoped calendar data
  is part of the unbuilt **SS-04** GDPR/CCPA export+deletion path; ensure
  calendar keys are in scope when SS-04 is built. (Also gates §2d if EU/UK.)
- **Convert no-egress audit → standing test — DONE (PR A).** The
  no-egress / no-provider-API invariants are now enforced by
  `calendarSurfaceNoEgress.guard.test.ts` (see §7), not a one-off audit.

## 9. Standing state

**Nothing in this packet is approved, and nothing about runtime behaviour has
changed.** `moments_calendar_enabled` remains **OFF**; no signature or
determination has been recorded. This close-out PR changes **only this document**
(no product code); the O-1/O-2 code lives in PR A
([#860](https://github.com/brandburrell2026/AForce-Command/pull/860), `c81f22d6`),
which is likewise **PR only — not a merge and not a deploy**. Calendar remains a
strategic AForce capability, held solely on this documented Legal + Privacy gate.
Activation follows only after the signed artifacts and dependent canonical
documents are committed to `governance/`.
