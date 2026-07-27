/**
 * Stage 1 — shared intelligence data contracts.
 *
 * Proves the Phase 3 Output J invariants that are testable at contract level:
 *  - Score Protection (no score surface exists in the contract at all)
 *  - no fabrication / fail-closed validation
 *  - provenance-or-nothing for derived records
 *  - the DR-002 hard invariant: no active derived record may survive when all
 *    of its supporting evidence is gone
 *  - DR-004 encryption classification
 *  - DR-005 retention classification, incl. the null-window semantics
 *  - day-index basis round-trips and is never normalized
 */
import { describe, expect, it } from 'vitest';
import {
  hasValidProvenance,
  isDerivedCategory,
  isEmittable,
  isExpiredByRetention,
  isPersistable,
  isPlaintextCacheable,
  isPrimaryCategory,
  isValidIntelligenceEvent,
  mustInvalidateForLostEvidence,
  requiresEncryptionAtRest,
  retentionDays,
  validateIntelligenceEvent,
} from '../intelligence/intelligenceEventContracts';
import {
  DERIVED_EVENT_CATEGORIES,
  PRIMARY_EVENT_CATEGORIES,
  RETENTION_CLASSES,
  type IntelligenceEvent,
  type RetentionClass,
} from '../../types/intelligenceEvents';
import { RETENTION_CLASS_DAYS } from '../../config/hydroStateModel';

const DAY_MS = 86_400_000;
const NOW = 1_800_000_000_000;

function primaryEvent(over: Partial<IntelligenceEvent> = {}): IntelligenceEvent {
  return {
    clientEventId: 'evt-1',
    userId: 'user-1',
    category: 'behavior',
    type: 'intake_logged',
    schemaVersion: 1,
    occurredAtMs: NOW - 1000,
    recordedAtMs: NOW - 500,
    dayIndex: 20_833,
    dayIndexBasis: 'local-calendar',
    version: { profileVersionId: 7, baselineVersionId: 3, modelVersion: null },
    provenance: { source: 'user_log', derivedFrom: [] },
    quality: { freshness: 'fresh', signalQuality: 'good', confidence: null },
    privacyClass: 'S1',
    retentionClass: 'R2',
    invalidation: { status: 'active' },
    payload: { oz: 16 },
    ...over,
  };
}

function derivedEvent(over: Partial<IntelligenceEvent> = {}): IntelligenceEvent {
  return primaryEvent({
    clientEventId: 'rel-1',
    category: 'graph',
    type: 'relationship_observed',
    version: { profileVersionId: 7, baselineVersionId: 3, modelVersion: 'graph-v1.0' },
    provenance: { source: 'derivation', derivedFrom: ['evt-1', 'evt-2'] },
    quality: { freshness: 'fresh', signalQuality: 'good', confidence: 0.62 },
    retentionClass: 'R4',
    ...over,
  });
}

describe('Score Protection — contract level', () => {
  it('exposes no score field anywhere in the envelope', () => {
    const keys = Object.keys(primaryEvent());
    for (const k of keys) {
      expect(k.toLowerCase()).not.toContain('score');
      expect(k.toLowerCase()).not.toContain('hydrostate');
    }
  });

  it('carries no numeric score in quality — confidence is the only scalar', () => {
    expect(Object.keys(primaryEvent().quality).sort()).toEqual([
      'confidence',
      'freshness',
      'signalQuality',
    ]);
  });
});

describe('category classification', () => {
  it('classifies every declared category exactly once', () => {
    for (const c of PRIMARY_EVENT_CATEGORIES) {
      expect(isPrimaryCategory(c)).toBe(true);
      expect(isDerivedCategory(c)).toBe(false);
    }
    for (const c of DERIVED_EVENT_CATEGORIES) {
      expect(isDerivedCategory(c)).toBe(true);
      expect(isPrimaryCategory(c)).toBe(false);
    }
  });
});

describe('provenance — §41 "no trust-me path"', () => {
  it('accepts a primary observation with no derivedFrom', () => {
    expect(hasValidProvenance(primaryEvent())).toBe(true);
  });

  it('rejects a derived record with no source events', () => {
    const e = derivedEvent({ provenance: { source: 'derivation', derivedFrom: [] } });
    expect(hasValidProvenance(e)).toBe(false);
    expect(validateIntelligenceEvent(e)).toContain('missing_provenance');
  });

  it('rejects a derived record with no model version', () => {
    const e = derivedEvent({
      version: { profileVersionId: 7, baselineVersionId: 3, modelVersion: null },
    });
    expect(hasValidProvenance(e)).toBe(false);
    expect(validateIntelligenceEvent(e)).toContain('derived_without_model_version');
  });
});

describe('DR-002 hard invariant — derived records cannot outlive their evidence', () => {
  it('keeps a derived record while ANY supporting event survives', () => {
    expect(mustInvalidateForLostEvidence(derivedEvent(), new Set(['evt-2']))).toBe(false);
  });

  it('invalidates when ALL supporting evidence is gone', () => {
    expect(mustInvalidateForLostEvidence(derivedEvent(), new Set())).toBe(true);
  });

  it('invalidates a derived record that never recorded sources (fail closed)', () => {
    const e = derivedEvent({ provenance: { source: 'derivation', derivedFrom: [] } });
    expect(mustInvalidateForLostEvidence(e, new Set(['evt-1']))).toBe(true);
  });

  it('never asks to invalidate a primary observation', () => {
    expect(mustInvalidateForLostEvidence(primaryEvent(), new Set())).toBe(false);
  });

  it('property: no active derived record survives total evidence loss', () => {
    const survivors = new Set<string>();
    for (const c of DERIVED_EVENT_CATEGORIES) {
      const e = derivedEvent({ category: c });
      expect(mustInvalidateForLostEvidence(e, survivors)).toBe(true);
    }
  });
});

describe('DR-004 — encryption classification', () => {
  it('requires encryption for personal and sensitive classes', () => {
    expect(requiresEncryptionAtRest('S1')).toBe(true);
    expect(requiresEncryptionAtRest('S2')).toBe(true);
    expect(requiresEncryptionAtRest('S3')).toBe(true);
  });

  it('does not require encryption for derived non-identifying data', () => {
    expect(requiresEncryptionAtRest('S0')).toBe(false);
  });

  it('forbids plaintext caching of a personal behavioural event', () => {
    expect(isPlaintextCacheable(primaryEvent({ privacyClass: 'S1' }))).toBe(false);
    expect(isPlaintextCacheable(primaryEvent({ privacyClass: 'S0' }))).toBe(true);
  });
});

describe('DR-005 — retention classification', () => {
  it('declares a window for every class', () => {
    for (const c of RETENTION_CLASSES) {
      expect(RETENTION_CLASS_DAYS).toHaveProperty(c);
    }
  });

  it('treats R0 as never persistable', () => {
    expect(isPersistable('R0')).toBe(false);
    for (const c of RETENTION_CLASSES.filter((x) => x !== 'R0')) {
      expect(isPersistable(c as RetentionClass)).toBe(true);
    }
  });

  it('exposes null (not a number) for account-lifetime and pending-review classes', () => {
    expect(retentionDays('R4')).toBeNull();
    expect(retentionDays('R6')).toBeNull();
    expect(retentionDays('R7')).toBeNull();
  });

  it('matches the DR-005 fixed windows', () => {
    expect(retentionDays('R1')).toBe(90);
    expect(retentionDays('R2')).toBe(730);
    expect(retentionDays('R3')).toBe(1095);
    expect(retentionDays('R5')).toBe(730);
  });

  it('expires a fixed-window record past its window', () => {
    const fresh = primaryEvent({ retentionClass: 'R1', recordedAtMs: NOW - 89 * DAY_MS });
    const aged = primaryEvent({ retentionClass: 'R1', recordedAtMs: NOW - 91 * DAY_MS });
    expect(isExpiredByRetention(fresh, NOW)).toBe(false);
    expect(isExpiredByRetention(aged, NOW)).toBe(true);
  });

  it('never expires an ACTIVE account-lifetime record on age alone', () => {
    const old = derivedEvent({ retentionClass: 'R4', recordedAtMs: NOW - 5000 * DAY_MS });
    expect(isExpiredByRetention(old, NOW)).toBe(false);
  });

  it('ages out a SUPERSEDED account-lifetime record', () => {
    const superseded = derivedEvent({
      retentionClass: 'R4',
      recordedAtMs: NOW - 800 * DAY_MS,
      invalidation: { status: 'superseded', supersededBy: 'rel-2' },
    });
    expect(isExpiredByRetention(superseded, NOW)).toBe(true);
  });

  it('does not expire on a future timestamp (clock skew)', () => {
    const skewed = primaryEvent({ retentionClass: 'R1', recordedAtMs: NOW + 10 * DAY_MS });
    expect(isExpiredByRetention(skewed, NOW)).toBe(false);
  });
});

describe('envelope validation — fails closed', () => {
  it('accepts a well-formed primary event', () => {
    expect(validateIntelligenceEvent(primaryEvent())).toEqual([]);
    expect(isValidIntelligenceEvent(primaryEvent())).toBe(true);
  });

  it('accepts a well-formed derived event', () => {
    expect(validateIntelligenceEvent(derivedEvent())).toEqual([]);
  });

  it('reports every violation, not just the first', () => {
    const broken = primaryEvent({
      clientEventId: '',
      userId: '',
      occurredAtMs: 0,
      recordedAtMs: 0,
    });
    const v = validateIntelligenceEvent(broken);
    expect(v).toContain('missing_client_event_id');
    expect(v).toContain('missing_user_id');
    expect(v).toContain('invalid_timestamps');
    expect(v.length).toBeGreaterThanOrEqual(3);
  });

  it('rejects a confidence outside 0..1', () => {
    const e = derivedEvent({
      quality: { freshness: 'fresh', signalQuality: 'good', confidence: 1.4 },
    });
    expect(validateIntelligenceEvent(e)).toContain('confidence_out_of_range');
  });

  it('rejects confidence attached to a primary observation', () => {
    const e = primaryEvent({
      quality: { freshness: 'fresh', signalQuality: 'good', confidence: 0.9 },
    });
    expect(validateIntelligenceEvent(e)).toContain('primary_with_confidence');
  });

  it('rejects a persisted R0 record', () => {
    expect(validateIntelligenceEvent(primaryEvent({ retentionClass: 'R0' }))).toContain(
      'non_persistable_retention',
    );
  });
});

describe('day index — basis travels with the value', () => {
  it('round-trips both conventions without normalizing', () => {
    const local = primaryEvent({ dayIndex: 20_833, dayIndexBasis: 'local-calendar' });
    const utc = primaryEvent({ dayIndex: 20_834, dayIndexBasis: 'utc-floor' });
    expect(local.dayIndexBasis).toBe('local-calendar');
    expect(utc.dayIndexBasis).toBe('utc-floor');
    expect(local.dayIndex).not.toBe(utc.dayIndex);
    expect(isValidIntelligenceEvent(local)).toBe(true);
    expect(isValidIntelligenceEvent(utc)).toBe(true);
  });

  it('rejects a missing basis', () => {
    const e = primaryEvent({ dayIndexBasis: 'wall-clock' as never });
    expect(validateIntelligenceEvent(e)).toContain('missing_day_index_basis');
  });
});

describe('emittability — necessary, never sufficient', () => {
  it('allows a valid, active, unexpired record', () => {
    expect(isEmittable(derivedEvent(), NOW)).toBe(true);
  });

  it('blocks an invalidated record', () => {
    const e = derivedEvent({ invalidation: { status: 'invalidated', reason: 'source_deleted' } });
    expect(isEmittable(e, NOW)).toBe(false);
  });

  it('blocks an expired record', () => {
    const e = derivedEvent({ retentionClass: 'R5', recordedAtMs: NOW - 900 * DAY_MS });
    expect(isEmittable(e, NOW)).toBe(false);
  });

  it('blocks a structurally invalid record', () => {
    const e = derivedEvent({ provenance: { source: 'derivation', derivedFrom: [] } });
    expect(isEmittable(e, NOW)).toBe(false);
  });
});
