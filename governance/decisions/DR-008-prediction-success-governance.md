# DR-008 — Prediction Success Governance

- **Status:** ACCEPTED — settled.
- **Date:** 2026-07-22 · **Decider:** Brandon (founder)
- **Governs:** §39 Prediction Engine™ — every prediction type, present and future
- **Related:** `DR-003`, `DR-006`, `DR-007`, `governance/PREDICTION-SUCCESS-CONTRACTS.md`
- **Scope:** governance and design only. **No code, schema, migration, flag, or UI.**

---

## 1. Purpose

**Freeze how every prediction type is evaluated before any prediction algorithm is implemented.**

**A prediction type may not be activated unless it has an approved success contract.**

This inverts the usual order deliberately: the measure of success is fixed before the thing being
measured exists, so success cannot be defined retroactively to match whatever the engine produces.

## 2. Required success contract — 26 fields

Every authorized prediction type must define all 26:

Prediction Purpose · Prediction Horizon · Input Domain · Prohibited Inputs · Observed Outcome ·
Outcome Source · Success Criteria · Error Tolerance · Invalidation Rules · Expiration Rules ·
Minimum Historical Data · Backtest Dataset Requirements · Backtest Method · Success Metric ·
Calibration Method · Recalibration Trigger · Confidence Eligibility · Suppression Conditions ·
§42 Language Category · Approved Surfaces · Prohibited Surfaces · Privacy Class · Retention Class ·
Required Versions · Required Reviews · Current Status

**Do not invent scientific thresholds, success metrics, tolerances, or calibration values.**
Where there is no approved basis, the field is marked **`UNSET — pending scientific review`**.

**Fail closed when a required field is UNSET.** A type with any UNSET required field cannot
activate, and the engine must not substitute, infer, or default the missing value.

Applied to the three current candidates in `governance/PREDICTION-SUCCESS-CONTRACTS.md`.

## 3. Canonical prediction lifecycle (frozen)

```
Prediction Created
  → Prediction Stored
    → Prediction Expires or Remains Eligible
      → Observed Outcome Recorded
        → Prediction Evaluated
          → Backtest Record Created
            → Governed Recalibration Considered
```

### 3.1 The frozen invariant

> **Predictions never become facts. Observed outcomes become facts.**

A prediction may be recorded as **an event that occurred** — that a prediction was made, of a
given type, at a given time. Its **predicted content** must never be treated as an observed
physiological, behavioural, environmental, or performance fact.

This is the structural guard against a system that believes its own forecasts.

## 4. Performance Memory rule

**Performance Memory™ may record:**

that a prediction was made · prediction type · horizon · state · confidence metadata · the
eventual observed outcome · evaluation result · invalidation reason · version context

**Performance Memory™ must never:**

| # | Prohibition |
|---|---|
| 1 | Rewrite a prediction as an observed outcome |
| 2 | Treat predicted content as completed behaviour |
| 3 | Use a prediction alone to change HydroState |
| 4 | Use a prediction alone to increase Command Confidence™ |
| 5 | Convert a prediction into a personal trait |
| 6 | Create a causal claim from prediction accuracy |

Prohibition 6 matters: a well-calibrated prediction is evidence the *model* works, never evidence
that the predicted mechanism is causal.

## 5. Outcome evaluation — nine results

**Do not force every prediction into a binary correct/incorrect result.**

| Result | Meaning |
|---|---|
| `correct` | Outcome matched within the approved definition |
| `directionally_correct` | Direction right, magnitude outside tolerance |
| `within_tolerance` | Inside the approved error tolerance |
| `outside_tolerance` | Outside the approved error tolerance |
| `incorrect` | Outcome contradicted the projection |
| `invalidated` | Supporting evidence deleted or invalidated before evaluation |
| `expired_without_observable_outcome` | Window closed; nothing observable occurred |
| `outcome_unavailable` | Outcome could not be observed (missing data, no sync) |
| `insufficient_evidence_to_evaluate` | Observation exists but is too thin to judge |

The last four are **not failures of the prediction** — collapsing them into "incorrect" would
systematically understate accuracy and corrupt calibration.

### 5.1 Evaluation record — 18 required fields

prediction identifier · prediction type · prediction creation time · prediction horizon ·
prediction state · prediction confidence metadata · policy version · model version · graph
version · profile version · baseline version · observed outcome identifier · outcome time ·
evaluation method · evaluation result · error magnitude (where applicable) · invalidation reason ·
evaluator version · recorded time

## 6. No automatic self-training (frozen)

> **The Prediction Engine may not silently retrain, reweight, recalibrate, or change its own model
> after individual predictions or outcomes.**

**Online learning and autonomous self-modification are NOT authorized.**

All model changes occur through a **governed recalibration process** requiring:

defined trigger · eligible dataset · minimum sample requirement · evaluation report · comparison
against current model · regression analysis · bias and subgroup review where applicable ·
scientific review where required · engineering review · privacy review · legal review where claim
behaviour changes · version increment · rollback plan · approval record · change-control record

## 7. Backtest governance

Per prediction type, document: eligible historical period · minimum sample size · exclusions ·
missing-data handling · **leakage prevention** · **training-versus-evaluation separation** ·
baseline comparator · success metric · calibration metric · error metric · subgroup analysis
where applicable · failure threshold · rollback threshold · review owner.

**Do not use the same records for both tuning and final evaluation** without documenting the
method and its limitations.

**Do not claim validation from internal tests alone.** A passing internal backtest is not
validation (truth rules §2).

## 8. Open items

| ID | Status |
|---|---|
| **N-1** | **OPEN** — prediction confidence thresholds remain UNSET. **No numeric defaults are approved.** |
| **N-2** | **OPEN** — outcome definitions, backtest methods, success metrics, tolerances, and calibration methods remain UNSET until scientific review. |
| **N-4** | **NEW — OPEN.** *Prediction Recalibration Governance:* the operational process, approval owners, minimum dataset, validation method, release criteria, rollback criteria, and audit requirements for prediction-model recalibration are **not yet approved**. **N-4 may not be closed through documentation alone** — it requires an approved operational process. |

## 9. Prohibited behaviour (frozen)

The Prediction Engine must **never**:

treat a prediction as an observation · modify historical outcomes · create completed behaviour ·
write HydroState directly · write Today's Command directly · increase a score because a prediction
was generated · create Performance DNA directly · self-train automatically · change thresholds
silently · change model weights without versioning · publish a prediction without Evidence Engine
and §42 review · emit unsupported certainty · emit diagnostic, clinical, injury, illness,
dehydration, or treatment claims · use product purchase as evidence of improved readiness · treat
a scan, view, or recommendation as completed behaviour

## 10. Status

**§39 remains `Specified`.** It does **not** advance to Partially Built. **No prediction type
becomes active.** All three current types remain **candidates only**.

**Implementation blocked on:**

1. Legal review of §39 language
2. Scientific review of **DR-003, N-1, and N-2**
3. Stage 2 graph-schema deployment (R-21)
4. **An approved success contract for each prediction type**
