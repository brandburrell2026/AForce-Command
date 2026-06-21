---
name: AForce score-from-ledger integration
description: How the command-event ledger becomes the score's INPUT SOURCE without changing score VALUES (interpretation A), and why the projection must fail closed.
---

# Score-from-Ledger integration (interpretation A)

Owner-approved "score integration" = make the shared command-event ledger the
authoritative INPUT SOURCE for the EXISTING hydration score while preserving
EXACT score VALUES (parity). It does NOT mean letting Command Confidence /
Execution Readiness move the score (interpretation B is rejected). Score-
Protection still holds: only completed behaviour changes score; nothing here
awards/mutates/fabricates score.

## The seam
- Implemented as a pure STATE-PROJECTION (`utils/scoring/scoreLedgerProjection.ts`):
  project a `UserState` whose score-input families come from the ledger, then run
  the UNCHANGED `buildBreakdown` on it. The score formula is never edited.
- A default-OFF flag (`scoreFromLedgerHybrid`, OFF in DEFAULT_FLAGS AND
  DEMO_ALL_ON) is the only switch that would ever select the projected state.
  Shadow-compare only (`shadowCompareScoreFromLedger`) until live-population
  parity is proven; do NOT wire into runtime (realApi) at introduction.

## Fail-closed is mandatory (no fabrication)
**Why:** no score family is losslessly ledger-derivable today.
- Ledger `intake` events lack the per-event impact decomposition
  (baseImpact/capAdjusted/immediate/delayed/delayedDurationMin) that
  `materializedIntakePoints` consumes → cannot reconstruct `intakeEvents`.
- Ledger `context_snapshot` carries only weatherTempC + a `hasFreshBiometrics`
  boolean + fetch timestamps — NOT the score's heatLoad/sweatRate/activityLevel.

**How to apply:** override a family from the ledger ONLY when lossless; otherwise
keep the live value verbatim. Today every family fails closed, so the projection
is a VERIFIED NO-OP. Before any cutover, enrich the ledger with score-grade
events (full intake decomposition + score context inputs), then flip per-family.

## Parity gate is STRICTER than final score
**Why:** the score clamps to [0,100]; two different input sets can clamp to the
same headline number, hiding real drift.

**How to apply:** `compareScoreParity` requires equal final score AND
decayPerMinute AND minutesSinceLast AND identical contribution vector
(id, order, delta). Ignoring label/hint/maxMagnitude is fine for SCORE-VALUE
parity (they don't change the number); add text parity only if explainability/UI
parity becomes a cutover requirement. Any runtime cutover MUST be gated on
contribution-level parity (CI/dev assert), not just the final number.

## Clock purity prerequisite
The score path is pure in `(state, now)` — `now` is threaded through
breakdown/scoringEngine including the social helpers (computeDecayPerMinute).
Determinism under a fixed clock is what makes live-vs-projected parity provable.
