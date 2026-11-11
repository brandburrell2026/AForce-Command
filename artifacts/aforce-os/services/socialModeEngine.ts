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
import { SOCIAL_SESSION_MAX_MS } from '../config/hydroStateModel';

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

/**
 * Is this session LIVE right now? `active: true` alone is not enough — a
 * session left open (nobody tapped End night) stops being live once it is
 * older than SOCIAL_SESSION_MAX_MS (config/hydroStateModel.ts). Pure; `now`
 * injectable. Found 2026-10-06: a demo session from 2026-08-12 had steered
 * every command for eight weeks.
 */
export function isSocialSessionLive(
  sm: NonNullable<UserState['socialMode']> | undefined | null,
  now: number = Date.now(),
): boolean {
  if (!sm || !sm.active) return false;
  const startedMs = sm.startedAt instanceof Date ? sm.startedAt.getTime() : new Date(sm.startedAt).getTime();
  if (!Number.isFinite(startedMs)) return false;
  return now - startedMs < SOCIAL_SESSION_MAX_MS;
}

/**
 * When the session is treated as having ENDED: the recorded endedAt, or — for
 * an open session past its maximum — the implied end at startedAt + max, so
 * the recovery window runs exactly as if End night had been tapped then.
 */
export function effectiveSessionEndMs(sm: NonNullable<UserState['socialMode']>, now: number = Date.now()): number | null {
  if (sm.endedAt) return sm.endedAt.getTime();
  if (sm.active && !isSocialSessionLive(sm, now)) {
    const startedMs = sm.startedAt instanceof Date ? sm.startedAt.getTime() : new Date(sm.startedAt).getTime();
    return Number.isFinite(startedMs) ? startedMs + SOCIAL_SESSION_MAX_MS : null;
  }
  return null;
}

export function buildSocialRollup(state: UserState, performanceScore: number, now: number = Date.now()): ScoreEngineOutput['social'] {
  const sm = state.socialMode;
  if (!sm) return null;
  const live = isSocialSessionLive(sm, now);
  const endedAtMs = effectiveSessionEndMs(sm, now);
  const windowMs = effectiveRecoveryWindowMs(sm, now);
  const inRecoveryWindow = !live
    && endedAtMs != null
    && (now - endedAtMs) < windowMs;
  const cruiseActive = isModifierActive(sm.cruiseUntil, now);
  const voyageShieldActive = isModifierActive(sm.voyageShieldUntil, now);
  // Voyage Shield is documented as an independent 12h floor — keep the
  // rollup alive while the shield is active even if the base recovery
  // window has expired, so the shield can actually apply its floor.
  if (!live && !inRecoveryWindow && !voyageShieldActive) return null;

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
    active: live,
    inRecoveryWindow,
    drinkCount: sm.drinks.length,
    hangoverRisk,
    alcoholMultiplier: live ? activeDecayMultiplier(sm.drinks, now) : 1,
    bac,
    impairment,
    transportation,
    recoveryCapacity,
    cruiseActive,
    voyageShieldActive,
    windowMs,
  };
}
