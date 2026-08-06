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
import {
  isAppleHealthDiagnosticsEnabled,
  setLastAppleHealthDiagnostics,
  type AppleHealthDiagnosticSample,
  type AppleHealthDiagnosticsSnapshot,
  type AppleHealthQuantityMetricDiagnostic,
  type AppleHealthStepsDiagnostic,
} from './appleHealthDiagnostics';

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

// ─── Steps aggregation ────────────────────────────────────────────────────
//
// RC-2 P0 device-validation fix. The OLD method (kept below as
// `sumRawQuantitySamples`, still used for the diagnostics comparison and as
// a resilience fallback) summed every raw `HKQuantitySample` for the day
// across every recording source. When a user wears an Apple Watch paired to
// their iPhone, BOTH devices can independently record steps for the same
// walking — HealthKit does not silently deduplicate that for you, and
// neither `queryQuantitySamples` nor a plain `queryStatisticsForQuantity`
// cumulativeSum removes the overlap (both simply add up every matching
// sample regardless of source). Apple's own Health app avoids the double
// count by reconciling per-source, per-time-window, not by a magic
// aggregation call.
//
// `reduceStepsByBucketMax` is the client-side approximation of that
// reconciliation: bucket the day into hours, and for each hour take the
// MAX across sources rather than the sum. Rationale — within any given
// hour, whichever device was actually being worn/carried captured that
// hour's real activity most completely; the other device's overlapping
// count for the same hour is the double-counted portion, not additional
// real steps. Hours where only one source reported are unaffected (max of
// one value is that value), so a device the user didn't wear for part of
// the day never loses real steps the other device caught.
//
// This is a client-side APPROXIMATION, not a guarantee of matching the
// Health app's own total exactly — see
// docs/health/validation/APPLE-PIPELINE-AUDIT.md for the full reasoning and
// why this needs device confirmation. The diagnostics panel below (gated on
// `INTERNAL_TESTFLIGHT_OVERLAY_ENABLED`) surfaces the OLD raw-sum value,
// the NEW bucketed-max value, and each source's whole-day total side by
// side specifically so that comparison can happen on-device against the
// Health app's displayed total.

export interface StepsSourceBucket {
  /** HealthKit source name, e.g. "iPhone" or "Brandon's Apple Watch". Diagnostic only — not used by the reduction itself. */
  sourceName: string;
  /** Bucket start, as an ISO string — samples in the same bucket must carry the identical string to be grouped together. */
  startDate: string;
  /** This source's cumulative sum for this bucket. */
  quantity: number;
}

/**
 * Pure reduction: group by `startDate` (the bucket key), take the MAX
 * `quantity` across sources within each bucket, then sum the per-bucket
 * maxes. Zero HealthKit/React Native dependency — see
 * `services/__tests__/appleHealth.stepsAggregation.test.ts` for the
 * multi-source fixture proving this does not double-count an overlapping
 * iPhone + Watch hour.
 */
export function reduceStepsByBucketMax(buckets: readonly StepsSourceBucket[]): number {
  const bucketMax = new Map<string, number>();
  for (const b of buckets) {
    const prev = bucketMax.get(b.startDate) ?? 0;
    if (b.quantity > prev) bucketMax.set(b.startDate, b.quantity);
  }
  let total = 0;
  for (const v of bucketMax.values()) total += v;
  return total;
}

function sumRawQuantitySamples(samples: unknown): number | null {
  if (!Array.isArray(samples)) return null;
  return samples.reduce(
    (sum: number, s: { quantity: number }) => sum + (s?.quantity ?? 0),
    0,
  );
}

function toDiagnosticSample(raw: any, unit: string): AppleHealthDiagnosticSample | null {
  if (!raw) return null;
  return {
    startDate: new Date(raw.startDate).toISOString(),
    endDate: new Date(raw.endDate).toISOString(),
    quantity: raw.quantity ?? 0,
    unit: raw.unit ?? unit,
    sourceName: raw.sourceRevision?.source?.name ?? 'unknown',
  };
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
  const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const diagnosticsEnabled = isAppleHealthDiagnosticsEnabled();

  const safe = async <T>(fn: () => Promise<T>): Promise<T | null> => {
    try {
      return await fn();
    } catch (err) {
      console.warn('[AppleHealth] sample fetch failed', err);
      return null;
    }
  };

  // Returns the raw newest sample (not just its `.quantity`) so the
  // diagnostics capture below can report startDate/endDate/sourceName
  // without issuing a second query for the same data.
  const mostRecentQuantitySample = async (identifier: string, unit: string): Promise<any | null> => {
    const samples = await HK.queryQuantitySamples(identifier, {
      ascending: false,
      limit: 1,
      unit,
      filter: { date: { startDate: new Date(0), endDate: now } },
    });
    if (!Array.isArray(samples) || samples.length === 0) return null;
    return samples[0] ?? null;
  };

  const restingHeartRateSample = await safe(() =>
    mostRecentQuantitySample('HKQuantityTypeIdentifierRestingHeartRate', 'count/min'),
  );
  const restingHeartRate = restingHeartRateSample?.quantity ?? null;

  const hrvSdnnSample = await safe(() =>
    mostRecentQuantitySample('HKQuantityTypeIdentifierHeartRateVariabilitySDNN', 'ms'),
  );
  const hrvSdnn = hrvSdnnSample?.quantity ?? null;

  // ── Steps: raw sum (OLD, kept for fallback + diagnostics) ──────────────
  const stepsRawSampleSum = await safe(async () => {
    const samples = await HK.queryQuantitySamples('HKQuantityTypeIdentifierStepCount', {
      ascending: true,
      limit: 0,
      unit: 'count',
      filter: { date: { startDate: startOfDay, endDate: now } },
    });
    return sumRawQuantitySamples(samples);
  });

  // ── Steps: bucketed max-per-source-per-hour (NEW) ───────────────────────
  let stepsBucketedMax: number | null = null;
  let stepsUsedFallback = false;
  try {
    const perSourceHourly = await HK.queryStatisticsCollectionForQuantitySeparateBySource(
      'HKQuantityTypeIdentifierStepCount',
      ['cumulativeSum'],
      startOfDay,
      { hour: 1 },
      { unit: 'count', filter: { date: { startDate: startOfDay, endDate: now } } },
    );
    const buckets: StepsSourceBucket[] = Array.isArray(perSourceHourly)
      ? perSourceHourly
          .filter((entry: any) => entry?.startDate)
          .map((entry: any) => ({
            sourceName: entry.source?.name ?? 'unknown',
            startDate: new Date(entry.startDate).toISOString(),
            quantity: entry.sumQuantity?.quantity ?? 0,
          }))
      : [];
    stepsBucketedMax = reduceStepsByBucketMax(buckets);
  } catch (err) {
    console.warn('[AppleHealth] bucketed step aggregation failed, falling back to raw sum', err);
    stepsUsedFallback = true;
  }

  const stepsToday = stepsUsedFallback ? stepsRawSampleSum : stepsBucketedMax;

  let sleepSampleCount: number | null = null;
  const sleepHoursLastNight = await safe(async () => {
    const samples = await HK.queryCategorySamples('HKCategoryTypeIdentifierSleepAnalysis', {
      ascending: true,
      limit: 0,
      filter: { date: { startDate: lastNightStart, endDate: now } },
    });
    if (!Array.isArray(samples)) return null;
    sleepSampleCount = samples.length;
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

  const snapshot: AppleHealthSnapshot = {
    restingHeartRate: restingHeartRate ?? null,
    hrvSdnn: hrvSdnn ?? null,
    stepsToday: stepsToday ?? null,
    sleepHoursLastNight: sleepHoursLastNight ?? null,
  };

  // ── Diagnostics capture (internal-TestFlight only) ──────────────────────
  // Best-effort and fully non-blocking to the returned snapshot: any
  // failure here is swallowed so a diagnostics bug can never turn into a
  // user-visible Apple Health regression. Off-gate this entire block never
  // runs (see `isAppleHealthDiagnosticsEnabled`), so production builds pay
  // zero extra HealthKit query cost.
  if (diagnosticsEnabled) {
    try {
      const [rhr24h, hrv24h, perSourceTotalsRaw] = await Promise.all([
        safe(() => HK.queryQuantitySamples('HKQuantityTypeIdentifierRestingHeartRate', {
          ascending: false,
          limit: 0,
          unit: 'count/min',
          filter: { date: { startDate: last24h, endDate: now } },
        })),
        safe(() => HK.queryQuantitySamples('HKQuantityTypeIdentifierHeartRateVariabilitySDNN', {
          ascending: false,
          limit: 0,
          unit: 'ms',
          filter: { date: { startDate: startOfDay, endDate: now } },
        })),
        safe(() => HK.queryStatisticsForQuantitySeparateBySource(
          'HKQuantityTypeIdentifierStepCount',
          ['cumulativeSum'],
          { unit: 'count', filter: { date: { startDate: startOfDay, endDate: now } } },
        )),
      ]);

      const restingHeartRateDiag: AppleHealthQuantityMetricDiagnostic = {
        identifier: 'HKQuantityTypeIdentifierRestingHeartRate',
        queried: true,
        sampleCount24h: Array.isArray(rhr24h) ? rhr24h.length : null,
        newest: toDiagnosticSample(restingHeartRateSample, 'count/min'),
        valueUsed: restingHeartRate,
      };

      const hrvDiag: AppleHealthQuantityMetricDiagnostic = {
        identifier: 'HKQuantityTypeIdentifierHeartRateVariabilitySDNN',
        queried: true,
        sampleCount24h: Array.isArray(hrv24h) ? hrv24h.length : null,
        newest: toDiagnosticSample(hrvSdnnSample, 'ms'),
        valueUsed: hrvSdnn,
      };

      const stepsSampleCountForDiagnostics = await safe(async () => {
        const samples = await HK.queryQuantitySamples('HKQuantityTypeIdentifierStepCount', {
          ascending: true,
          limit: 0,
          unit: 'count',
          filter: { date: { startDate: startOfDay, endDate: now } },
        });
        return Array.isArray(samples) ? samples.length : null;
      });

      const stepsDiag: AppleHealthStepsDiagnostic = {
        identifier: 'HKQuantityTypeIdentifierStepCount',
        queried: true,
        rawSampleSum: stepsRawSampleSum,
        bucketedMaxTotal: stepsBucketedMax,
        perSourceTotals: Array.isArray(perSourceTotalsRaw)
          ? perSourceTotalsRaw.map((entry: any) => ({
              sourceName: entry.source?.name ?? 'unknown',
              total: entry.sumQuantity?.quantity ?? 0,
            }))
          : [],
        sampleCount: stepsSampleCountForDiagnostics,
        valueUsed: stepsToday,
        usedFallback: stepsUsedFallback,
      };

      const diagnosticsSnapshot: AppleHealthDiagnosticsSnapshot = {
        capturedAt: Date.now(),
        restingHeartRate: restingHeartRateDiag,
        hrv: hrvDiag,
        steps: stepsDiag,
        sleep: {
          identifier: 'HKCategoryTypeIdentifierSleepAnalysis',
          queried: true,
          sampleCount: sleepSampleCount,
          valueUsed: sleepHoursLastNight,
        },
        workout: {
          identifier: 'HKWorkoutTypeIdentifier',
          queried: false,
          reason: 'HKWorkoutTypeIdentifier is authorized (see requestAppleHealthPermissions) but fetchAppleHealthSnapshot never queries it — AppleHealthSnapshot has no workout field. See APPLE-PIPELINE-AUDIT.md, SUSPECT 4.',
        },
        mappedSnapshot: snapshot,
      };

      setLastAppleHealthDiagnostics(diagnosticsSnapshot);
    } catch (err) {
      console.warn('[AppleHealth] diagnostics capture failed (non-fatal, snapshot unaffected)', err);
    }
  }

  return snapshot;
}
