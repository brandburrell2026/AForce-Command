---
name: AForce Analytics Layer
description: Internal, no-UI analytics that powers the engine; the durable rules behind it.
---

AForce analytics is INTERNAL and has NO user-facing surface (build lock:
no tab/nav/dashboard). It exists to power the engine, honoring "Powerful
underneath. Simple on top." It mirrors the dailyWins/explainability
split: a PURE metrics module + a thin persisted recorder service.

**Durable rules (not derivable from a quick read):**

- Keep ALL analytics math in the pure metrics module. The persistence
  service and the recorder hooks import RN/AsyncStorage, which the vitest
  setup here cannot transform (same failure mode as the orbReasons test),
  so anything in those files is effectively untestable. Pure module = the
  only testable seam.
- Metrics map ONLY to real observed signals — never fabricate. Onboarding
  completion is recorded at the actual finish moment and is deliberately
  NOT backfilled, so users from before the feature shipped read as
  not-completed. That under-counting is intentional honesty, not a bug to
  "fix" with a backfill.
- Reminder "slots" are the Day 0/1/3/7 cadence slots, NOT calendar days.
  Response rate counts only responses to slots that were actually shown
  (intersection), so the rate stays within [0,1] even with stray or
  truncated events.
- The visible win banner and the analytics recorder MUST read the SAME
  win from the shared top-win hook. Do not reintroduce inline win
  derivation in the banner — divergence would mean "the win recorded" ≠
  "the win shown".

**Concurrency invariant (the subtle one):** every persisted append is a
read-modify-write and MUST go through the single in-module write queue.
**Why:** the home recorder fires multiple recorders on mount and the
notification banner can fire concurrently; without serialization they
read the same snapshot and clobber each other, silently dropping events
and corrupting every derived metric. Any new recorder must reuse the
queued append path, never write storage directly. This holds only under
the single-JS-runtime assumption; a background/multi-process runtime
would need a storage-level transaction instead.

**Scope boundary:** the layer only records + derives and exposes a
metrics getter for the engine to read. Active consumption (e.g. adaptive
reminders reacting to response rate / time-to-first-win) is a later phase.
