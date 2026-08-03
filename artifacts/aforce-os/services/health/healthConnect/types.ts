/**
 * artifacts/aforce-os/services/health/healthConnect/types.ts
 *
 * LANE H1 — Android Health Connect adapter SHELL. No native dependency
 * exists yet (`react-native-health-connect` lands in H2); nothing here
 * imports a native module. These are minimal local interfaces for the
 * Health Connect record shapes this adapter consumes.
 *
 * Modeling assumption (documented, for H2 to verify against the real SDK
 * types): the native bridge normalizes platform `Instant` values to
 * ISO-8601 UTC strings before these shapes are constructed, so every
 * time field here is already `string`. That keeps mapRecords.ts pure and
 * unit-testable without the native SDK, matching the Apple-lane discipline
 * of a normalization boundary that never touches platform time types
 * directly (see lib/health-core/src/normalize.ts).
 *
 * Governance: consumes @workspace/health-core contracts only — does not
 * modify them. The provider id for every record here is the frozen
 * 'google_health' (see HEALTH_PROVIDER_CAPABILITIES.google_health in
 * lib/health-core/src/contracts.ts; hrvMethod: 'rmssd').
 */

import type { CanonicalHealthMetricType } from '@workspace/health-core';

// ─── Shared record metadata ──────────────────────────────────────────────────

export interface HcDataOrigin {
  /** Android package name of the app that wrote the record (HC `dataOrigin`). */
  packageName: string;
}

export interface HcRecordMetadata {
  /** Health Connect's own record id — strongest dedup key (→ `externalId`). */
  id: string;
  dataOrigin: HcDataOrigin;
  /** ISO-8601 UTC. */
  lastModifiedTime: string;
}

interface HcRecordBase {
  metadata: HcRecordMetadata;
}

// ─── Sleep ────────────────────────────────────────────────────────────────────

/**
 * Health Connect `SleepSessionRecord.Stage` type ints
 * (androidx.health.connect.client.records.SleepSessionRecord):
 *   0 unknown · 1 awake · 2 sleeping (undifferentiated) · 3 out of bed ·
 *   4 light · 5 deep · 6 REM.
 * Stage 7 (awake-in-bed) exists in newer HC releases and is deliberately
 * left unmapped here — see mapRecords.ts's stage table comment for the
 * honest fallback behavior.
 */
export type HcSleepStageType = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export interface HcSleepStage {
  startTime: string; // ISO-8601 UTC
  endTime: string; // ISO-8601 UTC
  stage: HcSleepStageType;
}

export interface SleepSessionRecord extends HcRecordBase {
  startTime: string;
  endTime: string;
  stages: HcSleepStage[];
}

// ─── Activity / vitals ────────────────────────────────────────────────────────

export interface StepsRecord extends HcRecordBase {
  startTime: string;
  endTime: string;
  count: number;
}

export interface HeartRateSample {
  time: string;
  beatsPerMinute: number;
}

/** HC's HeartRateRecord is a time-series session; this adapter summarizes it. */
export interface HeartRateRecord extends HcRecordBase {
  startTime: string;
  endTime: string;
  samples: HeartRateSample[];
}

export interface RestingHeartRateRecord extends HcRecordBase {
  time: string;
  beatsPerMinute: number;
}

export interface HeartRateVariabilityRmssdRecord extends HcRecordBase {
  time: string;
  /** RMSSD, milliseconds. Health Connect emits RMSSD only — never SDNN. */
  heartRateVariabilityMillis: number;
}

export interface ExerciseSessionRecord extends HcRecordBase {
  startTime: string;
  endTime: string;
  /** Provider-native exercise type string (H2 lowercases against HC's exerciseType int→name table). */
  exerciseType: string;
  /** Optional aggregates HC exposes via linked records; H2 fills these in when it joins them. Absent ⇒ unknown, not zero. */
  activeCaloriesKcal?: number | null;
  avgHeartRateBpm?: number | null;
}

export interface ActiveCaloriesBurnedRecord extends HcRecordBase {
  startTime: string;
  endTime: string;
  energyKcal: number;
}

export interface RespiratoryRateRecord extends HcRecordBase {
  time: string;
  rate: number; // breaths per minute
}

// ─── SDK availability ─────────────────────────────────────────────────────────

export type HealthConnectAvailability = 'unavailable' | 'needs_update' | 'available';

/** Mirrors the real SDK's `SdkAvailabilityStatus` constants without importing them. */
export type HealthConnectSdkStatus =
  | 'SDK_UNAVAILABLE'
  | 'SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED'
  | 'SDK_AVAILABLE';

// ─── Permissions ──────────────────────────────────────────────────────────────

export type HealthConnectPermissionString = `android.permission.health.${'READ' | 'WRITE'}_${string}`;

// ─── Native client surface (H2 implements against react-native-health-connect) ─

/**
 * Native-SDK-agnostic client contract. Nothing in this LANE H1 shell calls
 * this — it exists so H2's real implementation and any caller written
 * against this shell type-check identically before/after the native
 * dependency lands.
 */
export interface HealthConnectClient {
  getSdkStatus(): Promise<HealthConnectSdkStatus>;
  requestPermission(
    permissions: readonly HealthConnectPermissionString[],
  ): Promise<HealthConnectPermissionString[]>;
  getGrantedPermissions(): Promise<HealthConnectPermissionString[]>;
  readRecords<T>(recordType: string, options: unknown): Promise<T[]>;
  /** Health Connect's changes-token incremental sync surface. */
  getChangesToken(recordTypes: readonly string[]): Promise<string>;
  getChanges(changesToken: string): Promise<{ changes: unknown[]; nextChangesToken: string }>;
}

// Re-exported for adapter modules that only need the metric-type union.
export type { CanonicalHealthMetricType };
