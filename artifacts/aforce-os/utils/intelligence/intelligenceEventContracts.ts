/**
 * Stage 1 — Shared intelligence contract helpers (§41).
 *
 * Pure predicates and classifiers over the canonical `IntelligenceEvent`
 * envelope. This module is the single place the Stage 1 invariants are
 * expressed in code, so later stages (graph, prediction, DNA, LPM) enforce the
 * same rules rather than each re-deriving them.
 *
 * HARD LOCKS:
 *  - Pure + RN-free (type-only imports) so it runs under the vitest pure runner.
 *  - Score-Protection: nothing here reads, awards, mutates, or fabricates score.
 *  - No fabrication: every predicate FAILS CLOSED. An envelope that cannot be
 *    shown to be valid is invalid; a record that cannot be shown to be supported
 *    is unsupported. Absence is never a favourable default.
 *  - Config-driven: retention windows come from `config/hydroStateModel.ts`,
 *    never hardcoded here.
 */
import {
  DERIVED_EVENT_CATEGORIES,
  ENCRYPTION_REQUIRED_PRIVACY_CLASSES,
  NON_PERSISTENT_RETENTION_CLASSES,
  PRIMARY_EVENT_CATEGORIES,
  type DerivedEventCategory,
  type EventCategory,
  type IntelligenceEvent,
  type InvalidationStatus,
  type PrimaryEventCategory,
  type PrivacyClass,
  type RetentionClass,
} from '../../types/intelligenceEvents';
import {
  RETENTION_CLASS_DAYS,
  SUPERSEDED_RECORD_RETENTION_DAYS,
} from '../../config/hydroStateModel';

const DAY_MS = 86_400_000;

/* ─── Category ────────────────────────────────────────────────────────────── */

export function isPrimaryCategory(category: EventCategory): category is PrimaryEventCategory {
  return (PRIMARY_EVENT_CATEGORIES as readonly EventCategory[]).includes(category);
}

export function isDerivedCategory(category: EventCategory): category is DerivedEventCategory {
  return (DERIVED_EVENT_CATEGORIES as readonly EventCategory[]).includes(category);
}

/* ─── Provenance (§41) ────────────────────────────────────────────────────── */

/**
 * A DERIVED record must resolve to real source events AND name the logic that
 * produced it. There is no "trust me" path: a derived record missing either
 * `derivedFrom` or `modelVersion` is not emittable.
 *
 * A PRIMARY record is a fact — it needs neither.
 */
export function hasValidProvenance(event: IntelligenceEvent): boolean {
  if (isDerivedCategory(event.category)) {
    return event.provenance.derivedFrom.length > 0 && event.version.modelVersion !== null;
  }
  return true;
}

/* ─── Invalidation ────────────────────────────────────────────────────────── */

export function isActive(status: InvalidationStatus): boolean {
  return status === 'active';
}

/**
 * THE hard invariant of the intelligence layer (DR-002, DR-005): a derived
 * record may not remain active once ALL of its supporting evidence has been
 * deleted or invalidated.
 *
 * Returns true when the record must be invalidated. Fails closed — a derived
 * record whose surviving-evidence set cannot be established is treated as
 * unsupported.
 *
 * @param event                the record under test
 * @param survivingSourceIds   clientEventIds of source events still valid
 */
export function mustInvalidateForLostEvidence(
  event: IntelligenceEvent,
  survivingSourceIds: ReadonlySet<string>,
): boolean {
  if (!isDerivedCategory(event.category)) return false;
  if (!isActive(event.invalidation.status)) return false;

  const sources = event.provenance.derivedFrom;
  // A derived record with no recorded sources was never supportable.
  if (sources.length === 0) return true;

  return !sources.some((id) => survivingSourceIds.has(id));
}

/* ─── Privacy & encryption (DR-004) ───────────────────────────────────────── */

/**
 * Whether a record of this privacy class REQUIRES encryption at rest when cached
 * locally. S0 (derived, non-identifying) is the only class that does not.
 */
export function requiresEncryptionAtRest(privacyClass: PrivacyClass): boolean {
  return (ENCRYPTION_REQUIRED_PRIVACY_CLASSES as readonly PrivacyClass[]).includes(privacyClass);
}

/** Convenience: may this event be written to a PLAINTEXT local store? */
export function isPlaintextCacheable(event: IntelligenceEvent): boolean {
  return !requiresEncryptionAtRest(event.privacyClass);
}

/* ─── Retention (DR-005) ──────────────────────────────────────────────────── */

/** R0 is memory/job lifetime only — it must never reach durable storage. */
export function isPersistable(retentionClass: RetentionClass): boolean {
  return !(NON_PERSISTENT_RETENTION_CLASSES as readonly RetentionClass[]).includes(retentionClass);
}

/**
 * Retention window in days, or null when the class is not bounded by a fixed
 * number of days — either account-lifetime (R4/R6 current records) or unset
 * pending counsel review (R7). Callers MUST branch on null rather than coercing.
 */
export function retentionDays(retentionClass: RetentionClass): number | null {
  return RETENTION_CLASS_DAYS[retentionClass];
}

/**
 * Whether a record has aged past its retention window.
 *
 * Fails closed in the safe direction for each case:
 *  - R0 is never persistable, so any stored R0 record is immediately expired.
 *  - A null window means "no fixed day count" — NOT "keep forever". Superseded
 *    records in those classes age out on SUPERSEDED_RECORD_RETENTION_DAYS;
 *    active ones are account-lifetime and never expire on age alone.
 */
export function isExpiredByRetention(
  event: IntelligenceEvent,
  nowMs: number,
): boolean {
  const { retentionClass } = event;

  if (!isPersistable(retentionClass)) return true;

  const ageMs = nowMs - event.recordedAtMs;
  if (ageMs < 0) return false; // clock skew — never expire on a future timestamp

  const days = retentionDays(retentionClass);
  if (days !== null) return ageMs > days * DAY_MS;

  // Account-lifetime or pending-review class: only superseded/invalidated rows age out.
  if (isActive(event.invalidation.status)) return false;
  return ageMs > SUPERSEDED_RECORD_RETENTION_DAYS * DAY_MS;
}

/* ─── Envelope validation ─────────────────────────────────────────────────── */

export type ContractViolation =
  | 'missing_client_event_id'
  | 'missing_user_id'
  | 'unknown_category'
  | 'invalid_timestamps'
  | 'missing_day_index_basis'
  | 'missing_provenance'
  | 'derived_without_model_version'
  | 'non_persistable_retention'
  | 'confidence_out_of_range'
  | 'primary_with_confidence';

/**
 * Structural validation of an envelope. Returns the violations found — an empty
 * array means valid. Deliberately returns ALL violations rather than the first,
 * so an ingest rejection can explain itself completely.
 */
export function validateIntelligenceEvent(event: IntelligenceEvent): ContractViolation[] {
  const violations: ContractViolation[] = [];

  if (!event.clientEventId) violations.push('missing_client_event_id');
  if (!event.userId) violations.push('missing_user_id');

  const known = isPrimaryCategory(event.category) || isDerivedCategory(event.category);
  if (!known) violations.push('unknown_category');

  if (
    !Number.isFinite(event.occurredAtMs) ||
    !Number.isFinite(event.recordedAtMs) ||
    event.occurredAtMs <= 0 ||
    event.recordedAtMs <= 0
  ) {
    violations.push('invalid_timestamps');
  }

  if (event.dayIndexBasis !== 'local-calendar' && event.dayIndexBasis !== 'utc-floor') {
    violations.push('missing_day_index_basis');
  }

  if (known && !hasValidProvenance(event)) {
    violations.push(
      event.provenance.derivedFrom.length === 0
        ? 'missing_provenance'
        : 'derived_without_model_version',
    );
  }

  if (!isPersistable(event.retentionClass)) violations.push('non_persistable_retention');

  const { confidence } = event.quality;
  if (confidence !== null) {
    if (!Number.isFinite(confidence) || confidence < 0 || confidence > 1) {
      violations.push('confidence_out_of_range');
    }
    // A primary observation is a fact; attaching confidence to it implies a
    // derivation that did not happen.
    if (known && isPrimaryCategory(event.category)) violations.push('primary_with_confidence');
  }

  return violations;
}

/** Fail-closed convenience wrapper. */
export function isValidIntelligenceEvent(event: IntelligenceEvent): boolean {
  return validateIntelligenceEvent(event).length === 0;
}

/* ─── Emittability ────────────────────────────────────────────────────────── */

/**
 * Whether a record may be considered for a user-facing path AT THE CONTRACT
 * LEVEL. This is necessary, never sufficient: §42's language gate and each
 * system's own evidence gates apply on top and are enforced separately.
 */
export function isEmittable(event: IntelligenceEvent, nowMs: number): boolean {
  if (!isValidIntelligenceEvent(event)) return false;
  if (!isActive(event.invalidation.status)) return false;
  if (isExpiredByRetention(event, nowMs)) return false;
  return true;
}
