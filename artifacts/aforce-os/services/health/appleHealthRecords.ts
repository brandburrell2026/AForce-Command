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
 *   - Provenance is never claimed as first-party unless the sample really is
 *     first-party. `resolveNativeOrigin` (health-core) only recognizes
 *     THIRD-PARTY bundle ids — it correctly falls back to
 *     'unknown_device_app' for an absent/unrecognized bundle id, which would
 *     wrongly demote genuine Apple/first-party samples (whose sourceRevision
 *     is often bundle-id-less, or stamped with an Apple/AForce bundle) into
 *     "unknown app" territory. `resolveAppleHealthOrigin` below does the one
 *     extra check health-core deliberately leaves to each platform bridge:
 *     is this bundle id Apple's own or ours? If so, hop0 is 'apple_health'
 *     directly; otherwise it defers to `resolveNativeOrigin` exactly as
 *     documented (third-party origin as hop0, 'apple_health' aggregator_export
 *     as hop1).
 *   - `syncedAt` is always caller-supplied. No function in this file calls
 *     Date.now() — determinism and testability over convenience.
 *
 * Pure: no I/O, no native imports, no clocks.
 */

import {
  HEALTH_RECORD_SCHEMA_VERSION,
  resolveNativeOrigin,
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

/**
 * Apple's own Health app and AForce's own app write/re-surface samples whose
 * sourceRevision either has no bundle id at all, or carries one of these
 * bundle families. `resolveNativeOrigin` intentionally has no knowledge of
 * these — it only maps THIRD-PARTY bundle ids — so this check must happen
 * before deferring to it.
 */
const FIRST_PARTY_BUNDLE_PREFIXES = ['com.apple.health', 'com.aforce.os'];

function isFirstPartyBundle(bundleId: string | undefined): boolean {
  if (!bundleId) return true; // No source metadata ⇒ device/Watch-native sample.
  return FIRST_PARTY_BUNDLE_PREFIXES.some((p) => bundleId === p || bundleId.startsWith(`${p}.`));
}

function bundleIdOf(sample: { sourceRevision?: HKSourceRevision }): string | undefined {
  return sample.sourceRevision?.source?.bundleIdentifier;
}

/**
 * hop0 from sourceRevision.bundleIdentifier:
 *   - Apple/AForce first-party ⇒ single hop, provider 'apple_health', transport 'measured'.
 *   - Third-party (or genuinely unrecognized) bundle ⇒ hop0 is that bundle's
 *     resolved origin (transport 'measured' — it really did measure the
 *     data), hop1 is 'apple_health' (transport 'aggregator_export' — Health
 *     re-exported what the other app wrote).
 */
function resolveAppleHealthProvenance(bundleId: string | undefined): ProvenanceHop[] {
  if (isFirstPartyBundle(bundleId)) {
    return [
      {
        provider: 'apple_health',
        ...(bundleId ? { nativeOrigin: bundleId } : {}),
        transport: 'measured',
      },
    ];
  }
  const origin = resolveNativeOrigin(bundleId);
  return [
    { provider: origin, nativeOrigin: bundleId, transport: 'measured' },
    { provider: 'apple_health', transport: 'aggregator_export' },
  ];
}

function toIsoUtc(value: string | Date): string {
  return new Date(value).toISOString();
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
  return samples.map((s) => {
    const startTime = toIsoUtc(s.startDate);
    const endTime = toIsoUtc(s.endDate);
    return buildRecord({
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
    });
  });
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
  return samples.map((s) => {
    const startTime = toIsoUtc(s.startDate);
    const endTime = toIsoUtc(s.endDate);
    const value: WorkoutValue = {
      activityKind: s.workoutActivityType.toLowerCase(),
      durationMin: s.durationSec / 60,
      activeEnergyKcal: s.totalEnergyBurnedKcal ?? null,
      avgHeartRateBpm: s.averageHeartRateBpm ?? null,
    };
    return buildRecord({
      userId: opts.userId,
      metricType: 'workout',
      value,
      startTime,
      endTime,
      observedAt: endTime,
      syncedAt: opts.syncedAt,
      bundleId: bundleIdOf(s),
      externalId: s.uuid,
    });
  });
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
 * `totalSleepHours` sums only genuinely-asleep intervals (HK values 1,3,4,5);
 * time spent in bed but awake, or simply "in bed" (0), is tracked in
 * `inBedHours` and never counted as sleep. Empty input ⇒ empty output — no
 * night is fabricated from nothing.
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
      const startMs = new Date(s.startDate).getTime();
      const endMs = new Date(s.endDate).getTime();
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
      stages.push({
        stage,
        startUtc: toIsoUtc(s.startDate),
        endUtc: toIsoUtc(s.endDate),
      });
    }

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
