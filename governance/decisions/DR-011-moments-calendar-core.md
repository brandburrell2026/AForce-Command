# DR-011 — AForce Moments: calendar core (Phase 3b) — constrained build authorization

**Date:** 2026-08-12
**Deciders:** Brandon (founder) — APPROVED ("continue with Calendar core"),
covering PR-002 items **5.3** (calendar-derived surfacing — Brandon; **Julius
COUNTERSIGNED 2026-08-12**, founder relayed — gate satisfied), **5.5** (native build — Brandon, sole gate),
and the founder half of **5.2** (calendar data class — **LEGAL sign-off
PENDING · PRIVACY sign-off PENDING**, both REQUIRED by
INTELLIGENCE-CHANGE-CONTROL §4 before activation).
**Source proposal:** governance/proposals/PR-002-aforce-moments.md
(Appendix A is the counsel packet for 5.2).

---

## Ruling 1 — Build-dark authorization (Compliance Framework §10 pattern)

The calendar core (expo-calendar dependency, read-only bridge, classification,
Connect Calendar surface) is authorized to BUILD behind a NEW dedicated flag
`moments_calendar_enabled` — **OFF in production** — in addition to
`moments_enabled`. **Activation for any real user is BLOCKED until Legal and
Privacy sign Appendix A** and the DATA-CLASSIFICATION-MATRIX rows are
formally added. Building dark does not add the data class: with the flag off,
no code path requests calendar permission or reads an event.

## Ruling 2 — Reconciliation with the Night Out precedent (item 5.3)

The Night Out ruling ("no automatic activation from calendar") is reconciled,
not reversed: calendar-derived Moments exist only after an INTENTIONAL,
multi-step user action — the member taps CONNECT, grants the OS permission,
and individually selects calendars and event categories (everything is
unselected/least-privilege by default). No feature of AForce OS activates,
changes state, or interrupts based on calendar content alone; Moments derived
from calendar events flow through the same DR-010 notification budget and the
same advisory-only Score Protection as manual Moments.

## Ruling 3 — Data-minimization constraints (binding on all future work)

1. **Read-only, forever.** No write scope may be requested (Ruling-H
   pattern; enforced by test).
2. **Titles + times + calendar ids only.** Attendees, notes, locations,
   organizers, attachments, and URLs are never read past the immediate
   minimal mapping. Titleless events surface as PRIVATE EVENT.
3. **In-memory only.** Fetched events and derived calendar-Moments are never
   persisted. The only persisted artifacts are the member's own preferences
   and prepared-marks (calendarEventId → timestamp) — no event content.
4. **User-selected calendars only; category toggles filter classification;
   confidence-gated classification skips rather than guesses.**
5. **Local processing only.** No calendar-derived data is transmitted
   anywhere.

## Explicitly NOT decided here

Production activation of `moments_calendar_enabled` (blocked on Legal +
Privacy per Appendix A); the "Ritual" terminology ruling. (5.3's Julius
gate: satisfied 2026-08-12. Item 5.6: see DR-012.)
