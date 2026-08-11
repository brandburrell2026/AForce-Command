# PR-002 Appendix A — Calendar data class (counsel packet, PENDING LEGAL + PRIVACY)

**Status:** DRAFT FOR COUNSEL · Founder approved 2026-08-12 (DR-011) ·
**Legal sign-off ☐ PENDING · Privacy sign-off ☐ PENDING.**
Until both sign: `moments_calendar_enabled` stays OFF in production, no
DATA-CLASSIFICATION-MATRIX rows are added, and no real user's calendar is
read. This document is the complete description of what would be collected,
why, and how — written to be reviewable without reading code.

---

## 1. Proposed data class (for the DATA-CLASSIFICATION-MATRIX, on approval)

| Field | Value |
|---|---|
| Class name | `calendar_event_metadata` |
| Contents | Event **title**, **start/end time**, **calendar id/name**, all-day flag — from calendars the member individually selects |
| Explicitly excluded | Attendees, organizers, notes/descriptions, locations, attachments, URLs, recurrence metadata beyond occurrence times, event history |
| Source | On-device EventKit via expo-calendar, **read-only** permission |
| Purpose (purpose-bound, §6) | Sole purpose: derive preparation Moments (§43) — prep windows + one hydration-first action |
| Processing | **On-device only.** Never transmitted, never server-side |
| Persistence | **None** (in-memory, re-read on demand). Persisted: member preferences (selected calendar ids, category toggles) and prepared-marks (event-id → timestamp) — no event content |
| Proposed retention class | R0 (transient computation) for event data; R2 for the preference/prepared-mark records |
| Deletion | Disconnect forgets preferences immediately; event data has no stored copy to delete. (Interaction with SS-04's account-level export/deletion path: only the preference record would be in scope) |
| Consent surface | OS calendar permission (Apple-mediated) + in-app CONNECT step + per-calendar and per-category toggles + persistent privacy footer + MANAGE CALENDAR ACCESS deep link |

## 2. Questions for counsel

1. **MHMD / sensitive-inference analysis.** Titles are member-authored and
   may incidentally contain health terms (e.g. "physio", "therapy"). The
   classifier maps a fixed keyword list to preparation categories and skips
   everything else; is the derived category ("training", "recovery") a
   consumer-health-data inference under WA MHMD / NV SB 370, and if so does
   the existing consumer-health-data-privacy disclosure inventory need a
   calendar-events entry before activation?
2. **Privacy-policy delta.** `artifacts/aforce-os/legal/privacy-policy.md`
   states data access is limited to described features; on activation it
   needs a calendar section (draft in §3 below) — confirm wording.
3. **Third-party calendar ToS.** Google/Outlook accounts surface through the
   device's EventKit, not their APIs — confirm no additional API-terms
   obligations attach.
4. **Minor users.** Calendar reading for users under the app's age floor —
   any COPPA interaction beyond the existing SS-08 item?

## 3. Draft privacy-policy addition (for counsel wording review)

> **Calendar (optional).** If you connect your calendar, AForce reads event
> titles and times from the calendars you select — only on your device, only
> to prepare you for upcoming moments. We never read attendees, notes,
> locations, or attachments; we never store or transmit your calendar data;
> and you can disconnect at any time, which immediately stops all reading.

## 4. Sign-off

- Founder — Brandon ☑ 2026-08-12 (DR-011)
- Legal — ☐ PENDING
- Privacy — ☐ PENDING
