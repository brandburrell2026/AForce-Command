# DR-007 — §39 Prediction Engine™: Design Authorized, Implementation Gated

- **Status:** ACCEPTED — settled.
- **Date:** 2026-07-22 · **Decider:** Brandon (founder)
- **Governs:** §39 Prediction Engine™
- **Related:** `DR-003` (sufficiency defaults), `DR-006` (eligibility ≠ confidence),
  `INTELLIGENCE-CHANGE-CONTROL.md`, `REVIEW-APPROVAL-MATRIX.md`

---

## Decision

**§39 implementation design is authorized. Implementation is NOT authorized.**

**Amended 2026-07-22 — design approved with seven constraining decisions (§A–§G below).**

---

## A. `calibrated_personal` is NOT authorized for first implementation

The first implementation may support **only three states**:

`insufficient_data` · `context_only` · `emerging_personal`

**`calibrated_personal` must remain unreachable** until **all seven** are approved:

| # | Requirement | Status |
|---|---|---|
| 1 | Graph relationship weighting | **Not approved** (R-23) |
| 2 | Prediction-confidence methodology | **Not approved** |
| 3 | Per-prediction-type backtesting | **Not done** |
| 4 | Scientific review | **Not Yet Reviewed** |
| 5 | Legal review of calibrated prediction language | **Not Yet Reviewed** |
| 6 | Minimum validation criteria | **Not defined** |
| 7 | Rollback and recalibration policy | **Not defined** |

**Do not invent a local §39 weighting system to bypass R-23.** The absence of an approved graph
weighting is the constraint; routing around it would defeat the decision.

## B. Threshold placeholders are NOT approved

`PREDICTION_CONFIDENCE_FLOOR = 0.35` and `PREDICTION_CALIBRATED_CONFIDENCE_MIN = 0.70` are
**rejected as numeric defaults** and removed from the canonical design.

They are represented as **UNSET · pending scientific approval · fail-closed when required**.

**No implementation may silently substitute a default value.** An unset threshold must cause the
engine to fail closed (return `insufficient_data`), never to proceed on an assumed value.

**N-1 remains unresolved** until approved values *and supporting rationale* are documented.

## C. Initial prediction-type scope

**Authorized candidates (still subject to legal, scientific, privacy, engineering and §42 review):**

1. **Tomorrow Load Forecast™**
2. **Performance Drift™**
3. **Environmental Pressure Outlook**

**Explicitly NOT authorized — any type in this list is prohibited:**

injury prediction · illness prediction · dehydration diagnosis · medical-risk prediction ·
treatment recommendations · exact failure or crash-time claims · product-driven outcome
predictions · alcohol impairment or BAC predictions · clinical or diagnostic predictions

## D. Prediction-type governance

Each prediction type must define **18 fields** before it may become active: purpose · inputs ·
prohibited inputs · prediction horizon · sufficiency requirements · outcome definition · backtest
method · success metric · uncertainty representation · invalidation conditions · deletion
behaviour · §42 claim categories · approved surfaces · prohibited surfaces · retention class ·
privacy class · required reviews · current status.

**No prediction type may become active merely because the generic engine exists.**

**Superseded by `DR-008`:** the 18-field record is replaced by the **26-field success contract**.
Canonical registry: **`governance/PREDICTION-SUCCESS-CONTRACTS.md`**.

## E. Sufficiency storage — approved in principle

Must preserve: evaluated conditions · pass/fail result · missing requirements · policy version ·
evaluation time · relevant profile and baseline versions.

**Must not expose sensitive internal logic directly to users.**

## F. Policy version — approved in principle

`policy_version` must remain **distinct** from: prediction model version · HydroState model
version · graph derivation version · §42 gate-policy version · locale-policy version.

## G. Gates (restated)

> **Extended by `DR-008` (2026-07-22):** a **fourth** implementation gate applies — **an approved
> success contract for each prediction type**. The §D 18-field record is superseded by the
> **26-field success contract** in `governance/PREDICTION-SUCCESS-CONTRACTS.md`.


Implementation blocked until legal review of §39 language, scientific review of **DR-003, N-1 and
N-2**, Stage 2 schema deployment, and **an approved success contract per prediction type** are all
recorded. **Calibrated predictions are separately blocked** by §A.

---

## Implementation gates — all FOUR must clear

| # | Gate | Owner | Current status | Evidence required to clear |
|---|---|---|---|---|
| **1** | **Legal review of §39 prediction language** | Legal | **Not Yet Reviewed** | Recorded review of the §39 claim classes against `CLAIMS-REGISTER.md`; Risk-Register **CR-1** explicitly extended to cover §39 |
| **2** | **Scientific review of the DR-003 sufficiency thresholds** | Scientific | **Not Yet Reviewed** | Recorded review of 7 days / 5 comparable observations / 3 distinct days as beta-validation defaults, or replacement values |
| **3** | **Stage 2 graph schema deployed** (R-21) | Engineering | **OPEN** | `drizzle-kit push` executed in a `DATABASE_URL` environment; `aforce_graph_nodes` and `aforce_graph_edges` exist |
| **4** | **Approved success contract per prediction type** (`DR-008`) | Scientific · Legal · Privacy · Engineering | **OPEN — 0 of 3** | All 26 fields set (8 UNSET per type) + 14 backtest-governance items set + reviews recorded |

**No §39 code may be written until all four are recorded as cleared.** Design work — contracts,
schema proposals, test plans, documents — is permitted now.

## Rationale

The architectural contracts §39 needs are frozen and enforceable (Phase 3.5): ownership,
prohibited dependencies D1–D3, the four prediction states, DR-006's eligibility≠confidence rule,
version requirements, and a working §42 gate.

What is **not** settled is whether the language policy is legally defensible for a predictive
surface, and whether the sufficiency thresholds have any scientific basis. §39 is the
highest-compliance-risk system in the OS (`OPEN-RISKS.md` R-01, S1, launch-blocking). Building it
against unreviewed language policy and unvalidated thresholds would put the riskiest system on the
least-verified foundations.

Gate 3 is practical: §39 reads §38 edges, and §38 has no deployed store.

## Standing constraints (unchanged, restated)

§39 must not: write HydroState or Today's Command (D1, D2) · emit public copy directly (D3) ·
produce certainty language · present a context-only estimate as personal learning · derive
high-confidence language from the minimum beta threshold · bypass the Evidence Engine or §42.

## Status

`CAPABILITY-STATUS-REGISTER.md`: §39 remains **Specified**. It does not advance to
Partially Built until implementation is authorized and begun.
