import { describe, expect, it } from 'vitest';

import {
  CYCLE_OZ,
  computeHydrationDemand,
  TARGET_CEILING_OZ,
  TARGET_FLOOR_OZ,
  type HydrationDemandInputs,
} from '../hydrationDemandEngine';

const basePerson: HydrationDemandInputs = {
  weightLbs: 160,
  activityLevel: 2,
  sweatProfile: 'moderate',
  environmentProfile: 'mixed',
  heatC: 22,
  humidityPct: 50,
  sleepHours: 7.5,
  recoveryScore: 70,
  consumedOz: 0,
  completedCycles: 0,
};

describe('computeHydrationDemand', () => {
  it('produces a defensible baseline target for a moderate office worker', () => {
    const out = computeHydrationDemand(basePerson);
    // 160 * 0.5 = 80 baseline + 8 sweat moderate + 4 mixed env = 92.
    expect(out.targetOz).toBe(92);
    expect(out.remainingOz).toBe(92);
    expect(out.load).toBe('moderate');
  });

  it('classifies a near-baseline target as low load', () => {
    const out = computeHydrationDemand({
      ...basePerson,
      sweatProfile: 'low',
      environmentProfile: 'mostly_indoor',
    });
    // 80 baseline + 0 + 0 = 80. Over-baseline = 0 → low.
    expect(out.targetOz).toBe(80);
    expect(out.load).toBe('low');
  });

  it('classifies a hot, athletic day as high load', () => {
    const out = computeHydrationDemand({
      ...basePerson,
      activityLevel: 8,
      sweatProfile: 'very_high',
      environmentProfile: 'hot_climate',
      heatC: 35,
      humidityPct: 70,
    });
    expect(out.load).toBe('high');
    expect(out.targetOz).toBeGreaterThan(140);
    expect(out.targetOz).toBeLessThanOrEqual(TARGET_CEILING_OZ);
  });

  it('respects the floor for a tiny low-demand input', () => {
    const out = computeHydrationDemand({
      weightLbs: 50, // below clamp; will be raised to 60
      activityLevel: 0,
      sweatProfile: 'low',
      environmentProfile: 'mostly_indoor',
      heatC: 18,
      humidityPct: 30,
    });
    expect(out.targetOz).toBeGreaterThanOrEqual(TARGET_FLOOR_OZ);
  });

  it('respects the ceiling for an extreme input', () => {
    const out = computeHydrationDemand({
      weightLbs: 400,
      activityLevel: 10,
      sweatProfile: 'very_high',
      environmentProfile: 'hot_climate',
      heatC: 45,
      humidityPct: 95,
      sleepHours: 4,
      recoveryScore: 10,
    });
    expect(out.targetOz).toBeLessThanOrEqual(TARGET_CEILING_OZ);
  });

  it('subtracts consumed oz and cycle volume from remaining', () => {
    const out = computeHydrationDemand({
      ...basePerson,
      consumedOz: 20,
      completedCycles: 2,
    });
    expect(out.remainingOz).toBe(out.targetOz - 20 - 2 * CYCLE_OZ);
  });

  it('returns the target-met command when remaining drops to zero', () => {
    const out = computeHydrationDemand({
      ...basePerson,
      consumedOz: 999,
    });
    expect(out.remainingOz).toBe(0);
    expect(out.command).toBe('Hold steady — target met');
  });

  it('prefers a Water Cycle command when none completed yet', () => {
    const out = computeHydrationDemand(basePerson);
    expect(out.command).toBe('Complete 1 Water Cycle');
  });

  it('switches to "Drink 8 oz now" when remaining is over half the target', () => {
    const out = computeHydrationDemand({
      ...basePerson,
      consumedOz: 10,
      completedCycles: 1,
    });
    expect(out.command).toBe('Drink 8 oz now');
  });

  it('command and load strings never leak forbidden language', () => {
    const inputs: HydrationDemandInputs[] = [
      basePerson,
      { ...basePerson, sweatProfile: 'very_high', heatC: 38, activityLevel: 9 },
      { ...basePerson, consumedOz: 500 },
      { ...basePerson, recoveryScore: 15 },
    ];
    const forbidden =
      /\b(AI|engine|model|openai|claude|treats|prevents|cures|blood\s*(pressure|ph)|alkaline\s+bloodstream)\b/i;
    for (const i of inputs) {
      const out = computeHydrationDemand(i);
      expect(out.command).not.toMatch(forbidden);
      expect(out.load).not.toMatch(forbidden);
    }
  });

  it('is pure — identical inputs return identical outputs', () => {
    const a = computeHydrationDemand(basePerson);
    const b = computeHydrationDemand({ ...basePerson });
    expect(a).toEqual(b);
  });

  it('handles missing optional fields with safe defaults', () => {
    const minimal = computeHydrationDemand({
      weightLbs: 160,
      activityLevel: 2,
    });
    expect(minimal.targetOz).toBe(92);
    expect(minimal.load).toBe('moderate');
  });

  it('low sleep raises target by 5 oz', () => {
    const rested = computeHydrationDemand(basePerson);
    const sleepy = computeHydrationDemand({ ...basePerson, sleepHours: 4 });
    expect(sleepy.targetOz - rested.targetOz).toBe(5);
  });

  it('low recovery raises target by 6 oz; high recovery lowers it by 3', () => {
    const neutral = computeHydrationDemand(basePerson);
    const low = computeHydrationDemand({ ...basePerson, recoveryScore: 20 });
    const high = computeHydrationDemand({ ...basePerson, recoveryScore: 90 });
    expect(low.targetOz - neutral.targetOz).toBe(6);
    expect(neutral.targetOz - high.targetOz).toBe(3);
  });

  it('humidity only amplifies when heat is already elevated', () => {
    const coolHumid = computeHydrationDemand({
      ...basePerson,
      heatC: 22,
      humidityPct: 95,
    });
    const cool = computeHydrationDemand({ ...basePerson, heatC: 22, humidityPct: 30 });
    expect(coolHumid.targetOz).toBe(cool.targetOz);
  });
});
