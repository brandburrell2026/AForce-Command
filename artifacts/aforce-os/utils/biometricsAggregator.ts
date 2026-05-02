/**
 * Cross-provider biometrics aggregator.
 *
 * Folds snapshots from any combination of connected health platforms
 * (Apple Health, Oura, Samsung Health, Google Health Connect, Garmin,
 * WHOOP, Strava) into two scalar inputs the scoring engine already
 * understands:
 *
 *   inferredActivityLevel  : 0..10 — used as a FLOOR for the manual
 *                            activityLevel axis when biometrics show
 *                            higher activity than the user logged
 *                            (so a heavy WHOOP strain day depletes
 *                            faster even if the slider was forgotten).
 *
 *   recoveryDelta          : -10..+10 — folded into computeRecoverySignal
 *                            in place of the legacy single-provider
 *                            Apple Health delta. Same clamp magnitude
 *                            so multi-provider data can never dominate
 *                            the score.
 *
 * Per-metric reduction strategy (when multiple providers report the
 * same field): pick the FRESHEST snapshot's value for that metric.
 * "Freshest" = largest fetchedAt. This avoids double-counting (e.g.
 * Apple + Garmin both reporting HRV would add up to 2× the recovery
 * boost otherwise).
 *
 * Activity uses MAX across providers, on the principle that whichever
 * tracker recorded the highest workout/strain/steps captured the most
 * complete picture — Strava might log a ride that Apple missed, WHOOP
 * might log strain Apple Watch under-counted.
 *
 * Pure module — no React Native, no AsyncStorage, no clock side
 * effects beyond what the caller passes in. Easy to unit-test.
 */

import type { HealthProviderId } from '../data/healthProviders';
import type { ProviderBiometrics, ProviderSnapshot } from '../types/biometrics';

export interface AggregatedBiometrics {
  /** 0..10 activity level inferred from steps + workouts + strain. */
  inferredActivityLevel: number;
  /** -10..+10 recovery delta from HRV / sleep / readiness / recovery%. */
  recoveryDelta: number;
  /** Provider IDs that contributed at least one non-null field. */
  sources: HealthProviderId[];
  /** Human-readable summary suitable for the breakdown sheet hint. */
  hint: string;
}

const RECOVERY_CLAMP = 10;
const ACTIVITY_CLAMP = 10;

/**
 * Steps → 0..10 activity level. Anchors:
 *   2,000  → 1   (sedentary office day)
 *   5,000  → 3   (errands)
 *   7,500  → 5   (light walking)
 *  10,000  → 7   (active day, US health-guideline target)
 *  15,000+ → 9   (very active)
 */
function activityFromSteps(steps: number): number {
  if (steps <= 0) return 0;
  if (steps >= 15000) return 9;
  if (steps >= 10000) return 7 + ((steps - 10000) / 5000) * 2;
  if (steps >= 7500) return 5 + ((steps - 7500) / 2500) * 2;
  if (steps >= 5000) return 3 + ((steps - 5000) / 2500) * 2;
  if (steps >= 2000) return 1 + ((steps - 2000) / 3000) * 2;
  return (steps / 2000) * 1;
}

/**
 * Workout minutes → 0..10. Anchors (ACSM guideline = 150 min/week ≈
 * 22 min/day moderate or 11 min/day vigorous):
 *   15  → 3   (active commute)
 *   30  → 5   (moderate session)
 *   60  → 7   (real workout)
 *   90  → 8.5 (long ride / lift)
 *   120+ → 10 (endurance day)
 */
function activityFromWorkoutMinutes(min: number): number {
  if (min <= 0) return 0;
  if (min >= 120) return 10;
  if (min >= 90) return 8.5 + ((min - 90) / 30) * 1.5;
  if (min >= 60) return 7 + ((min - 60) / 30) * 1.5;
  if (min >= 30) return 5 + ((min - 30) / 30) * 2;
  if (min >= 15) return 3 + ((min - 15) / 15) * 2;
  return (min / 15) * 3;
}

/**
 * WHOOP strain (0..21) → 0..10. WHOOP's 21-point scale uses 0–9 = light,
 * 10–13 = moderate, 14–17 = strenuous, 18–21 = all-out. Linear scale to
 * the AForce 0..10 axis preserves the same proportional interpretation.
 */
function activityFromStrain(strain: number): number {
  if (strain <= 0) return 0;
  return Math.min(10, (strain / 21) * 10);
}

/** Pick the freshest snapshot for a given metric, return its value or null. */
function freshestNonNull<K extends keyof ProviderSnapshot>(
  snaps: ProviderSnapshot[],
  key: K,
): ProviderSnapshot[K] | null {
  let best: { value: ProviderSnapshot[K]; fetchedAt: number } | null = null;
  for (const s of snaps) {
    const v = s[key];
    if (v == null) continue;
    if (best === null || s.fetchedAt > best.fetchedAt) {
      best = { value: v, fetchedAt: s.fetchedAt };
    }
  }
  return best ? best.value : null;
}

/**
 * Aggregate per-provider snapshots into the two scalars the score
 * engine consumes. Pass an empty / undefined record to get a no-op
 * result (delta 0, inferredActivityLevel 0, sources []).
 */
export function aggregateBiometrics(
  biometrics: ProviderBiometrics | undefined,
): AggregatedBiometrics {
  if (!biometrics) {
    return { inferredActivityLevel: 0, recoveryDelta: 0, sources: [], hint: 'No platforms connected' };
  }

  const snaps: ProviderSnapshot[] = [];
  const sources: HealthProviderId[] = [];
  for (const [id, snap] of Object.entries(biometrics) as [HealthProviderId, ProviderSnapshot | undefined][]) {
    if (!snap) continue;
    snaps.push(snap);
    sources.push(id);
  }
  if (snaps.length === 0) {
    return { inferredActivityLevel: 0, recoveryDelta: 0, sources: [], hint: 'No platforms connected' };
  }

  // ── Activity inference ────────────────────────────────────────────
  // MAX across providers (best capture wins) and across signals (any
  // single signal indicating high activity is enough — a heavy lift
  // can be 30 min of workout but 1k steps).
  let activity = 0;
  for (const s of snaps) {
    if (s.stepsToday != null) activity = Math.max(activity, activityFromSteps(s.stepsToday));
    if (s.workoutMinutesToday != null) activity = Math.max(activity, activityFromWorkoutMinutes(s.workoutMinutesToday));
    if (s.strain != null) activity = Math.max(activity, activityFromStrain(s.strain));
  }
  // Strava training load is a 7-day rolling number, so it shouldn't
  // override TODAY's activity, but a sustained high load implies the
  // user is in a heavier training block — fold it in at half weight.
  for (const s of snaps) {
    if (s.trainingLoad != null && s.trainingLoad >= 50) {
      const loadActivity = Math.min(10, ((s.trainingLoad - 50) / 50) * 4 + 4);
      activity = Math.max(activity, loadActivity * 0.5);
    }
  }
  const inferredActivityLevel = Math.max(0, Math.min(ACTIVITY_CLAMP, Math.round(activity * 10) / 10));

  // ── Recovery delta ────────────────────────────────────────────────
  // Pick the freshest non-null reading per metric so we don't
  // double-count when Apple + Garmin both report HRV.
  const hrv = freshestNonNull(snaps, 'hrvSdnn');
  const sleep = freshestNonNull(snaps, 'sleepHoursLastNight');
  const readiness = freshestNonNull(snaps, 'readinessScore');
  const recoveryPct = freshestNonNull(snaps, 'recoveryPct');
  const stress = freshestNonNull(snaps, 'stressScore');

  const parts: string[] = [];
  let delta = 0;

  if (hrv != null) {
    if (hrv >= 60) { delta += 5; parts.push(`HRV ${Math.round(hrv)}ms (high)`); }
    else if (hrv >= 40) { delta += 2; parts.push(`HRV ${Math.round(hrv)}ms`); }
    else if (hrv >= 30) { parts.push(`HRV ${Math.round(hrv)}ms`); }
    else { delta -= 5; parts.push(`HRV ${Math.round(hrv)}ms (low)`); }
  }
  if (sleep != null) {
    if (sleep >= 7 && sleep <= 9) { delta += 5; parts.push(`Sleep ${sleep.toFixed(1)}h`); }
    else if (sleep >= 6) { delta += 2; parts.push(`Sleep ${sleep.toFixed(1)}h`); }
    else if (sleep >= 4) { delta -= 3; parts.push(`Sleep ${sleep.toFixed(1)}h (short)`); }
    else { delta -= 5; parts.push(`Sleep ${sleep.toFixed(1)}h (deficit)`); }
  }
  if (readiness != null) {
    if (readiness >= 85) { delta += 4; parts.push(`Readiness ${Math.round(readiness)}`); }
    else if (readiness >= 70) { delta += 2; parts.push(`Readiness ${Math.round(readiness)}`); }
    else if (readiness >= 50) { /* neutral */ parts.push(`Readiness ${Math.round(readiness)}`); }
    else { delta -= 4; parts.push(`Readiness ${Math.round(readiness)} (low)`); }
  }
  if (recoveryPct != null) {
    if (recoveryPct >= 75) { delta += 4; parts.push(`Recovery ${Math.round(recoveryPct)}%`); }
    else if (recoveryPct >= 50) { delta += 1; parts.push(`Recovery ${Math.round(recoveryPct)}%`); }
    else if (recoveryPct >= 33) { delta -= 2; parts.push(`Recovery ${Math.round(recoveryPct)}%`); }
    else { delta -= 5; parts.push(`Recovery ${Math.round(recoveryPct)}% (red)`); }
  }
  if (stress != null) {
    // Garmin stress: 0–25 rest, 26–50 low, 51–75 medium, 76–100 high.
    if (stress >= 76) { delta -= 4; parts.push(`Stress ${Math.round(stress)} (high)`); }
    else if (stress >= 51) { delta -= 2; parts.push(`Stress ${Math.round(stress)}`); }
    else if (stress <= 25) { delta += 2; parts.push(`Stress ${Math.round(stress)} (rest)`); }
  }

  const recoveryDelta = Math.max(-RECOVERY_CLAMP, Math.min(RECOVERY_CLAMP, delta));

  let hint: string;
  if (parts.length === 0) {
    hint = sources.length === 1 ? '1 platform · awaiting data' : `${sources.length} platforms · awaiting data`;
  } else {
    hint = parts.join(' · ');
  }

  return { inferredActivityLevel, recoveryDelta, sources, hint };
}
