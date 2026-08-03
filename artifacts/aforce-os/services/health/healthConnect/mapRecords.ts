/**
 * artifacts/aforce-os/services/health/healthConnect/mapRecords.ts
 *
 * Pure mappers: Health Connect record → CanonicalHealthRecord. Mirrors the
 * normalization-boundary discipline of lib/health-core/src/normalize.ts —
 * one pass, explicit per-field translation, absent data stays absent, no
 * platform imports, no Date.now() (clock is injected via MapContext.syncedAt).
 *
 * PROVENANCE (the Samsung-via-Health-Connect honesty rule)
 *   Every record here is DELIVERED by 'google_health' (provider field) —
 *   that's the frozen provider id for this whole adapter. The ORIGIN
 *   (provenanceChain[0]) is resolved from `dataOrigin.packageName`:
 *     - a recognized third-party wearable package (Samsung today, via the
 *       frozen NATIVE_ORIGIN_MAP) ⇒ that provider is hop 0, and hop 1 is
 *       google_health/'aggregator_export' — we never claim a direct Samsung
 *       connection through this path (see HEALTH_PROVIDER_CAPABILITIES
 *       .samsung_health.activationGates in health-core/contracts.ts).
 *     - a recognized first-party Google package (Google Fit / the Health
 *       Connect app itself) ⇒ single hop, google_health, transport
 *       'measured'. These packages are NOT in the shared NATIVE_ORIGIN_MAP
 *       (that map deliberately has no Google entry, so it never falsely
 *       claims first-party for an unmapped app) — recognizing them is a
 *       LOCAL detail of this Health Connect adapter, not a change to the
 *       frozen contract.
 *     - anything else unmapped ⇒ 'unknown_device_app' as hop 0, still with
 *       a google_health aggregator hop 1 (it did arrive via Health
 *       Connect) — attributed honestly, never upgraded to first-party.
 *
 * HRV: Health Connect's HeartRateVariabilityRmssdRecord emits RMSSD only.
 * hrvMethod is stamped 'rmssd' with a load-time guard against health-core's
 * HRV_METHOD_BY_PROVIDER.google_health drifting off 'rmssd' — this adapter
 * must never silently start mislabeling HRV as SDNN.
 */

import {
  buildDeduplicationKey,
  resolveNativeOrigin,
  HEALTH_RECORD_SCHEMA_VERSION,
  HRV_METHOD_BY_PROVIDER,
  type CanonicalHealthRecord,
  type HealthOriginId,
  type HrvMethod,
  type ProvenanceHop,
  type SleepSessionValue,
  type WorkoutValue,
} from '@workspace/health-core';

import type {
  ActiveCaloriesBurnedRecord,
  ExerciseSessionRecord,
  HcDataOrigin,
  HcSleepStage,
  HeartRateRecord,
  HeartRateVariabilityRmssdRecord,
  RespiratoryRateRecord,
  RestingHeartRateRecord,
  SleepSessionRecord,
  StepsRecord,
} from './types';

export interface MapContext {
  userId: string;
  /** ISO-8601 UTC. Injected — this module never calls Date.now(). */
  syncedAt: string;
  /** ISO-8601 UTC, when H2's sync loop pulled this record from Health Connect. */
  fetchedAt?: string;
}

// ─── Origin / provenance ──────────────────────────────────────────────────────

/**
 * First-party Google packages that write directly into Health Connect.
 * Deliberately local to this adapter — see file header. Health Connect's
 * own package id varies by OS build; both are recognized so a record
 * written by either resolves as first-party google_health.
 */
const GOOGLE_FIRST_PARTY_PACKAGES: ReadonlySet<string> = new Set([
  'com.google.android.apps.fitness', // Google Fit
  'com.google.android.apps.healthdata', // Health Connect app itself
]);

function resolveHealthConnectOrigin(dataOrigin: HcDataOrigin): HealthOriginId {
  if (GOOGLE_FIRST_PARTY_PACKAGES.has(dataOrigin.packageName)) return 'google_health';
  return resolveNativeOrigin(dataOrigin.packageName);
}

function buildProvenanceChain(dataOrigin: HcDataOrigin): ProvenanceHop[] {
  const origin = resolveHealthConnectOrigin(dataOrigin);
  const hop0: ProvenanceHop = {
    provider: origin,
    nativeOrigin: dataOrigin.packageName,
    transport: 'measured',
  };
  if (origin === 'google_health') return [hop0];
  return [hop0, { provider: 'google_health', transport: 'aggregator_export' }];
}

// ─── HRV method guard ─────────────────────────────────────────────────────────

/**
 * Fails loudly at module load if health-core's declared HRV statistic for
 * google_health ever drifts off 'rmssd' — this adapter's entire HRV mapping
 * assumes Health Connect never emits SDNN.
 */
const GOOGLE_HRV_METHOD: HrvMethod = (() => {
  const method = HRV_METHOD_BY_PROVIDER.google_health;
  if (method !== 'rmssd') {
    throw new Error(
      `healthConnect/mapRecords: health-core HRV_METHOD_BY_PROVIDER.google_health is '${method}', expected 'rmssd'. ` +
        'This adapter assumes Health Connect only emits RMSSD — re-verify before shipping H2.',
    );
  }
  return method;
})();

// ─── Sleep stage mapping ──────────────────────────────────────────────────────

type CanonicalSleepStage = NonNullable<SleepSessionValue['stages']>[number]['stage'];

/**
 * HC stage int → canonical stage kind. Stage 3 (out of bed) is NOT in this
 * table — it is excluded from the stages array and from both sleep-time
 * totals entirely (see mapSleepStages). Anything else unmapped (including
 * HC's newer stage 7, awake-in-bed) falls back to 'unspecified' rather than
 * being dropped — an unrecognized-but-present stage is honestly "some kind
 * of sleep state we don't have a bucket for yet", not "out of bed".
 */
const HC_SLEEP_STAGE_MAP: Readonly<Record<number, CanonicalSleepStage>> = {
  0: 'unspecified', // STAGE_TYPE_UNKNOWN
  1: 'awake', // STAGE_TYPE_AWAKE
  2: 'unspecified', // STAGE_TYPE_SLEEPING (undifferentiated)
  4: 'light', // STAGE_TYPE_LIGHT
  5: 'deep', // STAGE_TYPE_DEEP
  6: 'rem', // STAGE_TYPE_REM
};

const HC_SLEEP_STAGE_OUT_OF_BED = 3; // STAGE_TYPE_OUT_OF_BED — excluded from sleep time

function durationMs(startTime: string, endTime: string): number {
  const start = Date.parse(startTime);
  const end = Date.parse(endTime);
  const ms = end - start;
  return Number.isFinite(ms) && ms > 0 ? ms : 0;
}

/**
 * HC stages → SleepSessionValue. `totalSleepHours` counts every stage
 * EXCEPT 'awake' (asleep, not in-bed, per the contract's field doc);
 * `inBedHours` sums every stage that isn't out-of-bed (awake included —
 * you're still in bed while briefly awake). Out-of-bed periods count
 * toward neither and are dropped from the stages array outright.
 */
export function mapSleepStages(rawStages: readonly HcSleepStage[]): SleepSessionValue {
  const stages: NonNullable<SleepSessionValue['stages']> = [];
  let asleepMs = 0;
  let inBedMs = 0;

  for (const raw of rawStages) {
    if (raw.stage === HC_SLEEP_STAGE_OUT_OF_BED) continue; // excluded entirely
    const kind = HC_SLEEP_STAGE_MAP[raw.stage] ?? 'unspecified';
    const ms = durationMs(raw.startTime, raw.endTime);
    inBedMs += ms;
    if (kind !== 'awake') asleepMs += ms;
    stages.push({ stage: kind, startUtc: raw.startTime, endUtc: raw.endTime });
  }

  return {
    totalSleepHours: asleepMs / 3_600_000,
    inBedHours: rawStages.length > 0 ? inBedMs / 3_600_000 : null,
    stages: stages.length > 0 ? stages : null,
  };
}

// ─── Record mappers ───────────────────────────────────────────────────────────

export function mapSleepSessionRecord(record: SleepSessionRecord, ctx: MapContext): CanonicalHealthRecord {
  const chain = buildProvenanceChain(record.metadata.dataOrigin);
  const origin = chain[0].provider;
  const observedAt = record.startTime;
  return {
    schemaVersion: HEALTH_RECORD_SCHEMA_VERSION,
    userId: ctx.userId,
    provider: 'google_health',
    originalSource: record.metadata.dataOrigin.packageName,
    externalId: record.metadata.id,
    metricType: 'sleep_session',
    value: mapSleepStages(record.stages),
    startTime: record.startTime,
    endTime: record.endTime,
    observedAt,
    syncedAt: ctx.syncedAt,
    fetchedAt: ctx.fetchedAt,
    provenanceChain: chain,
    deduplicationKey: buildDeduplicationKey({
      userId: ctx.userId,
      metricType: 'sleep_session',
      origin,
      externalId: record.metadata.id,
      startTime: record.startTime,
      endTime: record.endTime,
      observedAt,
    }),
  };
}

export function mapStepsRecord(record: StepsRecord, ctx: MapContext): CanonicalHealthRecord {
  const chain = buildProvenanceChain(record.metadata.dataOrigin);
  const origin = chain[0].provider;
  const observedAt = record.startTime;
  return {
    schemaVersion: HEALTH_RECORD_SCHEMA_VERSION,
    userId: ctx.userId,
    provider: 'google_health',
    originalSource: record.metadata.dataOrigin.packageName,
    externalId: record.metadata.id,
    metricType: 'steps',
    value: record.count,
    unit: 'count',
    startTime: record.startTime,
    endTime: record.endTime,
    observedAt,
    syncedAt: ctx.syncedAt,
    fetchedAt: ctx.fetchedAt,
    provenanceChain: chain,
    deduplicationKey: buildDeduplicationKey({
      userId: ctx.userId,
      metricType: 'steps',
      origin,
      externalId: record.metadata.id,
      startTime: record.startTime,
      endTime: record.endTime,
      observedAt,
    }),
  };
}

/**
 * HC's HeartRateRecord is a sample series; CanonicalHealthMetricType has no
 * raw-series slot, so this summarizes to 'heart_rate_summary' (mean bpm,
 * rounded to 1 decimal). An empty sample array yields 0 — H2's sync loop
 * should filter out empty sessions before calling this; it is not this
 * pure function's job to decide whether an empty session is worth syncing.
 */
export function mapHeartRateRecord(record: HeartRateRecord, ctx: MapContext): CanonicalHealthRecord {
  const chain = buildProvenanceChain(record.metadata.dataOrigin);
  const origin = chain[0].provider;
  const observedAt = record.startTime;
  const avgBpm =
    record.samples.length === 0
      ? 0
      : Math.round((record.samples.reduce((sum, s) => sum + s.beatsPerMinute, 0) / record.samples.length) * 10) / 10;
  return {
    schemaVersion: HEALTH_RECORD_SCHEMA_VERSION,
    userId: ctx.userId,
    provider: 'google_health',
    originalSource: record.metadata.dataOrigin.packageName,
    externalId: record.metadata.id,
    metricType: 'heart_rate_summary',
    value: avgBpm,
    unit: 'bpm',
    startTime: record.startTime,
    endTime: record.endTime,
    observedAt,
    syncedAt: ctx.syncedAt,
    fetchedAt: ctx.fetchedAt,
    provenanceChain: chain,
    deduplicationKey: buildDeduplicationKey({
      userId: ctx.userId,
      metricType: 'heart_rate_summary',
      origin,
      externalId: record.metadata.id,
      startTime: record.startTime,
      endTime: record.endTime,
      observedAt,
    }),
  };
}

export function mapRestingHeartRateRecord(record: RestingHeartRateRecord, ctx: MapContext): CanonicalHealthRecord {
  const chain = buildProvenanceChain(record.metadata.dataOrigin);
  const origin = chain[0].provider;
  const observedAt = record.time;
  return {
    schemaVersion: HEALTH_RECORD_SCHEMA_VERSION,
    userId: ctx.userId,
    provider: 'google_health',
    originalSource: record.metadata.dataOrigin.packageName,
    externalId: record.metadata.id,
    metricType: 'resting_heart_rate',
    value: record.beatsPerMinute,
    unit: 'bpm',
    startTime: record.time,
    endTime: record.time,
    observedAt,
    syncedAt: ctx.syncedAt,
    fetchedAt: ctx.fetchedAt,
    provenanceChain: chain,
    deduplicationKey: buildDeduplicationKey({
      userId: ctx.userId,
      metricType: 'resting_heart_rate',
      origin,
      externalId: record.metadata.id,
      startTime: record.time,
      endTime: record.time,
      observedAt,
    }),
  };
}

export function mapHeartRateVariabilityRmssdRecord(
  record: HeartRateVariabilityRmssdRecord,
  ctx: MapContext,
): CanonicalHealthRecord {
  const chain = buildProvenanceChain(record.metadata.dataOrigin);
  const origin = chain[0].provider;
  const observedAt = record.time;
  return {
    schemaVersion: HEALTH_RECORD_SCHEMA_VERSION,
    userId: ctx.userId,
    provider: 'google_health',
    originalSource: record.metadata.dataOrigin.packageName,
    externalId: record.metadata.id,
    metricType: 'hrv',
    value: record.heartRateVariabilityMillis,
    unit: 'ms',
    startTime: record.time,
    endTime: record.time,
    observedAt,
    syncedAt: ctx.syncedAt,
    fetchedAt: ctx.fetchedAt,
    // Never 'sdnn' — see GOOGLE_HRV_METHOD guard above.
    hrvMethod: GOOGLE_HRV_METHOD,
    provenanceChain: chain,
    deduplicationKey: buildDeduplicationKey({
      userId: ctx.userId,
      metricType: 'hrv',
      origin,
      externalId: record.metadata.id,
      startTime: record.time,
      endTime: record.time,
      observedAt,
    }),
  };
}

export function mapExerciseSessionRecord(record: ExerciseSessionRecord, ctx: MapContext): CanonicalHealthRecord {
  const chain = buildProvenanceChain(record.metadata.dataOrigin);
  const origin = chain[0].provider;
  const observedAt = record.startTime;
  const durationMin = durationMs(record.startTime, record.endTime) / 60_000;
  const value: WorkoutValue = {
    activityKind: record.exerciseType.toLowerCase(),
    durationMin,
    activeEnergyKcal: record.activeCaloriesKcal ?? null,
    avgHeartRateBpm: record.avgHeartRateBpm ?? null,
  };
  return {
    schemaVersion: HEALTH_RECORD_SCHEMA_VERSION,
    userId: ctx.userId,
    provider: 'google_health',
    originalSource: record.metadata.dataOrigin.packageName,
    externalId: record.metadata.id,
    metricType: 'workout',
    value,
    startTime: record.startTime,
    endTime: record.endTime,
    observedAt,
    syncedAt: ctx.syncedAt,
    fetchedAt: ctx.fetchedAt,
    provenanceChain: chain,
    deduplicationKey: buildDeduplicationKey({
      userId: ctx.userId,
      metricType: 'workout',
      origin,
      externalId: record.metadata.id,
      startTime: record.startTime,
      endTime: record.endTime,
      observedAt,
    }),
  };
}

export function mapActiveCaloriesBurnedRecord(
  record: ActiveCaloriesBurnedRecord,
  ctx: MapContext,
): CanonicalHealthRecord {
  const chain = buildProvenanceChain(record.metadata.dataOrigin);
  const origin = chain[0].provider;
  const observedAt = record.startTime;
  return {
    schemaVersion: HEALTH_RECORD_SCHEMA_VERSION,
    userId: ctx.userId,
    provider: 'google_health',
    originalSource: record.metadata.dataOrigin.packageName,
    externalId: record.metadata.id,
    metricType: 'active_energy',
    value: record.energyKcal,
    unit: 'kcal',
    startTime: record.startTime,
    endTime: record.endTime,
    observedAt,
    syncedAt: ctx.syncedAt,
    fetchedAt: ctx.fetchedAt,
    provenanceChain: chain,
    deduplicationKey: buildDeduplicationKey({
      userId: ctx.userId,
      metricType: 'active_energy',
      origin,
      externalId: record.metadata.id,
      startTime: record.startTime,
      endTime: record.endTime,
      observedAt,
    }),
  };
}

export function mapRespiratoryRateRecord(record: RespiratoryRateRecord, ctx: MapContext): CanonicalHealthRecord {
  const chain = buildProvenanceChain(record.metadata.dataOrigin);
  const origin = chain[0].provider;
  const observedAt = record.time;
  return {
    schemaVersion: HEALTH_RECORD_SCHEMA_VERSION,
    userId: ctx.userId,
    provider: 'google_health',
    originalSource: record.metadata.dataOrigin.packageName,
    externalId: record.metadata.id,
    metricType: 'respiratory_rate',
    value: record.rate,
    unit: 'brpm',
    startTime: record.time,
    endTime: record.time,
    observedAt,
    syncedAt: ctx.syncedAt,
    fetchedAt: ctx.fetchedAt,
    provenanceChain: chain,
    deduplicationKey: buildDeduplicationKey({
      userId: ctx.userId,
      metricType: 'respiratory_rate',
      origin,
      externalId: record.metadata.id,
      startTime: record.time,
      endTime: record.time,
      observedAt,
    }),
  };
}

// Exported for tests that need to assert origin resolution independent of a
// full record mapping.
export { resolveHealthConnectOrigin, buildProvenanceChain };
