---
name: AForce Performance Memory (unified observational layer)
description: The additive, read-through Performance Memory layer — what it is, its Score-Protection boundary, and two non-obvious test gotchas that bit during the build.
---

# Performance Memory — unified observational layer

A purely OBSERVATIONAL read-through layer that folds the app's behaviour history
into one descriptive snapshot. It is additive over the existing stores (they
stay source-of-truth) and was built to a hard founder lock: **NEVER** touch
commandEvents / commandLedger / Command Confidence, no ML/LLM, no new scoring
engine, and Score-Protection holds (it MEASURES, never reads-into/awards/mutates
the score, never dispatches).

Three streams it captures that nothing else did: travel days, caffeine intake,
self-reported daily priority (check-in goal). A pure signals core + an
AsyncStorage service mirror the `commandEvents` (pure) / `commandLedger`
(service) split. A pure aggregator composes the EXISTING pure engines rather
than re-deriving them, so the unified view can't disagree with the individual
surfaces.

## Hard rules that are easy to violate

- **No-fabrication on cross-service capture.** When a producer normalizes a
  missing/invalid input to a fallback (e.g. voice check-in normalizes an absent
  goal to `'train'` for ITS OWN record), the Performance Memory capture must
  gate on the **original** user input, not the normalized fallback — otherwise
  it persists a "priority" the member never picked. **Why:** that silently
  fabricates an observed signal, breaking Score-Protection's no-fabrication
  contract. **How to apply:** at every capture call site, branch on the raw
  answer (`isCheckInGoal(answers.goal)`), let builders return `null` on bad
  input, and never feed a defaulted value into a capture builder.

- **Structural Score-Protection guard.** There is a source-scanning invariant
  test asserting the PM files never `dispatch(`, never import an engine/reducer/
  store (pure core), and never call score-mutating helpers. Keep it green when
  adding files to the stack — it fails the moment a forbidden dependency is
  *added*, before behaviour can drift.

## Two test gotchas (both cost a debug cycle)

- **Service tests prune against the real `Date.now()`.** The bounded streams
  drop anything older than the 180-day retention window using the live clock,
  so a hardcoded old-epoch fixture gets pruned to empty. Anchor service-test
  fixtures to `Date.now()` (the *pure* tests inject `nowMs`, so they're fine).
  Same trap for day-keyed dedupe ids: seed with `travel:${floor(now/86_400_000)}`
  so a re-record actually collides.

- **A capture is a cross-service write side-effect.** Adding the priority
  capture inside `recordCheckIn` made the voice-checkin service write a SECOND
  storage key, breaking that suite's `mem.size === 1` isolation assertion. Fix:
  mock the capture module in the *producer's* test; it owns its own key and is
  tested separately. **Why:** producer suites assert single-key isolation;
  a new observational write silently violates it.
