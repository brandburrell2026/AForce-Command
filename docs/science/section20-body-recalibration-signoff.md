# §20 Body Recalibration coefficients — performance-scientist sign-off

**Ruling by:** performance-scientist · **Date:** 2026-07-18 · **Verdict:** CONDITIONAL — clear to wire **flag-off**; three conditions gate the **flag flip**.

Basis for wiring the §20 targets (Training/Sweat/Goal-personalized hydration,
electrolyte, recovery timing) into the Demand Engine snapshot behind
`spec_section20_calibration`. Coefficients in `config/hydroStateModel.ts` (§20);
engine `services/bodyRecalibrationEngine.ts`.

## Verified worst cases
- **Hydration:** 500 lb × 0.5 × 1.22 (Elite) + 24 (very_heavy) + 12 (Endurance) = 341 oz → **clamps to 200**. Ceiling binds. ✅
- **Sodium:** 500 + 14 mg/min × 360 min (input cap) = **5,540 mg** — was **unclamped**. ⚠️ → fixed this PR (see BLOCK 1).
- Inputs validated upstream: weight 60–500 lb, duration 0–360 min.

## Per-group verdicts
| Group | Verdict |
|---|---|
| `HYDRATION_BASE_OZ_PER_LB` 0.5 | PLAUSIBLE (half-bodyweight-oz heuristic; a starting ritual estimate, not a requirement) |
| `TRAINING_LEVEL_HYDRATION_MULTIPLIER` 1.0–1.22 | PLAUSIBLE (directional; steps interpolated) |
| `SWEAT_LEVEL_HYDRATION_ADDER_OZ` 0–24 | SUPPORTED direction / PLAUSIBLE magnitude |
| `GOAL_HYDRATION_MODIFIER_OZ` 0–12 | PLAUSIBLE (Endurance +12 best grounded; Fat Loss +8 watch copy) |
| Floor/ceiling 64/200 oz | SAFE with **paced all-day** framing |
| `SODIUM_BASE_MG` 500 | PLAUSIBLE (≈ physiological minimum; not total dietary sodium) |
| `SODIUM_MG_PER_WORKOUT_MIN_BY_SWEAT` 3/6/10/14 | PLAUSIBLE rates — unusable live without an output ceiling (BLOCK 1) |
| `RECOVERY_WINDOW_MIN_BY_TRAINING` 30–90 (+≤30) | PLAUSIBLE (performance cue, not a treatment window) |
| `RECHECK_INTERVAL_*` | SUPPORTED (UX cadence, no physiological claim) |
| `ENV_PRESSURE_SENSITIVITY_BY_SWEAT` 0.9–1.3 | PLAUSIBLE — re-open when §Climate defines what it scales |

No group is unsupported on its own value.

## Flag-flip conditions (the wiring ships flag-off regardless)
1. **BLOCK 1 — sodium ceiling. ✅ RESOLVED this PR.** `SODIUM_CEILING_MG = 3500`
   added and the returned `electrolyteSodiumMg` clamped. Covers heavy-sweat
   sessions to ~210 min; keeps the surfaced figure in a defensible athlete band.
2. **BLOCK 2 — minors. OPEN → founder + counsel.** An `under_18` user is handed
   the full adult coefficient set (personalized sodium + 200 oz ceiling). Before
   flip: gate `under_18` out of live §20 targets, or confirm minors are never
   served the personalized number. Escalate to Brandon/counsel — not cleared here.
3. **COND 3 — surfacing copy. OPEN → performance-scientist.** The numbers carry
   no claims; the wrapper copy will. No "prevents dehydration / meets your needs /
   optimal-required"; sodium framed as a training-tied electrolyte figure, never
   daily dietary guidance; "recovery window" as a ritual cue, not a medical
   window; 200 oz always paced all-day, never a bolus or a rest-day push. Route
   final surfacing copy to performance-scientist before flip.

**Status:** BLOCK 1 resolved. Flip remains gated on BLOCK 2 + COND 3 (tracked for
CR-1). `ENV_PRESSURE_SENSITIVITY` re-opens for one look when §Climate lands.
