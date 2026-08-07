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
  type AppleHealthSleepSourceTotal,
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
// walking — a raw sample sum does not deduplicate that; it simply adds up
// every matching sample regardless of source.
//
// `reduceStepsByBucketMax` is this codebase's client-side approximation of
// HealthKit's own cross-source reconciliation: bucket the day into hours,
// and for each hour take the MAX across sources rather than the sum.
// Rationale — within any given hour, whichever device was actually being
// worn/carried captured that hour's real activity most completely; the
// other device's overlapping count for the same hour is the double-counted
// portion, not additional real steps. Hours where only one source reported
// are unaffected (max of one value is that value), so a device the user
// didn't wear for part of the day never loses real steps the other device
// caught.
//
// CORRECTION (RC-2 independent-verdict review, B1): an earlier version of
// this comment claimed the native Swift implementation had been "read" to
// confirm that neither a raw sample sum nor a plain
// `queryStatisticsForQuantity` cumulativeSum removes cross-source overlap.
// That was a category error — reading @kingstinct/react-native-healthkit's
// Swift wrapper (which forwards to `HKStatisticsQuery`) cannot by itself
// tell you what HealthKit's OWN internal statistics-merge behavior does at
// runtime; that is Apple's framework internals, not this wrapper's source.
// Per an Apple Frameworks Engineer
// (developer.apple.com/forums/thread/710937, Jul 2022, paraphrased): a
// statistics(-collection) query has HealthKit perform its own cross-source
// merge — the same merge the Health app's displayed total reflects —
// whereas hand-rolling a merge from sample queries is unlikely to match it.
// `stepsNativeMerged` below captures that number (via plain
// `queryStatisticsForQuantity`, not the `...SeparateBySource` variant this
// file otherwise uses) so it can be compared on-device against the Health
// app and against the two numbers below — see the comment on `stepsToday`'s
// assignment for why it is captured, not yet selected, and
// docs/health/validation/APPLE-PIPELINE-AUDIT.md §3 for the full record of
// that decision.
//
// KNOWN FAILURE CASE for max-per-hour (named so it isn't mistaken for
// untested confidence, not yet observed on a real device): if two sources
// report DISJOINT activity within the same clock hour — e.g. the Watch worn
// 08:00–08:30 (phone left at home) then the phone carried 08:30–09:00
// (watch removed) — the max-across-sources reduction counts only the larger
// of the two half-hour totals for that hour, silently dropping the other
// half-hour's real steps. This is a real, named limit of hourly
// granularity, not a hypothetical edge case.
//
// This is a client-side APPROXIMATION, not a guarantee of matching the
// Health app's own total exactly — see
// docs/health/validation/APPLE-PIPELINE-AUDIT.md for the full reasoning and
// why this needs device confirmation. The diagnostics panel below (gated on
// `INTERNAL_TESTFLIGHT_OVERLAY_ENABLED`) surfaces the OLD raw-sum value, the
// NEW bucketed-max value, HealthKit's own native-merged value, and each
// source's whole-day total side by side specifically so that comparison can
// happen on-device against the Health app's displayed total.

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

/**
 * Pure adapter: HealthKit's raw per-source statistics-collection response
 * (`QueryStatisticsResponseFromSingleSource[]` — see the installed
 * `@kingstinct/react-native-healthkit@14.0.2` type at
 * `src/types/QuantityType.ts`) → `StepsSourceBucket[]`, the shape
 * `reduceStepsByBucketMax` consumes.
 *
 * RC-2 independent-verdict review (S2): extracted from an inline
 * `.filter().map()` in `fetchAppleHealthSnapshot` because this — not
 * `reduceStepsByBucketMax`'s pure bucket-math — is where a real device bug
 * actually lives: a wrong optional-chain (`entry.sumQuantity?.quantity`,
 * `entry.source?.name`), an unexpected non-array response, or a missing
 * `startDate` all originate at this boundary, and none of them were under
 * test before this fix. Accepts `unknown` (not the typed HealthKit
 * response) so it can be exercised directly against malformed/partial
 * fixtures without needing to mock the native module — see
 * `services/__tests__/appleHealth.stepsAdapter.test.ts`.
 */
export function mapStatsToBuckets(entries: unknown): StepsSourceBucket[] {
  if (!Array.isArray(entries)) return [];
  return entries
    .filter((entry: any) => entry?.startDate)
    .map((entry: any) => ({
      sourceName: entry.source?.name ?? 'unknown',
      startDate: new Date(entry.startDate).toISOString(),
      quantity: entry.sumQuantity?.quantity ?? 0,
    }));
}

function sumRawQuantitySamples(samples: unknown): number | null {
  if (!Array.isArray(samples)) return null;
  return samples.reduce(
    (sum: number, s: { quantity: number }) => sum + (s?.quantity ?? 0),
    0,
  );
}

// ─── Sleep aggregation ────────────────────────────────────────────────────
//
// Founder Ruling A (2026-08-06), device-confirmed on build 48: the Home
// score reported 13.332682222222223h of sleep from 49 samples for a real
// ~7.5h night. 13.33 / 2 ≈ 6.67h — textbook Apple Watch "time asleep" for
// that night. The OLD method (kept below as `sumRawSleepSamples`, used for
// the diagnostics comparison and as a resilience fallback) took every
// `HKCategorySample` with an "asleep" value (1 = ASLEEP_UNSPECIFIED, 3/4/5 =
// ASLEEP_CORE/DEEP/REM) across the whole [now-18h, now] window (`lastNightStart`
// below) and summed their durations with a flat `reduce` — no cross-source or
// same-source deduplication at all. When an Apple Watch writes per-stage
// samples (core/deep/REM) for a night AND the paired iPhone independently
// writes an `asleepUnspecified` (value 1) layer for the SAME night — exactly
// what a stage-capable Watch pairing does — the flat sum adds both layers
// together, doubling the real total.
//
// `reduceSleepByIntervalUnion` (mirroring `reduceStepsByBucketMax`'s role for
// the steps fix) fixes this with two independent guards:
//
//   1. SOURCE-CLASS PREFERENCE (`selectSleepIntervals`): if ANY stage sample
//      (value 3/4/5) exists in the window, use ONLY stage samples — a
//      concurrent value-1 layer is, by construction, the double-counting
//      iPhone summary of the same night the Watch already reported in finer
//      detail, not additional real sleep. Only when NO stage sample exists
//      at all does the reduction fall back to value-1 samples. This mirrors
//      the Health app's own "Time Asleep" behavior, which prefers the
//      stage-capable source.
//   2. INTERVAL UNION: within the selected set, sort by start time and merge
//      overlapping/adjacent intervals before summing — this guards
//      SAME-source overlap too (two overlapping samples from one source
//      count once, not twice), not just cross-source.
//
// inBed (value 0) and awake (value 2) samples are never part of either
// selection branch, so they are excluded by construction.
//
// This is a client-side reconstruction of a preferred-source sleep total,
// not a call into a native cross-source merge API — see
// `services/__tests__/appleHealth.sleepAggregation.test.ts`'s device-scenario
// fixture (Watch stages ~6.7h across ~45 segments + iPhone unspecified ~6.6h
// overlapping) for the regression proof that this collapses to ~6.7h, not
// ~13.3h.

/** Raw `HKCategoryValueSleepAnalysis` values this file cares about. */
const SLEEP_STAGE_VALUES: ReadonlySet<number> = new Set([3, 4, 5]); // core, deep, REM
const SLEEP_UNSPECIFIED_VALUE = 1; // asleepUnspecified
const MS_PER_HOUR = 60 * 60 * 1000;

export interface SleepInterval {
  /** Interval start, epoch ms. */
  startMs: number;
  /** Interval end, epoch ms. */
  endMs: number;
  /** Raw HKCategoryValueSleepAnalysis: 0=inBed, 1=asleepUnspecified, 2=awake, 3=core, 4=deep, 5=rem. */
  value: number;
  /**
   * HealthKit source name, e.g. "iPhone" or "Brandon's Apple Watch".
   * Diagnostic only — the union merges across sources by design, so this
   * field is never used to group or filter the reduction itself.
   */
  sourceName: string;
}

export type SleepSelectionBranch = 'stages' | 'unspecified' | 'none';

/**
 * Pure selection: which sample class becomes the union reduction's input.
 * Exported separately from `reduceSleepByIntervalUnion` so the branch that
 * fired can be surfaced in diagnostics (`appleHealthDiagnostics.ts`) without
 * re-deriving it from the final number, and so the stage-preference /
 * fallback behavior is independently unit-testable — see
 * `services/__tests__/appleHealth.sleepAggregation.test.ts`.
 */
export function selectSleepIntervals(
  intervals: readonly SleepInterval[],
): { branch: SleepSelectionBranch; selected: SleepInterval[] } {
  const stageIntervals = intervals.filter((i) => SLEEP_STAGE_VALUES.has(i.value));
  if (stageIntervals.length > 0) {
    return { branch: 'stages', selected: stageIntervals };
  }
  const unspecifiedIntervals = intervals.filter((i) => i.value === SLEEP_UNSPECIFIED_VALUE);
  if (unspecifiedIntervals.length > 0) {
    return { branch: 'unspecified', selected: unspecifiedIntervals };
  }
  return { branch: 'none', selected: [] };
}

/**
 * Pure reduction: `selectSleepIntervals` the input, then sort by start and
 * merge overlapping/adjacent intervals before summing — guarding BOTH
 * cross-source overlap (Watch stages + iPhone unspecified for the same
 * night) and same-source overlap (two overlapping samples from one source).
 * Returns milliseconds asleep; an empty or all-excluded input returns 0,
 * never throws. See
 * `services/__tests__/appleHealth.sleepAggregation.test.ts` for the
 * multi-source device-scenario fixture, same-source-overlap fixture, and
 * the adjacent-vs-gap distinction (an awake gap between two stage runs is
 * never bridged into asleep time).
 */
export function reduceSleepByIntervalUnion(intervals: readonly SleepInterval[]): number {
  const { selected } = selectSleepIntervals(intervals);
  if (selected.length === 0) return 0;

  const sorted = [...selected].sort((a, b) => a.startMs - b.startMs);
  let total = 0;
  let curStart = sorted[0].startMs;
  let curEnd = sorted[0].endMs;
  for (let i = 1; i < sorted.length; i++) {
    const next = sorted[i];
    if (next.startMs <= curEnd) {
      // Overlapping or exactly adjacent — extend the current run rather
      // than starting a new one. A genuine gap (next.startMs > curEnd, e.g.
      // an awake period between two sleep stages) is NOT bridged: it simply
      // closes the current run and starts a new one, so the gap itself is
      // never counted as asleep time.
      if (next.endMs > curEnd) curEnd = next.endMs;
    } else {
      total += Math.max(0, curEnd - curStart);
      curStart = next.startMs;
      curEnd = next.endMs;
    }
  }
  total += Math.max(0, curEnd - curStart);
  return total;
}

/**
 * Pure adapter: raw `HKCategorySample[]` (the installed
 * `@kingstinct/react-native-healthkit@14.0.2` `CategorySample` shape —
 * `{ startDate, endDate, value, sourceRevision: { source: { name } } }`,
 * the same `sourceRevision` path `toDiagnosticSample` below already reads
 * for quantity samples) → `SleepInterval[]`.
 *
 * Defensive by the same S2 lesson the steps adapter (`mapStatsToBuckets`)
 * was extracted for: a wrong optional chain or a malformed/missing field
 * here silently produces a wrong sleep total with the pure reduction never
 * seeing anything wrong. Samples missing `startDate`/`endDate`, or with a
 * non-numeric `value`, are dropped entirely — they cannot be classified
 * safely, and defaulting them to a real HealthKit value (e.g. 0/inBed)
 * would misrepresent malformed data as a genuine reading. See
 * `services/__tests__/appleHealth.sleepAdapter.test.ts`.
 */
export function mapCategorySamplesToSleepIntervals(samples: unknown): SleepInterval[] {
  if (!Array.isArray(samples)) return [];
  return samples
    .filter(
      (s: any) => s?.startDate != null && s?.endDate != null && typeof s?.value === 'number',
    )
    .map((s: any) => ({
      startMs: new Date(s.startDate).getTime(),
      endMs: new Date(s.endDate).getTime(),
      value: s.value,
      sourceName: s.sourceRevision?.source?.name ?? 'unknown',
    }))
    .filter((i: { startMs: number; endMs: number }) => Number.isFinite(i.startMs) && Number.isFinite(i.endMs));
}

/**
 * OLD method (pre-Ruling-A): flat sum of every "asleep" sample's duration —
 * value 1 (unspecified) OR 3/4/5 (stage) — across every source, with NO
 * deduplication. This is the exact computation that produced the 13.33h
 * device evidence. Kept, unchanged, for two reasons: the diagnostics panel
 * shows it side by side with the union total (exactly as
 * `sumRawQuantitySamples` is kept for steps), and it is the resilience
 * fallback when the interval selection above comes back empty despite real
 * raw samples existing — see the empty-selection guard in
 * `fetchAppleHealthSnapshot`. Returns milliseconds, matching
 * `reduceSleepByIntervalUnion`'s unit.
 */
function sumRawSleepSamples(samples: unknown): number | null {
  if (!Array.isArray(samples)) return null;
  return samples.reduce(
    (sum: number, s: { startDate: string | Date; endDate: string | Date; value: number }) => {
      const isAsleep = s.value === 1 || s.value === 3 || s.value === 4 || s.value === 5;
      if (!isAsleep) return sum;
      const start = new Date(s.startDate).getTime();
      const end = new Date(s.endDate).getTime();
      return sum + Math.max(0, end - start);
    },
    0,
  );
}

/**
 * Diagnostics-only: per-source, per-value-class flat sums — NOT
 * union-deduplicated, deliberately, so the panel can show the raw
 * per-device picture next to the deduplicated union total. Mirrors steps'
 * `perSourceTotals` role. inBed(0)/awake(2) samples contribute to neither
 * class and are excluded, same as everywhere else in this file.
 */
function computeSleepPerSourceTotals(intervals: readonly SleepInterval[]): AppleHealthSleepSourceTotal[] {
  // Keyed on sourceName+valueClass directly (never joined into, then split
  // back out of, a delimited string) — source names are free text (e.g.
  // "Brandon's Apple Watch") and may contain any character at all.
  const totals = new Map<string, { sourceName: string; valueClass: 'stage' | 'unspecified'; ms: number }>();
  for (const iv of intervals) {
    const valueClass: 'stage' | 'unspecified' | null = SLEEP_STAGE_VALUES.has(iv.value)
      ? 'stage'
      : iv.value === SLEEP_UNSPECIFIED_VALUE
        ? 'unspecified'
        : null;
    if (!valueClass) continue;
    const key = `${valueClass}:${iv.sourceName}`;
    const durationMs = Math.max(0, iv.endMs - iv.startMs);
    const existing = totals.get(key);
    if (existing) {
      existing.ms += durationMs;
    } else {
      totals.set(key, { sourceName: iv.sourceName, valueClass, ms: durationMs });
    }
  }
  return Array.from(totals.values()).map(({ sourceName, valueClass, ms }) => ({
    sourceName,
    valueClass,
    totalHours: ms / MS_PER_HOUR,
  }));
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
  // N3 (RC-2 independent-verdict review): the sample array's length is
  // captured here, alongside the sum, so the diagnostics block below (if
  // enabled) can reuse it instead of re-issuing the identical
  // day-window `queryQuantitySamples` call a second time purely to count
  // its results.
  let stepsRawSampleCount: number | null = null;
  const stepsRawSampleSum = await safe(async () => {
    const samples = await HK.queryQuantitySamples('HKQuantityTypeIdentifierStepCount', {
      ascending: true,
      limit: 0,
      unit: 'count',
      filter: { date: { startDate: startOfDay, endDate: now } },
    });
    stepsRawSampleCount = Array.isArray(samples) ? samples.length : null;
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
    const buckets = mapStatsToBuckets(perSourceHourly);
    // B1.3 (RC-2 independent-verdict review — BLOCKING): the native
    // `handleHKNoDataOrThrow` path (ios/QuantityTypeModule.swift) RESOLVES
    // with an empty array on HealthKit's `errorNoData`, it does not throw —
    // verified by reading the Swift source, which is the correct kind of
    // claim to make about a wrapper (this is what the wrapper itself does,
    // not a claim about HealthKit's internal merge behavior). Before this
    // fix, only the `catch` block below ever set `stepsUsedFallback`, so a
    // legitimate empty-bucket response (not a thrown error) silently made
    // `reduceStepsByBucketMax([])` return `0` — a hard "0 steps" shown to a
    // user who has real step samples for the day. Treat a zero-length
    // bucket array, when raw samples actually exist, as the same fallback
    // trigger a thrown error already is.
    stepsBucketedMax = reduceStepsByBucketMax(buckets);
    // SF-2 (RC-2 independent-verdict review, second pass — supersedes the
    // empty-array-only guard above): an empty bucket array was not the only
    // reachable silent-zero path. `mapStatsToBuckets` coerces a missing
    // `sumQuantity` to `0` (see its `entry.sumQuantity?.quantity ?? 0`), so a
    // NON-empty bucket array whose entries are all zero-quantity also makes
    // `reduceStepsByBucketMax` return `0` without the array ever being
    // empty — the length check above never fired for that case. Checking the
    // REDUCED total instead of the array length subsumes the original
    // empty-array case (reduceStepsByBucketMax([]) === 0 too) while also
    // catching the all-zero-bucket case. See
    // `appleHealth.stepsSelection.test.ts` for both the original B1.3
    // (empty-array) regression fixture and the new all-zero-bucket fixture.
    if ((stepsBucketedMax ?? 0) === 0 && (stepsRawSampleSum ?? 0) > 0) {
      stepsUsedFallback = true;
    }
  } catch (err) {
    console.warn('[AppleHealth] bucketed step aggregation failed, falling back to raw sum', err);
    stepsUsedFallback = true;
  }

  // ── Steps: HealthKit's OWN merged total (B1, CAPTURE ONLY — see below) ──
  // Uses plain `queryStatisticsForQuantity` (no "...SeparateBySource"),
  // requesting the exact statistic Apple's own Health app total is believed
  // to derive from — see the file header's B1 correction for the citation
  // and why this is captured for on-device comparison rather than treated
  // as proven from source alone.
  // SF-1 (RC-2 independent-verdict review): this query's ONLY consumer is
  // `nativeMergedTotal` in the diagnostics block below, which is itself
  // gated on `diagnosticsEnabled`. Before this fix the query ran
  // unconditionally, so every production snapshot fetch paid an extra
  // HealthKit statistics round-trip whose result was always discarded —
  // contradicting the "zero extra HealthKit query cost" claim made a few
  // lines down and in docs/health/validation/APPLE-PIPELINE-AUDIT.md §11.
  // Gating it here on the same `diagnosticsEnabled` flag that gates its only
  // consumer makes that claim true. NOTE: when the B1.2 selection below
  // flips to use `stepsNativeMerged` on build-48 evidence, this must be
  // ungated as part of that change — it will no longer be diagnostics-only.
  const stepsNativeMerged = diagnosticsEnabled
    ? await safe(async () => {
        const stats = await HK.queryStatisticsForQuantity(
          'HKQuantityTypeIdentifierStepCount',
          ['cumulativeSum'],
          { unit: 'count', filter: { date: { startDate: startOfDay, endDate: now } } },
        );
        return stats?.sumQuantity?.quantity ?? null;
      })
    : null;

  // B1.2 (RC-2 independent-verdict review — deliberate founder-level
  // sequencing decision, NOT an oversight): `stepsNativeMerged` above is
  // captured for comparison but intentionally NOT selected here.
  // `buildStatisticsOptions` (ios/Helpers.swift) unconditionally inserts
  // `.separateBySource` into every statistics query this library issues,
  // including the plain (non-"SeparateBySource") call used above — verified
  // by reading that Swift source. What is NOT verifiable from source alone
  // is whether `HKStatistics.sumQuantity()` (no per-source argument), under
  // `.separateBySource`, still returns HealthKit's true cross-source-merged
  // aggregate, or whether it degrades to the same per-source-summed total
  // the bucketed-max reduction above exists to avoid — that is Apple
  // framework runtime behavior, not this wrapper's code. If it is the
  // latter, selecting `stepsNativeMerged` here would silently make
  // `stepsToday` the WORST of the three numbers, not the best. Build 48
  // exists to measure all three (raw sum / bucketed max / native merged)
  // against the Health app's own displayed total on a real device; the
  // selection flip is then a one-line change made on evidence, not a guess.
  // See docs/health/validation/APPLE-PIPELINE-AUDIT.md §3 for the full
  // record of this decision and what build 48 must report.
  const stepsToday = stepsUsedFallback ? stepsRawSampleSum : stepsBucketedMax;

  // ── Sleep: interval-union, source-aware (RC-2 Ruling A) ────────────────
  // See the "Sleep aggregation" section header above `SleepInterval` for the
  // full device-evidence writeup. `sleepTotalSampleCount` is EVERY sample
  // HealthKit returned (including excluded inBed(0)/awake(2) rows);
  // `sleepSummedSampleCount` is only the subset `selectSleepIntervals` chose
  // (stage samples, or the value-1 fallback set) — these were previously
  // conflated under one ambiguous `sleepSampleCount` field (item 5, Ruling A).
  let sleepTotalSampleCount: number | null = null;
  let sleepSummedSampleCount: number | null = null;
  let sleepSelectionBranch: SleepSelectionBranch = 'none';
  let sleepUnionMs: number | null = null;
  let sleepRawSumMs: number | null = null;
  let sleepUsedFallback = false;
  let sleepIntervalsForDiagnostics: SleepInterval[] = [];
  const sleepHoursLastNight = await safe(async () => {
    const samples = await HK.queryCategorySamples('HKCategoryTypeIdentifierSleepAnalysis', {
      ascending: true,
      limit: 0,
      filter: { date: { startDate: lastNightStart, endDate: now } },
    });
    if (!Array.isArray(samples)) return null;
    sleepTotalSampleCount = samples.length;

    const intervals = mapCategorySamplesToSleepIntervals(samples);
    sleepIntervalsForDiagnostics = intervals;
    const { branch, selected } = selectSleepIntervals(intervals);
    sleepSelectionBranch = branch;
    sleepSummedSampleCount = selected.length;

    const unionMs = reduceSleepByIntervalUnion(intervals);
    sleepUnionMs = unionMs;
    const rawMs = sumRawSleepSamples(samples) ?? 0;
    sleepRawSumMs = rawMs;

    // Empty-selection guard (the steps fix's SF-2 lesson, applied here): if
    // the interval selection produced NOTHING despite real raw samples
    // existing — e.g. every returned sample failed the adapter's defensive
    // field checks — silently reporting 0h would show "no sleep last night"
    // to a user who has real sleep data for the window. Fall back to the
    // raw flat sum instead, exactly as the steps fix falls back to
    // `stepsRawSampleSum` when the bucketed reduction comes back empty/zero
    // with real samples present. A genuine zero-sleep window (rawMs also 0)
    // is deliberately NOT treated as a fallback trigger.
    if (unionMs === 0 && rawMs > 0) {
      sleepUsedFallback = true;
      return rawMs / MS_PER_HOUR;
    }
    return unionMs / MS_PER_HOUR;
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

      // N3 (RC-2 independent-verdict review): reuse the sample count already
      // captured by the `stepsRawSampleSum` query above rather than
      // re-issuing the identical day-window `queryQuantitySamples` call a
      // second time purely to count its results.
      const stepsDiag: AppleHealthStepsDiagnostic = {
        identifier: 'HKQuantityTypeIdentifierStepCount',
        queried: true,
        rawSampleSum: stepsRawSampleSum,
        bucketedMaxTotal: stepsBucketedMax,
        nativeMergedTotal: stepsNativeMerged,
        perSourceTotals: Array.isArray(perSourceTotalsRaw)
          ? perSourceTotalsRaw.map((entry: any) => ({
              sourceName: entry.source?.name ?? 'unknown',
              total: entry.sumQuantity?.quantity ?? 0,
            }))
          : [],
        sampleCount: stepsRawSampleCount,
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
          totalSampleCount: sleepTotalSampleCount,
          summedSampleCount: sleepSummedSampleCount,
          selectionBranch: sleepSelectionBranch,
          rawSumHours: sleepRawSumMs === null ? null : sleepRawSumMs / MS_PER_HOUR,
          unionHours: sleepUnionMs === null ? null : sleepUnionMs / MS_PER_HOUR,
          perSourceTotals: computeSleepPerSourceTotals(sleepIntervalsForDiagnostics),
          valueUsed: sleepHoursLastNight,
          usedFallback: sleepUsedFallback,
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
