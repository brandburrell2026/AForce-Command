---
name: AForce explainability drivers
description: How the plain-language score "drivers" layer relates to the detailed score breakdown.
---

The user-facing score explanation has TWO layers, both derived from the
same `ScoreContribution[]` (output of `buildBreakdown`) — they must never
diverge or invent their own numbers:
- **Detailed**: the per-contribution rows + formula in
  `ScoreBreakdownSheet` (power-user view; technical labels are fine here).
- **Simple**: four plain drivers — Water / Sleep / Heat / Recovery —
  produced by the pure `buildScoreDrivers` (utils/scoring/drivers.ts),
  rendered by `ScoreDrivers` at the top of the same sheet.

**Driver roll-up rule:** each driver sums a fixed set of contribution ids
(water = base/aforce_bonus/recency/urine; sleep = sleep/health_signals;
heat = context/output; recovery = recovery/confirmation/consistency/
symptom). `social_intake` is intentionally excluded from the simple view
(stays in DETAILS). All four drivers always render (neutral at zero) so
the picture is complete and honest.

**Copy lock (Priority #2):** driver sentences must stay ONE sentence,
jargon-free, non-diagnostic — never surface "HRV", "urine signal",
"decay", "deficit", "output stress", "symptoms", or any formula. Goal is
transparency + trust, not clinical accuracy.

**Why:** there was already a hidden 4-factor scaffold (services/orbReasons.ts,
water/heat/sleep/correction, gated `spec_orb`) built for exactly this but
never wired; Priority #2 chose to expose plain drivers via the breakdown
sheet rather than wire that scaffold, because the sheet is the existing
score-explanation surface reachable by tapping the Orb (no new navigation,
build-lock safe). orbReasons.ts uses "correction" as its 4th factor; the
shipped drivers use "Recovery" per the explicit product ask.

**Test placement gotcha:** aforce-os vitest `include` only globs
`utils/__tests__/**` (NOT nested `utils/scoring/__tests__/**`), so scoring
helper tests must live in `utils/__tests__/`, importing `../scoring/<file>`.
