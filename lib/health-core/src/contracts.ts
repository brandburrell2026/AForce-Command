/**
 * @workspace/health-core — canonical, provider-neutral health contracts.
 *
 * THE single source of truth for provider identity, capability, connection
 * state, canonical health records, provenance, and deletion vocabulary.
 * The mobile app's `types/biometrics.ts` and `data/healthProviders.ts`
 * re-export from here; the api-server adopts these contracts in the
 * provider-kit PR (1B).
 *
 * GOVERNANCE (Score-Protection): nothing in this package touches the
 * Hydration Score. Health data informs Readiness surfaces only, under the
 * existing ±10 recovery clamp owned by utils/scoring (off-limits here).
 * Provider readiness/recovery values stay PROVIDER-ATTRIBUTED — they are
 * never blended into an AForce score of any kind.
 *
 * Pure TypeScript: no I/O, no Date.now(), no platform imports.
 */

// ─── Provider identity ───────────────────────────────────────────────────────

/**
 * Every provider AForce can ingest from. Moved here (verbatim) from
 * `artifacts/aforce-os/data/healthProviders.ts` so app + server share one
 * union. Do not add a provider without a capability declaration below.
 */
export type HealthProviderId =
  | 'apple_health'
  | 'oura'
  | 'samsung_health'
  | 'google_health'
  | 'garmin'
  | 'whoop'
  | 'strava';

/**
 * Where a record ORIGINATED, which is a superset of who delivered it:
 * platform aggregators (HealthKit / Health Connect) re-export records
 * written by other apps. `unknown_device_app` keeps unmapped origins
 * honest instead of silently claiming them as first-party.
 */
export type HealthOriginId = HealthProviderId | 'unknown_device_app';

// ─── Provider capability declarations ────────────────────────────────────────

export type ConnectMethod = 'device_native' | 'oauth_cloud' | 'via_health_connect';
export type SyncModel = 'push_from_device' | 'cloud_pull' | 'cloud_webhook_pull';

export type CanonicalHealthMetricType =
  | 'sleep_session'
  | 'resting_heart_rate'
  | 'hrv'
  | 'heart_rate_summary'
  | 'workout'
  | 'steps'
  | 'active_energy'
  | 'respiratory_rate'
  | 'provider_score';

/** Provider-attributed score kinds — displayed with attribution, never blended. */
export type ProviderScoreKind =
  | 'whoop_recovery'
  | 'whoop_strain'
  | 'oura_readiness'
  | 'garmin_stress'
  | 'strava_training_load';

export type HrvMethod = 'rmssd' | 'sdnn';

export interface ProviderCapabilityDecl {
  method: ConnectMethod;
  platforms: readonly ('ios' | 'android')[];
  /** Garmin Health API + Samsung direct SDK are partner programs. */
  requiresExternalApproval: boolean;
  /** Typed record coverage (replaces free-text `pulls` strings). */
  recordTypes: readonly CanonicalHealthMetricType[];
  providerScores: readonly ProviderScoreKind[];
  /** Which HRV statistic the provider actually emits (null = none). */
  hrvMethod: HrvMethod | null;
  /** Hard backfill cap, days. Health Connect floor is 30. */
  maxBackfillDays: number;
  sync: SyncModel;
  /**
   * Activation gate: a provider may not go user-visible until every listed
   * gate is objectively true. Enforced socially + by tests, documented in
   * governance/AFORCE_OS_HEALTH_SOURCE_MATRIX.md.
   */
  activationGates: readonly string[];
}

/**
 * Facts as of 2026-08-03. Garmin endpoints are UNVERIFIED pending partner
 * credentials (api-server lib/garminSnapshot.ts:19-24) — hence 'dormant'.
 * Samsung ships Phase-1 as an UPSTREAM ORIGIN through Health Connect only;
 * we never claim a direct Samsung connection without the partner SDK.
 */
export const HEALTH_PROVIDER_CAPABILITIES: Record<HealthProviderId, ProviderCapabilityDecl> = {
  apple_health: {
    method: 'device_native', platforms: ['ios'], requiresExternalApproval: false,
    recordTypes: ['sleep_session', 'resting_heart_rate', 'hrv', 'heart_rate_summary', 'workout', 'steps', 'active_energy', 'respiratory_rate'],
    providerScores: [], hrvMethod: 'sdnn', maxBackfillDays: 30, sync: 'push_from_device',
    activationGates: ['healthkit_native_enabled', 'health_apple_enabled', 'native dependency installed', 'App Privacy labels updated'],
  },
  google_health: {
    method: 'device_native', platforms: ['android'], requiresExternalApproval: false,
    recordTypes: ['sleep_session', 'resting_heart_rate', 'hrv', 'heart_rate_summary', 'workout', 'steps', 'active_energy', 'respiratory_rate'],
    providerScores: [], hrvMethod: 'rmssd', maxBackfillDays: 30, sync: 'push_from_device',
    activationGates: ['health_google_connect_enabled', 'Play Console health declaration approved', 'privacy-rationale flow shipped'],
  },
  samsung_health: {
    method: 'via_health_connect', platforms: ['android'], requiresExternalApproval: true,
    recordTypes: ['sleep_session', 'resting_heart_rate', 'heart_rate_summary', 'workout', 'steps', 'active_energy'],
    providerScores: [], hrvMethod: null, maxBackfillDays: 30, sync: 'push_from_device',
    activationGates: ['arrives as upstream origin via Health Connect (no direct claim)', 'health_samsung_direct_enabled + partner SDK for direct'],
  },
  whoop: {
    method: 'oauth_cloud', platforms: ['ios', 'android'], requiresExternalApproval: false,
    recordTypes: ['sleep_session', 'resting_heart_rate', 'hrv', 'workout', 'respiratory_rate', 'provider_score'],
    providerScores: ['whoop_recovery', 'whoop_strain'], hrvMethod: 'rmssd', maxBackfillDays: 30, sync: 'cloud_pull',
    activationGates: ['server credentials (existing)', 'health_whoop_enabled adopts gating at provider-kit cutover (PR 1B)'],
  },
  oura: {
    method: 'oauth_cloud', platforms: ['ios', 'android'], requiresExternalApproval: false,
    recordTypes: ['sleep_session', 'resting_heart_rate', 'hrv', 'workout', 'steps', 'active_energy', 'respiratory_rate', 'provider_score'],
    providerScores: ['oura_readiness'], hrvMethod: 'rmssd', maxBackfillDays: 30, sync: 'cloud_pull',
    activationGates: ['health_oura_enabled', 'server sweep + admin + tests (PR 1B/3)', 'mobile connect flow'],
  },
  garmin: {
    method: 'oauth_cloud', platforms: ['ios', 'android'], requiresExternalApproval: true,
    recordTypes: ['sleep_session', 'resting_heart_rate', 'hrv', 'workout', 'steps', 'active_energy', 'respiratory_rate', 'provider_score'],
    providerScores: ['garmin_stress'], hrvMethod: 'rmssd', maxBackfillDays: 30, sync: 'cloud_webhook_pull',
    activationGates: ['DORMANT: partner credentials granted', 'endpoints verified against partner portal', 'health_garmin_enabled'],
  },
  strava: {
    method: 'oauth_cloud', platforms: ['ios', 'android'], requiresExternalApproval: false,
    recordTypes: ['workout', 'provider_score'],
    providerScores: ['strava_training_load'], hrvMethod: null, maxBackfillDays: 7, sync: 'cloud_pull',
    activationGates: ['PARKED: kept intact, not exposed', 'health_strava_enabled'],
  },
};

// ─── Connection / sync / deletion state vocabulary ──────────────────────────

/**
 * Presentation-level status. Extends the shipped §26 resolver vocabulary
 * (utils/health/healthProviderStatus.ts) with freshness-aware and lifecycle
 * states. A provider is NEVER presented as connected/live merely because a
 * stale snapshot exists — `stale` / `no_recent_data` exist for exactly that.
 */
export type ProviderPresentationState =
  | 'unavailable'
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'connected_limited'
  | 'syncing'
  | 'stale'
  | 'no_recent_data'
  | 'action_required'
  | 'error'
  | 'via_health_connect'
  | 'dormant'
  | 'requires_external_approval';

export type SyncStatus = 'never' | 'idle' | 'syncing' | 'error';

/** Disconnect / deletion lifecycle (enforced server-side in PR 1B). */
export type DeletionStatus =
  | 'active'
  | 'disconnect_requested'
  | 'tokens_deleted'
  | 'snapshot_removed'
  | 'data_tombstoned'
  | 'purged';

export type HealthConfidence = 'high' | 'medium' | 'low' | 'unknown';

// ─── Provenance ──────────────────────────────────────────────────────────────

/**
 * One hop in the chain a record travelled: index 0 is the ORIGIN (the thing
 * that measured it), later hops are aggregators/relays. A direct cloud pull
 * has a single hop. HealthKit re-exports carry the origin's bundle id in
 * `nativeOrigin`; Health Connect carries the package name.
 */
export interface ProvenanceHop {
  provider: HealthOriginId;
  /** e.g. 'com.ouraring.oura' (HK sourceRevision) / 'com.sec.android.app.shealth' (HC dataOrigin). */
  nativeOrigin?: string;
  /** How this hop delivered the record onward. */
  transport: 'measured' | 'aggregator_export' | 'cloud_api' | 'device_push';
}

// ─── Canonical health record ─────────────────────────────────────────────────

export const HEALTH_RECORD_SCHEMA_VERSION = 1;

/** Structured value for sleep sessions — sessions/stages are never forced into one number. */
export interface SleepSessionValue {
  totalSleepHours: number;          // asleep, not in-bed
  inBedHours: number | null;
  stages:
    | { stage: 'awake' | 'light' | 'deep' | 'rem' | 'unspecified'; startUtc: string; endUtc: string }[]
    | null;                         // null = provider supplied no stages
}

export interface WorkoutValue {
  activityKind: string;             // normalized lowercase provider string
  durationMin: number;
  activeEnergyKcal: number | null;
  avgHeartRateBpm: number | null;
}

export type CanonicalHealthValue = number | string | SleepSessionValue | WorkoutValue | Record<string, unknown>;

export interface CanonicalHealthRecord {
  schemaVersion: number;            // HEALTH_RECORD_SCHEMA_VERSION
  userId: string;
  /** The provider that DELIVERED the record to AForce (chain hop N). */
  provider: HealthProviderId;
  /** Raw native origin identifier when delivered via an aggregator. */
  originalSource?: string;
  device?: {
    manufacturer?: string;
    model?: string;
    hardwareVersion?: string;
    softwareVersion?: string;
  };
  /** Provider-native record id when one exists — strongest dedup key. */
  externalId?: string;
  metricType: CanonicalHealthMetricType;
  value: CanonicalHealthValue;
  /** Canonical units: ms (HRV) · bpm · hours · count · kcal · brpm · min. */
  unit?: string;
  startTime?: string;               // ISO-8601 UTC
  endTime?: string;                 // ISO-8601 UTC
  observedAt: string;               // ISO-8601 UTC — when the phenomenon happened
  syncedAt: string;                 // ISO-8601 UTC — when AForce ingested it
  fetchedAt?: string;               // ISO-8601 UTC — when pulled from the provider
  /** REQUIRED for metricType 'hrv' — RMSSD is never presented as SDNN. */
  hrvMethod?: HrvMethod;
  /** For provider_score records: which attributed score this is. */
  scoreKind?: ProviderScoreKind;
  confidence?: HealthConfidence;
  /** [origin, ...aggregators]; length 1 = direct. */
  provenanceChain: ProvenanceHop[];
  /** Deterministic identity — see dedupe.buildDeduplicationKey. */
  deduplicationKey: string;
}

// ─── Legacy snapshot model (moved here verbatim + honest HRV extension) ──────

/**
 * The per-provider daily snapshot ("snapshot plane"). This IS the model that
 * previously lived in artifacts/aforce-os/types/biometrics.ts — moved, not
 * forked; the app re-exports it. Additive fields only; the wire shape the
 * api-server writes today remains valid input.
 */
export interface ProviderSnapshot {
  providerId: HealthProviderId;
  /** Resting heart rate (bpm). */
  restingHeartRate?: number | null;
  /**
   * @deprecated LEGACY MIXED-SEMANTICS FIELD. Despite the name, WHOOP / Oura
   * / Garmin populate this with RMSSD-based values; only HealthKit's SDNN
   * type would truly be SDNN. Kept verbatim for wire/consumer compatibility.
   * Read HRV via `hrvRmssdMs` / `hrvSdnnMs` (or normalize.resolveHrv), which
   * are populated by explicit per-provider translation only.
   */
  hrvSdnn?: number | null;
  /** HRV, RMSSD statistic, milliseconds — set only when truly RMSSD. */
  hrvRmssdMs?: number | null;
  /** HRV, SDNN statistic, milliseconds — set only when truly SDNN. */
  hrvSdnnMs?: number | null;
  /** Total sleep duration last night (hours). */
  sleepHoursLastNight?: number | null;
  /** Total steps for the current local day. */
  stepsToday?: number | null;
  /** Active workout / exercise minutes for the current local day. */
  workoutMinutesToday?: number | null;
  /** WHOOP-style strain score (0–21). Provider-attributed. */
  strain?: number | null;
  /** WHOOP recovery percentage (0–100). Provider-attributed. */
  recoveryPct?: number | null;
  /** Oura readiness score (0–100). Provider-attributed. */
  readinessScore?: number | null;
  /** Garmin stress score (0–100, higher = more stressed). Provider-attributed. */
  stressScore?: number | null;
  /** Strava-style 7-day acute training load. Provider-attributed. */
  trainingLoad?: number | null;
  /** When this snapshot was last refreshed (epoch ms). */
  fetchedAt: number;
  /**
   * Epoch ms of the newest underlying OBSERVATION captured in this snapshot
   * — e.g. the timestamp of the WHOOP recovery/cycle record, the Oura day
   * summary, or the Garmin metric read — as opposed to `fetchedAt`, which is
   * when AForce SYNCED that data. The two can diverge widely (a provider sync
   * can return an observation from hours or days earlier). OPTIONAL and
   * ADDITIVE (Founder Ruling I, RC-2): absent on legacy blobs and on any
   * payload where the provider did not carry a usable observation timestamp.
   * Consumers MUST fall back to `fetchedAt`-only behavior when this is
   * undefined — never fabricate or backfill it.
   */
  latestObservedAtMs?: number;
  /**
   * Per-FIELD observation times (epoch ms), keyed by the ProviderSnapshot
   * metric field the timestamp belongs to. OPTIONAL and ADDITIVE (Founder
   * Ruling C, RC-2, 2026-08-06): populated today only by `apple_health`
   * (artifacts/aforce-os/services/appleHealth.ts is the sole producer) —
   * every other provider stays snapshot-level-only via `latestObservedAtMs`
   * above, because a cloud sync/poll returns one observation moment for the
   * whole payload, not a distinct one per metric. A field missing from this
   * map is NOT "observed now": consumers MUST fall back to
   * `latestObservedAtMs`, then `fetchedAt` — see
   * `utils/biometricsAggregator.ts`'s `resolveComparisonTimestamp`, the one
   * canonical implementation of that fallback chain. Never fabricated or
   * backfilled — absent when the producer has no usable per-field moment.
   */
  fieldObservedAtMs?: Partial<Record<
    'restingHeartRate' | 'hrvSdnn' | 'sleepHoursLastNight' | 'stepsToday',
    number
  >>;
  /** Stamped by the normalization boundary; absent on raw legacy blobs. */
  schemaVersion?: number;
}

export type ProviderBiometrics = Partial<Record<HealthProviderId, ProviderSnapshot>>;
