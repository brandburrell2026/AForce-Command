---
name: AForce Smart Modes + Friction Score
description: How the four-mode engine and the internal Friction KPI are wired, and the constraints that keep them additive.
---

# Smart Modes (Heat / Workout / Travel / Recovery)

Exactly **four** modes, fixed order `heat → workout → travel → recovery`. The mode
list type is closed — do not add a fifth mode; that would break the navigation/build lock.

- The engine is **pure** (no `Date.now`, no I/O): a context of signals in → active
  modes + two aggregate multipliers out. Keep it pure so it stays unit-testable.
- `reminderIntensityMultiplier` (heat/workout sharpen, recovery softens) is the ONLY
  live behavioral effect. It feeds the reminder policy as an **optional** field that
  defaults to `1` (a no-op). **Why:** the reminder behavior shipped earlier must be
  byte-for-byte unchanged when no mode is active. Any new mode signal must preserve
  that default-1 contract.
- `hydrationTargetMultiplier` is **advisory/guidance only** — it is NOT wired into the
  live daily target or scoring engine. **Why:** rewiring the target would change scored
  behavior, which the build lock forbids. Surfacing it as copy is fine; mutating
  `dailyTarget`/scores is not.
- Mode guidance copy is under the water-first wording lock: every string must
  **lead with** `HYDRATE NOW` or `Start with water` (assert `startsWith`, not just
  `contains('water')`).
- **Travel mode is dormant** in wiring (`isTravelDay: false`) because no
  timezone/travel-history signal exists yet. The engine path is built and tested;
  only the live trigger is missing. Follow-up: feed a real travel signal.

# Friction Score (internal KPI, no UI)

A 0..100 composite (higher = less friction) inside the analytics metrics rollup.
Components: time-to-first-log, time-to-first-win, reminder response rate, daily
active usage, logging completion rate.

- **Null-safe averaging:** the score is `null` when no component is available, and
  averages only the components that are present. Don't assume all five exist.
- **time-to-first-log is true first-log latency**, not the per-log median. Anchor =
  onboarding-completed (else first session) → the first `log_action` **at or after**
  that anchor (a stray pre-anchor log must not count). The per-log median Time-To-Log
  stays a separate metric — don't conflate the two. **Why:** an earlier reviewer pass
  failed for measuring median TTL when the KPI asked for onboarding→first-log latency.
