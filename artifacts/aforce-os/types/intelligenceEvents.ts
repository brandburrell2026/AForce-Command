/**
 * Stage 1 — Shared intelligence data contracts (§41, §B of the Phase 3 design).
 *
 * The single canonical envelope every AForce Intelligence™ system reads and
 * writes. Category-specific data lives in a typed payload so new event families
 * are additive and never require an envelope change.
 *
 * HARD LOCKS:
 *  - Types only. RN-free, dependency-free (type-only imports) so every consumer
 *    runs under the vitest pure runner.
 *  - Score-Protection: nothing in this contract carries or confers authority to
 *    mutate score. Events RECORD completed behaviour and observed context; they
 *    never award, mutate, or fabricate score.
 *  - No fabrication: absence of an event is never a favourable default. Consumers
 *    resolve missing evidence to an explicit insufficient-data state.
 *  - Server-canonical (DR-002): PostgreSQL is authoritative. `sync` below is
 *    CACHE-LOCAL metadata and is not part of the canonical server record.
 *
 * Reuses the SHIPPED confidence vocabulary rather than restating it — see
 * `utils/confidence/*`. Introducing a parallel notion of freshness or signal
 * quality here would drift from the definitions already surfaced to users.
 */
import type { FreshnessRating } from '../utils/confidence/dataFreshness';
import type { SignalQualityRating } from '../utils/confidence/signalQuality';

/* ─── Categories ──────────────────────────────────────────────────────────── */

/**
 * PRIMARY categories record facts. DERIVED categories record conclusions and
 * always carry a `modelVersion` plus a non-empty `provenance.derivedFrom`.
 */
export type PrimaryEventCategory =
  | 'behavior'
  | 'context'
  | 'physiological'
  | 'outcome'
  | 'profile';

export type DerivedEventCategory =
  | 'graph'
  | 'prediction'
  | 'prediction_outcome'
  | 'pattern'
  | 'model_snapshot'
  | 'audit';

export type EventCategory = PrimaryEventCategory | DerivedEventCategory;

export const PRIMARY_EVENT_CATEGORIES: readonly PrimaryEventCategory[] = [
  'behavior',
  'context',
  'physiological',
  'outcome',
  'profile',
];

export const DERIVED_EVENT_CATEGORIES: readonly DerivedEventCategory[] = [
  'graph',
  'prediction',
  'prediction_outcome',
  'pattern',
  'model_snapshot',
  'audit',
];

/* ─── Privacy classification ──────────────────────────────────────────────── */

/**
 * Mirrors `governance/DATA-CLASSIFICATION-MATRIX.md` §1.
 *  S0 derived non-identifying · S1 personal behavioural · S2 personal
 *  physiological · S3 sensitive/regulated. S4 (identity/credential) is
 *  deliberately absent — the intelligence layer never touches it.
 */
export type PrivacyClass = 'S0' | 'S1' | 'S2' | 'S3';

export const PRIVACY_CLASSES: readonly PrivacyClass[] = ['S0', 'S1', 'S2', 'S3'];

/** Classes whose local persistence REQUIRES encryption at rest (DR-004). */
export const ENCRYPTION_REQUIRED_PRIVACY_CLASSES: readonly PrivacyClass[] = ['S1', 'S2', 'S3'];

/* ─── Retention classification (DR-005) ───────────────────────────────────── */

/**
 * Purpose-limited retention classes. Default windows live in
 * `config/hydroStateModel.ts` (RETENTION_CLASS_DAYS) — never hardcoded here.
 *
 *  R0 transient · R1 high-frequency raw · R2 normalized personal events ·
 *  R3 daily/periodic derived features · R4 graph & model history ·
 *  R5 predictions & outcomes · R6 user-facing insight history ·
 *  R7 privacy/consent/security records (window TBD pending counsel review).
 */
export type RetentionClass = 'R0' | 'R1' | 'R2' | 'R3' | 'R4' | 'R5' | 'R6' | 'R7';

export const RETENTION_CLASSES: readonly RetentionClass[] = [
  'R0',
  'R1',
  'R2',
  'R3',
  'R4',
  'R5',
  'R6',
  'R7',
];

/** R0 is memory/job lifetime only — it must never reach durable storage. */
export const NON_PERSISTENT_RETENTION_CLASSES: readonly RetentionClass[] = ['R0'];

/**
 * Classes bounded by account lifetime rather than a fixed window: they stay
 * active while the account is active, and only SUPERSEDED rows age out.
 */
export const ACCOUNT_LIFETIME_RETENTION_CLASSES: readonly RetentionClass[] = ['R4', 'R6'];

/* ─── Versioning context (§41) ────────────────────────────────────────────── */

/**
 * `<system>-v<major>.<minor>`. A MAJOR bump means records are not comparable —
 * re-derive or retire, never silently reinterpret under new logic.
 */
export type ModelVersion = string;

export type ModelVersionSystem = 'graph' | 'prediction' | 'dna' | 'lpm';

export interface ModelVersionRef {
  system: ModelVersionSystem;
  version: ModelVersion;
  /** false ⇒ prior records must be re-derived or retired, never reinterpreted. */
  comparableToPrior: boolean;
}

/**
 * Server-canonical version references. These point at the EXISTING
 * `aforce_profile_versions` / `aforce_baseline_versions` tables — Stage 1 must
 * not restate or duplicate those records, only reference them.
 */
export interface VersionContext {
  profileVersionId: number | null;
  baselineVersionId: number | null;
  /** null for primary observations; required for every derived record. */
  modelVersion: ModelVersion | null;
}

/* ─── Provenance (§41) ────────────────────────────────────────────────────── */

export type EventSource =
  | 'user_log'
  | 'command_ledger'
  | 'voice_checkin'
  | 'wearable'
  | 'health_kit'
  | 'weather'
  | 'device_context'
  | 'profile_engine'
  | 'hydro_scan'
  | 'derivation';

/**
 * Every claim must resolve to real recorded source events. A derived record with
 * an empty `derivedFrom` is invalid — there is no "trust me" path.
 */
export interface Provenance {
  source: EventSource;
  /** clientEventIds this was derived from. Empty for primary observations. */
  derivedFrom: readonly string[];
  /** Optional pointer to the underlying domain row (intake log id, scan id, …). */
  sourceRecordRef?: string;
}

/* ─── Quality (reused, not redefined) ─────────────────────────────────────── */

export interface QualityContext {
  freshness: FreshnessRating;
  signalQuality: SignalQualityRating;
  /** 0..1. null for primary observations — a fact has no confidence, it just is. */
  confidence: number | null;
}

/* ─── Invalidation & supersession ─────────────────────────────────────────── */

export type InvalidationStatus = 'active' | 'invalidated' | 'superseded';

export type InvalidationReason =
  | 'source_deleted'
  | 'profile_version_changed'
  | 'baseline_recalibrated'
  | 'model_version_major'
  | 'contradicted'
  | 'expired'
  | 'superseded';

export interface InvalidationState {
  status: InvalidationStatus;
  reason?: InvalidationReason;
  atMs?: number;
  /** clientEventId of the record that replaced this one. */
  supersededBy?: string;
}

/* ─── Synchronization (cache-local only) ──────────────────────────────────── */

/**
 * NOT part of the canonical server record (DR-002). This is the device's view of
 * how far an event has travelled. `conflict` resolves server-wins.
 */
export type SyncState = 'pending' | 'sent' | 'acked' | 'conflict' | 'failed';

export interface SyncMetadata {
  state: SyncState;
  attempts: number;
  lastAttemptAtMs?: number;
}

/* ─── Audit (§41) ─────────────────────────────────────────────────────────── */

export type AuditAction = 'access' | 'export' | 'delete' | 'invalidate' | 're-derive';

export type AuditActor = 'user' | 'system' | 'founder_mode';

export interface AuditMetadata {
  action: AuditAction;
  actor: AuditActor;
  /** Non-sensitive scope descriptor. NEVER carries payload contents (DR-005). */
  scope: Readonly<Record<string, string | number | boolean | null>>;
  affectedCounts?: Readonly<Record<string, number>>;
  atMs: number;
}

/* ─── Day index ───────────────────────────────────────────────────────────── */

/**
 * Day-index conventions DIFFER per source and MUST be preserved round-trip:
 * voice check-ins carry the record's LOCAL-calendar day index (what streak math
 * compares against); Performance Age snapshots carry the UTC floor
 * (`floor(ms / 86400000)`). Normalizing to one convention silently breaks either
 * streaks or snapshot alignment — so the basis travels with the value and no
 * consumer has to guess.
 */
export type DayIndexBasis = 'local-calendar' | 'utc-floor';

export interface DayIndexRef {
  dayIndex: number;
  dayIndexBasis: DayIndexBasis;
}

/* ─── The envelope ────────────────────────────────────────────────────────── */

/** Payload shape is category-specific and refined per system in later stages. */
export type IntelligenceEventPayload = Readonly<Record<string, unknown>>;

/** Current envelope schema version. Bump only on a breaking envelope change. */
export const INTELLIGENCE_EVENT_SCHEMA_VERSION = 1;

export interface IntelligenceEvent {
  /* identity */
  /** UUID minted on-device at creation and FROZEN — never regenerated on retry. */
  clientEventId: string;
  /** Assigned by the server on first successful ingest. Never used for dedupe. */
  serverId?: number;
  userId: string;

  /* classification */
  category: EventCategory;
  type: string;
  schemaVersion: number;

  /* time — three distinct clocks; offline capture makes them genuinely differ */
  occurredAtMs: number;
  recordedAtMs: number;
  receivedAtMs?: number;
  dayIndex: number;
  dayIndexBasis: DayIndexBasis;

  /* context */
  version: VersionContext;
  provenance: Provenance;
  quality: QualityContext;

  /* governance */
  privacyClass: PrivacyClass;
  retentionClass: RetentionClass;
  invalidation: InvalidationState;

  /* cache-local */
  sync?: SyncMetadata;

  payload: IntelligenceEventPayload;
}

/** A derived record's link back to the source events that justify it. */
export interface ProvenanceLink {
  derivedKind: 'relationship' | 'prediction' | 'pattern' | 'snapshot';
  derivedId: string;
  sourceEventId: string;
  modelVersion: ModelVersion;
}
