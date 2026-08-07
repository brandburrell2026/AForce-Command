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
  /**
   * Per-field OBSERVATION times (epoch ms) — RC-2 Founder Ruling C
   * (2026-08-06). The moment the underlying phenomenon happened, as
   * distinct from `fetchedAt` (stamped by the caller — see
   * ProfileScreenV2.tsx/ProfileLegacy.tsx's `{ ...snap, fetchedAt:
   * Date.now() }`), which is when THIS APP read it from HealthKit. OPTIONAL
   * and ADDITIVE: undefined whenever the corresponding metric itself is
   * null (nothing was observed, so there is nothing to timestamp) —
   * never fabricated. See each field's assignment in
   * `fetchAppleHealthSnapshot` for exactly how it's derived.
   */
  restingHeartRateObservedAtMs?: number;
  hrvSdnnObservedAtMs?: number;
  sleepHoursLastNightObservedAtMs?: number;
  stepsTodayObservedAtMs?: number;
  /**
   * max(...the four fields above) — closes, for `apple_health` specifically,
   * the observation-freshness gap registered by Founder Ruling I / #562 and
   * tracked in `docs/health/validation/runbook-apple-healthkit.md`'s "Known
   * gaps" section (see that doc's RC-2 Ruling C update for the closure
   * note — `samsung_health`'s half of that shared gap bullet is UNCHANGED
   * and stays open). Undefined only when every per-field time above is also
   * undefined (nothing observed at all, e.g. permission denied).
   */
  latestObservedAtMs?: number;
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
/**
 * Shared reduction step for both `reduceStepsByBucketMax` (the total) and
 * `lastNonEmptyStepsBucketEndMs` (the observation time, RC-2 Ruling C):
 * group by `startDate`, keep only each bucket's MAX `quantity` across
 * sources. Extracted so both functions share exactly one definition of
 * "which per-bucket value counts" — previously each had its own
 * independently-written copy of this loop, which is exactly the kind of
 * duplication that lets two reductions silently drift apart. A bucket
 * whose max is 0 (or, defensively, negative) never earns a key here —
 * `b.quantity > prev`, with `prev` defaulting to 0, excludes non-positive
 * values by construction — so both callers see "non-empty buckets only"
 * for free.
 */
function buildBucketMax(buckets: readonly StepsSourceBucket[]): Map<string, number> {
  const bucketMax = new Map<string, number>();
  for (const b of buckets) {
    const prev = bucketMax.get(b.startDate) ?? 0;
    if (b.quantity > prev) bucketMax.set(b.startDate, b.quantity);
  }
  return bucketMax;
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
  let total = 0;
  for (const v of buildBucketMax(buckets).values()) total += v;
  return total;
}

const STEPS_BUCKET_MS = 60 * 60 * 1000; // buckets are queried at `{ hour: 1 }` granularity

/**
 * RC-2 Founder Ruling C (observation-time arbitration): `stepsToday`'s
 * chosen observation moment is the END of the LATEST hour-bucket that
 * actually contributed to the bucketed-max total (i.e. survived the same
 * per-bucket MAX reduction `reduceStepsByBucketMax` performs — both now
 * share `buildBucketMax`, so "survived" is structurally guaranteed, not
 * just documented) — an hour-granularity approximation of "the moment the
 * last real activity this total reflects was recorded," which is the
 * finest resolution `queryStatisticsCollectionForQuantitySeparateBySource`
 * exposes (it returns bucket boundaries, not individual sample
 * timestamps). Buckets are queried at `{ hour: 1 }` granularity elsewhere
 * in this file, so end = start + 1h. Returns null when every bucket is
 * empty/zero (nothing to timestamp) — the caller falls back to `now` for
 * the raw-sum fallback path (steps are a rolling today-aggregate with no
 * single "last observed" instant in that path, so `now` at fetch is the
 * most honest available choice; see `fetchAppleHealthSnapshot`).
 */
export function lastNonEmptyStepsBucketEndMs(buckets: readonly StepsSourceBucket[]): number | null {
  let latestStartMs: number | null = null;
  for (const startDate of buildBucketMax(buckets).keys()) {
    const startMs = new Date(startDate).getTime();
    if (!Number.isFinite(startMs)) continue;
    if (latestStartMs === null || startMs > latestStartMs) latestStartMs = startMs;
  }
  return latestStartMs === null ? null : latestStartMs + STEPS_BUCKET_MS;
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
//   1. PER-SOURCE COVERAGE (`selectSleepIntervals`), RC-2 P0 gate for build
//      49 (F1, 2026-08-06) — NOT a min/max time span. Identify every source
//      that ever wrote a stage sample (value 3/4/5) in the window ("stage
//      sources" — typically the Watch). That source's OWN samples of ANY
//      value — including inBed(0) and awake(2), not just its stage samples
//      — are "covered" time: real, positive evidence of what the
//      stage-capable device was doing, merged into a set of covered spans.
//      A concurrent value-1 (`asleepUnspecified`) sample from a DIFFERENT
//      (non-stage) source — the iPhone's coarser layer — is then clipped
//      against those covered spans: whatever portion falls INSIDE a covered
//      span is the double-counting iPhone summary of time the stage source
//      already accounted for (asleep OR explicitly awake/inBed) and is
//      dropped; whatever portion falls OUTSIDE every covered span — the
//      stage source wrote NOTHING AT ALL there, of any value — is the only
//      signal of real sleep for that stretch and is kept, clipped to
//      exactly the uncovered slice(s). A single value-1 sample can split
//      into more than one kept slice if it straddles multiple covered spans
//      with a gap between them (see `subtractCoveredSpans`).
//
//      CORRECTED (RC-2 P0 gate for build 49, F1, 2026-08-06): the PREVIOUS
//      rule (RC-2 P0 follow-up B1, #592) computed a single envelope from
//      [earliest STAGE sample start, latest STAGE sample end] and treated
//      everything inside it as covered — but that envelope was built ONLY
//      from stage-valued samples, blind to the SAME source's own
//      awake(2)/inBed(0) samples that commonly sit just outside a stage run
//      (an awake tail right after waking, an inBed lead-in before falling
//      asleep). A concurrent iPhone value-1 sample overlapping one of those
//      explicitly-recorded-awake/inBed stretches got wrongly reclassified as
//      "outside the envelope, therefore uncovered" and counted as sleep —
//      for time the Watch itself explicitly, not silently, scored as NOT
//      asleep. Per-source coverage fixes this because it is built from the
//      stage source's ENTIRE sample set, not just its stage-valued subset —
//      an explicit awake/inBed sample is "covered" exactly like a stage
//      sample is, so a value-1 layer can never re-fill it. The PRIOR
//      version of this comment claimed "outside the envelope the Watch
//      recorded NOTHING" — that was true only when the Watch truly wrote no
//      sample of any kind there (dead battery, not yet worn); it was never
//      true in general, and the awake-tail/inBed-lead-in case above is
//      exactly where it was false. See
//      `services/__tests__/appleHealth.sleepAggregation.test.ts`'s "F1 —
//      per-source coverage" describe block (probes g/h) for the regression
//      fixtures with exact before/after numbers.
//
//      This also RETROACTIVELY ELIMINATES the "known limitation, flagged
//      for founder sign-off" the B1 fix (#592) documented and explicitly
//      declined to fix: two DISJOINT stage clusters (a nap earlier in the
//      day plus a separate night; or a Watch that dies mid-night and is
//      recharged/re-worn before waking) used to collapse into ONE min/max
//      envelope, so genuine iPhone-only sleep between the two clusters —
//      where the Watch recorded nothing at all — was wrongly excluded as
//      "inside the envelope." Per-source coverage has no single envelope to
//      collapse: covered spans are whatever the stage source actually
//      wrote, cluster by cluster, so a gap between two clusters with zero
//      Watch samples of any kind is genuinely uncovered and a value-1 layer
//      spanning it is correctly kept. This needs NO gap-tolerance threshold
//      and therefore no `config/hydroStateModel.ts` change and no founder
//      sign-off item — see probes i/j in the test file (a
//      nap+night+iPhone-only-stretch scenario, and a watch-dies-then-
//      re-worn scenario) for the measured before/after.
//
//      SEMANTIC NUANCE (deliberate, not an oversight): a gap between two
//      stage-source-covered spans with genuinely ZERO samples of any kind
//      from that source reads as "the stage source recorded nothing here" —
//      the only reachable states on a real device are a battery death, the
//      device not yet being worn, or (per probes i/j) a nap+night pairing —
//      and a concurrent value-1 layer is free to fill it. A real Apple
//      Watch, worn continuously through a single sleep session, instead
//      writes awake(2) segments for brief night wake-ups WITHIN that
//      session (see the `S1` device-scenario fixture) — those are covered,
//      explicit, and never re-filled. The two cases look similar (both are
//      "not a stage sample") but are opposite in meaning; this rule
//      distinguishes them correctly by construction, because the test is
//      whether a sample exists at all, not what value it holds. See the
//      separate "unrecorded gap" fixture in the test file for the
//      fill-behavior this is deliberately preserving.
//
//      CORRECTED AGAIN (F2, RC-2 P0 gate for build 49 tail fix,
//      2026-08-06, post-#598 independent verdict): F1's `covered` spans
//      were built from ALL of a stage source's own samples INCLUDING that
//      source's own value-1 (asleepUnspecified) samples, and the residual
//      loop then skipped any value-1 sample whose source was itself a
//      stage source outright (`if (stageSources.has(iv.sourceName))
//      continue;`) — reasoning that subtracting it against `covered` would
//      "always yield nothing" since it was already inside `covered` by
//      construction. That reasoning was circular: it was true only because
//      coverage was DEFINED to include the very sample being deleted, not
//      because the sample carried no information. A same-source value-1
//      tail/lead-in immediately outside that source's own stage run — or a
//      same-source value-1 sample sitting in the genuine gap BETWEEN two of
//      that source's own stage runs — is real, positive evidence the
//      device was recording asleepUnspecified somewhere its own stage
//      classifier wrote nothing; deleting it on sight silently regressed
//      exactly the undercounting-class defect this coverage design exists
//      to close (measured: a 7h night reported as 6h). DOCTRINE: coverage
//      is positive evidence of what the stage-capable device was doing; a
//      source's own "asleep" reading is evidence OF SLEEP, never coverage
//      AGAINST itself. Fixed by (1) excluding a stage source's own value-1
//      samples from `covered` (coverage is now built only from that
//      source's stage/awake/inBed samples), and (2) removing the
//      same-source skip entirely — every value-1 sample, same-source or
//      not, now flows through the identical `subtractCoveredSpans` path.
//      This still correctly drops a same-source value-1 sample's portion
//      that overlaps that source's own stage/awake/inBed coverage (a
//      redundant coarser reading of time the device already classified
//      more precisely) — it only stops deleting the portion that falls
//      OUTSIDE that coverage, which is exactly the portion that was never
//      redundant in the first place. See
//      `services/__tests__/appleHealth.sleepAggregation.test.ts`'s "F2 —
//      same-source value-1 self-coverage" describe block (TAIL, LEAD-IN,
//      MID-GAP, and 'unknown'-fallback-collision fixtures) for the
//      regression proof and the one pre-existing fixture (the "same-source
//      overlap" describe block's second test) whose correct total moved
//      from 70min to 80min under this fix.
//   2. INTERVAL UNION: within the selected set, sort by start time and merge
//      overlapping/adjacent intervals before summing — this guards
//      SAME-source overlap too (two overlapping samples from one source
//      count once, not twice), not just cross-source. `reduceSleepByIntervalUnion`
//      is a pure union/merge over an ALREADY-SELECTED set — it does not
//      re-run selection itself (RC-2 P0 follow-up, S3): the caller
//      (`fetchAppleHealthSnapshot`) selects once, then unions that same
//      result, rather than each function independently re-deriving it.
//
// inBed (value 0) and awake (value 2) samples are never themselves part of
// the final selected/summed set — they contribute only as COVERAGE evidence
// (marking a stage source's territory), never as asleep time.
//
// This is a client-side reconstruction of a preferred-source sleep total,
// not a call into a native cross-source merge API — see
// `services/__tests__/appleHealth.sleepAggregation.test.ts`'s device-scenario
// fixture (Watch stages ~6.6h across 8 segments with realistic awake gaps +
// iPhone unspecified spanning the full night) for the regression proof that
// this collapses to the stage total, not the larger iPhone-bridged total,
// the separate partial-coverage fixture for the original B1 undercounting
// fix, and the "F1 — per-source coverage" block for the awake-tail/inBed-
// lead-in fix and the disjoint-cluster fix.

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
   * PRIMARY SELECTION KEY as of F1 (RC-2 P0 gate for build 49,
   * 2026-08-06) — this field is NOT diagnostic-only. `selectSleepIntervals`
   * groups every interval by `sourceName` to determine which sources wrote
   * a stage sample ("stage sources") and to build each stage source's own
   * coverage spans from that source's samples (see the "Sleep aggregation"
   * file-header comment above for the full design, and its F2 update for
   * the same-source value-1 self-coverage fix). A HealthKit source that
   * reports an empty/missing name — defaulted to the literal string
   * `'unknown'` by this file's adapters (see `entry.source?.name ??
   * 'unknown'` below) — is therefore indistinguishable from any OTHER
   * source that also defaults to `'unknown'`: this is a real, documented,
   * currently-accepted limitation. See the "'unknown'-fallback collision"
   * test in `services/__tests__/appleHealth.sleepAggregation.test.ts` for
   * the exact behavior this produces and why no fix is planned without
   * observed real-world occurrence.
   */
  sourceName: string;
}

export type SleepSelectionBranch = 'stages' | 'stages+uncovered' | 'unspecified' | 'none';

/**
 * Merge a set of (possibly overlapping/adjacent/unsorted) time spans into
 * sorted, non-overlapping spans. Only `startMs`/`endMs` matter — callers
 * that need to preserve `value`/`sourceName` must do so separately (see
 * `subtractCoveredSpans`, which does). A `sort` + linear scan, deliberately
 * NOT `Math.min(...spread)`/`Math.max(...spread)` (S-c, RC-2 P0 gate for
 * build 49): HealthKit's `queryCategorySamples` is called with `limit: 0`
 * (`fetchAppleHealthSnapshot` below) — an unbounded result set — and
 * spreading a large array into `Math.min`/`Math.max`'s argument list can
 * exceed the JS engine's call-stack/argument-count limit
 * ("Maximum call stack size exceeded" / "too many arguments") on
 * pathological input. `Array.prototype.sort` has no such limit. See
 * `services/__tests__/appleHealth.sleepAggregation.test.ts`'s stack-safety
 * test for the large-N regression proof.
 */
function mergeIntervalSpans(
  intervals: readonly Pick<SleepInterval, 'startMs' | 'endMs'>[],
): Array<{ startMs: number; endMs: number }> {
  if (intervals.length === 0) return [];
  const sorted = [...intervals].sort((a, b) => a.startMs - b.startMs);
  const merged: Array<{ startMs: number; endMs: number }> = [
    { startMs: sorted[0].startMs, endMs: sorted[0].endMs },
  ];
  for (let i = 1; i < sorted.length; i++) {
    const last = merged[merged.length - 1];
    const cur = sorted[i];
    if (cur.startMs <= last.endMs) {
      if (cur.endMs > last.endMs) last.endMs = cur.endMs;
    } else {
      merged.push({ startMs: cur.startMs, endMs: cur.endMs });
    }
  }
  return merged;
}

/**
 * Subtract a set of already-merged, SORTED, non-overlapping `covered` spans
 * (guaranteed by `mergeIntervalSpans`) from one interval, returning zero or
 * more residual slices that preserve the original interval's
 * `value`/`sourceName`. A value-1 sample that is only partially covered
 * (e.g. it straddles a covered span with an uncovered gap on either side)
 * can split into multiple slices — that is deliberate, not a bug: see F1's
 * "unrecorded gap" vs. "recorded awake/inBed" distinction in the "Sleep
 * aggregation" file-header comment.
 *
 * Single left-to-right pass over `covered` (O(covered.length)), stopping
 * early once a span starts at/after `iv.endMs` — NOT the "shrink a
 * `remaining` slice list against every covered span" approach an earlier
 * version of this function used, which was O(covered.length × slices
 * produced) and could degrade badly (tens of seconds) against a
 * pathological input with many small disjoint covered spans under one wide
 * value-1 sample. `covered` being pre-sorted (an invariant of
 * `mergeIntervalSpans`, not re-checked here) is what makes the single pass
 * correct: it lets a running `cursor` stand in for "everything before this
 * point in `iv` has already been resolved," rather than needing to test
 * every remaining slice against every span.
 */
function subtractCoveredSpans(
  iv: SleepInterval,
  covered: readonly { startMs: number; endMs: number }[],
): SleepInterval[] {
  const out: SleepInterval[] = [];
  let cursor = iv.startMs;
  for (const span of covered) {
    if (span.endMs <= cursor) continue; // entirely before the cursor — already resolved, skip
    if (span.startMs >= iv.endMs) break; // covered is sorted — nothing further can overlap `iv`
    if (span.startMs > cursor) {
      out.push({ startMs: cursor, endMs: span.startMs, value: iv.value, sourceName: iv.sourceName });
    }
    cursor = Math.max(cursor, span.endMs);
    if (cursor >= iv.endMs) break;
  }
  if (cursor < iv.endMs) {
    out.push({ startMs: cursor, endMs: iv.endMs, value: iv.value, sourceName: iv.sourceName });
  }
  return out;
}

/**
 * Pure selection: which sample class becomes the union reduction's input.
 * Exported separately from `reduceSleepByIntervalUnion` so the branch that
 * fired can be surfaced in diagnostics (`appleHealthDiagnostics.ts`) without
 * re-deriving it from the final number, and so the stage-preference /
 * fallback behavior is independently unit-testable — see
 * `services/__tests__/appleHealth.sleepAggregation.test.ts`.
 *
 * RC-2 P0 gate for build 49 (F1, 2026-08-06): PER-SOURCE COVERAGE, not a
 * min/max time span. A "stage source" is any HealthKit source that wrote at
 * least one stage sample (value 3/4/5) in the window. That source's own
 * stage(3/4/5), inBed(0), and awake(2) samples are "covered" time —
 * positive evidence of what the stage-capable device was doing. A value-1
 * (asleepUnspecified) sample — from that SAME source or a DIFFERENT one
 * (F2, 2026-08-06: same-source is no longer special-cased, see below) — is
 * clipped against the covered spans: the covered portion is dropped (a
 * redundant coarser reading of time the stage source already accounted
 * for, asleep or not); the uncovered portion — the stage source wrote
 * NOTHING there, of any value — is kept, clipped to exactly that slice.
 * See the "Sleep aggregation" file-header comment above for the full
 * rationale, why this eliminates the B1 (#592) disjoint-cluster limitation
 * with no gap-tolerance threshold, the awake-tail/inBed-lead-in defect F1
 * corrected relative to the prior min/max-envelope rule, and F2's fix for
 * the same-source value-1 self-deletion F1 itself introduced (coverage
 * doctrine: a source's own "asleep" reading is evidence OF SLEEP, never
 * coverage against itself).
 */
export function selectSleepIntervals(
  intervals: readonly SleepInterval[],
): { branch: SleepSelectionBranch; selected: SleepInterval[] } {
  const stageIntervals = intervals.filter((i) => SLEEP_STAGE_VALUES.has(i.value));
  const unspecifiedIntervals = intervals.filter((i) => i.value === SLEEP_UNSPECIFIED_VALUE);

  if (stageIntervals.length === 0) {
    return unspecifiedIntervals.length > 0
      ? { branch: 'unspecified', selected: unspecifiedIntervals }
      : { branch: 'none', selected: [] };
  }
  if (unspecifiedIntervals.length === 0) {
    return { branch: 'stages', selected: stageIntervals };
  }

  const stageSources = new Set(stageIntervals.map((i) => i.sourceName));
  // F2 (RC-2 P0 gate for build 49 tail fix, post-#598 verdict): coverage is
  // built from a stage source's stage(3/4/5)/inBed(0)/awake(2) samples —
  // ANY value EXCEPT that source's own value-1 (asleepUnspecified). A
  // source's own "asleep unspecified" reading is evidence OF SLEEP, not
  // coverage against itself; including it here (the pre-F2 behavior) made
  // that sample's own residual subtraction always yield nothing, deleting
  // exactly the same-source tail/lead-in/mid-gap evidence F2 restores.
  const covered = mergeIntervalSpans(
    intervals.filter((i) => stageSources.has(i.sourceName) && i.value !== SLEEP_UNSPECIFIED_VALUE),
  );

  const residual: SleepInterval[] = [];
  for (const iv of unspecifiedIntervals) {
    // F2: every value-1 sample — same-source or not — flows through the
    // identical subtract-against-coverage path below. There is no
    // same-source special case: `covered` above already excludes this
    // source's own value-1 samples, so a same-source value-1 sample is
    // subtracted only against that source's genuine stage/awake/inBed
    // evidence, exactly like a different source's value-1 sample is.
    //
    // S-c (RC-2 P0 gate for build 49): append via a loop, NOT
    // `residual.push(...slices)` — spreading a large slice array into
    // `push`'s argument list is the exact same call-stack-limit hazard as
    // `Math.min(...arr)`, just relocated here. `subtractCoveredSpans` can
    // return many slices for one sample when `covered` has many disjoint
    // spans, so this must stay a loop.
    for (const slice of subtractCoveredSpans(iv, covered)) {
      residual.push(slice);
    }
  }
  return residual.length > 0
    ? { branch: 'stages+uncovered', selected: [...stageIntervals, ...residual] }
    : { branch: 'stages', selected: stageIntervals };
}

export interface SleepUnionResult {
  /** Total asleep milliseconds — identical to `reduceSleepByIntervalUnion`'s return value. */
  totalMs: number;
  /**
   * End of the LAST (chronologically latest-starting) merged run — RC-2
   * Founder Ruling C's chosen `sleepHoursLastNight` observation moment:
   * "the moment the observed sleep ended." Null only when `selected` is
   * empty (nothing to timestamp — mirrors `totalMs: 0` in that case).
   */
  lastEndMs: number | null;
}

/**
 * Pure reduction: sort an ALREADY-SELECTED interval set by start and merge
 * overlapping/adjacent intervals before summing — guarding BOTH
 * cross-source overlap (Watch stages + iPhone unspecified for the same
 * night) and same-source overlap (two overlapping samples from one source).
 * Returns the total AND the last merged run's end (see `SleepUnionResult`,
 * RC-2 Founder Ruling C — `lastEndMs` is `sleepHoursLastNight`'s chosen
 * observation moment: "the moment the observed sleep ended"). An empty
 * input returns `{ totalMs: 0, lastEndMs: null }`, never throws.
 *
 * RC-2 P0 follow-up (S3, 2026-08-06): this function used to re-run
 * `selectSleepIntervals` internally while its only caller
 * (`fetchAppleHealthSnapshot`) ALSO called `selectSleepIntervals` first —
 * selection executed twice per fetch, and this "union" function secretly
 * selected too, contradicting its name. It now does exactly one thing: union
 * whatever interval set it is given. Callers select once, then union that
 * same result — which is also why `lastEndMs` is trustworthy as "the
 * moment observed sleep ended": it is computed over the SAME selected set
 * the returned total was computed over, never over raw/unselected samples.
 * Passing an unfiltered/unselected interval set (e.g. raw inBed/awake
 * samples) will merge them too — filtering is the caller's job. See
 * `services/__tests__/appleHealth.sleepAggregation.test.ts` for the
 * multi-source device-scenario fixture, same-source-overlap fixture, and
 * the adjacent-vs-gap distinction (an awake gap between two stage runs is
 * never bridged into asleep time).
 */
export function reduceSleepByIntervalUnionDetailed(selectedIntervals: readonly SleepInterval[]): SleepUnionResult {
  if (selectedIntervals.length === 0) return { totalMs: 0, lastEndMs: null };

  const sorted = [...selectedIntervals].sort((a, b) => a.startMs - b.startMs);
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
  return { totalMs: total, lastEndMs: curEnd };
}

/**
 * Pure reduction: total asleep milliseconds only — see
 * `reduceSleepByIntervalUnionDetailed` (this function's byte-identical
 * `totalMs` given the same ALREADY-SELECTED input; extracted so RC-2
 * Ruling C's `lastEndMs` capture could be added without touching this
 * function's signature or its existing call sites/tests). Takes an
 * already-selected interval set — see the detailed version's header for
 * why (RC-2 P0 follow-up S3: no internal `selectSleepIntervals` call).
 */
export function reduceSleepByIntervalUnion(selectedIntervals: readonly SleepInterval[]): number {
  return reduceSleepByIntervalUnionDetailed(selectedIntervals).totalMs;
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
 * device evidence. Kept for the diagnostics panel, which shows it side by
 * side with the union total (exactly as `sumRawQuantitySamples` is kept for
 * steps) — NO LONGER used as a live resilience fallback (RC-2 P0 follow-up,
 * S2; see the empty-selection handling in `fetchAppleHealthSnapshot`).
 * Returns milliseconds, matching `reduceSleepByIntervalUnion`'s unit.
 *
 * RC-2 P0 follow-up (S2, 2026-08-06): hardened against malformed
 * `startDate`/`endDate` — a null `startDate` previously coerced through
 * `new Date(null).getTime()` to epoch (1970-01-01, NOT `NaN`, the classic JS
 * `Date` gotcha), and an unparseable date string coerced to `NaN`. Either
 * one, unguarded, corrupts this sum: a real endDate minus an epoch start
 * produced the measured ~496,109.5h fallback value on a single malformed
 * sample (`startDate: null`, `endDate` a real 2026 date) — this function's
 * bug, not the caller's, since it read raw samples directly instead of going
 * through the adapter's (`mapCategorySamplesToSleepIntervals`) defensive
 * filtering. Samples that fail these checks are skipped, exactly as the
 * adapter already skips them for the union path — see
 * `services/__tests__/appleHealth.sleepAdapter.test.ts` for the equivalent
 * adapter-side coverage and `appleHealth.sleepSelection.test.ts` for this
 * function's own regression fixture.
 */
/** Shape this function trusts nothing about beyond "maybe has these fields" — deliberately not `any` (nit, RC-2 P0 gate for build 49). */
interface RawSleepSampleShape {
  startDate?: unknown;
  endDate?: unknown;
  value?: unknown;
}

function sumRawSleepSamples(samples: unknown): number | null {
  if (!Array.isArray(samples)) return null;
  return (samples as unknown[]).reduce((sum: number, raw: unknown) => {
    const s = raw as RawSleepSampleShape | null | undefined;
    if (s?.startDate == null || s?.endDate == null) return sum;
    const isAsleep = s.value === 1 || s.value === 3 || s.value === 4 || s.value === 5;
    if (!isAsleep) return sum;
    const start = new Date(s.startDate as string | number | Date).getTime();
    const end = new Date(s.endDate as string | number | Date).getTime();
    if (!Number.isFinite(start) || !Number.isFinite(end)) return sum;
    return sum + Math.max(0, end - start);
  }, 0);
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

/**
 * RC-2 Founder Ruling C: a single, defensive date→epoch-ms conversion used
 * everywhere this file derives a per-field observation time from a raw
 * HealthKit sample's `endDate` (a `Date`, or an ISO string depending on
 * which query path produced it — both are valid `Date` constructor input).
 * Never throws; an unparseable or absent value simply yields `null`, which
 * every call site treats as "no observation time for this field" — never a
 * fabricated fallback like `now`.
 */
export function toEpochMsOrNull(dateLike: unknown): number | null {
  if (dateLike == null) return null;
  const ms = new Date(dateLike as string | number | Date).getTime();
  return Number.isFinite(ms) ? ms : null;
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
  // RC-2 Ruling C: RHR's observation moment is this sample's own endDate —
  // the newest reading HealthKit actually has, not when we happened to ask.
  // #595 verdict, S3: guarded on `restingHeartRate == null` — a sample can be
  // PRESENT (non-null `restingHeartRateSample`) while its `.quantity` is
  // null/undefined (a malformed or unit-mismatched HealthKit row); in that
  // case `restingHeartRate` above is correctly null, but `endDate` still
  // resolves to a real timestamp. Without this guard that produces a
  // timestamped null metric — a real moment attached to a value we never
  // actually observed.
  const restingHeartRateObservedAtMs =
    restingHeartRate == null ? null : toEpochMsOrNull(restingHeartRateSample?.endDate);

  const hrvSdnnSample = await safe(() =>
    mostRecentQuantitySample('HKQuantityTypeIdentifierHeartRateVariabilitySDNN', 'ms'),
  );
  const hrvSdnn = hrvSdnnSample?.quantity ?? null;
  // Same rule for HRV — already captured for diagnostics via
  // `toDiagnosticSample` below; this is the score-facing counterpart.
  // #595 verdict, S3: same null-quantity guard as RHR above.
  const hrvSdnnObservedAtMs = hrvSdnn == null ? null : toEpochMsOrNull(hrvSdnnSample?.endDate);

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
  // RC-2 Ruling C: end of the latest non-empty hour-bucket — see
  // `lastNonEmptyStepsBucketEndMs`'s header for why hour granularity is the
  // finest available here. Captured unconditionally alongside
  // `stepsBucketedMax`; which one the snapshot actually uses is resolved
  // after `stepsUsedFallback` is finalized below (raw fallback uses `now`
  // instead — steps are a rolling aggregate with no single bucket boundary
  // in that path).
  let stepsBucketedObservedAtMs: number | null = null;
  try {
    const perSourceHourly = await HK.queryStatisticsCollectionForQuantitySeparateBySource(
      'HKQuantityTypeIdentifierStepCount',
      ['cumulativeSum'],
      startOfDay,
      { hour: 1 },
      { unit: 'count', filter: { date: { startDate: startOfDay, endDate: now } } },
    );
    const buckets = mapStatsToBuckets(perSourceHourly);
    stepsBucketedObservedAtMs = lastNonEmptyStepsBucketEndMs(buckets);
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
  // RC-2 Ruling C: resolved AFTER `stepsUsedFallback` is final (it can flip
  // true in either the try block above or the catch below it) — bucketed
  // path uses the last non-empty bucket's end; raw-fallback path uses `now`
  // at fetch time (documented choice: a rolling today-aggregate has no
  // single "last observed" instant to point to in that path).
  // #595 verdict, S3: guarded on `stepsToday == null` FIRST — when both the
  // bucketed query and the raw fallback come up empty (the ordinary shape of
  // a denied steps permission), `stepsToday` is null and there is nothing to
  // timestamp. Without this guard, `stepsUsedFallback` can still be `true`
  // (set by the bucketed query's `catch`) while `stepsRawSampleSum` is also
  // null, producing a timestamped null metric that then poisons
  // `latestObservedAtMs` (max over fields, below) up to `now` — corrupting
  // Apple's tier-2 fallback for every OTHER field in the same snapshot.
  const stepsTodayObservedAtMs =
    stepsToday == null ? null : stepsUsedFallback ? now.getTime() : stepsBucketedObservedAtMs;

  // ── Sleep: interval-union, source-aware (RC-2 Ruling A) ────────────────
  // See the "Sleep aggregation" section header above `SleepInterval` for the
  // full device-evidence writeup. `sleepTotalSampleCount` is EVERY sample
  // HealthKit returned (including excluded inBed(0)/awake(2) rows);
  // `sleepSummedSampleCount` is only the subset `selectSleepIntervals` chose
  // (stage samples, or the value-1 fallback set) — these were previously
  // conflated under one ambiguous `sleepSampleCount` field (item 5, Ruling A).
  // S-b (RC-2 P0 gate for build 49): this counts SELECTED SLICES, not
  // distinct raw samples — post-F1, one raw value-1 sample can be split into
  // multiple residual slices at covered-span boundaries
  // (`subtractCoveredSpans`), so `sleepSummedSampleCount` can legitimately
  // exceed the number of raw samples that fed it. Threading a stable sample
  // identity through the split would let this count distinct samples
  // instead, but that requires widening `SleepInterval` (and every fixture
  // across three test files) purely to make a diagnostics-only label more
  // precise — not worth the blast radius for an internal-only panel.
  // Labeled accordingly at the diagnostics/panel layer ("selected slices: N
  // (from M samples)") rather than silently renamed here; see
  // `services/appleHealthDiagnostics.ts` and `AppleHealthDiagnosticsPanel.tsx`.
  let sleepTotalSampleCount: number | null = null;
  let sleepSummedSampleCount: number | null = null;
  let sleepSelectionBranch: SleepSelectionBranch = 'none';
  let sleepUnionMs: number | null = null;
  let sleepRawSumMs: number | null = null;
  // F2 (RC-2 P0 gate for build 49): renamed from `sleepUsedFallback` — post-
  // #592 (S2) this never triggers a raw-sum fallback; it fires exactly when
  // the adapter had to drop a raw sample AND selection came back empty, i.e.
  // the sleep value is UNKNOWN, not a substituted number. The name now says
  // what it means. See `services/appleHealthDiagnostics.ts`'s
  // `AppleHealthSleepDiagnostic.sleepValueUnknown` for the mirrored rename.
  let sleepValueUnknown = false;
  let sleepIntervalsForDiagnostics: SleepInterval[] = [];
  // RC-2 Ruling C: "the moment the observed sleep ended" — set from the
  // union reduction's own `lastEndMs`. Stays `null` on the S2 unknown-data
  // path below (the value itself is `null` there too — nothing to
  // timestamp when the metric is unknown).
  let sleepHoursLastNightObservedAtMs: number | null = null;
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
    // S3: select ONCE, then union that same selected set — `reduceSleepByIntervalUnion`
    // no longer re-derives its own selection (see its header comment).
    const { branch, selected } = selectSleepIntervals(intervals);
    sleepSelectionBranch = branch;
    sleepSummedSampleCount = selected.length;

    // RC-2 Ruling C: `reduceSleepByIntervalUnionDetailed` runs over `selected`
    // (the POST-selection set), exactly matching what `reduceSleepByIntervalUnion`
    // itself is given per S3's contract above — `lastEndMs` is therefore the
    // end of the same merged run the returned total came from, never a raw/
    // unselected sample's end.
    const { totalMs: unionMs, lastEndMs } = reduceSleepByIntervalUnionDetailed(selected);
    sleepUnionMs = unionMs;
    const rawMs = sumRawSleepSamples(samples) ?? 0;
    sleepRawSumMs = rawMs;

    // RC-2 P0 follow-up (S2, 2026-08-06): the OLD empty-selection guard fell
    // back to the raw flat sum (`sumRawSleepSamples`) whenever the union came
    // back 0 with `rawMs > 0` — but `rawMs` itself was not a trustworthy
    // signal to fall back TO: a single malformed sample (`startDate: null`)
    // could inflate it to ~496,109.5h (epoch-to-now), which this guard would
    // then report as the night's sleep total. `sumRawSleepSamples` is now
    // hardened against that specific corruption (see its header), but
    // trusting a raw, non-deduplicated sum as a "fallback value" at all was
    // the deeper defect — malformed data should read as UNKNOWN, not as a
    // guessed number. The signal that actually distinguishes "confirmed
    // zero" from "unknown" is whether the ADAPTER had to drop any raw
    // sample for being unusable: if `intervals.length` is shorter than the
    // raw `sleepTotalSampleCount`, some real HealthKit rows could not be
    // classified at all, and an empty selection in that case means "we
    // don't know", not "zero". If nothing was dropped and selection is still
    // empty, every raw sample was legitimately inBed/awake-only (or the
    // window was genuinely empty) — 0h is a confirmed, honest answer.
    //
    // Returning `null` here (rather than 0 or a guessed number) is safe:
    // `AppleHealthSnapshot.sleepHoursLastNight` is already `number | null`
    // and every consumer already guards it — `utils/scoring/breakdown.ts`'s
    // `snap.sleepHoursLastNight != null` check, `utils/biometricsAggregator.ts`'s
    // `freshestNonNull`, the Profile cards (`WhoopSnapshotCard`,
    // `ProfileScreenV2`, `ProfileLegacy`) all render '—' for `null`, and the
    // store mirror (`store/appStoreReducer.ts`, `store/app/actions.ts`)
    // copies the field verbatim with no coercion. See
    // `appleHealth.sleepSelection.test.ts` for the regression fixture (the
    // exact malformed-sample shape that produced the epoch bug) asserting
    // `null`, not a bounded guess.
    // Nit (RC-2 P0 gate for build 49): no `?? 0` here — `sleepTotalSampleCount`
    // was unconditionally assigned `samples.length` above (line ~876), with
    // an early `return null` for the only case (`!Array.isArray(samples)`)
    // that could have left it unset. It is provably a `number` by this line.
    const adapterDroppedSamples = intervals.length < sleepTotalSampleCount;
    if (unionMs === 0 && adapterDroppedSamples) {
      sleepValueUnknown = true;
      // RC-2 Ruling C: the value itself is `null` here (S2, above) — there is
      // nothing to timestamp when the metric is unknown, not a guess.
      // `sleepHoursLastNightObservedAtMs` stays at its `null` initializer.
      return null;
    }
    sleepHoursLastNightObservedAtMs = lastEndMs;
    return unionMs / MS_PER_HOUR;
  });

  const snapshot: AppleHealthSnapshot = {
    restingHeartRate: restingHeartRate ?? null,
    hrvSdnn: hrvSdnn ?? null,
    // Round HERE, at snapshot assembly — NOT at the `stepsToday` local above
    // (:431). HealthKit statistics split samples across bucket boundaries,
    // which can leave the selected total fractional (observed on-device:
    // 11959.287359440914) — a floating-point artifact of summation, not a
    // real fractional step measurement (steps are inherently integers).
    // The diagnostics capture below (`valueUsed: stepsToday`, the LOCAL)
    // deliberately reads the unrounded value — the raw/bucketed/native
    // three-way comparison must stay exact for device measurement — so this
    // rounds only the value that ships in the returned snapshot.
    stepsToday: stepsToday != null ? Math.round(stepsToday) : null,
    sleepHoursLastNight: sleepHoursLastNight ?? null,
    // RC-2 Founder Ruling C: per-field observation times, optional/additive
    // (undefined, never null, matching `ProviderSnapshot.fieldObservedAtMs`'s
    // convention — see that field's doc comment in
    // lib/health-core/src/contracts.ts). `latestObservedAtMs` is the max of
    // whichever of the four below are actually present; undefined only when
    // every one of them is (nothing observed at all — e.g. every HealthKit
    // read failed or returned empty).
    ...(restingHeartRateObservedAtMs != null ? { restingHeartRateObservedAtMs } : {}),
    ...(hrvSdnnObservedAtMs != null ? { hrvSdnnObservedAtMs } : {}),
    ...(sleepHoursLastNightObservedAtMs != null ? { sleepHoursLastNightObservedAtMs } : {}),
    ...(stepsTodayObservedAtMs != null ? { stepsTodayObservedAtMs } : {}),
    ...(() => {
      const observed = [
        restingHeartRateObservedAtMs,
        hrvSdnnObservedAtMs,
        sleepHoursLastNightObservedAtMs,
        stepsTodayObservedAtMs,
      ].filter((v): v is number => v != null);
      return observed.length > 0 ? { latestObservedAtMs: Math.max(...observed) } : {};
    })(),
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
          sleepValueUnknown,
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
