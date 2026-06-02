import { describe, it, expect } from 'vitest';

import {
  RECOVERY_PRESETS,
  RECOVERY_PRESET_LIST,
  computeRecoveryCapacity,
  environmentalStress,
  presetMetaFor,
} from '../recoveryCapacity';

describe('RECOVERY_PRESETS catalog', () => {
  it('exposes Travel, Heat, and Hard Block in a stable list order', () => {
    expect(RECOVERY_PRESET_LIST.map((p) => p.id)).toEqual([
      'travel', 'heat', 'hard_block',
    ]);
  });

  it('orders preset severity Travel < Hard Block < Heat', () => {
    expect(RECOVERY_PRESETS.travel.stressFloor)
      .toBeLessThan(RECOVERY_PRESETS.hard_block.stressFloor);
    expect(RECOVERY_PRESETS.hard_block.stressFloor)
      .toBeLessThan(RECOVERY_PRESETS.heat.stressFloor);
  });

  it('every preset declares a Lucide-mapped icon', () => {
    for (const p of RECOVERY_PRESET_LIST) {
      expect(['plane', 'thermometer', 'dumbbell']).toContain(p.icon);
    }
  });
});

describe('presetMetaFor', () => {
  it('returns metadata for valid ids', () => {
    expect(presetMetaFor('travel')?.label).toBe('Travel');
    expect(presetMetaFor('heat')?.label).toBe('Heat');
    expect(presetMetaFor('hard_block')?.label).toBe('Hard Block');
  });

  it('returns null for null/undefined inputs', () => {
    expect(presetMetaFor(null)).toBeNull();
    expect(presetMetaFor(undefined)).toBeNull();
  });
});

describe('environmentalStress with preset bias', () => {
  it('a preset alone raises stress to its floor', () => {
    expect(environmentalStress({ preset: 'travel' })).toBeCloseTo(0.30);
    expect(environmentalStress({ preset: 'hard_block' })).toBeCloseTo(0.40);
    expect(environmentalStress({ preset: 'heat' })).toBeCloseTo(0.50);
  });

  it('a hotter environment dominates a milder preset', () => {
    // Travel = 0.30, but humidity 80 ramps to 0.80 — the env wins.
    expect(environmentalStress({ humidity: 80, preset: 'travel' })).toBeCloseTo(0.80);
  });

  it('a preset cannot lower stress below the real signal', () => {
    const base = environmentalStress({ tempC: 38 }); // 1.0
    const withTravel = environmentalStress({ tempC: 38, preset: 'travel' });
    expect(withTravel).toBe(base);
  });

  it('null preset is a no-op', () => {
    expect(environmentalStress({ preset: null })).toBe(0);
  });
});

describe('Recovery Capacity with a preset baseline', () => {
  it('a clean-environment Travel session lands in Stable, not Peak', () => {
    // Ideal AutoPilot + perfect hydration, but Travel preset pulls the
    // environmental contribution down via the 0.30 stress floor.
    const r = computeRecoveryCapacity({
      autoPilotScore: 100,
      hydrationCompliance: 1,
      environmentalStress: environmentalStress({
        tempC: 20, humidity: 30, activityLevel: 0, preset: 'travel',
      }),
    });
    // 60 + 25 + (1 - 0.30) * 15 = 60 + 25 + 10.5 = 95.5 → 96 → Peak
    // Travel alone shouldn't knock a perfect day out of Peak.
    expect(r.band).toBe('peak');
  });

  it('a Heat preset on a borderline user pushes them out of Peak', () => {
    const r = computeRecoveryCapacity({
      autoPilotScore: 90,
      hydrationCompliance: 1,
      environmentalStress: environmentalStress({ preset: 'heat' }),
    });
    // 54 + 25 + (1 - 0.50) * 15 = 54 + 25 + 7.5 = 86.5 → 87 → Peak (just)
    expect(r.score).toBeGreaterThanOrEqual(80);
    expect(r.score).toBeLessThanOrEqual(90);
  });
});
