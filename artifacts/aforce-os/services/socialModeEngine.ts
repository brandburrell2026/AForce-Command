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

import { resolveCurrentWeather } from '../utils/environment/weatherFreshness';
import type { ScoreEngineOutput, UserState } from '../types';
import { calculateHangoverRisk, activeDecayMultiplier } from '../utils/hangoverRisk';
import { estimateBAC } from './bacEstimationService';
import { impairmentFromBAC, transportationPromptFor } from './legalSafetyService';
import {
  computeRecoveryCapacity,
  complianceFromStreak,
  environmentalStress,
  isModifierActive,
  applyVoyageShield,
  bandFor,
  CRUISE_WINDOW_MS,
} from './recoveryCapacity';

export const RECOVERY_WINDOW_MS = 8 * 60 * 60 * 1000;

/**
 * Effective post-session recovery window length in ms. Cruise Mode, when
 * active, lengthens the window from 8h to 24h. Returns the larger of
 * the two so a partial-overlap Cruise (engaged mid-recovery) always
 * wins.
 */
export function effectiveRecoveryWindowMs(
  sm: NonNullable<UserState['socialMode']>,
  now: number = Date.now(),
): number {
  return isModifierActive(sm.cruiseUntil, now) ? CRUISE_WINDOW_MS : RECOVERY_WINDOW_MS;
}

export function buildSocialRollup(state: UserState, performanceScore: number, now: number = Date.now()): ScoreEngineOutput['social'] {
  const sm = state.socialMode;
  if (!sm) return null;
  const endedAtMs = sm.endedAt ? sm.endedAt.getTime() : null;
  const windowMs = effectiveRecoveryWindowMs(sm, now);
  const inRecoveryWindow = !sm.active
    && endedAtMs != null
    && (now - endedAtMs) < windowMs;
  const cruiseActive = isModifierActive(sm.cruiseUntil, now);
  const voyageShieldActive = isModifierActive(sm.voyageShieldUntil, now);
  // Voyage Shield is documented as an independent 12h floor — keep the
  // rollup alive while the shield is active even if the base recovery
  // window has expired, so the shield can actually apply its floor.
  if (!sm.active && !inRecoveryWindow && !voyageShieldActive) return null;

  const currentWeatherForRecovery = resolveCurrentWeather(state, now);

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

  const rawRecovery = computeRecoveryCapacity({
    autoPilotScore: performanceScore,
    hydrationCompliance: complianceFromStreak(state.complianceStreak),
    // PR5 — the same canonical freshness verdict Core uses. Recovery Capacity
    // is a member-visible band; it must not disagree with the score about
    // whether the same weather reading is current. `environmentalStress`
    // already treats null as "no environmental premium".
    environmentalStress: environmentalStress({
      tempC: currentWeatherForRecovery.tempC,
      humidity: currentWeatherForRecovery.humidityPct,
      activityLevel: state.activityLevel,
      preset: sm.preset ?? null,
    }),
  });

  // ─── Voyage Shield (chunk #5) ────────────────────────────────
  // Apply the shield to the *final* score, not the component points,
  // so the contributions readout still reflects reality and the shield
  // is a clean "score floor" UX without faking inputs.
  const shieldedScore = applyVoyageShield(rawRecovery.score, voyageShieldActive);
  const shieldedMeta = bandFor(shieldedScore);
  const recoveryCapacity = voyageShieldActive && shieldedScore !== rawRecovery.score
    ? { ...rawRecovery, score: shieldedScore, band: shieldedMeta.band, meta: shieldedMeta }
    : rawRecovery;

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
    cruiseActive,
    voyageShieldActive,
    windowMs,
  };
}
