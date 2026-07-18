# §56 — Universal Personalization™ / Coverage layer (design ruling ②)

**Ruling by:** ml-engineer · **Date:** 2026-07-17 · **Status:** Step 1 implemented (coverage resolver)

Basis for the §56 coverage denominators. Code:
`artifacts/aforce-os/utils/personalization/personalizationCoverage.ts`.

## Founder scope ruling
Build the **coverage-qualifier layer + §20 wiring**; **defer the Personal Baseline
primitive** (learned averages superseding population) to post-launch behind ruling ④
(cybersecurity + counsel). Core score stays off-limits (ruling ⑤ RESERVED).

## What §56 is (vs §55)
§55 measures which fields the user **filled** (availability). §56 measures whether
the engine **used** them (consumption). They compose — §55 availability is §56's
denominator. §56 is a pure qualifier; it persists nothing and never touches a score.

## Field statuses
- **personalized** — load-bearing, available, consumed ✓
- **population-default** — load-bearing, available, NOT consumed ← the §56 gap
- **blocked-on-input** — load-bearing, not available (a §55 problem, excluded from the denominator)
- **scoring-locked** — load-bearing but wiring needs the off-limits scoring engine (reported separately, never a miss)

Denominator = load-bearing ∩ available ∩ not-scoring-locked. Coverage = 1 when the
denominator is empty ("nothing to personalize yet," not 0%). Structural fields
(`adaptiveProfile`, `profileVersion`) are the container for the other 13 — in no denominator.

## Per-engine load-bearing rationale
- **HydroState** — self-evident: weight, activityLevel, connectedWearables. Sign-off
  (physiological): age, trainingLevel, primaryGoal, sweatClassification, climateProfile,
  environmentalPressure, travelStatus. **sex = scoring-locked** (materially load-bearing for
  hydration but wiring needs the scoring engine — RL-1).
- **HydroScan** — weight, activityLevel, performanceMemory; sign-off: sweatClassification, primaryGoal.
- **SleepReadiness** — connectedWearables, performanceMemory; sign-off: age, activityLevel, travelStatus.
- **RecoveryWindow** — connectedWearables, activityLevel, performanceMemory; sign-off: trainingLevel, age, travelStatus.
- **PerformanceIdentity** — performanceMemory, primaryGoal, trainingLevel (identity framing, no coefficient).
- **AutoPilot / Guardian / Clutch / Cruise** — *composite*: aggregate the engines they compose (modes consume engine outputs, not profile fields). Absent members (TomorrowLoadForecast) → `pendingBuild`, excluded from the denominator.
- **EvidenceEngine** — *reflective*: reflects the consumed load-bearing set of the command it explains (metric = citation fidelity; true cited-vs-consumed fidelity needs the citation output as a predicate — a wiring refinement).
- **TomorrowLoadForecast** — *absent* (stub only): reported `not-yet-built`.

## Sign-offs owed (Step 2, not Step 1)
The eight `requiresSignOff` fields (age, trainingLevel, primaryGoal, sweatClassification,
climateProfile, environmentalPressure, travelStatus, sex) need **performance-scientist
evidence sign-off before their §20 COEFFICIENT ships**. That gate does **not** block the
coverage layer — it can report a field as consumed while its coefficient is still provisional.
