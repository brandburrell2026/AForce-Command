/**
 * depletionRate — exhaustive coverage for the physiologically
 * grounded hydration decay model.
 *
 * Pins down anchor scenarios (sedentary office, athlete in heat,
 * sleeping adult, etc.) so any future tweak to the constants is
 * either a deliberate calibration change or caught immediately.
 *
 * Source physiology references are documented in `depletionRate.ts`.
 */

import { describe, it, expect } from 'vitest';
import {
  RESTING_BASELINE_PER_MIN,
  ACTIVITY_PER_LEVEL,
  HEAT_AMPLIFICATION_PER_10C,
  HUMIDITY_AMPLIFICATION_FACTOR,
  SLEEP_MULTIPLIER,
  CLUTCH_MULTIPLIER,
  REFERENCE_WEIGHT_LBS,
  MIN_WEIGHT_LBS,
  THERMONEUTRAL_C,
  HUMIDITY_NEUTRAL_PCT,
  heatLoadToTempC,
  heatMultiplier,
  humidityAmplification,
  depletionRatePerMinute,
} from '../depletionRate';

const baseline = (over: Parameters<typeof depletionRatePerMinute>[0] = {}) => ({
  bodyWeightLbs: 150,
  activityLevel: 0,
  weatherTempC: 25,
  weatherHumidity: 50,
  isAwake: true,
  clutchActive: false,
  socialDecayMultiplier: 1,
  ...over,
});

// ─── Constants & exports ─────────────────────────────────────────
describe('exported constants — physiological calibration', () => {
  it('resting baseline is ~0.083 pts/min ≈ 5 pts/hr', () => {
    expect(RESTING_BASELINE_PER_MIN).toBeCloseTo(0.083, 3);
  });
  it('activity factor is 0.125 pts/min per level', () => {
    expect(ACTIVITY_PER_LEVEL).toBe(0.125);
  });
  it('reference weight is 150 lb', () => {
    expect(REFERENCE_WEIGHT_LBS).toBe(150);
  });
  it('weight floor is 60 lb (child boundary, prevents zero)', () => {
    expect(MIN_WEIGHT_LBS).toBe(60);
  });
  it('thermoneutral anchor is 25 °C', () => {
    expect(THERMONEUTRAL_C).toBe(25);
  });
  it('humidity neutral anchor is 50 % RH', () => {
    expect(HUMIDITY_NEUTRAL_PCT).toBe(50);
  });
  it('sleep multiplier is 0.5', () => expect(SLEEP_MULTIPLIER).toBe(0.5));
  it('clutch multiplier is 1.3', () => expect(CLUTCH_MULTIPLIER).toBe(1.3));
});

// ─── heatLoadToTempC fallback ────────────────────────────────────
describe('heatLoadToTempC — back-fill axis', () => {
  it('heatLoad 0 → 20 °C (cool morning)', () => expect(heatLoadToTempC(0)).toBe(20));
  it('heatLoad 5 → 26 °C (warm afternoon)', () => expect(heatLoadToTempC(5)).toBe(26));
  it('heatLoad 10 → 32 °C (peak summer)', () => expect(heatLoadToTempC(10)).toBe(32));
  it('clamps below 0 (treated as 0)', () => expect(heatLoadToTempC(-3)).toBe(20));
  it('clamps above 10 (treated as 10)', () => expect(heatLoadToTempC(15)).toBe(32));
});

// ─── heatMultiplier ──────────────────────────────────────────────
describe('heatMultiplier — sweat amplification by temperature', () => {
  it('thermoneutral (25 °C) returns 1.0 (no amplification)', () => {
    expect(heatMultiplier(25)).toBe(1);
  });
  it('cool (15 °C) returns 1.0 (clamped, no negative amplification)', () => {
    expect(heatMultiplier(15)).toBe(1);
  });
  it('30 °C ≈ 1.30 (~30 % more sweat)', () => {
    expect(heatMultiplier(30)).toBeCloseTo(1.3, 5);
  });
  it('35 °C ≈ 1.60 (~60 % more sweat) — matches ACSM "doubles at 35"', () => {
    expect(heatMultiplier(35)).toBeCloseTo(1.6, 5);
  });
  it('40 °C ≈ 1.90', () => expect(heatMultiplier(40)).toBeCloseTo(1.9, 5));
  it('45 °C ≈ 2.20', () => expect(heatMultiplier(45)).toBeCloseTo(2.2, 5));
  it('extreme 50 °C ≈ 2.50 (still finite, monotonic)', () => {
    expect(heatMultiplier(50)).toBeCloseTo(2.5, 5);
  });
  it('monotonically non-decreasing across the realistic range', () => {
    let prev = -Infinity;
    for (let t = -10; t <= 50; t += 1) {
      const m = heatMultiplier(t);
      expect(m).toBeGreaterThanOrEqual(prev);
      prev = m;
    }
  });
});

// ─── humidityAmplification ───────────────────────────────────────
describe('humidityAmplification — heat-coupled humidity penalty', () => {
  it('humidity ≤ 50 % returns 1.0 regardless of temperature', () => {
    expect(humidityAmplification(50, heatMultiplier(35))).toBe(1);
    expect(humidityAmplification(30, heatMultiplier(40))).toBe(1);
    expect(humidityAmplification(0, heatMultiplier(45))).toBe(1);
  });
  it('humidity at 100 % in COOL weather has NO effect (heatMul=1, heatPremium=0)', () => {
    expect(humidityAmplification(100, 1)).toBe(1);
    expect(humidityAmplification(100, heatMultiplier(20))).toBe(1);
  });
  it('high humidity (80 %) at 35 °C amplifies (~1.18×)', () => {
    const heatMul = heatMultiplier(35); // 1.6
    // humidExcess = (80-50)/50 = 0.6, heatPremium = 0.6, factor = 0.5
    // 1 + 0.6 × 0.6 × 0.5 = 1.18
    expect(humidityAmplification(80, heatMul)).toBeCloseTo(1.18, 5);
  });
  it('100 % RH at 35 °C amplifies (~1.30×)', () => {
    const heatMul = heatMultiplier(35);
    // 1 + 1.0 × 0.6 × 0.5 = 1.30
    expect(humidityAmplification(100, heatMul)).toBeCloseTo(1.3, 5);
  });
  it('100 % RH at 45 °C amplifies (~1.60×)', () => {
    const heatMul = heatMultiplier(45); // 2.2
    // 1 + 1.0 × 1.2 × 0.5 = 1.60
    expect(humidityAmplification(100, heatMul)).toBeCloseTo(1.6, 5);
  });
  it('uses HUMIDITY_AMPLIFICATION_FACTOR exactly', () => {
    // Sanity: changing the constant should propagate
    const heatMul = heatMultiplier(35);
    const expected = 1 + 1.0 * (heatMul - 1) * HUMIDITY_AMPLIFICATION_FACTOR;
    expect(humidityAmplification(100, heatMul)).toBeCloseTo(expected, 10);
  });
});

// ─── depletionRatePerMinute — anchor scenarios ───────────────────
describe('depletionRatePerMinute — physiological anchor scenarios', () => {
  it('sedentary 150 lb, 25 °C, 50 % RH → 0.083 pts/min ≈ 5 pts/hr (8 hr to deplete from 100→60)', () => {
    const rate = depletionRatePerMinute(baseline());
    expect(rate).toBeCloseTo(0.083, 3);
    const hoursToDepleted = 40 / (rate * 60);
    expect(hoursToDepleted).toBeGreaterThan(7);
    expect(hoursToDepleted).toBeLessThan(9);
  });

  it('office worker (activity 2), 25 °C, 50 % RH → ~20 pts/hr (PEAK→RECOVERING in ~75 min)', () => {
    const rate = depletionRatePerMinute(baseline({ activityLevel: 2 }));
    // base 0.083 + activity 0.25 = 0.333 pts/min = 19.98 pts/hr
    expect(rate).toBeCloseTo(0.333, 3);
    const minToRecovering = 25 / rate; // PEAK midpoint 95 → RECOVERING 70 = 25 pts
    expect(minToRecovering).toBeGreaterThan(60);
    expect(minToRecovering).toBeLessThan(90);
  });

  it('athlete training (activity 8), 30 °C, 60 % RH → ~90 pts/hr (PEAK→DEPLETED in ~28 min)', () => {
    const rate = depletionRatePerMinute(baseline({
      activityLevel: 8, weatherTempC: 30, weatherHumidity: 60,
    }));
    // base 0.083 + activity 1.0 = 1.083; heat 30°C = 1.3; hum 60% at 30°C = 1+0.2*0.3*0.5 = 1.03
    // 1.083 × 1.3 × 1.03 ≈ 1.45 pts/min ≈ 87 pts/hr
    expect(rate).toBeCloseTo(1.45, 2);
    const minToDepleted = 40 / rate;
    expect(minToDepleted).toBeGreaterThan(20);
    expect(minToDepleted).toBeLessThan(40);
  });

  it('extreme heat exercise (activity 10, 35 °C, 80 % RH) → ~150 pts/hr (drink continuously)', () => {
    const rate = depletionRatePerMinute(baseline({
      activityLevel: 10, weatherTempC: 35, weatherHumidity: 80,
    }));
    // base 0.083 + activity 1.25 = 1.333; heat 35°C = 1.6; hum 80% at 35°C = 1.18
    // 1.333 × 1.6 × 1.18 ≈ 2.52 pts/min ≈ 151 pts/hr
    expect(rate).toBeCloseTo(2.52, 1);
    expect(rate * 60).toBeGreaterThan(120);
    expect(rate * 60).toBeLessThan(180);
  });

  it('sleeping 150 lb, 22 °C, 60 % RH → ~2.5 pts/hr (~20 pts decay over 8 hr)', () => {
    const rate = depletionRatePerMinute(baseline({
      isAwake: false, weatherTempC: 22, weatherHumidity: 60,
    }));
    // base 0.083 (no activity, sub-thermoneutral, humidity neutralized) × 0.5 sleep = 0.0415
    expect(rate).toBeCloseTo(0.0415, 3);
    const eightHrDecay = rate * 60 * 8;
    expect(eightHrDecay).toBeGreaterThan(15);
    expect(eightHrDecay).toBeLessThan(25);
  });

  it('hot car at rest (35 °C, 50 % RH, sedentary) → ~8 pts/hr (heat alone, no exercise)', () => {
    const rate = depletionRatePerMinute(baseline({ weatherTempC: 35 }));
    // 0.083 × 1.6 × 1.0 = 0.133 pts/min ≈ 8 pts/hr
    expect(rate).toBeCloseTo(0.133, 3);
    expect(rate * 60).toBeGreaterThan(6);
    expect(rate * 60).toBeLessThan(10);
  });
});

// ─── Body weight scaling ─────────────────────────────────────────
describe('depletionRatePerMinute — body weight scaling', () => {
  it('200 lb → ~33 % faster baseline than 150 lb', () => {
    const r150 = depletionRatePerMinute(baseline({ bodyWeightLbs: 150 }));
    const r200 = depletionRatePerMinute(baseline({ bodyWeightLbs: 200 }));
    expect(r200 / r150).toBeCloseTo(200 / 150, 3);
  });
  it('100 lb → ~33 % slower baseline than 150 lb', () => {
    const r150 = depletionRatePerMinute(baseline({ bodyWeightLbs: 150 }));
    const r100 = depletionRatePerMinute(baseline({ bodyWeightLbs: 100 }));
    expect(r100 / r150).toBeCloseTo(100 / 150, 3);
  });
  it('floors at MIN_WEIGHT_LBS (60 lb) — protects against zero / undefined', () => {
    const r60 = depletionRatePerMinute(baseline({ bodyWeightLbs: 60 }));
    const r30 = depletionRatePerMinute(baseline({ bodyWeightLbs: 30 }));
    expect(r30).toBe(r60);
  });
  it('null bodyWeight → falls back to 150 lb reference', () => {
    expect(depletionRatePerMinute(baseline({ bodyWeightLbs: null })))
      .toBeCloseTo(depletionRatePerMinute(baseline({ bodyWeightLbs: 150 })), 5);
  });
  it('zero bodyWeight → falls back to 150 lb reference', () => {
    expect(depletionRatePerMinute(baseline({ bodyWeightLbs: 0 })))
      .toBeCloseTo(depletionRatePerMinute(baseline({ bodyWeightLbs: 150 })), 5);
  });
});

// ─── Activity scaling ────────────────────────────────────────────
describe('depletionRatePerMinute — activity scaling', () => {
  it('activity is linear: each level adds 0.125 pts/min before env multipliers', () => {
    const r0 = depletionRatePerMinute(baseline({ activityLevel: 0 }));
    const r5 = depletionRatePerMinute(baseline({ activityLevel: 5 }));
    const r10 = depletionRatePerMinute(baseline({ activityLevel: 10 }));
    // At thermoneutral, env multipliers = 1, so the increase is pure activity.
    expect(r5 - r0).toBeCloseTo(5 * ACTIVITY_PER_LEVEL, 5);
    expect(r10 - r0).toBeCloseTo(10 * ACTIVITY_PER_LEVEL, 5);
  });
  it('clamps activity above 10 (treats as 10)', () => {
    const r10 = depletionRatePerMinute(baseline({ activityLevel: 10 }));
    const r99 = depletionRatePerMinute(baseline({ activityLevel: 99 }));
    expect(r99).toBe(r10);
  });
  it('clamps negative activity to 0', () => {
    const r0 = depletionRatePerMinute(baseline({ activityLevel: 0 }));
    const rNeg = depletionRatePerMinute(baseline({ activityLevel: -5 }));
    expect(rNeg).toBe(r0);
  });
  it('null activity → treated as 0 (rest)', () => {
    expect(depletionRatePerMinute(baseline({ activityLevel: null })))
      .toBeCloseTo(depletionRatePerMinute(baseline({ activityLevel: 0 })), 5);
  });
});

// ─── Heat & humidity composition ─────────────────────────────────
describe('depletionRatePerMinute — heat & humidity composition', () => {
  it('heat is multiplicative (NOT additive — fixes the old 35°C catastrophe)', () => {
    // Old additive bug: 35°C added 3 pts/min independently of activity,
    // depleting in 17 min while sitting still. Multiplicative fix:
    // sedentary at 35°C should be moderate, not catastrophic.
    const rate35 = depletionRatePerMinute(baseline({ weatherTempC: 35 }));
    expect(rate35 * 60).toBeLessThan(15); // way under the old 180 pts/hr
  });
  it('humidity has NO effect at thermoneutral (heat coupling)', () => {
    const dry = depletionRatePerMinute(baseline({ weatherTempC: 25, weatherHumidity: 30 }));
    const humid = depletionRatePerMinute(baseline({ weatherTempC: 25, weatherHumidity: 90 }));
    expect(humid).toBe(dry);
  });
  it('humidity amplifies in HOT weather (the WBGT mechanism)', () => {
    const hotDry = depletionRatePerMinute(baseline({ weatherTempC: 38, weatherHumidity: 30 }));
    const hotHumid = depletionRatePerMinute(baseline({ weatherTempC: 38, weatherHumidity: 90 }));
    expect(hotHumid).toBeGreaterThan(hotDry);
    // 90% RH at 38°C: humidExcess 0.8, heatPremium 0.78, factor 0.5 → ×1.31 amp
    expect(hotHumid / hotDry).toBeCloseTo(humidityAmplification(90, heatMultiplier(38)), 5);
  });
  it('falls back to heatLoad axis when weatherTempC is null', () => {
    const fromAxis = depletionRatePerMinute(baseline({
      weatherTempC: null, weatherHumidity: null, heatLoad: 5,
    }));
    const expectedTemp = heatLoadToTempC(5); // 26°C
    const expected = depletionRatePerMinute(baseline({
      weatherTempC: expectedTemp, weatherHumidity: 50,
    }));
    expect(fromAxis).toBeCloseTo(expected, 5);
  });
  it('null weatherHumidity → defaults to 50 % (neutral)', () => {
    const r1 = depletionRatePerMinute(baseline({ weatherHumidity: null }));
    const r2 = depletionRatePerMinute(baseline({ weatherHumidity: 50 }));
    expect(r1).toBeCloseTo(r2, 5);
  });
});

// ─── Sleep / clutch / social modifiers ───────────────────────────
describe('depletionRatePerMinute — state modifiers', () => {
  it('sleep halves the rate', () => {
    const awake = depletionRatePerMinute(baseline({ isAwake: true }));
    const asleep = depletionRatePerMinute(baseline({ isAwake: false }));
    expect(asleep / awake).toBeCloseTo(SLEEP_MULTIPLIER, 5);
  });

  it('clutch multiplies by 1.3', () => {
    const off = depletionRatePerMinute(baseline({ clutchActive: false }));
    const on = depletionRatePerMinute(baseline({ clutchActive: true }));
    expect(on / off).toBeCloseTo(CLUTCH_MULTIPLIER, 5);
  });

  it('social multiplier only applied when > 1', () => {
    const noSocial = depletionRatePerMinute(baseline({ socialDecayMultiplier: 1 }));
    const withSocial = depletionRatePerMinute(baseline({ socialDecayMultiplier: 1.5 }));
    expect(withSocial / noSocial).toBeCloseTo(1.5, 5);
  });

  it('clutch + sleep stack multiplicatively (×1.3 × 0.5 = ×0.65)', () => {
    const baseRate = depletionRatePerMinute(baseline({ isAwake: true, clutchActive: false }));
    const both = depletionRatePerMinute(baseline({ isAwake: false, clutchActive: true }));
    expect(both / baseRate).toBeCloseTo(0.65, 5);
  });

  it('all modifiers compound on top of environmental rate', () => {
    const env = depletionRatePerMinute(baseline({
      activityLevel: 5, weatherTempC: 32, weatherHumidity: 70,
    }));
    const all = depletionRatePerMinute(baseline({
      activityLevel: 5, weatherTempC: 32, weatherHumidity: 70,
      clutchActive: true, socialDecayMultiplier: 1.4,
    }));
    expect(all / env).toBeCloseTo(1.3 * 1.4, 4);
  });
});

// ─── Invariants ──────────────────────────────────────────────────
describe('depletionRatePerMinute — invariants', () => {
  it('always non-negative', () => {
    for (const tempC of [-20, 0, 25, 50]) {
      for (const hum of [0, 50, 100]) {
        for (const act of [0, 5, 10]) {
          for (const w of [60, 150, 300]) {
            const r = depletionRatePerMinute({
              weatherTempC: tempC, weatherHumidity: hum,
              activityLevel: act, bodyWeightLbs: w,
            });
            expect(r).toBeGreaterThanOrEqual(0);
            expect(Number.isFinite(r)).toBe(true);
          }
        }
      }
    }
  });

  it('zero inputs (no activity, neutral env) still returns the resting baseline', () => {
    const r = depletionRatePerMinute({});
    // Defaults: 150 lb, activity 0, heatLoad 0 → 20°C (sub-thermoneutral)
    // → no heat amp, no humidity amp → just the resting baseline.
    expect(r).toBeCloseTo(RESTING_BASELINE_PER_MIN, 5);
  });

  it('monotonic in activity level (more activity ⇒ never less decay)', () => {
    let prev = -Infinity;
    for (let a = 0; a <= 10; a++) {
      const r = depletionRatePerMinute(baseline({ activityLevel: a }));
      expect(r).toBeGreaterThanOrEqual(prev);
      prev = r;
    }
  });

  it('monotonic in temperature above thermoneutral', () => {
    let prev = -Infinity;
    for (let t = 25; t <= 50; t++) {
      const r = depletionRatePerMinute(baseline({ weatherTempC: t }));
      expect(r).toBeGreaterThanOrEqual(prev);
      prev = r;
    }
  });
});
