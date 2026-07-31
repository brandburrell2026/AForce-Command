# DR-006 — Prediction Sufficiency Clarification

- **Status:** ACCEPTED — settled. **Clarifies and constrains `DR-003`.**
- **Date:** 2026-07-22 · **Decider:** Brandon (founder)
- **Governs:** §39 Prediction Engine™, §42 Language Gate
- **Related:** `DR-003`, `docs/PREDICTION-ENGINE-SPEC.md`, `OPEN-RISKS.md` R-16, R-20

---

## Clarification

The `DR-003` thresholds — **7 days · 5 comparable observations · 3 distinct days** — are
**minimum beta eligibility conditions only.**

**They are not sufficient for a High-Confidence Pattern or a strongly personalized prediction.**

## Required interpretation

| # | Rule |
|---|---|
| 1 | The minimum thresholds may qualify **only for an Emerging Personal Prediction**, and only when all other quality gates pass. |
| 2 | **Context-Only Estimates must not be presented as something learned about the individual.** |
| 3 | **Calibrated Personal Predictions require additional evidence and successful backtesting.** |
| 4 | **No high-confidence language may be derived solely from the minimum beta threshold.** |
| 5 | **Prediction eligibility and prediction confidence are separate decisions.** Passing the gates earns the right to speak, not the right to sound certain. |
| 6 | The **§42 language gate must mechanically enforce** these distinctions. |

## The four states (unchanged, now load-bearing)

1. **Insufficient Data**
2. **Context-Only Estimate**
3. **Emerging Personal Prediction**
4. **Calibrated Personal Prediction**

## Why this matters

`DR-003`'s thresholds are permissive by design — they are beta defaults meant to be revised by
backtesting. Read alone, they could be taken as licence to speak confidently on 7 days of data.
This record closes that reading: **eligibility ≠ confidence.** The gate that prevents the failure
is mechanical (§42), not editorial.

Performance DNA™ retains its **separately approved lifecycle and evidence thresholds**
(Founder Decision 4 / `DR-003`); nothing here relaxes them.
