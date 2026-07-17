/**
 * Section 55 Step 2 — Profile Completeness → Data Confidence.
 *
 * Pins the science ruling: completeness is self-report, capped at `partial`,
 * NEVER `verified`; and — enforced by the resolver's arithmetic, not by
 * convention — completeness alone can never lift a data-confidence read to
 * `high`. Its ceiling standing alone is `medium`.
 */
import { describe, it, expect } from 'vitest';
import { DEFAULT_PROFILE_IDENTITY, type ProfileIdentity } from '../profileIdentity';
import {
  assessDataConfidence,
  HIGH_MIN_VERIFIED,
  type DataSignalInput,
} from '../confidence/dataConfidence';
import {
  profileCompletenessQuality,
  profileCompletenessSignal,
  withProfileCompleteness,
  PROFILE_COMPLETENESS_SIGNAL_KEY,
} from '../profile/profileCompletenessConfidence';

const RICH: ProfileIdentity = {
  ...DEFAULT_PROFILE_IDENTITY,
  bodyWeightLbs: 180, heightCm: 178, birthYear: 1990, biologicalSex: 'male',
  activityLevel: 6, trainingLevel: 'Active', primaryGoal: 'Recovery Optimization',
  sweatClassification: 'moderate', goalWeightLbs: 175,
};
const PARTIAL: ProfileIdentity = {
  ...DEFAULT_PROFILE_IDENTITY,
  bodyWeightLbs: 180, heightCm: 178, birthYear: 1990, biologicalSex: 'female',
};
const SPARSE: ProfileIdentity = DEFAULT_PROFILE_IDENTITY;

const verified = (key: string): DataSignalInput => ({ key, quality: 'verified' });

describe('Section 55 Step 2 — profileCompletenessQuality mapping', () => {
  it('maps bands: sparse→estimated, partial→partial, rich→partial', () => {
    expect(profileCompletenessQuality('sparse')).toBe('estimated');
    expect(profileCompletenessQuality('partial')).toBe('partial');
    expect(profileCompletenessQuality('rich')).toBe('partial');
  });

  it('NEVER returns verified — a rich (fully self-reported) profile caps at partial', () => {
    expect(profileCompletenessQuality('rich')).not.toBe('verified');
    for (const level of ['sparse', 'partial', 'rich'] as const) {
      expect(profileCompletenessQuality(level)).not.toBe('verified');
    }
  });
});

describe('Section 55 Step 2 — profileCompletenessSignal', () => {
  it('carries the stable key and the mapped quality per profile state', () => {
    expect(profileCompletenessSignal(SPARSE)).toEqual({ key: PROFILE_COMPLETENESS_SIGNAL_KEY, quality: 'estimated' });
    expect(profileCompletenessSignal(PARTIAL)).toEqual({ key: PROFILE_COMPLETENESS_SIGNAL_KEY, quality: 'partial' });
    expect(profileCompletenessSignal(RICH)).toEqual({ key: PROFILE_COMPLETENESS_SIGNAL_KEY, quality: 'partial' });
  });

  it('never emits a verified signal for ANY profile (the cap, at the signal level)', () => {
    for (const p of [SPARSE, PARTIAL, RICH]) {
      expect(profileCompletenessSignal(p).quality).not.toBe('verified');
    }
  });
});

describe('Section 55 Step 2 — withProfileCompleteness (opt-in composition)', () => {
  it('appends the completeness signal without mutating the input array', () => {
    const base: DataSignalInput[] = [verified('wearable')];
    const composed = withProfileCompleteness(base, RICH);
    expect(base).toHaveLength(1); // input untouched
    expect(composed).toHaveLength(2);
    expect(composed[composed.length - 1].key).toBe(PROFILE_COMPLETENESS_SIGNAL_KEY);
  });
});

describe('Section 55 Step 2 — Score-Protection: completeness can never reach high', () => {
  it('a rich profile ALONE resolves to medium, never high', () => {
    const r = assessDataConfidence([profileCompletenessSignal(RICH)]);
    expect(r.level).toBe('medium');
    expect(r.level).not.toBe('high');
  });

  it('rich completeness + ONE verified sensor is still medium (needs 2 verified for high)', () => {
    // completeness contributes partial, not a 2nd verified → verifiedCount stays 1
    const r = assessDataConfidence(withProfileCompleteness([verified('wearable')], RICH));
    expect(r.verifiedCount).toBe(1);
    expect(r.level).toBe('medium');
  });

  it('completeness never supplies the marginal verified signal — 1 sensor + any profile stays below high', () => {
    for (const p of [SPARSE, PARTIAL, RICH]) {
      const r = assessDataConfidence(withProfileCompleteness([verified('wearable')], p));
      expect(r.verifiedCount, `profile via one sensor`).toBeLessThan(HIGH_MIN_VERIFIED);
      expect(r.level).not.toBe('high');
    }
  });

  it('does not interfere when real sensors already earn high (2 verified → high, completeness rides along)', () => {
    const r = assessDataConfidence(withProfileCompleteness([verified('wearable'), verified('hydroscan')], RICH));
    expect(r.level).toBe('high');
  });

  it('a sparse profile never downgrades an already-high read (adds an estimated, band holds)', () => {
    const r = assessDataConfidence(withProfileCompleteness([verified('wearable'), verified('hydroscan')], SPARSE));
    expect(r.level).toBe('high');
    expect(r.estimatedCount).toBe(1); // the sparse completeness signal
  });
});
