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
});
