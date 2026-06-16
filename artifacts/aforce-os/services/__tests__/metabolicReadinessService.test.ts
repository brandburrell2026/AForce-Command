/**
 * Metabolic Readiness service — normalization + derivation contract.
 *
 * Pins the owner-approved raw → normalized mappings (HRV ms, sleep hours,
 * workout load → 0–100) and proves the service stays a read-only projection
 * (it never mutates the biometrics it reads).
 */
import { describe, it, expect } from 'vitest';
import {
  normalizeHrvMs,
  normalizeSleepHours,
  deriveWorkoutFatigue,
  selectFreshestHrvMs,
  selectMaxWorkoutMinutes,
  selectMaxStrain,
  deriveMetabolicReadiness,
} from '../metabolicReadinessService';
import type { ProviderBiometrics } from '../../types/biometrics';

describe('normalizeHrvMs — provisional fixed curve (20ms→0, 70ms→100)', () => {
  it('anchors and midpoint', () => {
    expect(normalizeHrvMs(20)).toBe(0);
    expect(normalizeHrvMs(70)).toBe(100);
    expect(normalizeHrvMs(45)).toBe(50);
  });
  it('clamps out-of-range', () => {
    expect(normalizeHrvMs(5)).toBe(0);
    expect(normalizeHrvMs(120)).toBe(100);
  });
  it('missing ⇒ undefined (term drops, no penalty)', () => {
    expect(normalizeHrvMs(null)).toBeUndefined();
    expect(normalizeHrvMs(undefined)).toBeUndefined();
    expect(normalizeHrvMs(NaN)).toBeUndefined();
  });
});

describe('normalizeSleepHours — 7–9h optimal plateau', () => {
  it('optimal window = 100', () => {
    expect(normalizeSleepHours(7)).toBe(100);
    expect(normalizeSleepHours(8)).toBe(100);
    expect(normalizeSleepHours(9)).toBe(100);
  });
  it('band anchors', () => {
    expect(normalizeSleepHours(6)).toBe(70);
    expect(normalizeSleepHours(4)).toBe(30);
    expect(normalizeSleepHours(0)).toBe(0);
    expect(normalizeSleepHours(10)).toBe(90); // gentle oversleep decline
  });
  it('missing ⇒ undefined (cognitive needs-more-data)', () => {
    expect(normalizeSleepHours(null)).toBeUndefined();
    expect(normalizeSleepHours(undefined)).toBeUndefined();
  });
});

describe('deriveWorkoutFatigue — buckets none/light/moderate/hard/extreme', () => {
  it('workout minutes buckets', () => {
    expect(deriveWorkoutFatigue(95, null)).toBe(100); // extreme
    expect(deriveWorkoutFatigue(60, null)).toBe(75); // hard
    expect(deriveWorkoutFatigue(30, null)).toBe(50); // moderate
    expect(deriveWorkoutFatigue(10, null)).toBe(25); // light
  });
  it('strain wins when larger', () => {
    expect(deriveWorkoutFatigue(10, 19)).toBe(100); // strain all-out beats light minutes
  });
  it('no signal ⇒ undefined (rest day, math treats as 0)', () => {
    expect(deriveWorkoutFatigue(0, null)).toBeUndefined();
    expect(deriveWorkoutFatigue(null, null)).toBeUndefined();
  });
});

describe('biometrics selectors', () => {
  const bio: ProviderBiometrics = {
    apple_health: { providerId: 'apple_health', hrvSdnn: 40, workoutMinutesToday: 20, strain: 8, fetchedAt: 100 },
    whoop: { providerId: 'whoop', hrvSdnn: 55, workoutMinutesToday: 45, strain: 14, fetchedAt: 200 },
  } as unknown as ProviderBiometrics;

  it('HRV = freshest (highest fetchedAt) wins', () => {
    expect(selectFreshestHrvMs(bio)).toBe(55);
  });
  it('workout minutes + strain = max across providers', () => {
    expect(selectMaxWorkoutMinutes(bio)).toBe(45);
    expect(selectMaxStrain(bio)).toBe(14);
  });
  it('undefined biometrics ⇒ null', () => {
    expect(selectFreshestHrvMs(undefined)).toBeNull();
    expect(selectMaxWorkoutMinutes(undefined)).toBeNull();
    expect(selectMaxStrain(undefined)).toBeNull();
  });
});

describe('deriveMetabolicReadiness — end-to-end projection', () => {
  it('full signals → both scored, lastUpdated echoes caller clock', () => {
    const snap = deriveMetabolicReadiness({
      hydrationScore: 90,
      recoveryCapacity: 80,
      sleepHours: 8, // → 100
      hrvMs: 70, // → 100
      workoutMinutes: 30, // → fatigue 50
      strain: null,
      nowMs: 123456,
    });
    // muscle = round(0.4*90 + 0.4*80 + 0.2*(100−50)) = 78
    expect(snap.muscleReadiness).toEqual({ hasEnoughData: true, score: 78, band: 'BALANCED' });
    // cognitive = round(0.35*90 + 0.40*100 + 0.25*100) = round(96.5) = 97
    expect(snap.cognitiveReadiness).toEqual({ hasEnoughData: true, score: 97, band: 'PEAK' });
    expect(snap.hasEnoughData).toBe(true);
    expect(snap.lastUpdated).toBe(123456);
  });

  it('no signals → both insufficient, hasEnoughData false', () => {
    const snap = deriveMetabolicReadiness({
      hydrationScore: null,
      recoveryCapacity: null,
      sleepHours: null,
      hrvMs: null,
      workoutMinutes: null,
      strain: null,
      nowMs: 1,
    });
    expect(snap.muscleReadiness.hasEnoughData).toBe(false);
    expect(snap.cognitiveReadiness.hasEnoughData).toBe(false);
    expect(snap.hasEnoughData).toBe(false);
  });
});

describe('Score Protection — service never mutates the biometrics it reads', () => {
  it('frozen biometrics survive every selector + derivation byte-for-byte', () => {
    const deepFreeze = <T>(o: T): T => {
      if (o && typeof o === 'object') {
        Object.values(o as Record<string, unknown>).forEach(deepFreeze);
        Object.freeze(o);
      }
      return o;
    };
    const bio = deepFreeze({
      whoop: { providerId: 'whoop', hrvSdnn: 55, sleepHoursLastNight: 8, workoutMinutesToday: 45, strain: 14, fetchedAt: 200 },
    }) as unknown as ProviderBiometrics;

    const before = JSON.stringify(bio);
    selectFreshestHrvMs(bio);
    selectMaxWorkoutMinutes(bio);
    selectMaxStrain(bio);
    deriveMetabolicReadiness({
      hydrationScore: 88,
      recoveryCapacity: 74,
      sleepHours: 8,
      hrvMs: selectFreshestHrvMs(bio),
      workoutMinutes: selectMaxWorkoutMinutes(bio),
      strain: selectMaxStrain(bio),
      nowMs: 0,
    });
    expect(JSON.stringify(bio)).toBe(before);
  });
});
