import { describe, it, expect } from 'vitest';

import { calculateHangoverRisk, activeDecayMultiplier } from '../hangoverRisk';
import type { DrinkLog } from '../../types';

const T0 = new Date('2026-04-22T20:00:00Z').getTime();

function drink(type: DrinkLog['type'], offsetMin: number, hydrated: DrinkLog['hydrated'] = null): DrinkLog {
  return {
    id: `d-${type}-${offsetMin}`,
    type,
    loggedAt: new Date(T0 + offsetMin * 60_000),
    multiplier: 1,
    hydrated,
  };
}

describe('calculateHangoverRisk', () => {
  it('returns LOW with 0 drinks', () => {
    const r = calculateHangoverRisk({ drinks: [], now: T0 });
    expect(r.level).toBe('LOW');
    expect(r.score).toBe(0);
    expect(r.reasons).toHaveLength(0);
  });

  it('escalates to MODERATE/HIGH as drinks pile up without hydration', () => {
    const drinks = [
      drink('beer', 0, false),
      drink('beer', 15, false),
      drink('beer', 30, false),
    ];
    const r = calculateHangoverRisk({ drinks, now: T0 + 35 * 60_000 });
    expect(r.score).toBeGreaterThanOrEqual(25);
    expect(['MODERATE', 'HIGH']).toContain(r.level);
    expect(r.reasons).toContain('low_hydration_response');
  });

  it('flags strong_drinks for liquor/cocktail', () => {
    const drinks = [drink('cocktail', 0, true), drink('liquor', 30, true)];
    const r = calculateHangoverRisk({ drinks, now: T0 + 35 * 60_000 });
    expect(r.reasons).toContain('strong_drinks');
  });

  it('hits CRITICAL with many fast strong drinks + no hydration', () => {
    const drinks = [
      drink('liquor', 0, false),
      drink('cocktail', 12, false),
      drink('liquor', 25, false),
      drink('cocktail', 40, false),
      drink('liquor', 55, false),
    ];
    const r = calculateHangoverRisk({ drinks, now: T0 + 60 * 60_000, heatLoad: 8 });
    expect(r.level).toBe('CRITICAL');
    expect(r.reasons).toEqual(expect.arrayContaining(['high_drink_count', 'strong_drinks', 'low_hydration_response', 'fast_pacing', 'high_heat']));
  });

  it('lowers risk when the user hydrates after every drink', () => {
    const wet = [drink('beer', 0, true), drink('beer', 30, true), drink('wine', 60, true)];
    const dry = [drink('beer', 0, false), drink('beer', 30, false), drink('wine', 60, false)];
    const wetR = calculateHangoverRisk({ drinks: wet, now: T0 + 70 * 60_000 });
    const dryR = calculateHangoverRisk({ drinks: dry, now: T0 + 70 * 60_000 });
    expect(wetR.score).toBeLessThan(dryR.score);
  });

  it('weights lighter body mass more heavily', () => {
    const drinks = [drink('cocktail', 0, false), drink('cocktail', 20, false)];
    const heavy = calculateHangoverRisk({ drinks, bodyWeightLbs: 220, now: T0 + 25 * 60_000 });
    const light = calculateHangoverRisk({ drinks, bodyWeightLbs: 120, now: T0 + 25 * 60_000 });
    expect(light.score).toBeGreaterThan(heavy.score);
  });

  it('clamps to 0..100', () => {
    const insane = Array.from({ length: 30 }, (_, i) => drink('liquor', i * 5, false));
    const r = calculateHangoverRisk({ drinks: insane, now: T0 + 200 * 60_000, heatLoad: 10, bodyWeightLbs: 100 });
    expect(r.score).toBeLessThanOrEqual(100);
    expect(r.score).toBeGreaterThanOrEqual(0);
  });
});

describe('activeDecayMultiplier', () => {
  it('returns 1 when no drinks', () => {
    expect(activeDecayMultiplier([], T0)).toBe(1);
  });

  it('averages multipliers of in-window drinks', () => {
    const drinks = [drink('beer', 0), drink('cocktail', 5)];
    const m = activeDecayMultiplier(drinks, T0 + 10 * 60_000);
    expect(m).toBeCloseTo((1.15 + 1.30) / 2, 2);
  });

  it('drops drinks past their active window', () => {
    const drinks = [drink('beer', 0), drink('liquor', -50)];
    // beer logged at T0 is in-window at T0+10; liquor at T0-50 (50 min ago) is out.
    const m = activeDecayMultiplier(drinks, T0 + 10 * 60_000);
    expect(m).toBeCloseTo(1.15, 2);
  });

  it('returns 1 when all drinks have aged out', () => {
    const drinks = [drink('beer', -120), drink('wine', -90)];
    expect(activeDecayMultiplier(drinks, T0)).toBe(1);
  });
});
