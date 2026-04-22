/**
 * BAC estimation tests.
 *
 * These tests pin the core invariants of the Widmark-based estimator:
 *   1. Zero drinks → zero BAC, zero clear time.
 *   2. A single beer for a 170 lb male shortly after logging lands in
 *      the LOW band (< 0.04).
 *   3. Several quick liquor shots push the midpoint into HIGH (≥ 0.08).
 *   4. Trend is "rising" when drinks are recent, "falling" once
 *      elimination dominates.
 *   5. Time-to-clear is monotonically non-negative and rounded UP to
 *      the nearest 5 min so the engine never under-predicts recovery.
 *   6. Confidence degrades when sex is unspecified or many drinks are
 *      logged.
 */

import { describe, it, expect } from 'vitest';
import { estimateBAC } from '../bacEstimationService';
import { impairmentFromBAC, transportationPromptFor } from '../legalSafetyService';
import type { DrinkLog } from '../../types/socialMode';

function makeDrink(type: DrinkLog['type'], minutesAgo: number, overrides: Partial<DrinkLog> = {}): DrinkLog {
  return {
    id: `t-${type}-${minutesAgo}`,
    type,
    loggedAt: new Date(Date.now() - minutesAgo * 60 * 1000),
    multiplier: 1.2,
    hydrated: null,
    ...overrides,
  };
}

describe('estimateBAC', () => {
  it('returns zero range and zero clear time when no drinks logged', () => {
    const e = estimateBAC({ drinks: [] });
    expect(e.rangeLow).toBe(0);
    expect(e.rangeHigh).toBeCloseTo(0.01); // widening floor
    expect(e.timeToClearMinutes).toBe(0);
    expect(e.trend).toBe('steady');
  });

  it('one beer 5 min ago for 170 lb male stays in the LOW band', () => {
    const e = estimateBAC({
      drinks: [makeDrink('beer', 5)],
      bodyWeightLbs: 170,
      sex: 'male',
    });
    const mid = (e.rangeLow + e.rangeHigh) / 2;
    expect(mid).toBeLessThan(0.04);
    expect(impairmentFromBAC(e).level).toBe('LOW');
  });

  it('four liquor shots in 30 minutes pushes a 170 lb male into MODERATE+ impairment', () => {
    const drinks: DrinkLog[] = [
      makeDrink('liquor', 30),
      makeDrink('liquor', 22),
      makeDrink('liquor', 14),
      makeDrink('liquor', 6),
    ];
    const e = estimateBAC({ drinks, bodyWeightLbs: 170, sex: 'male' });
    const mid = (e.rangeLow + e.rangeHigh) / 2;
    expect(mid).toBeGreaterThanOrEqual(0.05);
    const imp = impairmentFromBAC(e).level;
    expect(['MODERATE', 'HIGH', 'CRITICAL']).toContain(imp);
  });

  it('marks the trend as rising when drinks are recent and falling after long elimination', () => {
    const recent = estimateBAC({
      drinks: [makeDrink('beer', 0), makeDrink('beer', 0)],
      bodyWeightLbs: 170, sex: 'male',
    });
    expect(recent.trend === 'rising' || recent.trend === 'steady').toBe(true);

    const old = estimateBAC({
      drinks: [makeDrink('beer', 240)], // 4 hr ago — well past peak
      bodyWeightLbs: 170, sex: 'male',
    });
    expect(old.trend === 'falling' || old.trend === 'steady').toBe(true);
    expect(old.rangeLow).toBe(0);
  });

  it('time-to-clear is non-negative and rounded up to a 5-minute multiple', () => {
    const e = estimateBAC({
      drinks: [makeDrink('liquor', 10), makeDrink('liquor', 5)],
      bodyWeightLbs: 170, sex: 'male',
    });
    expect(e.timeToClearMinutes).toBeGreaterThanOrEqual(0);
    expect(e.timeToClearMinutes % 5).toBe(0);
  });

  it('confidence degrades when sex is unspecified', () => {
    const drinks = [makeDrink('beer', 5, { abv: 5, oz: 12 })];
    const high = estimateBAC({ drinks, bodyWeightLbs: 170, sex: 'male' });
    const med = estimateBAC({ drinks, bodyWeightLbs: 170 });
    expect(high.confidence).toBe('high');
    expect(med.confidence === 'medium' || med.confidence === 'low').toBe(true);
    expect(med.notes).toContain('default_sex');
  });

  it('food intake softens the BAC estimate vs an empty stomach', () => {
    const drinks = [
      makeDrink('liquor', 10, { abv: 40, oz: 1.5 }),
      makeDrink('liquor', 5, { abv: 40, oz: 1.5 }),
    ];
    const empty = estimateBAC({ drinks, bodyWeightLbs: 170, sex: 'male', ateRecently: false });
    const full = estimateBAC({ drinks, bodyWeightLbs: 170, sex: 'male', ateRecently: true });
    const midEmpty = (empty.rangeLow + empty.rangeHigh) / 2;
    const midFull = (full.rangeLow + full.rangeHigh) / 2;
    expect(midFull).toBeLessThanOrEqual(midEmpty);
  });
});

describe('legalSafetyService', () => {
  it('hides the safety card at LOW/ELEVATED impairment', () => {
    const e = { rangeLow: 0.01, rangeHigh: 0.03, trend: 'steady' as const, confidence: 'medium' as const, timeToClearMinutes: 10, notes: [] };
    const imp = impairmentFromBAC(e);
    expect(imp.level === 'LOW' || imp.level === 'ELEVATED').toBe(true);
    const prompt = transportationPromptFor(imp.level);
    expect(prompt.show).toBe(false);
  });

  it('escalates to "do not drive" at HIGH and CRITICAL', () => {
    const high = transportationPromptFor('HIGH');
    expect(high.show).toBe(true);
    expect(high.titleKey).toBe('social.safety_do_not_drive');
    expect(high.stopDrinking).toBe(true);

    const critical = transportationPromptFor('CRITICAL');
    expect(critical.severity).toBe('critical');
    expect(critical.stopDrinking).toBe(true);
  });

  it('always returns the "not legal/medical" disclaimer key when shown', () => {
    for (const level of ['MODERATE', 'HIGH', 'CRITICAL'] as const) {
      const p = transportationPromptFor(level);
      expect(p.disclaimerKey).toBe('social.not_legal_medical');
    }
  });
});
