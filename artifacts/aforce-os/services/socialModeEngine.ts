/**
 * Social Mode orchestrator.
 *
 * Pulled out of `utils/scoringEngine.ts` so the social rollup logic
 * (hangover risk + BAC + impairment + transportation prompt + recovery
 * window) lives in one cohesive module that the scoring engine just
 * delegates to.
 *
 * Returns the same shape `ScoreEngineOutput.social` expects, or `null`
 * when Social Mode is neither active nor inside its 8h recovery window.
 */

import type { ScoreEngineOutput, UserState } from '../types';
import { calculateHangoverRisk, activeDecayMultiplier } from '../utils/hangoverRisk';
import { estimateBAC } from './bacEstimationService';
import { impairmentFromBAC, transportationPromptFor } from './legalSafetyService';
import {
  computeRecoveryCapacity,
  complianceFromStreak,
  environmentalStress,
} from './recoveryCapacity';

export const RECOVERY_WINDOW_MS = 8 * 60 * 60 * 1000;

export function buildSocialRollup(state: UserState, performanceScore: number, now: number = Date.now()): ScoreEngineOutput['social'] {
  const sm = state.socialMode;
  if (!sm) return null;
  const endedAtMs = sm.endedAt ? sm.endedAt.getTime() : null;
  const inRecoveryWindow = !sm.active
    && endedAtMs != null
    && (now - endedAtMs) < RECOVERY_WINDOW_MS;
  if (!sm.active && !inRecoveryWindow) return null;

  const hangoverRisk = calculateHangoverRisk({
    drinks: sm.drinks,
    bodyWeightLbs: state.bodyWeightLbs,
    heatLoad: state.heatLoad,
    now,
  });

  // ─── DEPRECATED in chunk #3b ────────────────────────────────────
  // The BAC / impairment / transportation surfaces are scheduled for
  // removal in chunk #3c. They are still wired here so existing UI
  // components keep rendering until they are repurposed. The canonical
  // replacement is `recoveryCapacity` below.
  const bac = estimateBAC({
    drinks: sm.drinks,
    bodyWeightLbs: state.bodyWeightLbs,
    sex: sm.sex,
    ateRecently: sm.ateRecently,
    now,
  });
  const impairment = impairmentFromBAC(bac);
  const transportation = transportationPromptFor(impairment.level);
  // ────────────────────────────────────────────────────────────────

  const recoveryCapacity = computeRecoveryCapacity({
    autoPilotScore: performanceScore,
    hydrationCompliance: complianceFromStreak(state.complianceStreak),
    environmentalStress: environmentalStress({
      tempC: state.weatherTempC,
      humidity: state.weatherHumidity,
      activityLevel: state.activityLevel,
      preset: sm.preset ?? null,
    }),
  });

  return {
    active: sm.active,
    inRecoveryWindow,
    drinkCount: sm.drinks.length,
    hangoverRisk,
    alcoholMultiplier: sm.active ? activeDecayMultiplier(sm.drinks, now) : 1,
    bac,
    impairment,
    transportation,
    recoveryCapacity,
  };
}
