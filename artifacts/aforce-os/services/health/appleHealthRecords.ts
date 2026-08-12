/**
 * Apple HealthKit → canonical record mapping (pure layer).
 *
 * This module never touches the native module and never imports it. It takes
 * ALREADY-FETCHED HealthKit-shaped samples (typed as the minimal local
 * interfaces below, not the @kingstinct/react-native-healthkit package types
 * — so this file stays unit-testable on every platform, with no native
 * module loaded, forever) and produces CanonicalHealthRecord[] per
 * `@workspace/health-core`.
 *
 * HONESTY RULES (mirrors health-core's own invariants)
 *   - No fabrication: an empty sample list produces an empty record list.
 *     Never sourceless numbers, never estimated stages.
 *   - RMSSD is never written into an SDNN pathway. Apple HealthKit's HRV type
 *     is HKQuantityTypeIdentifierHeartRateVariabilitySDNN — true SDNN — so
 *     every hrv record this module produces is stamped `hrvMethod: 'sdnn'`.
 *     There is no code path here that can emit `hrvMethod: 'rmssd'`.
 *   - Provenance is never claimed as first-party unless the sample carries
 *     POSITIVE EVIDENCE of it — an explicit Apple bundle id. Origin
 *     resolution for hop 0 is delegated entirely to health-core's
 *     `resolveOriginForAggregator('apple_health', bundleId)`, which is the
 *     canonical, single source of truth for the aggregator first-party
 *     policy (see lib/health-core/src/dedupe.ts). An absent bundle id is NOT
 *     evidence of first-party — every genuine HKSample HealthKit hands an
 *     app carries a populated sourceRevision, so a missing one resolves to
 *     'unknown_device_app', never "assume Apple". `com.aforce.os` (AForce's
 *     OWN bundle) is likewise NOT in health-core's first-party set, so
 *     AForce writing its own samples back into HealthKit and reading them
 *     later never self-loops as `apple_health`-measured.
 *   - `syncedAt` is always caller-supplied. No function in this file calls
 *     Date.now() — determinism and testability over convenience.
 *   - `toIsoUtc` returns `null` for an unparseable date instead of throwing.
 *     Every mapper treats a null date as "drop this one sample/record", never
 *     letting one malformed timestamp abort an entire batch of otherwise-good
 *     samples, and never substituting a guessed or clamped time.
 *
 * Pure: no I/O, no native imports, no clocks.
 */

import {
  HEALTH_RECORD_SCHEMA_VERSION,
  resolveOriginForAggregator,
  buildDeduplicationKey,
  type CanonicalHealthMetricType,
  type CanonicalHealthRecord,
  type CanonicalHealthValue,
  type HrvMethod,
  type ProvenanceHop,
  type SleepSessionValue,
  type WorkoutValue,
} from '@workspace/health-core';

// ─── Minimal local HK sample shapes ──────────────────────────────────────────
// Deliberately NOT imported from @kingstinct/react-native-healthkit: keeping
// these local means this file (and its tests) never require the native
// module to exist, load, or even be correctly typed for the platform running
// the test. The real bridge (services/appleHealth.ts, once native-activated)
// is responsible for shaping whatever the package actually returns into
// these interfaces before calling into this module.

export interface HKSourceRevision {
  source?: {
    /** e.g. 'com.ouraring.oura' (HealthKit sourceRevision.source.bundleIdentifier). */
    bundleIdentifier?: string;
    name?: string;
  };
}

export interface HKQuantitySample {
  /** Already unit-converted by the caller to the unit this module expects (see per-metric mappers). */
  quantity: number;
  startDate: string | Date;
  endDate: string | Date;
  /** HealthKit sample uuid — strongest available dedup identity when present. */
  uuid?: string;
  sourceRevision?: HKSourceRevision;
}

/**
 * HKCategoryValueSleepAnalysis numeric values:
 * inBed=0, asleepUnspecified=1, awake=2, asleepCore=3, asleepDeep=4, asleepREM=5.
 */
export type HKSleepStageValue = 0 | 1 | 2 | 3 | 4 | 5;

export interface HKSleepCategorySample {
  value: HKSleepStageValue;
  startDate: string | Date;
  endDate: string | Date;
  uuid?: string;
  sourceRevision?: HKSourceRevision;
}

export interface HKWorkoutSample {
  /** Caller-normalized activity name (e.g. 'running'); case is normalized here regardless. */
  workoutActivityType: string;
  durationSec: number;
  totalEnergyBurnedKcal?: number | null;
  averageHeartRateBpm?: number | null;
  startDate: string | Date;
  endDate: string | Date;
  uuid?: string;
  sourceRevision?: HKSourceRevision;
}

export interface MapOptions {
  userId: string;
  /** ISO-8601 UTC. Injected — never computed in this module. */
  syncedAt: string;
}

// ─── Provenance resolution ────────────────────────────────────────────────────

function bundleIdOf(sample: { sourceRevision?: HKSourceRevision }): string | undefined {
  return sample.sourceRevision?.source?.bundleIdentifier;
}

/**
 * hop0 from sourceRevision.bundleIdentifier, resolved entirely by
 * health-core's `resolveOriginForAggregator('apple_health', bundleId)` — the
 * canonical, frozen aggregator first-party policy (dotted-prefix match for
 * Apple's `com.apple.health`/`com.apple.Health` families; absent/unrecognized/
 * `com.aforce.os` ⇒ 'unknown_device_app'; see lib/health-core/src/dedupe.ts).
 *   - Apple first-party origin ⇒ single hop, provider 'apple_health',
 *     transport 'measured'.
 *   - Everything else — third-party, genuinely unrecognized, or ABSENT —
 *     hop0 is the resolved origin (transport 'measured'), hop1 is
 *     'apple_health' (transport 'aggregator_export' — Health re-exported
 *     what the other source produced).
 */
function resolveAppleHealthProvenance(bundleId: string | undefined): ProvenanceHop[] {
  const origin = resolveOriginForAggregator('apple_health', bundleId);
  if (origin === 'apple_health') {
    return [
      {
        provider: 'apple_health',
        ...(bundleId ? { nativeOrigin: bundleId } : {}),
        transport: 'measured',
      },
    ];
  }
  return [
    { provider: origin, ...(bundleId ? { nativeOrigin: bundleId } : {}), transport: 'measured' },
    { provider: 'apple_health', transport: 'aggregator_export' },
  ];
}

/**
 * ISO-8601 UTC, or `null` if `value` doesn't parse to a valid date.
 * Deliberately never throws — a malformed date from the native bridge (or a
 * malformed fixture) must not abort an entire batch of otherwise-good
 * samples. Every call site treats `null` as "drop this one sample/record",
 * consistent with this module's no-fabrication rule: an unparseable
 * timestamp isn't something we can honestly stamp a record with.
 */
function toIsoUtc(value: string | Date): string | null {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

// ─── Shared record builder ────────────────────────────────────────────────────

interface BuildRecordParams {
  userId: string;
  metricType: CanonicalHealthMetricType;
  value: CanonicalHealthValue;
  unit?: string;
  startTime?: string;
  endTime?: string;
  observedAt: string;
  syncedAt: string;
  bundleId?: string;
  externalId?: string;
  hrvMethod?: HrvMethod;
}

function buildRecord(params: BuildRecordParams): CanonicalHealthRecord {
  const provenanceChain = resolveAppleHealthProvenance(params.bundleId);
  const origin = provenanceChain[0].provider;
  const isAggregated = provenanceChain.length > 1;

  const deduplicationKey = buildDeduplicationKey({
    userId: params.userId,
    metricType: params.metricType,
    origin,
    externalId: params.externalId,
    startTime: params.startTime,
    endTime: params.endTime,
    observedAt: params.observedAt,
  });

  const record: CanonicalHealthRecord = {
    schemaVersion: HEALTH_RECORD_SCHEMA_VERSION,
    userId: params.userId,
    // The record was DELIVERED to AForce by HealthKit regardless of who
    // originally measured it — that's what `provider` means; provenanceChain
    // carries the true origin.
    provider: 'apple_health',
    metricType: params.metricType,
    value: params.value,
    observedAt: params.observedAt,
    syncedAt: params.syncedAt,
    provenanceChain,
    deduplicationKey,
  };
  if (isAggregated && params.bundleId) record.originalSource = params.bundleId;
  if (params.externalId) record.externalId = params.externalId;
  if (params.unit) record.unit = params.unit;
  if (params.startTime) record.startTime = params.startTime;
  if (params.endTime) record.endTime = params.endTime;
  if (params.hrvMethod) record.hrvMethod = params.hrvMethod;
  return record;
}

// ─── Quantity-sample mappers ──────────────────────────────────────────────────

function mapQuantitySamples(
  samples: readonly HKQuantitySample[],
  opts: MapOptions,
  metricType: CanonicalHealthMetricType,
  unit: string,
  hrvMethod?: HrvMethod,
): CanonicalHealthRecord[] {
  const records: CanonicalHealthRecord[] = [];
  for (const s of samples) {
    const startTime = toIsoUtc(s.startDate);
    const endTime = toIsoUtc(s.endDate);
    // An unparseable date isn't a record we can honestly timestamp — drop
    // just this sample, don't fail the whole batch (see toIsoUtc's doc).
    if (startTime === null || endTime === null) continue;
    records.push(
      buildRecord({
        userId: opts.userId,
        metricType,
        value: s.quantity,
        unit,
        startTime,
        endTime,
        observedAt: endTime,
        syncedAt: opts.syncedAt,
        bundleId: bundleIdOf(s),
        externalId: s.uuid,
        hrvMethod,
      }),
    );
  }
  return records;
}

/** Resting heart rate — HKQuantityTypeIdentifierRestingHeartRate, bpm. */
export function mapRestingHeartRateSamples(
  samples: readonly HKQuantitySample[],
  opts: MapOptions,
): CanonicalHealthRecord[] {
  return mapQuantitySamples(samples, opts, 'resting_heart_rate', 'bpm');
}

/**
 * HRV — HKQuantityTypeIdentifierHeartRateVariabilitySDNN. Apple's HRV type is
 * SDNN, never RMSSD, so every record here is unconditionally stamped
 * `hrvMethod: 'sdnn'`. There is no parameter or branch that can produce
 * `hrvMethod: 'rmssd'` from this function.
 */
export function mapHrvSdnnSamples(
  samples: readonly HKQuantitySample[],
  opts: MapOptions,
): CanonicalHealthRecord[] {
  return mapQuantitySamples(samples, opts, 'hrv', 'ms', 'sdnn');
}

/** Steps — HKQuantityTypeIdentifierStepCount, count. One record per sample interval; no aggregation performed here. */
export function mapStepsSamples(
  samples: readonly HKQuantitySample[],
  opts: MapOptions,
): CanonicalHealthRecord[] {
  return mapQuantitySamples(samples, opts, 'steps', 'count');
}

/** Active energy — HKQuantityTypeIdentifierActiveEnergyBurned, kcal. */
export function mapActiveEnergySamples(
  samples: readonly HKQuantitySample[],
  opts: MapOptions,
): CanonicalHealthRecord[] {
  return mapQuantitySamples(samples, opts, 'active_energy', 'kcal');
}

/** Respiratory rate — HKQuantityTypeIdentifierRespiratoryRate, breaths/min. */
export function mapRespiratoryRateSamples(
  samples: readonly HKQuantitySample[],
  opts: MapOptions,
): CanonicalHealthRecord[] {
  return mapQuantitySamples(samples, opts, 'respiratory_rate', 'brpm');
}

// ─── Workout mapper ───────────────────────────────────────────────────────────

/** Workouts — HKWorkoutTypeIdentifier. */
export function mapWorkoutSamples(
  samples: readonly HKWorkoutSample[],
  opts: MapOptions,
): CanonicalHealthRecord[] {
  const records: CanonicalHealthRecord[] = [];
  for (const s of samples) {
    const startTime = toIsoUtc(s.startDate);
    const endTime = toIsoUtc(s.endDate);
    if (startTime === null || endTime === null) continue;
    const value: WorkoutValue = {
      activityKind: s.workoutActivityType.toLowerCase(),
      durationMin: s.durationSec / 60,
      activeEnergyKcal: s.totalEnergyBurnedKcal ?? null,
      avgHeartRateBpm: s.averageHeartRateBpm ?? null,
    };
    records.push(
      buildRecord({
        userId: opts.userId,
        metricType: 'workout',
        value,
        startTime,
        endTime,
        observedAt: endTime,
        syncedAt: opts.syncedAt,
        bundleId: bundleIdOf(s),
        externalId: s.uuid,
      }),
    );
  }
  return records;
}

// ─── Sleep session mapper ─────────────────────────────────────────────────────

/** asleepUnspecified/Core/Deep/REM — the numeric values that count as "asleep". */
const ASLEEP_VALUES = new Set<HKSleepStageValue>([1, 3, 4, 5]);

/** Our sleep-stage vocabulary — matches SleepSessionValue['stages'][number]['stage'] exactly. */
type SleepStageName = 'awake' | 'light' | 'deep' | 'rem' | 'unspecified';

/** Non-inBed HK sleep values → our stage vocabulary. inBed (0) is handled separately (see below) — it has no stage entry. */
const HK_SLEEP_STAGE_MAP: Record<Exclude<HKSleepStageValue, 0>, SleepStageName> = {
  1: 'unspecified',
  2: 'awake',
  3: 'light', // HealthKit's "Core" sleep.
  4: 'deep',
  5: 'rem',
};

/**
 * Groups sleep-analysis category samples by their source (bundle id) and
 * produces ONE sleep_session CanonicalHealthRecord per source. A night with
 * both an Apple Watch recording and a re-exported third-party sleep session
 * (e.g. Oura writing into HealthKit) yields two records with distinct
 * provenance — collapsing them is `dedupeRecords`'s job (health-core), not
 * this mapper's; specifically its aggregator-copy-of-direct pass, which the
 * caller runs downstream once it knows which providers are directly
 * connected for this user.
 *
 * `totalSleepHours` sums only genuinely-asleep intervals (HK values
 * 1,3,4,5) — awake time and explicit "in bed" (0) time are both excluded
 * from it, never counted as sleep.
 *
 * `inBedHours` comes ONLY from explicit inBed(0) samples, and ONLY when at
 * least one is present in the group — it is NEVER derived by summing
 * asleep+awake durations. HealthKit's sleep-analysis samples are a flat,
 * independent list with no session container asserting overall coverage;
 * summing "everything that isn't asleep-labeled-awake" and calling it
 * "in bed" would assume a continuous, gap-free recording that HealthKit
 * never actually guarantees. If no inBed(0) sample was recorded for this
 * source, the honest answer is `null` — "this source didn't tell us" — not
 * a number computed from unrelated stage data. (Health Connect's adapter
 * makes a DIFFERENT, deliberately-justified choice here because its
 * platform contract is structurally different — see mapRecords.ts's
 * mapSleepStages doc for that adapter's reasoning.)
 *
 * Empty input ⇒ empty output — no night is fabricated from nothing. A
 * sample with an unparseable date is dropped individually (see toIsoUtc);
 * if every sample in a source group turns out unparseable, that group
 * produces no record rather than a record spanning nothing.
 *
 * A source group with NO asleep-labeled duration — inBed/awake samples
 * only, or asleep samples that all clamp to zero — likewise produces no
 * record. `totalSleepHours: 0` from such a group would report an absence of
 * asleep evidence as a measured zero-sleep night, and downstream a literal 0
 * is a confident number, not an unknown. Since a genuine zero-sleep night is
 * indistinguishable here from a source that simply never labeled any asleep
 * interval, the honest output is no record at all — the same answer the
 * snapshot lane gives for an inBed/awake-only night.
 */
export function mapSleepSamplesToRecords(
  samples: readonly HKSleepCategorySample[],
  opts: MapOptions,
): CanonicalHealthRecord[] {
  if (samples.length === 0) return [];

  const groups = new Map<string, HKSleepCategorySample[]>();
  const NO_SOURCE = ' no-source';
  for (const s of samples) {
    const key = bundleIdOf(s) ?? NO_SOURCE;
    const arr = groups.get(key);
    if (arr) arr.push(s);
    else groups.set(key, [s]);
  }

  const records: CanonicalHealthRecord[] = [];
  for (const bundleKey of [...groups.keys()].sort()) {
    const bundleId = bundleKey === NO_SOURCE ? undefined : bundleKey;
    const groupSamples = [...groups.get(bundleKey)!].sort(
      (a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime(),
    );

    let inBedMs = 0;
    let hasInBed = false;
    let asleepMs = 0;
    const stages: NonNullable<SleepSessionValue['stages']> = [];

    let windowStartMs = Infinity;
    let windowEndMs = -Infinity;

    for (const s of groupSamples) {
      const startIso = toIsoUtc(s.startDate);
      const endIso = toIsoUtc(s.endDate);
      // An unparseable date drops just this ONE sample — its duration,
      // stage entry, and window contribution are all excluded, but sibling
      // samples in the same source group still produce an honest (if
      // smaller) session. See toIsoUtc's doc.
      if (startIso === null || endIso === null) continue;
      const startMs = new Date(startIso).getTime();
      const endMs = new Date(endIso).getTime();
      const durMs = Math.max(0, endMs - startMs);
      windowStartMs = Math.min(windowStartMs, startMs);
      windowEndMs = Math.max(windowEndMs, endMs);

      if (s.value === 0) {
        hasInBed = true;
        inBedMs += durMs;
        continue; // inBed is not a sleep "stage" in SleepSessionValue.
      }
      const stage = HK_SLEEP_STAGE_MAP[s.value];
      if (ASLEEP_VALUES.has(s.value)) asleepMs += durMs;
      stages.push({ stage, startUtc: startIso, endUtc: endIso });
    }

    // Every sample in this source group had an unparseable date ⇒ no
    // window to report ⇒ no record for this group, rather than fabricating
    // one that spans nothing.
    if (!Number.isFinite(windowStartMs) || !Number.isFinite(windowEndMs)) continue;

    // No asleep-labeled duration in this group at all — an inBed/awake-only
    // night, or one whose asleep samples all clamped to zero. A
    // `totalSleepHours: 0` here would not be "this source measured a night
    // with no sleep"; it would be "this source never reported any asleep
    // interval", which is an absence, not a measurement. Downstream a
    // literal 0 is a real, confident number that scores as a maximal sleep
    // deficit, so emitting one would turn silence into a diagnosis. No
    // record is the honest answer — and it converges with what the snapshot
    // lane already reports for the same night.
    if (asleepMs === 0) continue;

    const value: SleepSessionValue = {
      totalSleepHours: asleepMs / (1000 * 60 * 60),
      inBedHours: hasInBed ? inBedMs / (1000 * 60 * 60) : null,
      stages: stages.length > 0 ? stages : null,
    };

    const startTime = new Date(windowStartMs).toISOString();
    const endTime = new Date(windowEndMs).toISOString();

    records.push(
      buildRecord({
        userId: opts.userId,
        metricType: 'sleep_session',
        value,
        startTime,
        endTime,
        observedAt: endTime,
        syncedAt: opts.syncedAt,
        bundleId,
      }),
    );
  }
  return records;
}

// ─── Partial-permission honesty helper ────────────────────────────────────────

export interface AuthorizationResult {
  granted: string[];
  denied: string[];
  indeterminate: string[];
}

export interface RequestedAppleHealthPermissions {
  toRead: readonly string[];
  toShare: readonly string[];
}

export interface GrantedAppleHealthPermissions {
  /** HealthKit's authorizationStatus() DOES report a real answer for share (write) types. */
  toShareGranted?: readonly string[];
  toShareDenied?: readonly string[];
}

/**
 * Partitions a HealthKit permission request into granted/denied/indeterminate.
 *
 * HealthKit READ authorization is INDETERMINATE BY DESIGN: Apple's API never
 * tells an app whether a read type was denied or simply never granted, so
 * that apps can't infer sensitive facts (e.g. "the user has a heart
 * condition and denied HR access") from authorization state alone. Every
 * requested `toRead` type therefore lands in `indeterminate` — permanently,
 * not just until the first successful read — reflecting what HealthKit
 * actually tells us (nothing).
 *
 * WRITE (`toShare`) authorization IS observable via HealthKit's
 * authorizationStatus() API, so those types partition into granted/denied
 * based on the caller-supplied `granted` sets; a toShare type absent from
 * both sets (e.g. the system sheet hasn't resolved yet) is also
 * indeterminate.
 */
export function resolvePartialAppleHealthAuthorization(
  requested: RequestedAppleHealthPermissions,
  granted: GrantedAppleHealthPermissions = {},
): AuthorizationResult {
  const grantedShare = new Set(granted.toShareGranted ?? []);
  const deniedShare = new Set(granted.toShareDenied ?? []);

  const result: AuthorizationResult = { granted: [], denied: [], indeterminate: [] };

  for (const type of requested.toRead) {
    result.indeterminate.push(type);
  }

  for (const type of requested.toShare) {
    if (grantedShare.has(type)) result.granted.push(type);
    else if (deniedShare.has(type)) result.denied.push(type);
    else result.indeterminate.push(type);
  }

  return result;
}
