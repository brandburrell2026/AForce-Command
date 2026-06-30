/**
 * Adaptive Profile Engine™ (Section 18) tests.
 *
 * Pin the Section-18 invariants:
 *   1. Major vs minor classification: only the configured major variables,
 *      with numeric delta thresholds and categorical exact-match.
 *   2. Weight below the trigger delta stays MINOR; at/above is MAJOR.
 *   3. null↔value transitions count as a change; null↔null does not.
 *   4. Connected wearables compare as a SET (order-independent).
 *   5. Contract B: passage of time never mints a version — only a birthYear
 *      edit does; the bracket is recomputed at read time.
 *   6. Confidence opens lower after recalibration than for a first baseline,
 *      ramps per observation, and clamps at the ceiling.
 *   7. Evidence Engine™ copy: weight template interpolates from/to; generic
 *      template uses a humanized label and never implies a change the user
 *      didn't make.
 */

import { describe, it, expect } from 'vitest';
import {
  detectMajorChange,
  classifyProfileSave,
  ageBracketForBirthYear,
  initialConfidence,
  confidenceForObservations,
  explainMajorChange,
  type ProfileSnapshot,
} from '../adaptiveProfileEngine';
import {
  PROFILE_VERSION_TRIGGER,
  BASELINE_CONFIDENCE,
} from '../../config/hydroStateModel';

function snapshot(overrides: Partial<ProfileSnapshot> = {}): ProfileSnapshot {
  return {
    weightLbs: 200,
    heightCm: 180,
    birthYear: 1990,
    sex: 'male',
    activityLevel: 5,
    trainingLevel: 'Active',
    performanceGoal: 'Lean Performance',
    homeClimate: 'temperate',
    sleepSchedule: 'standard',
    sweatClassification: 'moderate',
    connectedWearables: [],
    ...overrides,
  };
}

describe('detectMajorChange', () => {
  it('treats an identical snapshot as no change (minor)', () => {
    const res = detectMajorChange(snapshot(), snapshot());
    expect(res.isMajor).toBe(false);
    expect(res.changedFields).toEqual([]);
  });

  it('flags a weight change at/above the trigger delta as major', () => {
    const delta = PROFILE_VERSION_TRIGGER.weightLbs as number;
    const res = detectMajorChange(
      snapshot({ weightLbs: 200 }),
      snapshot({ weightLbs: 200 + delta }),
    );
    expect(res.isMajor).toBe(true);
    expect(res.changedFields).toContain('weightLbs');
  });

  it('ignores a weight wobble below the trigger delta (minor)', () => {
    const delta = PROFILE_VERSION_TRIGGER.weightLbs as number;
    const res = detectMajorChange(
      snapshot({ weightLbs: 200 }),
      snapshot({ weightLbs: 200 + (delta - 1) }),
    );
    expect(res.isMajor).toBe(false);
  });

  it('treats a null→value transition as a change', () => {
    const res = detectMajorChange(
      snapshot({ weightLbs: null }),
      snapshot({ weightLbs: 180 }),
    );
    expect(res.changedFields).toContain('weightLbs');
  });

  it('treats null→null as no change', () => {
    const res = detectMajorChange(
      snapshot({ trainingLevel: null }),
      snapshot({ trainingLevel: null }),
    );
    expect(res.isMajor).toBe(false);
  });

  it('flags a categorical change (training level) exactly', () => {
    const res = detectMajorChange(
      snapshot({ trainingLevel: 'Active' }),
      snapshot({ trainingLevel: 'Elite' }),
    );
    expect(res.changedFields).toEqual(['trainingLevel']);
  });

  it('compares connected wearables as a set (order-independent)', () => {
    const same = detectMajorChange(
      snapshot({ connectedWearables: ['whoop', 'oura'] }),
      snapshot({ connectedWearables: ['oura', 'whoop'] }),
    );
    expect(same.isMajor).toBe(false);

    const added = detectMajorChange(
      snapshot({ connectedWearables: ['whoop'] }),
      snapshot({ connectedWearables: ['whoop', 'garmin'] }),
    );
    expect(added.changedFields).toContain('connectedWearables');
  });
});

describe('contract B — age bracket from passage of time', () => {
  it('does NOT mint a version when only the clock advanced (birthYear unchanged)', () => {
    // Same birthYear before and after — even though "today" differs, the
    // editable field is identical, so there is no change to record.
    const res = detectMajorChange(
      snapshot({ birthYear: 1995 }),
      snapshot({ birthYear: 1995 }),
    );
    expect(res.isMajor).toBe(false);
  });

  it('mints a version when the user actually edits birthYear (correction)', () => {
    const res = detectMajorChange(
      snapshot({ birthYear: 1995 }),
      snapshot({ birthYear: 1990 }),
    );
    expect(res.changedFields).toEqual(['birthYear']);
  });

  it('recomputes the bracket at read time across a boundary', () => {
    // A 1995-born user is 29 in 2024 and 30 in 2025 — bracket shifts with
    // the clock, with no profile edit and no version.
    expect(ageBracketForBirthYear(1995, new Date('2024-06-01'))).toBe('18_29');
    expect(ageBracketForBirthYear(1995, new Date('2025-06-01'))).toBe('30_39');
  });

  it('returns null for missing or implausible birth years', () => {
    expect(ageBracketForBirthYear(null)).toBeNull();
    expect(ageBracketForBirthYear(1700, new Date('2025-01-01'))).toBeNull();
  });
});

describe('baseline confidence lifecycle', () => {
  it('opens a first baseline higher than a post-recalibration baseline', () => {
    expect(initialConfidence(true)).toBe(BASELINE_CONFIDENCE.initialFirstBaseline);
    expect(initialConfidence(false)).toBe(
      BASELINE_CONFIDENCE.initialAfterRecalibration,
    );
    expect(initialConfidence(true)).toBeGreaterThan(initialConfidence(false));
  });

  it('ramps confidence by the per-observation gain', () => {
    const c0 = confidenceForObservations(0, false);
    const c2 = confidenceForObservations(2, false);
    expect(c0).toBe(BASELINE_CONFIDENCE.initialAfterRecalibration);
    expect(c2).toBeCloseTo(
      BASELINE_CONFIDENCE.initialAfterRecalibration +
        2 * BASELINE_CONFIDENCE.perObservationGain,
      5,
    );
  });

  it('clamps confidence at the ceiling no matter how many observations', () => {
    expect(confidenceForObservations(10_000, false)).toBe(
      BASELINE_CONFIDENCE.fullConfidenceCeiling,
    );
  });
});

describe('explainMajorChange (Evidence Engine™ copy)', () => {
  it('uses the weight template with interpolated from/to', () => {
    const msg = explainMajorChange(
      ['weightLbs'],
      snapshot({ weightLbs: 260 }),
      snapshot({ weightLbs: 248 }),
    );
    expect(msg).toContain('260');
    expect(msg).toContain('248');
    expect(msg).toMatch(/recalibrated/i);
  });

  it('falls back to the generic template with a humanized label', () => {
    const msg = explainMajorChange(
      ['sweatClassification'],
      snapshot(),
      snapshot({ sweatClassification: 'heavy' }),
    );
    expect(msg).toContain('sweat classification');
    expect(msg).not.toContain('{field}');
  });
});

describe('classifyProfileSave', () => {
  it('returns minor with no explanation when nothing major changed', () => {
    const decision = classifyProfileSave(snapshot(), snapshot());
    expect(decision.changeType).toBe('minor');
    expect(decision.explanation).toBe('');
    expect(decision.changedFields).toEqual([]);
  });

  it('returns major with an explanation and the next snapshot', () => {
    const next = snapshot({ weightLbs: 188 });
    const decision = classifyProfileSave(snapshot({ weightLbs: 200 }), next);
    expect(decision.changeType).toBe('major');
    expect(decision.changedFields).toContain('weightLbs');
    expect(decision.explanation.length).toBeGreaterThan(0);
    expect(decision.snapshot).toEqual(next);
  });
});
