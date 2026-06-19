---
name: AForce Performance Age™
description: Durable design rules for the derived, display-only Performance Age headline metric (formula contract, boundaries, lifecycle, gating).
---

# Performance Age™ — derived display-only metric

A headline ESTIMATE (in years) of recent performance behaviour vs. actual age.
Lives as an additive, flag-gated Home zone. Pure math + a normalization
service + a read-only hook + presentational cards. Mirrors the Metabolic
Readiness wiring pattern, with two deliberate differences (see Gating).

## Locked formula contract (V1)
- Weights: Hydration Consistency **0.35**, Recovery Trend **0.30**, Sleep
  Quality **0.20**, Activity Consistency **0.15**. **Command Completion is
  EXCLUDED** — completing app commands must never flatter the age number
  (keeps it a health signal, not an engagement score).
- Composite→age is anchored at a **neutral 75** (delta 0). composite 100 →
  −15 yrs, composite 0 → +10 yrs, **clamped to [−15, +10]**. Asymmetric on
  purpose: more upside-capped than downside.
- **Display floor = min(18, actualAge)**. The 18 floor stops absurdly-low
  numbers; the `min(…, actualAge)` half stops *youth inversion* (a 16yo
  must never be reported as 18 = older than they are).
- **Drop-and-renormalize** missing optional sub-scores over the present
  weights. **Why:** never fabricate a favourable default for a signal the
  user hasn't produced — absent ≠ perfect, and absent ≠ zero.

## Lifecycle (3 states, all carry the disclaimer)
- `missing-age` — no birth year → no number, prompt to add it.
- `provisional` — number + PROVISIONAL badge; or "collecting" copy when no
  behaviour signal exists yet.
- `established` — only when **activeDays ≥ 7 AND ≥ 3/4 sub-scores present**.

## Disclaimer
A single required string (`PERFORMANCE_AGE_DISCLAIMER`) is rendered
unconditionally on EVERY card state. Don't move it into a per-state branch.

## Gating (differs from Metabolic Readiness)
- Flag `performance_age_enabled`: **false in DEFAULT_FLAGS**, true in the
  demo/all-on set. Ships OFF in prod (Build 100% · Show 10%).
- **NO entitlement gate.** Unlike Metabolic Readiness (Athlete-plan gated),
  Performance Age is the primary *consumer* headline metric — once the flag
  is lit it is available to every member.

## Score Protection
The whole feature is a one-directional projection of the hydration +
recovery engines and the analytics layer. No store dispatch, no persist; the
pure module is mutation-tested against frozen inputs. It can never move a
hydration point, band, or recovery score.

## Honesty caveats (intentional V1 debt)
- Sub-scores are proxies because there is **no persisted daily SCORE series
  yet**: hydration-consistency ← compliance day-streak vs a 7-day target;
  recovery-trend ← current recovery capacity; activity-consistency ← profile
  activity level, else recent workout LOAD (`deriveWorkoutFatigue`, a weak
  fallback — load ≠ consistency; keep the TODO to swap for a multi-day
  frequency series).
- Trends compute correctly but the hook passes `dailySnapshots: []`, so
  weekly/monthly render **"Collecting…"** rather than fabricate a slope.
  **Persisting a daily snapshot series is the natural follow-up** that turns
  the trend rows live.
