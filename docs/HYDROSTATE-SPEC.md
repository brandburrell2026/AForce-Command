# HydroState™ — Specification

**Status:** Canonical (tier 4) · **Sections:** §1–17 · **Updated:** 2026-07-22
**Constitutional basis:** Principle 2 — *One hero metric. HydroState. Never create a competing
hero metric.*

HydroState™ is the **foundational state engine** of AForce OS and its **single hero metric**.
Every other system in AForce Intelligence™ operates around and through it.

---

## 1. Position in the architecture

HydroState™ is load-bearing. Systems read from it; systems inform its inputs; **no system
replaces it, competes with it, or emits a rival headline number.**

```
inputs  →  HydroState™  →  everything else
```

Founder Decision 1 restates this as a binding constraint on every newly authorized system:
they must not create a competing hero metric and must not replace HydroState™.

## 2. Inputs

| Input | Source | Section |
|---|---|---|
| Adaptive Performance Profile™ | Onboarding + edits | §18–19 |
| Body recalibration targets | Derived from profile | §20 |
| Intake events | User logging | core |
| Environmental Pressure™ / Climate Profile™ | OpenWeather + device | Part F |
| Sleep Readiness Intelligence™ | Wearables / HealthKit | §21 |
| Tomorrow Load Forecast™ | Derived | §22 |
| Wearable biometrics | WHOOP · HealthKit · Garmin | — |

## 3. Score and bands

**Two band ladders exist. They are intentional, they serve different jobs, and their thresholds
do not align.** Never describe one as an alias of the other — a range-based mapping between them
is mathematically wrong.

### 3.1 Performance State — 4 bands

Classified by `utils/scoring/breakdown.ts` → `resolveState`, called from `utils/scoringEngine.ts`.
Colors in `theme/colors.ts` (`states`).

| Band | Threshold | Drives |
|---|---|---|
| **PEAK** | ≥ 90 | orb flare |
| **BALANCED** | ≥ 75 | steady orb |
| **RECOVERING** | ≥ 60 | recovery pacing |
| **DEPLETED** | else | orb collapse, urgent command |

Also drives `riskTimer`, `pulseConfig`, and command selection.

### 3.2 Score Status — 5 bands

`theme/statusColor.ts`. Drives the AI Coach status-color layer (dots, borders, glows, CTA tint)
and the score read-out. Each band has a Pressure-Mode variant.

| Band | Range |
|---|---|
| **OPTIMAL** | 85–100 |
| **STABLE** | 70–84 |
| **DECLINING** | 50–69 |
| **RISK** | 30–49 |
| **CRITICAL** | 0–29 |

The two ladders share only the top green `#1FA35A` and the bottom red `#FF2800`.

> **"RISK" is an internal band token, not user-facing copy.** The word *risk* is banned
> vocabulary (`governance/CLAIMS-REGISTER.md` §1) and must never be rendered to a user.

### 3.3 Off-limits

`utils/scoringEngine.ts` and `theme/statusColor.ts` are the source of truth for scoring math,
band definitions, and status-color mapping. **They may not be modified** without explicit founder
approval. A change that appears to require editing them must be flagged, not made.

## 4. Score Protection

**Only completed behavior modifies score.**

| Never modifies score | Does modify score |
|---|---|
| Recommendations | Completed, logged intake |
| HydroScan results (advisory-only, DR-001) | Completed commands |
| Product selection | Recorded behavior |
| §38 graph, §39 projections, §40 patterns | — |
| §61 lessons | — |

Advisory systems may **read** score read-only for fail-closed gating — reading is not a breach.
Awarding, mutating, or fabricating is.

## 5. Configuration discipline

Every threshold, weight, coefficient, and tunable lives in
`artifacts/aforce-os/config/hydroStateModel.ts`. Engine logic never hardcodes a number
(Build Rule 13). The file grows one numbered section at a time.

## 6. Visual Intelligence (§1–17, phased)

HydroState™ Visual Intelligence is **Architecture Only**, gated behind
`hydrostate_visual_enabled` until device and lighting validation is complete. Camera imagery is
sensitivity class **S3** (`governance/DATA-CLASSIFICATION-MATRIX.md`) and requires explicit
per-feature consent.

## 7. What HydroState™ is not

- Not a health score, not a medical measure, not a diagnosis.
- Not a comparison against other people or population averages.
- Not a proxy for any claim in `CLAIMS-REGISTER.md` class C5 or C6.

It is an observation of the user's current performance state, explainable from their own data.
