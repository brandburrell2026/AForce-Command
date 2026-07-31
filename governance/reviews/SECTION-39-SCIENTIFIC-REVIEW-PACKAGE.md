# §39 Prediction Engine™ — Scientific Review Package

**Status:** ⏳ **NOT YET REVIEWED** — prepared for an external scientific reviewer
**Prepared:** 2026-07-22 (Phase 3.7) · **Reviewer:** _to be assigned_
**Covers:** DR-003 sufficiency thresholds · N-1 confidence thresholds · N-2 success-contract fields
· three candidate prediction types

> **This package is self-contained.** You do not need to read the repository to review it.
>
> **Nothing here is approved.** No value in this document has a scientific basis unless explicitly
> marked as a founder product-policy default. Fields marked **`UNSET — scientific determination
> required`** are deliberately empty: they were **not** filled with plausible-looking values,
> because doing so would manufacture false precision.

---

## Part 1 — Context (read first)

### 1.1 What the system is

AForce OS is a hydration and performance operating system. Its single hero metric is
**HydroState** — a 0–100 score of current performance state, computed from the user's profile,
logged fluid intake, environmental conditions, sleep, and wearable signals.

### 1.2 What §39 would add

A **Prediction Engine** that projects the user's **own demonstrated response pattern** forward.

**It is explicitly not:** a health forecast · a medical prediction · a diagnosis · a risk
assessment. It projects only patterns the individual has already demonstrated in their own
recorded data.

### 1.3 Where predictions come from

A **Performance Knowledge Graph** records observed relationships between three node kinds:

- **Context** — heat, travel, poor sleep, high training load
- **Behavior** — completed commands, logged intake, timing
- **Outcome** — recovery movement, follow-through, self-reported energy (1–5)

Each **edge** (a context→behavior→outcome co-occurrence) carries a supporting-observation count, a
contradicting count, the number of **distinct days** observed, and a coarse evidence state.

**Critically: the graph produces no numeric confidence today.** There is no approved weighting
formula, so relationship strength is stored as `null`. Only a five-value categorical state exists:
`insufficient` · `emerging` · `supported` · `contradicted` · `superseded`.

### 1.4 The four prediction states

| State | Meaning |
|---|---|
| **Insufficient Data** | Gates unmet. No claim made. |
| **Context-Only Estimate** | Derived from current conditions, **not** from learning about this person. Must be labeled as such. |
| **Emerging Personal Prediction** | Gates met, low confidence. Cautious language only. |
| **Calibrated Personal Prediction** | **NOT AUTHORIZED.** Blocked pending, among other things, this review. |

**A founder ruling separates eligibility from confidence:** passing the data gates earns the right
to speak, not the right to sound certain.

### 1.5 What already constrains the system

- Only **completed behavior** may change the score. Recommendations, scans, product views, and purchases never do.
- Every user-facing claim passes a mechanical language gate blocking medical, diagnostic, causal, and certainty language.
- **Association is never presented as causation.**
- No claim may be made without a traceable path back to real recorded events.

## Part 2 — What requires your determination

### 2.1 DR-003 — current sufficiency thresholds

These are **founder-set product-policy defaults for beta validation**. They have **no scientific
basis** and are presented to you for determination.

| Gate | Current default | Basis |
|---|---|---|
| Minimum usable personal history | **7 days** | Product policy only |
| Minimum comparable observations per type | **5** | Product policy only |
| Distribution | **≥ 3 distinct days** | Product policy only |
| Fresh current-context inputs | required | Engineering |
| Sufficient signal quality | required | Engineering |
| Confidence floor | **UNSET** | **N-1 — your determination** |

> A broader context-based forecast may use **less** personal history, provided it is clearly
> labeled as context-based rather than personal learning.

### 2.2 N-1 — confidence thresholds are UNSET

Two values were proposed by the build agent and **rejected by the founder as having no basis**:

- `PREDICTION_CONFIDENCE_FLOOR` — proposed 0.35, **rejected**
- `PREDICTION_CALIBRATED_CONFIDENCE_MIN` — proposed 0.70, **rejected**

Both are now `null` and **fail closed**: with no floor, every projection resolves to
*Insufficient Data*. **The engine currently cannot produce any prediction.** Setting these values
is the gate on §39 producing any output at all.

### 2.3 N-2 — success-contract fields are UNSET

Eight fields are unset for **every** prediction type, plus all 14 backtest-governance items:

Observed Outcome · Success Criteria · Error Tolerance · Backtest Dataset Requirements ·
Backtest Method · Success Metric · Calibration Method · Recalibration Trigger

## Part 3 — The three candidate prediction types

### PT-1 — Tomorrow Load Forecast

| Item | Detail |
|---|---|
| **Plain-language purpose** | "Based on how tomorrow looks, here's what your body may need." |
| **Intended user benefit** | Prepare the night before rather than react the next day |
| **Horizon** | ~24h, one forward day |
| **Candidate inputs** | Graph edges (load↔outcome) · calendar-derived load · weather outlook · sleep readiness · recent intake |
| **Prohibited inputs** | Medical/clinical signals · blood-alcohol · purchase or product data · another user's data · population baselines once personal data exists |
| **Sufficiency** | DR-003 defaults; **per-type "comparable observation" definition UNSET** |
| **Observed outcome** | **UNSET — scientific determination required.** What counts as "the load that actually occurred"? |
| **Success criteria** | **UNSET — scientific determination required** |
| **Tolerance** | **UNSET — scientific determination required** |
| **Minimum sample** | **UNSET — scientific determination required** |
| **Backtest requirements / method** | **UNSET — scientific determination required** |
| **Success / calibration metric** | **UNSET — scientific determination required** |
| **Recalibration trigger** | **UNSET — scientific determination required** |
| **Expected failure modes** | Calendar load ≠ actual load · unlogged activity · weather forecast error propagating as personal error |
| **Confounders** | Illness · travel · schedule change · social events · seasonality |
| **Missing-data risks** | Wearable gaps · unlogged intake; absence is *not* evidence of low load |
| **Leakage risks** | Same-day outcome data entering a "tomorrow" projection; overlapping windows across train/test |
| **Subgroup / bias** | Shift workers, parents, and irregular schedules may be systematically under-served by a day-boundary model |
| **Uncertainty requirement** | Qualitative horizon; no numeric certainty |

### PT-2 — Performance Drift

| Item | Detail |
|---|---|
| **Plain-language purpose** | "Your recent pattern has been moving in a direction — here's what it looks like." |
| **Intended user benefit** | Notice a slow trend before it becomes a surprise |
| **Horizon** | Multi-day trend **direction**. Never a dated failure point. |
| **Candidate inputs** | Graph edges over an extended window · drift context signals · baseline version |
| **Prohibited inputs** | Medical/clinical signals · blood-alcohol · product data · population baselines once personal data exists |
| **Sufficiency** | DR-003 + a **longer window than PT-1**; exact window **UNSET** |
| **Observed outcome** | **UNSET.** What constitutes "drift continued"? |
| **Success criteria / tolerance / sample** | **UNSET — scientific determination required** |
| **Backtest requirements / method / metrics** | **UNSET — scientific determination required** |
| **Recalibration trigger** | **UNSET — scientific determination required** |
| **Expected failure modes** | Mistaking normal variation for a trend · regression to the mean read as improvement · a single disrupted week reading as decline |
| **Confounders** | Training periodization · seasonal change · life events · measurement change (new wearable) |
| **Missing-data risks** | Gaps may look like drift; a quiet week is not a declining week |
| **Leakage risks** | Trend fitted and evaluated on the same window |
| **Subgroup / bias** | Users with intermittent logging may show false drift |
| **Uncertainty requirement** | Direction + qualitative confidence only |
| ⚠️ **Specific concern** | **This is the highest-language-risk type.** Drift phrasing sits closest to implying deterioration. Please advise on whether "decline" framing is scientifically supportable at all. |

### PT-3 — Environmental Pressure Outlook

| Item | Detail |
|---|---|
| **Plain-language purpose** | "Conditions over the next day or two will raise your fluid needs." |
| **Intended user benefit** | Prepare for heat, humidity, altitude before exposure |
| **Horizon** | 24–48h |
| **Candidate inputs** | Weather forecast · climate profile · location band · current environmental pressure |
| **Prohibited inputs** | Medical signals · **personal physiological inference presented as environmental** |
| **Sufficiency** | **Context-based** — may use less personal history, but must be labeled context-based |
| **Observed outcome** | **UNSET.** Note this is partly *observed weather*, not a personal outcome. |
| **Success criteria / tolerance / sample** | **UNSET — scientific determination required** |
| **Backtest method** | **UNSET.** ⚠️ Partly a *weather-forecast accuracy* question rather than personal learning — the method must **separate the two error sources**. |
| **Metrics / recalibration** | **UNSET — scientific determination required** |
| **Expected failure modes** | Weather forecast error attributed to the OS · microclimate mismatch · indoor/outdoor exposure unknown |
| **Confounders** | Air conditioning · indoor work · clothing · acclimatization |
| **Missing-data risks** | Location unavailable; forecast provider gaps |
| **Leakage risks** | Using observed weather where a forecast should have been used |
| **Subgroup / bias** | Climate-dependent; users in stable climates get little signal |
| **Uncertainty requirement** | Range or qualitative horizon |
| ⚠️ **Specific concern** | Most likely of the three to be **mistaken for personal learning**. |

## Part 4 — Proposed evaluation-state vocabulary

We propose evaluating each prediction into **one of nine** results rather than correct/incorrect,
because forcing a binary would systematically understate accuracy and corrupt calibration:

`correct` · `directionally_correct` · `within_tolerance` · `outside_tolerance` · `incorrect` ·
`invalidated` · `expired_without_observable_outcome` · `outcome_unavailable` ·
`insufficient_evidence_to_evaluate`

**Please confirm this vocabulary is scientifically appropriate, or supply a corrected one.**

## Part 5 — Twelve questions requiring your judgment

1. **Is 7 days / 5 observations / 3 distinct days sufficient** for an *Emerging Personal
   Prediction*? If not, what is?
2. **Should thresholds vary by prediction type?** (PT-2 plausibly needs a longer window than PT-1.)
3. **What observed outcome makes each prediction evaluable?** (Three answers required.)
4. **What constitutes correct, directionally correct, within tolerance, and incorrect** for each type?
5. **What error tolerance is acceptable** for each type?
6. **What minimum dataset is required** before any prediction type is evaluated?
7. **Which baseline comparator** should each type be measured against? (Persistence? Population mean? User's own mean?)
8. **Which accuracy, calibration, and error metrics** should be used?
9. **How should missing or unobservable outcomes be handled** so they do not bias calibration?
10. **What evidence is required before any confidence value may be shown to a user?** (This sets N-1.)
11. **What evidence is required before calibrated predictions may ever be considered?**
12. **What recalibration triggers are scientifically defensible?**

## Part 6 — Reviewer response section

> Complete this section directly. Do not rewrite the package.

**Reviewer:** ______________________ **Credentials:** ______________________
**Date:** ____________ **Review status:** ☐ Approved ☐ Approved With Conditions ☐ Rejected ☐ Needs Revision ☐ Not Reviewed

### 6.1 Determinations

| # | Question | Determination |
|---|---|---|
| 1 | 7 / 5 / 3 sufficient for emerging? | |
| 2 | Thresholds vary by type? | |
| 3 | Observed outcome — PT-1 | |
| 3 | Observed outcome — PT-2 | |
| 3 | Observed outcome — PT-3 | |
| 4 | Result definitions | |
| 5 | Error tolerance | |
| 6 | Minimum dataset | |
| 7 | Baseline comparator | |
| 8 | Metrics | |
| 9 | Missing-outcome handling | |
| 10 | **Confidence floor value + rationale (N-1)** | |
| 11 | Evidence bar for calibrated predictions | |
| 12 | Defensible recalibration triggers | |

### 6.2 Evaluation vocabulary

☐ Nine-state vocabulary approved ☐ Approved with changes (specify) ☐ Rejected

### 6.3 Per-type verdict

| Type | Scientifically supportable as specified? | Conditions |
|---|---|---|
| PT-1 Tomorrow Load Forecast | ☐ Yes ☐ Yes with conditions ☐ No | |
| PT-2 Performance Drift | ☐ Yes ☐ Yes with conditions ☐ No | |
| PT-3 Environmental Pressure Outlook | ☐ Yes ☐ Yes with conditions ☐ No | |

### 6.4 Additional concerns

_______________________________________________

**Signature:** ______________________ **Date:** ____________

> On completion, record the outcome in `governance/REVIEW-APPROVAL-MATRIX.md`. **Approval may not
> be inferred from this document's existence** — only from a completed, signed response above.
