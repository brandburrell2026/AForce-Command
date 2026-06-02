/**
 * Demo snapshots for non-Apple-Health providers.
 *
 * The Profile screen mocks OAuth for Oura / Samsung / Google Health /
 * Garmin / WHOOP / Strava (real OAuth ships with the v1.1 native
 * build). To keep the multi-provider score aggregation observable in
 * the current build, connecting a non-Apple provider seeds one of
 * these representative snapshots into UserState.biometrics so the
 * orb visibly reacts.
 *
 * Each value is hand-picked to be physiologically plausible for a
 * typical-but-trained adult (HRV mid-range, ~7h sleep, moderate
 * activity) so when a user connects multiple providers the
 * aggregator surfaces a coherent recovery delta + activity level
 * rather than a flat zero.
 *
 * Apple Health is intentionally NOT in this map — Apple Health uses
 * the real `services/appleHealth.ts` native bridge.
 */

import type { HealthProviderId } from './healthProviders';
import type { ProviderSnapshot } from '../types/biometrics';

export type DemoSnapshot = Omit<ProviderSnapshot, 'fetchedAt'>;

export const DEMO_PROVIDER_SNAPSHOTS: Partial<Record<HealthProviderId, DemoSnapshot>> = {
  oura: {
    providerId: 'oura',
    hrvSdnn: 58,
    sleepHoursLastNight: 7.4,
    readinessScore: 82,
    restingHeartRate: 56,
  },
  samsung_health: {
    providerId: 'samsung_health',
    restingHeartRate: 62,
    sleepHoursLastNight: 6.8,
    stepsToday: 8200,
    workoutMinutesToday: 28,
  },
  google_health: {
    providerId: 'google_health',
    restingHeartRate: 64,
    stepsToday: 9400,
  },
  garmin: {
    providerId: 'garmin',
    hrvSdnn: 52,
    stressScore: 38,
    workoutMinutesToday: 45,
  },
  whoop: {
    providerId: 'whoop',
    strain: 14.2,
    recoveryPct: 71,
    sleepHoursLastNight: 7.1,
  },
  strava: {
    providerId: 'strava',
    workoutMinutesToday: 62,
    trainingLoad: 78,
  },
};

/** Build a snapshot with a fresh fetchedAt timestamp at call time. */
export function buildDemoSnapshot(id: HealthProviderId, now: number = Date.now()): ProviderSnapshot | null {
  const base = DEMO_PROVIDER_SNAPSHOTS[id];
  if (!base) return null;
  return { ...base, fetchedAt: now };
}
