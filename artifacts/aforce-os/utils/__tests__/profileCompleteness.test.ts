/**
 * Section 55 — Profile Completeness™ resolver.
 *
 * Asserts the pure completeness measure: an all-unset profile is 'sparse' with
 * ratio 0, a fully-filled profile is 'rich', "never require every field" holds
 * (rich strictly below 100%), the unset sentinels are honored per field
 * (null / 'unspecified'), activityLevel 0 counts as provided, and the layer is
 * a pure qualifier that touches no score.
 */
import { describe, it, expect } from 'vitest';
import { DEFAULT_PROFILE_IDENTITY, type ProfileIdentity } from '../profileIdentity';
import {
  assessProfileCompleteness,
  PROFILE_IDENTITY_FIELDS,
  RICH_MIN_RATIO,
  PARTIAL_MIN_RATIO,
  type ProfileFieldDescriptor,
} from '../profile/profileCompleteness';

/** A profile with every ProfileIdentity completeness field filled with a real value. */
const FULLY_FILLED: ProfileIdentity = {
  ...DEFAULT_PROFILE_IDENTITY,
  bodyWeightLbs: 180,
  heightCm: 178,
  birthYear: 1990,
  biologicalSex: 'male',
  activityLevel: 6,
  trainingLevel: 'Active',
  primaryGoal: 'Recovery Optimization',
  sweatClassification: 'moderate',
  goalWeightLbs: 175,
};

const TOTAL = PROFILE_IDENTITY_FIELDS.length;

describe('Section 55 — assessProfileCompleteness', () => {
  it('an all-unset (default) profile is sparse with ratio 0 and nothing filled', () => {
    const r = assessProfileCompleteness(DEFAULT_PROFILE_IDENTITY);
    expect(r.filledCount).toBe(0);
    expect(r.totalFields).toBe(TOTAL);
    expect(r.ratio).toBe(0);
    expect(r.level).toBe('sparse');
    expect(r.fields.every((f) => f.present === false)).toBe(true);
  });

  it('a fully-filled profile is rich with ratio 1 and every field present', () => {
    const r = assessProfileCompleteness(FULLY_FILLED);
    expect(r.filledCount).toBe(TOTAL);
    expect(r.ratio).toBe(1);
    expect(r.level).toBe('rich');
    expect(r.fields.every((f) => f.present)).toBe(true);
  });

  it('"never require every field": rich is reached strictly below 100%', () => {
    // Drop exactly one field from a full profile → still rich (as long as ≥ 80%).
    const oneMissing: ProfileIdentity = { ...FULLY_FILLED, goalWeightLbs: null };
    const r = assessProfileCompleteness(oneMissing);
    expect(r.ratio).toBeLessThan(1);
    expect(r.ratio).toBeGreaterThanOrEqual(RICH_MIN_RATIO);
    expect(r.level).toBe('rich');
    expect(RICH_MIN_RATIO).toBeLessThan(1);
  });

  it('bands map to the locked thresholds', () => {
    // sparse: below PARTIAL_MIN_RATIO
    const sparse: ProfileIdentity = { ...DEFAULT_PROFILE_IDENTITY, bodyWeightLbs: 180 };
    expect(assessProfileCompleteness(sparse).ratio).toBeLessThan(PARTIAL_MIN_RATIO);
    expect(assessProfileCompleteness(sparse).level).toBe('sparse');
    // partial: between the two thresholds (half the fields)
    const half: ProfileIdentity = {
      ...DEFAULT_PROFILE_IDENTITY,
      bodyWeightLbs: 180, heightCm: 178, birthYear: 1990, biologicalSex: 'female',
    };
    const hr = assessProfileCompleteness(half);
    expect(hr.ratio).toBeGreaterThanOrEqual(PARTIAL_MIN_RATIO);
    expect(hr.ratio).toBeLessThan(RICH_MIN_RATIO);
    expect(hr.level).toBe('partial');
  });

  it("honors each field's own unset sentinel (null vs 'unspecified')", () => {
    // biologicalSex 'unspecified' is the unset default → not present.
    const unspecSex: ProfileIdentity = { ...FULLY_FILLED, biologicalSex: 'unspecified' };
    const byKey = (k: string) =>
      assessProfileCompleteness(unspecSex).fields.find((f) => f.key === k)!;
    expect(byKey('biologicalSex').present).toBe(false);
    // all other fields still present
    expect(byKey('bodyWeightLbs').present).toBe(true);
  });

  it('activityLevel 0 (sedentary) counts as provided, not unset', () => {
    const sedentary: ProfileIdentity = { ...DEFAULT_PROFILE_IDENTITY, activityLevel: 0 };
    const field = assessProfileCompleteness(sedentary).fields.find((f) => f.key === 'activityLevel')!;
    expect(field.present).toBe(true);
  });

  it('non-positive / non-finite numeric fields are treated as unset', () => {
    const bad: ProfileIdentity = {
      ...FULLY_FILLED,
      bodyWeightLbs: 0,
      heightCm: -5,
      goalWeightLbs: Number.NaN as unknown as number,
    };
    const present = (k: string) =>
      assessProfileCompleteness(bad).fields.find((f) => f.key === k)!.present;
    expect(present('bodyWeightLbs')).toBe(false);
    expect(present('heightCm')).toBe(false);
    expect(present('goalWeightLbs')).toBe(false);
  });

  it('is extensible: an empty descriptor list yields sparse/0, never a crash', () => {
    const r = assessProfileCompleteness(FULLY_FILLED, []);
    expect(r.totalFields).toBe(0);
    expect(r.ratio).toBe(0);
    expect(r.level).toBe('sparse');
    expect(r.fields).toEqual([]);
  });

  it('respects a custom descriptor group (extension point for cross-slice fields)', () => {
    const custom: ProfileFieldDescriptor[] = [
      { key: 'weightOnly', present: (p) => p.bodyWeightLbs != null },
    ];
    expect(assessProfileCompleteness(FULLY_FILLED, custom).level).toBe('rich');
    expect(assessProfileCompleteness(DEFAULT_PROFILE_IDENTITY, custom).level).toBe('sparse');
  });

  it('is a pure qualifier — it returns only completeness fields, never a score/band/color', () => {
    const r = assessProfileCompleteness(FULLY_FILLED);
    expect(Object.keys(r).sort()).toEqual(
      ['fields', 'filledCount', 'level', 'ratio', 'totalFields'].sort(),
    );
  });

  it('projects the exact 9 field keys, in descriptor order (pins identity + order)', () => {
    // Guards against a key typo or a descriptor reordering — the Step-2 Data
    // Confidence adapter will match on these exact strings.
    expect(assessProfileCompleteness(FULLY_FILLED).fields.map((f) => f.key)).toEqual([
      'bodyWeightLbs', 'heightCm', 'birthYear', 'biologicalSex', 'activityLevel',
      'trainingLevel', 'primaryGoal', 'sweatClassification', 'goalWeightLbs',
    ]);
  });

  it('activityLevel non-finite (NaN / Infinity) is unset — pins the finite guard', () => {
    for (const bad of [Number.NaN, Infinity, -Infinity]) {
      const p: ProfileIdentity = { ...DEFAULT_PROFILE_IDENTITY, activityLevel: bad };
      const field = assessProfileCompleteness(p).fields.find((f) => f.key === 'activityLevel')!;
      // soft → each value is proven independently, not short-circuited at NaN
      expect.soft(field.present, `activityLevel=${bad}`).toBe(false);
    }
  });

  it('birthYear non-finite / non-positive is unset (all four positiveNumber fields covered)', () => {
    for (const bad of [Infinity, -1990, 0, Number.NaN]) {
      const p: ProfileIdentity = { ...FULLY_FILLED, birthYear: bad as unknown as number };
      const field = assessProfileCompleteness(p).fields.find((f) => f.key === 'birthYear')!;
      expect.soft(field.present, `birthYear=${bad}`).toBe(false);
    }
  });
});

// Custom descriptor groups sized to land ratios EXACTLY on the locked
// thresholds — the 9-field group can't hit 0.8 or 0.34 exactly, but the
// generic resolver (and the Step-2 adapter) can, so pin the >= edges here.
describe('Section 55 — threshold edges are exact (>= not >)', () => {
  /** N trivial descriptors, the first `filled` present. */
  function makeDescriptors(total: number, filled: number): ProfileFieldDescriptor[] {
    return Array.from({ length: total }, (_, i) => ({
      key: `f${i}`,
      present: () => i < filled,
    }));
  }
  const levelOf = (total: number, filled: number) =>
    assessProfileCompleteness(DEFAULT_PROFILE_IDENTITY, makeDescriptors(total, filled));

  it('ratio exactly RICH_MIN_RATIO (0.80) is rich, not partial', () => {
    const r = levelOf(5, 4); // 4/5 = 0.80
    expect(r.ratio).toBe(RICH_MIN_RATIO);
    expect(r.level).toBe('rich');
  });

  it('ratio exactly PARTIAL_MIN_RATIO (0.34) is partial, not sparse', () => {
    const r = levelOf(50, 17); // 17/50 = 0.34
    expect(r.ratio).toBe(PARTIAL_MIN_RATIO);
    expect(r.level).toBe('partial');
  });

  it('the 0.79 / 0.80 boundary pair splits partial → rich', () => {
    expect(levelOf(100, 79).level).toBe('partial'); // 0.79
    expect(levelOf(100, 80).level).toBe('rich');    // 0.80
  });

  it('the 0.33 / 0.34 boundary pair splits sparse → partial', () => {
    expect(levelOf(100, 33).level).toBe('sparse');  // 0.33
    expect(levelOf(100, 34).level).toBe('partial'); // 0.34
  });
});
