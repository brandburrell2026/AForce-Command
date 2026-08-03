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
 *     POSITIVE EVIDENCE of it — an explicit Apple bundle id. `resolveNativeOrigin`
 *     (health-core) only recognizes THIRD-PARTY bundle ids and falls back to
 *     'unknown_device_app' for an absent/unrecognized one; `isFirstPartyBundle`
 *     below does the one extra check health-core deliberately leaves to each
 *     platform bridge — is this bundle id Apple's own? If so, hop0 is
 *     'apple_health' directly; otherwise (including an ABSENT bundle id —
 *     no sourceRevision at all) it defers to `resolveNativeOrigin`, landing
 *     on 'unknown_device_app' hop0 + 'apple_health' aggregator_export hop1.
 *     An absent bundle id is NOT evidence of first-party. Every genuine
 *     HKSample HealthKit hands an app carries a populated sourceRevision —
 *     an app never legitimately sees one missing it, so treating "missing"
 *     as "must be the Watch/first-party" was an unfounded guess, not a
 *     reading of real evidence. If it happens (malformed bridge output,
 *     sloppy test data), the honest default is "we don't know", not "assume
 *     Apple". See `isFirstPartyBundle`'s own doc for the full rationale,
 *     including why `com.aforce.os` (AForce's OWN bundle) is deliberately
 *     NOT in the first-party set despite being AForce's app.
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
 * Apple's own Health/Watch stack writes samples stamped with one of these
 * bundle families. `resolveNativeOrigin` intentionally has no knowledge of
 * these — it only maps THIRD-PARTY bundle ids — so this check must happen
 * before deferring to it.
 *
 * DELIBERATELY DOES NOT INCLUDE `com.aforce.os`. AForce's own app can write
 * samples into HealthKit (e.g. water intake) and later read them back via
 * the same query surface. If we labeled those `apple_health` hop0 with
 * transport 'measured', that's a self-loop: it claims Apple's platform
 * measured a value AForce itself entered, which is exactly the honesty
 * violation `provenanceChain` exists to prevent. `com.aforce.os` is
 * therefore left OUT of this set on purpose, so it falls through to
 * `resolveNativeOrigin` below like any other bundle id health-core doesn't
 * recognize — landing on 'unknown_device_app' hop0 + 'apple_health'
 * aggregator_export hop1. health-core's frozen HealthOriginId union has no
 * dedicated 'self'/'aforce' origin (and this adapter doesn't modify that
 * contract), so 'unknown_device_app' is the honest fallback: it correctly
 * signals "not a recognized wearable, and not first-party Apple either".
 */
const FIRST_PARTY_BUNDLE_PREFIXES = ['com.apple.health'];

/**
 * True only when `bundleId` carries POSITIVE evidence of being Apple's own
 * bundle. An absent bundle id (`undefined`/empty) is NOT first-party — see
 * file header. Every genuine HKSample HealthKit hands an app has a
 * populated sourceRevision; if this code ever sees one missing, the honest
 * read is "we don't know who produced this", not "must be the Watch".
 */
function isFirstPartyBundle(bundleId: string | undefined): boolean {
  if (!bundleId) return false;
  return FIRST_PARTY_BUNDLE_PREFIXES.some((p) => bundleId === p || bundleId.startsWith(`${p}.`));
}

function bundleIdOf(sample: { sourceRevision?: HKSourceRevision }): string | undefined {
  return sample.sourceRevision?.source?.bundleIdentifier;
}

/**
 * hop0 from sourceRevision.bundleIdentifier:
 *   - Apple first-party bundle (positive match) ⇒ single hop, provider
 *     'apple_health', transport 'measured'.
 *   - Everything else — third-party, genuinely unrecognized, ABSENT, or
 *     AForce's own `com.aforce.os` (deliberately excluded from first-party,
 *     see FIRST_PARTY_BUNDLE_PREFIXES) — defers to `resolveNativeOrigin`:
 *     hop0 is that bundle's resolved origin (transport 'measured'; absent/
 *     unrecognized resolves to 'unknown_device_app'), hop1 is
 *     'apple_health' (transport 'aggregator_export' — Health re-exported
 *     what the other source produced).
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
