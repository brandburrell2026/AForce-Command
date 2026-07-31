# §39 Prediction Engine™ — Implementation Design

**Status:** DESIGN ONLY — **implementation gated by `DR-007`.** Nothing here is built.
**Date:** 2026-07-22 · **Authority:** tier 4 (design), governed by the Phase 3.5 freeze

> **Implementation gates (all three must clear — `DR-007` §G):**
> 1. Legal review of §39 prediction language · 2. Scientific review of **DR-003 and N-1** ·
> 3. Stage 2 graph schema deployed (R-21).
>
> **No §39 code may be written until all three are recorded as cleared.**
>
> **First implementation supports THREE states only** — `insufficient_data`, `context_only`,
> `emerging_personal`. **`calibrated_personal` is NOT authorized** and is separately blocked by
> seven further approvals (`DR-007` §A).
>
> **Design approved 2026-07-22 with the constraints in `DR-007` §A–§G.**

---

## 1. What §39 is

**Observation extended forward. Nothing more.**

It projects **the user's own demonstrated response pattern** from the §38 graph. It does not
forecast health, and it does not predict outcomes the user has never demonstrated.

**Frozen constraints** (`INTELLIGENCE-OWNERSHIP-MATRIX.md`, `INTELLIGENCE-DEPENDENCY-MATRIX.md`):

| Must never | Rule |
|---|---|
| Write HydroState | D1 |
| Write Today's Command | D2 |
| Emit public copy directly | D3 |
| Produce a second readiness score | D9 |
| Bypass Evidence Engine or §42 | B1, B5 |
| Feed the Evidence Engine's factual explanation path | D12 |

## 2. Module placement

```
artifacts/aforce-os/
  types/prediction.ts                              NEW  projection + state types
  utils/intelligence/prediction/
    sufficiencyGate.ts                             NEW  DR-003 gate evaluation (pure)
    stateResolver.ts                               NEW  four-state resolution (pure)
    projectionBuilder.ts                           NEW  edge → projection (pure)
    confidence.ts                                  NEW  projection confidence (pure)
    calibration.ts                                 NEW  outcome → calibration factor (pure)
    claimCandidateAdapter.ts                       NEW  projection → §42 ClaimCandidate
  config/hydroStateModel.ts                        EXTEND  DR-003 thresholds
  featureFlags/flags.ts                            EXTEND  2 flags, default false
lib/db/src/schema/aforce.ts                        EXTEND  2 tables
artifacts/api-server/src/services/
  predictionEngine.ts                              NEW  derivation (server-canonical)
  predictionOutcomes.ts                            NEW  reconciliation sweep
```

Pure derivation shared by client and server, per the established split. Persistence and I/O never
in the pure modules.

## 3. Data contracts

```ts
/**
 * DR-003 / DR-006. Eligibility and confidence are SEPARATE decisions.
 *
 * DR-007 §A: the FIRST IMPLEMENTATION supports only the three authorized
 * states. `calibrated_personal` is declared so policy can name and refuse it,
 * and so §42 can test its language — it is NOT constructible.
 */
export type AuthorizedPredictionState =
  | 'insufficient_data'
  | 'context_only'
  | 'emerging_personal';

/** Declared, NOT authorized for construction (DR-007 §A). */
export type UnauthorizedPredictionState = 'calibrated_personal';

export type PredictionState = AuthorizedPredictionState | UnauthorizedPredictionState;

export interface SufficiencyEvaluation {
  usableHistoryDays: number;
  comparableObservations: number;
  distinctDayCount: number;
  contextFresh: boolean;
  signalQualitySufficient: boolean;
  /** Which individual gates failed — never collapsed into one boolean. */
  failedGates: readonly SufficiencyGate[];
  passed: boolean;
}

export type SufficiencyGate =
  | 'min_history_days'
  | 'min_comparable_observations'
  | 'min_distinct_days'
  | 'context_freshness'
  | 'signal_quality'
  | 'confidence_floor';

export interface Projection {
  clientPredictionId: string;      // frozen at creation; idempotency key
  userId: string;
  predictionType: PredictionType;

  state: PredictionState;
  /** null for insufficient_data. Never null for a personal state. */
  confidence: number | null;

  /** TRUE ⇒ derived from context, NOT learned about this person. */
  contextOnly: boolean;

  evidenceRefs: readonly string[];   // §38 edge ids
  provenancePath: readonly string[]; // source event ids
  evidenceCount: number;
  distinctDayCount: number;
  observationPeriod: { startMs: number; endMs: number };

  issuedAtMs: number;
  expiresAtMs: number;               // projections ALWAYS expire

  modelVersion: string;              // prediction-v<major>.<minor>
  policyVersion: string;             // DR-003 threshold set version
  profileVersionId: number | null;
  baselineVersionId: number | null;

  sufficiency: SufficiencyEvaluation;
}
```

**Prediction types** are now scoped by **`DR-007` §C** to three authorized candidates. See §17.
K-6 is **partially resolved**: the candidate set is fixed; per-type activation still requires the
18-field governance record and its reviews.

## 4. Sufficiency gate (DR-003)

All thresholds in `config/hydroStateModel.ts`, none hardcoded:

```ts
// Founder-approved beta-validation defaults (DR-003).
export const PREDICTION_MIN_HISTORY_DAYS = 7;
export const PREDICTION_MIN_COMPARABLE_OBSERVATIONS = 5;
export const PREDICTION_MIN_DISTINCT_DAYS = 3;
export const PREDICTION_VALIDITY_MS = 24 * 60 * 60 * 1000;

/**
 * UNSET — PENDING SCIENTIFIC APPROVAL (DR-007 §B, N-1).
 *
 * The previously proposed 0.35 / 0.70 were REJECTED as numeric defaults.
 * `null` is the required representation. An unset threshold MUST fail closed:
 * the engine returns `insufficient_data`. It may NEVER silently substitute a
 * default, infer one, or fall back to a hardcoded value.
 */
export const PREDICTION_CONFIDENCE_FLOOR: number | null = null;
export const PREDICTION_CALIBRATED_CONFIDENCE_MIN: number | null = null;
```

> **The two null values are not placeholders awaiting a guess — they are a fail-closed contract.**
> `DR-007` §B: no implementation may silently substitute a default. While
> `PREDICTION_CONFIDENCE_FLOOR` is null, **every projection resolves to `insufficient_data`**,
> which is the intended safe state. **N-1 remains unresolved** until approved values *and
> supporting rationale* are documented.

Freshness and signal quality come from the **existing** `utils/confidence/dataFreshness.ts`
(`assessFreshness`) and `signalQuality.ts` (`assessSignalQuality`). **No parallel definition.**

`failedGates` returns every failure, not the first — a suppressed prediction must be able to
explain precisely which condition it missed.

## 5. State resolution — three authorized states

```
confidence floor UNSET (N-1)         → insufficient_data     ← current state of the system
gates unmet, no context basis        → insufficient_data
gates unmet, context basis available → context_only          (MUST be labeled context-based)
gates met, confidence ≥ floor        → emerging_personal     ← highest authorized state

                                     ✗ calibrated_personal   NOT AUTHORIZED (DR-007 §A)
```

**`calibrated_personal` is not constructible in the first implementation.** The state resolver
must have **no code path that produces it**. It is declared in the type union only so §42 can
name and refuse its language.

**DR-006 constraints, enforced structurally:**

- The minimum thresholds may qualify **only for `emerging_personal`**.
- **Eligibility ≠ confidence.** Passing the gates earns the right to speak, not to sound certain.
- **No high-confidence language may derive solely from the minimum beta threshold.**
- Collapsing `context_only` into a personal state is a **trust breach**.
- **An unset threshold fails closed to `insufficient_data`** — never a substituted default.

## 6. Confidence

Derived from §38 edge confidence, never asserted. Graph relationship strength is currently
**`null`** (no approved weighting — R-23), and `PREDICTION_CONFIDENCE_FLOOR` is **UNSET** (N-1).

**Two independent blocks, both deliberate:**

| Block | Effect |
|---|---|
| **R-23** — no approved graph weighting | No numeric confidence input exists |
| **N-1** — confidence floor UNSET | No threshold to compare against ⇒ fail closed |
| **DR-007 §A** — calibrated not authorized | Even with both resolved, `calibrated_personal` needs seven further approvals |

**Consequence:** with the floor unset, **every projection resolves to `insufficient_data`**. That
is the correct, safe behaviour — not a defect to engineer around.

**`DR-007` §A is explicit: do not invent a local §39 weighting system to bypass R-23.** Routing
around the missing graph weighting would defeat the decision and duplicate the deferred work.

## 7. Persistence

Tables were designed in Phase 3 Output C and are **restated by reference, not redesigned**:
`aforce_predictions` and `aforce_prediction_outcomes`.

**Refinements from the Phase 3.5 freeze:**

| Field | Change |
|---|---|
| `policy_version` | **ADD** — the DR-003 threshold set is versioned separately from the model (Version-Context #8) |
| `sufficiency` | **ADD** jsonb — the full evaluation, so a suppression is explainable after the fact |
| `retention_class` | Fixed at **R5** (24 months) |
| `privacy_class` | **S0** for the projection; **S1** for the outcome |

## 8. Lifecycle

```
build → issue (issuedAtMs, expiresAtMs) → active → expired → reconciled → aged out (R5)
```

**Projections always expire.** A stale projection is discarded, never re-surfaced. An issued
prediction is **never retroactively edited** — accountability requires the original stands as
issued.

## 9. Outcome reconciliation and calibration

A scheduled sweep matches expired projections to what actually happened, writing
`matched` / `diverged` / `unresolved`.

**Calibration guard (frozen):** calibration adjusts **future** predictions only and may only
**tighten**. A type that historically over-predicts is damped; a well-calibrated type is **never
boosted past its evidence-derived ceiling**. Calibration must never manufacture confidence the
evidence does not support.

## 10. §42 integration

`claimCandidateAdapter.ts` maps a `Projection` to a `ClaimCandidate`:

| Projection | ClaimCandidate |
|---|---|
| `state: context_only` | `claimCategory: 'context_estimate'`, `contextOnly: true` |
| `state: emerging_personal` | `claimCategory: 'emerging_personal_prediction'` |
| `state: calibrated_personal` | `claimCategory: 'calibrated_personal_prediction'` |
| `state: insufficient_data` | **no candidate produced** |
| `provenancePath` | `provenancePath` |
| `evidenceCount` / `distinctDayCount` | supporting/contradictory counts |
| `modelVersion` | `modelVersion` |

The gate's existing state-integrity rules already cover the failure modes:
`P42-STA-001/002` (context-as-personal), `P42-STA-003` (emerging claimed as calibrated),
`P42-STA-004` (insufficient data with a personal claim).

**Path:** §38 → Evidence Engine adapter → §42 → surface. §39 never calls a surface directly.

## 11. Deletion and invalidation

§39 registers as a downstream consumer of the Stage 2 `DownstreamNotice` contract
(`prediction_engine`). On notice: re-evaluate; if all supporting evidence is gone → invalidate
(`source_deleted`). **No active projection may survive total loss of its supporting evidence.**

## 12. Feature flags — default `false`

| Flag | Enables |
|---|---|
| `spec_predictionEngine` | Headless derivation |
| `spec_predictionSurface` | Any user-facing output — **requires §42 accepted** |

Strict flag-off short-circuit before any graph read or clock access.

## 13. Migration and rollback

Additive: 2 new tables, no existing table altered. Rollback = drop tables + flags off. **No
rollback path deletes user data.** §39 is never load-bearing — the OS must function identically
with it absent.

**Depends on R-21:** the graph tables must exist first.

## 14. Test plan

Universal V-1…V-8 plus:

| ID | Check |
|---|---|
| P-1 | Below the gate → `insufficient_data`, never a low-confidence guess |
| P-2 | Every projection carries confidence, period, evidence count |
| P-3 | A projection that cannot state confidence is not emitted |
| P-4 | Output is the user's own pattern forward — never a health forecast |
| P-5 | **§42 gate cleared** — blocking |
| P-6 | Projections expire; stale ones never re-surface |
| P-7 | `failedGates` reports every failure, not the first |
| P-8 | `context_only` can never map to a personal claim category |
| **P-9** | **`calibrated_personal` is unreachable UNCONDITIONALLY** — no input combination produces it. Not merely "while graph confidence is null" (`DR-007` §A). |
| **P-13** | An UNSET confidence floor **fails closed to `insufficient_data`** — never a substituted default, never an inferred value (`DR-007` §B) |
| **P-14** | No prediction type activates without its complete 18-field record and recorded reviews (`DR-007` §D) |
| **P-15** | A prohibited prediction type cannot be constructed at all |
| **P-16** | `sufficiency` record preserves conditions, result, missing requirements, policy version, evaluation time, profile + baseline versions — and **exposes no internal logic to users** (`DR-007` §E) |
| **P-17** | `policy_version` is distinct from model, HydroState, graph, gate-policy and locale-policy versions (`DR-007` §F) |
| P-10 | Calibration only tightens; never inflates past the evidence ceiling |
| P-11 | Issued projections are never retroactively edited |
| P-12 | Total evidence loss → invalidated |

## 15. Implementation sequence (post-gate)

| Step | Scope | Depends on |
|---|---|---|
| 1 | Types + sufficiency gate (pure) | gate 2 (thresholds) |
| 2 | State resolver + projection builder (pure) | step 1 |
| 3 | Schema + persistence | gate 3 (R-21) |
| 4 | §42 claim-candidate adapter | steps 1–2 |
| 5 | Outcome reconciliation + calibration | step 3 |
| 6 | Backtesting harness | step 5 |
| 7 | Surface — separately approved | gate 1 + §42 |

## 16. Open decisions and risks

| Item | Status |
|---|---|
| **K-6** — which prediction types launch | **Partially resolved (`DR-007` §C).** Candidate set fixed at three: Tomorrow Load Forecast™, Performance Drift™, Environmental Pressure Outlook. Per-type activation still blocked. |
| **`DR-007` §A** — `calibrated_personal` not authorized | **Blocked by seven approvals.** No code path may construct it. |
| **D-08** — HydroState model version | Open; affects reproducibility of any score referenced by a projection |
| **R-01** — prediction language becomes a medical claim | S1, launch-blocking; gate 1 addresses it |
| **R-20** — permissive thresholds risk premature patterns | Gate 2 addresses it |
| **R-23** — graph confidence is `null` | **Caps §39 at `emerging_personal`** (§6) |
| **R-24** — English only | §39 output suppressed in all other locales |
| **N-1** | **UNRESOLVED.** The proposed 0.35 / 0.70 were **rejected** (`DR-007` §B). Both constants are **UNSET (`null`), fail-closed**. Until approved values *and rationale* are documented, every projection resolves to `insufficient_data`. |
| **N-2 (new)** | **All three prediction types have UNDEFINED outcome definition, backtest method, and success metric.** No type can be activated or scientifically reviewed until specified per type. Largest remaining §39 design gap. |

## 17. Prediction-type registry → moved

**Canonical location: [`governance/PREDICTION-SUCCESS-CONTRACTS.md`](../../governance/PREDICTION-SUCCESS-CONTRACTS.md)**

`DR-008` expands the per-type record from 18 fields to a **26-field success contract** plus a
14-item backtest-governance record. That detail is governance, not design, and holding it here as
well would create a duplicate source of truth. The registry that briefly lived in this section has
been **moved, not copied**.

**Summary only — see the contracts document for the authoritative record:**

| Type | Contract | UNSET fields | Status |
|---|---|---|---|
| PT-1 Tomorrow Load Forecast™ | Not approved | 8 | Candidate only |
| PT-2 Performance Drift™ | Not approved | 8 | Candidate only |
| PT-3 Environmental Pressure Outlook | Not approved | 8 | Candidate only |

**A prediction type may not be activated unless it has an approved success contract** (`DR-008`).

## 18. Prediction lifecycle and evaluation (`DR-008`)

**Frozen lifecycle:**

```
Prediction Created → Prediction Stored → Expires or Remains Eligible
  → Observed Outcome Recorded → Prediction Evaluated
    → Backtest Record Created → Governed Recalibration Considered
```

**Frozen invariant: predictions never become facts. Observed outcomes become facts.**

A prediction may be recorded as *an event that occurred*; its **predicted content** must never be
treated as an observed physiological, behavioural, environmental, or performance fact.

**Evaluation is nine-valued, never binary** — `correct` · `directionally_correct` ·
`within_tolerance` · `outside_tolerance` · `incorrect` · `invalidated` ·
`expired_without_observable_outcome` · `outcome_unavailable` ·
`insufficient_evidence_to_evaluate`. The last four are **not prediction failures**; collapsing
them into "incorrect" would understate accuracy and corrupt calibration.

The evaluation record carries 18 required fields (`DR-008` §5.1), including evaluator version and
the full version context.

**No automatic self-training.** The engine may not silently retrain, reweight, or recalibrate.
Online learning and autonomous self-modification are **not authorized**. All model changes route
through governed recalibration (**N-4**, unresolved).

### 18.1 Design consequence

The design in §9 (outcome reconciliation and calibration) is **narrowed**: the sweep may **record
and evaluate** outcomes, but may **not apply** any calibration adjustment. Calibration becomes a
governed, reviewed, versioned release step — not a runtime behaviour.

`calibration.ts` in §2 is therefore **not a runtime module in the first implementation**. It may
compute a *proposed* factor for review; it may never apply one.
