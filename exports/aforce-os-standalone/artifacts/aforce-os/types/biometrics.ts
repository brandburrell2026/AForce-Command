/**
 * Cross-provider biometric snapshot.
 *
 * AForce ingests data from multiple health platforms (Apple Health,
 * Oura, Samsung Health, Google Health Connect, Garmin, WHOOP, Strava).
 * Every platform exposes a slightly different schema; this is the
 * union we normalize to before feeding the score. Any field a given
 * provider doesn't expose stays null — never substituted with a
 * placeholder. That keeps the aggregator honest about what's actually
 * connected and what isn't.
 *
 * The previous model only stored an `appleHealth` field on UserState;
 * with seven providers in the catalog (see data/healthProviders.ts)
 * the score now derives from whichever providers the user has linked.
 */

import type { HealthProviderId } from '../data/healthProviders';

export interface ProviderSnapshot {
  /** Which provider this snapshot came from. */
  providerId: HealthProviderId;
  /** Resting heart rate (bpm). */
  restingHeartRate?: number | null;
  /** Heart rate variability — SDNN, milliseconds. */
  hrvSdnn?: number | null;
  /** Total sleep duration last night (hours). */
  sleepHoursLastNight?: number | null;
  /** Total steps for the current local day. */
  stepsToday?: number | null;
  /** Active workout / exercise minutes for the current local day. */
  workoutMinutesToday?: number | null;
  /** WHOOP-style strain score (0–21). */
  strain?: number | null;
  /** WHOOP / Oura recovery percentage (0–100, higher = more recovered). */
  recoveryPct?: number | null;
  /** Oura readiness score (0–100). */
  readinessScore?: number | null;
  /** Garmin stress score (0–100, higher = more stressed). */
  stressScore?: number | null;
  /** Strava-style 7-day acute training load (arbitrary CTL/ATL units). */
  trainingLoad?: number | null;
  /** When this snapshot was last refreshed (epoch ms). */
  fetchedAt: number;
}

export type ProviderBiometrics = Partial<Record<HealthProviderId, ProviderSnapshot>>;
