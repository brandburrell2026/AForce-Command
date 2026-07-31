# Reviewer Handoff Summaries — §39

**Status:** ⏳ Handoffs prepared. **NEITHER REVIEW HAS BEEN PERFORMED OR SIMULATED.**
**Prepared:** 2026-07-22

> **No legal or scientific field has been filled on behalf of a reviewer.** Approval may not be
> inferred from the existence of these packages.

---

## A. Legal reviewer

| | |
|---|---|
| **Package** | `governance/reviews/SECTION-39-LEGAL-REVIEW-PACKAGE.md` |
| **Time to read** | ~20 minutes. Self-contained — no repository access needed. |
| **Scope** | Three candidate prediction types only |

**What is being reviewed:** whether a consumer hydration app may present forward-looking
statements derived from a user's own logged behavior, and in what language.

**The three candidates:**

1. **Tomorrow Load Forecast** — projected demand for the coming day
2. **Performance Drift** — direction of a slow multi-day trend *(highest language risk)*
3. **Environmental Pressure Outlook** — forward heat/humidity/altitude load

**Twelve rulings required:** presentability as predictions · terminology risk in
"forecast/outlook/drift/load" · whether context-only output needs different terminology ·
required qualifiers and disclaimers · prohibited certainty language · completeness of the
medical/diagnostic/injury prohibition list · treatment of adverse-performance warnings ·
surface-specific language · synthetic predictions in investor demos · acceptability of an
English-only launch · claims requiring evidence disclosure · claims always suppressed.

**Decision form:** §8 of the package — per-type rulings (Approved · Approved With Conditions ·
Rejected · Needs Revision · Not Reviewed) plus a row per question.

**Expected output:** completed §8, signed and dated. On receipt: record in
`REVIEW-APPROVAL-MATRIX.md` and extend Risk-Register **CR-1** to cover §39 explicitly.

**Context the reviewer should know:** a mechanical gate already blocks medical, diagnostic, causal,
and certainty language and fails closed; `calibrated_personal` predictions are **prohibited**;
**no prediction algorithm exists yet** — this reviews the language contract, not shipped behavior.

## B. Scientific reviewer

| | |
|---|---|
| **Package** | `governance/reviews/SECTION-39-SCIENTIFIC-REVIEW-PACKAGE.md` |
| **Time to read** | ~30 minutes. Self-contained. |
| **Scope** | DR-003 thresholds · N-1 confidence thresholds · N-2 success-contract fields · three types |

**What is being reviewed:** whether the proposed evidence thresholds are defensible, and what
would make each prediction type evaluable.

**Three specific items:**

- **DR-003** — 7 days / 5 comparable observations / 3 distinct days. **Founder product-policy
  defaults with no scientific basis.**
- **N-1** — the confidence floor and calibrated minimum are **UNSET**. Two proposed values (0.35 /
  0.70) were **rejected as unbased**. **While unset, the engine produces nothing at all** — every
  projection resolves to *Insufficient Data*.
- **N-2** — 8 fields UNSET per type (observed outcome, success criteria, error tolerance, backtest
  dataset/method, success metric, calibration method, recalibration trigger), plus **14/14 backtest
  governance items UNSET**.

**Twelve determinations required** — see package Part 5. The two highest-leverage:

- **Q10:** what evidence is required before any confidence value may be shown? *(This sets N-1 and
  unblocks all output.)*
- **Q3:** what observed outcome makes each prediction evaluable? *(Three answers; nothing can be
  backtested without them.)*

**Decision form:** §6 — determinations table, evaluation-vocabulary verdict, per-type verdict.

**Expected output:** completed §6, signed and dated. On receipt: record in
`REVIEW-APPROVAL-MATRIX.md`; resolved values flow into `PREDICTION-SUCCESS-CONTRACTS.md` and
`config/hydroStateModel.ts`.

**Context the reviewer should know:** the knowledge graph produces **no numeric confidence** — only
a five-value categorical state, because no weighting is approved (R-23). The reviewer is not
being asked to validate an existing model; **no model exists.** They are being asked to define
what "working" would mean before anything is built.

## C. Status

| Review | Package | Reviewer | Status |
|---|---|---|---|
| Legal | ✅ Prepared | ❌ Unassigned | ⏳ **NOT YET REVIEWED** |
| Scientific | ✅ Prepared | ❌ Unassigned | ⏳ **NOT YET REVIEWED** |

**Both §39 review gates remain blocked.**
