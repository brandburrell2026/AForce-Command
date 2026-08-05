/**
 * Apple HealthKit bridge for AForce OS.
 *
 * This module isolates every call to @kingstinct/react-native-healthkit
 * behind a tiny async API so the rest of the app can request
 * permission, check status, and pull recent samples without caring
 * about platform availability.
 *
 * Important contract:
 *   - On non-iOS platforms (Android, web) every function resolves to a
 *     safe "unavailable" result. The Profile screen surfaces this so
 *     the user knows real Apple Health requires a native iOS build.
 *   - We never fabricate data. If a permission is denied or the
 *     module isn't linked, we return null and the score engine simply
 *     doesn't receive an Apple Health contribution.
 */

import { Platform } from 'react-native';

import { DEFAULT_FLAGS } from '../featureFlags/flags';
import { INTERNAL_TESTFLIGHT_OVERLAY_ENABLED } from '../featureFlags/internalTestflightOverlay';

export interface AppleHealthSnapshot {
  /** Most recent resting heart rate sample (bpm). */
  restingHeartRate: number | null;
  /** Most recent HRV (SDNN, ms). */
  hrvSdnn: number | null;
  /** Total step count for the current local day. */
  stepsToday: number | null;
  /** Total sleep duration for the prior night (hours). */
  sleepHoursLastNight: number | null;
}

const EMPTY_SNAPSHOT: AppleHealthSnapshot = {
  restingHeartRate: null,
  hrvSdnn: null,
  stepsToday: null,
  sleepHoursLastNight: null,
};

export function isAppleHealthSupported(): boolean {
  // RC-2 Track-A — internal-TestFlight HealthKit enablement.
  //
  // Available on iOS when EITHER:
  //   - this is an internal-TestFlight build. `INTERNAL_TESTFLIGHT_OVERLAY_ENABLED`
  //     (featureFlags/internalTestflightOverlay.ts) reads
  //     EXPO_PUBLIC_INTERNAL_TESTFLIGHT, inlined at build time by
  //     babel-preset-expo — the same reachable, non-React-store env gate
  //     Ruling A already proved for the elite_* flag overlay. Reused here
  //     rather than re-reading the env var, so there is exactly one seam
  //     that knows what "internal TestFlight" means, OR
  //   - DEFAULT_FLAGS.healthkit_native_enabled is true — the general-
  //     availability switch for a future production rollout. It stays
  //     `false` in DEFAULT_FLAGS and DEMO_ALL_ON today (unchanged by this
  //     gate), so it contributes nothing until a separate, deliberate
  //     ruling flips it.
  //
  // Production and ordinary preview builds set neither, so they report
  // "unavailable" — the same shape an Android or web user already gets —
  // exactly as before this change.
  return Platform.OS === 'ios' && (INTERNAL_TESTFLIGHT_OVERLAY_ENABLED || DEFAULT_FLAGS.healthkit_native_enabled);
}

/**
 * Lazily import the native module. Imported this way so Metro doesn't
 * try to resolve the native side on web/Android, where the package's
 * Nitro module isn't linked.
 *
 * RE-ENABLE STATUS: @kingstinct/react-native-healthkit + react-native-nitro-modules
 * are back in package.json, the config plugin is registered in app.json (RC-2
 * Track-A), and the dynamic import below is live. It only executes when
 * isAppleHealthSupported() is true — i.e. iOS AND (internal-TestFlight build
 * OR healthkit_native_enabled) — so production/preview builds and every
 * non-iOS platform never reach the import and Metro never needs to resolve
 * the native module for them. There is deliberately only ONE gate here now
 * (isAppleHealthSupported() itself): a second, independent
 * `healthkit_native_enabled` check used to live in this function too, but
 * that made it a second source of truth that would have silently re-blocked
 * the internal-TestFlight path this change exists to open. General
 * production availability (flipping `healthkit_native_enabled` on) is a
 * separate, deliberately un-taken step.
 */
async function loadHealthKit(): Promise<any | null> {
  if (!isAppleHealthSupported()) return null;
  try {
    const mod = await import('@kingstinct/react-native-healthkit');
    return mod;
  } catch (err) {
    console.warn('[AppleHealth] failed to load native module', err);
    return null;
  }
}

/**
 * Request read access to the metrics we feed into the AForce engine.
 * Returns true only if the request was actually shown AND HealthKit
 * is available — false in every other case (web, Android, native
 * build without entitlement, user cancellation).
 */
export async function requestAppleHealthPermissions(): Promise<boolean> {
  const HK = await loadHealthKit();
  if (!HK) return false;
  try {
    await HK.requestAuthorization({
      toRead: [
        'HKQuantityTypeIdentifierHeartRate',
        'HKQuantityTypeIdentifierRestingHeartRate',
        'HKQuantityTypeIdentifierHeartRateVariabilitySDNN',
        'HKQuantityTypeIdentifierStepCount',
        'HKCategoryTypeIdentifierSleepAnalysis',
        'HKWorkoutTypeIdentifier',
      ],
      // RULING H (RC-2): no write (toShare) scopes. AForce never writes to
      // HealthKit — DietaryWater write access was requested but never used
      // (zero HKQuantitySample-write calls exist in this codebase). See
      // services/__tests__/appleHealth.healthKitScopes.test.ts for the
      // regression lock: a future legitimate write feature must touch that
      // test consciously, not silently reintroduce a write scope here.
      toShare: [],
    });
    return true;
  } catch (err) {
    console.warn('[AppleHealth] requestAuthorization failed', err);
    return false;
  }
}

/**
 * Pull a snapshot of the metrics that influence the AForce score.
 * Any field we can't read is left as null — never substituted with
 * a placeholder.
 */
export async function fetchAppleHealthSnapshot(): Promise<AppleHealthSnapshot> {
  const HK = await loadHealthKit();
  if (!HK) return EMPTY_SNAPSHOT;

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const now = new Date();
  const lastNightStart = new Date(now.getTime() - 18 * 60 * 60 * 1000);

  const safe = async <T>(fn: () => Promise<T>): Promise<T | null> => {
    try {
      return await fn();
    } catch (err) {
      console.warn('[AppleHealth] sample fetch failed', err);
      return null;
    }
  };

  const mostRecentQuantity = async (identifier: string, unit: string): Promise<number | null> => {
    const samples = await HK.queryQuantitySamples(identifier, {
      ascending: false,
      limit: 1,
      unit,
      filter: { date: { startDate: new Date(0), endDate: now } },
    });
    if (!Array.isArray(samples) || samples.length === 0) return null;
    return samples[0]?.quantity ?? null;
  };

  const restingHeartRate = await safe(() =>
    mostRecentQuantity('HKQuantityTypeIdentifierRestingHeartRate', 'count/min'),
  );

  const hrvSdnn = await safe(() =>
    mostRecentQuantity('HKQuantityTypeIdentifierHeartRateVariabilitySDNN', 'ms'),
  );

  const stepsToday = await safe(async () => {
    const samples = await HK.queryQuantitySamples('HKQuantityTypeIdentifierStepCount', {
      ascending: true,
      limit: 0,
      unit: 'count',
      filter: { date: { startDate: startOfDay, endDate: now } },
    });
    if (!Array.isArray(samples)) return null;
    return samples.reduce(
      (sum: number, s: { quantity: number }) => sum + (s.quantity ?? 0),
      0,
    );
  });

  const sleepHoursLastNight = await safe(async () => {
    const samples = await HK.queryCategorySamples('HKCategoryTypeIdentifierSleepAnalysis', {
      ascending: true,
      limit: 0,
      filter: { date: { startDate: lastNightStart, endDate: now } },
    });
    if (!Array.isArray(samples)) return null;
    const ms = samples.reduce(
      (sum: number, s: { startDate: string | Date; endDate: string | Date; value: number }) => {
        // value 0 = INBED, 1 = ASLEEP_UNSPECIFIED, 3..5 = ASLEEP_CORE/DEEP/REM, 2 = AWAKE.
        const isAsleep = s.value === 1 || s.value === 3 || s.value === 4 || s.value === 5;
        if (!isAsleep) return sum;
        const start = new Date(s.startDate).getTime();
        const end = new Date(s.endDate).getTime();
        return sum + Math.max(0, end - start);
      },
      0,
    );
    return ms / (1000 * 60 * 60);
  });

  return {
    restingHeartRate: restingHeartRate ?? null,
    hrvSdnn: hrvSdnn ?? null,
    stepsToday: stepsToday ?? null,
    sleepHoursLastNight: sleepHoursLastNight ?? null,
  };
}
