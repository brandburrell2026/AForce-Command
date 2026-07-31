# Intelligence Confidence Taxonomy

**Status:** FROZEN (Phase 3.5) · **Frozen:** 2026-07-22 · **Authority:** tier 3

Eleven distinct concepts. **Several share the word "confidence" and none of them mean the same
thing.** They must never be merged, substituted, or rendered into one another.

---

## 1. The eleven concepts

| # | Concept | What it measures | Type | Scope | Owner |
|---|---|---|---|---|---|
| 1 | **Signal quality** | How trustworthy a *source* is | `excellent \| good \| limited \| unavailable` | per signal | `utils/confidence/signalQuality.ts` |
| 2 | **Freshness** | How *recent* a signal is | `fresh \| aging \| stale \| expired` | per signal | `utils/confidence/dataFreshness.ts` |
| 3 | **Evidence state** | Strength of a *graph relationship* | `insufficient \| emerging \| supported \| contradicted \| superseded` | per edge | §38 |
| 4 | **Contradiction state** | Counter-evidence against a relationship | counts (supporting vs contradicting) | per edge | §38 |
| 5 | **Graph relationship strength** | Derived scalar for an edge | **`null` — no approved weighting exists** | per edge | §38 |
| 6 | **Model completeness** | How well the OS knows this person | descriptive dimensions | per user | §61 |
| 7 | **Prediction state** | Eligibility tier of a projection | `insufficient_data \| context_only \| emerging_personal \| calibrated_personal` | per projection | §39 |
| 8 | **Prediction confidence** | Strength of a specific projection | 0..1 + band | per projection | §39 |
| 9 | **Performance DNA lifecycle** | Maturity of a pattern | `emerging \| observed \| high_confidence \| recalibrating \| retired \| superseded` | per pattern | §40 |
| 10 | **Command Confidence™** | Confidence in *today's command* | `high \| medium \| low` | per command | §58 |
| 11 | **HydroState™** | Current performance state | 0–100 + band | per user | §1–17 |

## 2. Frozen non-equivalences

| Rule | Why |
|---|---|
| **HydroState is not a confidence value.** | It is a state measurement. Rendering it as confidence, or confidence as it, creates a second hero metric. |
| **Prediction confidence ≠ Command Confidence™.** | §39 measures *how strong a projection is*. §58 measures *how confident the OS is in today's command*. Different inputs, different lifetimes, different surfaces. |
| **Graph relationship strength is internal only.** | Never surfaced, never rendered, never converted into a user-facing number. |
| **Performance DNA has no score.** | Only the six lifecycle labels. No numeric type exists in the design or the code. |
| **Evidence state ≠ prediction state.** | Evidence state describes a *relationship*; prediction state describes a *projection's eligibility tier*. |
| **Prediction state ≠ prediction confidence.** | **Eligibility and confidence are separate decisions** (DR-006). Passing the gates earns the right to speak, not the right to sound certain. |
| **Signal quality ≠ freshness.** | A fresh signal from a poor source is fresh and low-quality. Both travel independently. |
| **Model completeness is not a score.** | Descriptive only; never a headline number (Principle 2). |
| **Contradiction state is never folded into evidence state.** | Counter-evidence must remain independently visible (Founder Decision 4). |

## 3. Permitted conversions

| From | To | Permitted? |
|---|---|---|
| Signal quality + freshness | Evidence-state inputs | ✅ as inputs |
| Evidence state | Prediction eligibility | ✅ as one input among the DR-003 gates |
| Evidence state | Prediction confidence | ❌ **never directly** |
| Graph strength | Any user-facing value | ❌ **never** |
| Prediction confidence | Command Confidence | ❌ **never** |
| Any of 1–10 | HydroState | ❌ **never** |
| HydroState | Any of 1–10 | ❌ **never** |
| Any confidence | A second displayed score | ❌ **never** |

## 4. Numeric vs. categorical (frozen)

| Concept | Numeric today? | Rule |
|---|---|---|
| Graph relationship strength | **No — `null`** | No approved weighting; inputs stored so a future approved weighting applies retroactively (R-23) |
| Prediction confidence | Designed numeric | Must always ship with state + provenance; never alone |
| Command Confidence | No — three levels | UI only, no new calculation (§58) |
| Performance DNA | **No, permanently** | Founder Decision 4 |
| Model completeness | No | descriptive |
| HydroState | **Yes — the only user-facing number** | the hero metric |

**Frozen:** HydroState™ is the **only** intelligence value rendered to users as a number.

## 5. Language mapping (§42)

| Concept | Permitted user-facing expression |
|---|---|
| Evidence state | qualitative only, with counts and period |
| Prediction state | must be explicitly labelled; `context_only` must say it is context-based |
| Prediction confidence | with an approved range or qualitative horizon, never certainty |
| DNA lifecycle | the six labels only; never "permanent", never genetic |
| Graph strength | **never expressed to a user** |
| Command Confidence | the §58 display only |

Enforced by `P42-SCR-002` (second hero score), `P42-CER-001` (certainty), `P42-DNA-001`
(pattern language), and the state-integrity rules `P42-STA-001…006`.
