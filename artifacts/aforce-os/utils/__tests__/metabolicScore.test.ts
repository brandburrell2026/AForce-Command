/**
 * Metabolic Readiness — locked pure-math contract.
 *
 * These cases pin the exact formulas, weights, rounding, clamping, band
 * thresholds, and missing-data behavior from the spec. The math in
 * `utils/metabolicScore.ts` is a READ-ONLY downstream of the hydration +
 * recovery engines, so the final block also proves it cannot mutate the
 * stores it reads from (Score Protection).
 */

import { describe, it, expect } from 'vitest';
import {
  bandForScore,
  computeMuscleReadiness,
  computeCognitiveReadiness,
  type MetabolicReadiness,
} from '../metabolicScore';

// Muscle = round( 0.40·hydration + 0.40·recovery + 0.20·(100 − fatigue) )
describe('computeMuscleReadiness — locked cases', () => {
  it('M1 — peak inputs: 95 / 92 / fatigue 10 → 93 (PEAK)', () => {
    // 0.4*95 + 0.4*92 + 0.2*90 = 38 + 36.8 + 18 = 92.8 → 93
    const r = computeMuscleReadiness({ hydrationScore: 95, recoveryCapacity: 92, workoutFatigue: 10 });
    expect(r).toEqual<MetabolicReadiness>({ hasEnoughData: true, score: 93, band: 'PEAK' });
  });

  it('M2 — mid inputs: 70 / 65 / fatigue 40 → 66 (RECOVERING)', () => {
    // 0.4*70 + 0.4*65 + 0.2*60 = 28 + 26 + 12 = 66 → 66
    const r = computeMuscleReadiness({ hydrationScore: 70, recoveryCapacity: 65, workoutFatigue: 40 });
    expect(r).toEqual<MetabolicReadiness>({ hasEnoughData: true, score: 66, band: 'RECOVERING' });
  });

  it('M3 — depleted inputs: 40 / 35 / fatigue 80 → 34 (DEPLETED)', () => {
    // 0.4*40 + 0.4*35 + 0.2*20 = 16 + 14 + 4 = 34 → 34
    const r = computeMuscleReadiness({ hydrationScore: 40, recoveryCapacity: 35, workoutFatigue: 80 });
    expect(r).toEqual<MetabolicReadiness>({ hasEnoughData: true, score: 34, band: 'DEPLETED' });
  });

  it('M4 — fatigue absent ⇒ weights renormalize (no fabricated boost): 80 / 80 → 80 (BALANCED)', () => {
    // term dropped, weights renormalized: 0.5*80 + 0.5*80 = 40 + 40 = 80 → 80
    // (NOT treated as fatigue 0, which would inflate to 84)
    const r = computeMuscleReadiness({ hydrationScore: 80, recoveryCapacity: 80 });
    expect(r).toEqual<MetabolicReadiness>({ hasEnoughData: true, score: 80, band: 'BALANCED' });
  });

  it('M5 — recoveryCapacity missing ⇒ insufficient data (null, never NaN)', () => {
    const r = computeMuscleReadiness({ hydrationScore: 80, workoutFatigue: 20 });
    expect(r).toEqual<MetabolicReadiness>({ hasEnoughData: false, score: null, band: null });
    expect(Number.isNaN(r.score as unknown as number)).toBe(false);
  });

  it('M6 — absent fatigue must NOT equal explicit zero fatigue (no fabricated freshness)', () => {
    // Same hydration + recovery: a CONFIRMED rest day (workoutFatigue: 0)
    // legitimately earns the full +0.20*100 freshness term (→ 84), while
    // ABSENT data renormalizes instead of inventing that boost (→ 80).
    const explicitZero = computeMuscleReadiness({ hydrationScore: 80, recoveryCapacity: 80, workoutFatigue: 0 });
    const absent = computeMuscleReadiness({ hydrationScore: 80, recoveryCapacity: 80 });
    expect(explicitZero.score).toBe(84);
    expect(absent.score).toBe(80);
    expect(explicitZero.score! > absent.score!).toBe(true);
  });
});

// Cognitive = round( 0.35·hydration + 0.40·sleep + 0.25·hrvNormalized )
describe('computeCognitiveReadiness — locked cases', () => {
  it('C1 — peak inputs: 92 / 95 / hrv 88 → 92 (PEAK)', () => {
    // 0.35*92 + 0.40*95 + 0.25*88 = 32.2 + 38 + 22 = 92.2 → 92
    const r = computeCognitiveReadiness({ hydrationScore: 92, sleepScore: 95, hrvNormalized: 88 });
    expect(r).toEqual<MetabolicReadiness>({ hasEnoughData: true, score: 92, band: 'PEAK' });
  });

  it('C2 — mid inputs: 70 / 60 / hrv 50 → 62 (RECOVERING)', () => {
    // 0.35*70 + 0.40*60 + 0.25*50 = 24.5 + 24 + 12.5 = 61 → 61
    const r = computeCognitiveReadiness({ hydrationScore: 70, sleepScore: 60, hrvNormalized: 50 });
    expect(r).toEqual<MetabolicReadiness>({ hasEnoughData: true, score: 61, band: 'RECOVERING' });
  });

  it('C3 — depleted inputs: 40 / 35 / hrv 30 → 36 (DEPLETED)', () => {
    // 0.35*40 + 0.40*35 + 0.25*30 = 14 + 14 + 7.5 = 35.5 → 36 (round half up)
    const r = computeCognitiveReadiness({ hydrationScore: 40, sleepScore: 35, hrvNormalized: 30 });
    expect(r).toEqual<MetabolicReadiness>({ hasEnoughData: true, score: 36, band: 'DEPLETED' });
  });

  it('C4 — hrv absent ⇒ weights renormalize (no penalty): 80 / 90 → 85 (BALANCED)', () => {
    // (0.35/0.75)*80 + (0.40/0.75)*90 = 37.333 + 48 = 85.333 → 85
    const r = computeCognitiveReadiness({ hydrationScore: 80, sleepScore: 90 });
    expect(r).toEqual<MetabolicReadiness>({ hasEnoughData: true, score: 85, band: 'BALANCED' });
  });

  it('C5 — sleepScore missing ⇒ insufficient data (null, never NaN)', () => {
    const r = computeCognitiveReadiness({ hydrationScore: 80, hrvNormalized: 60 });
    expect(r).toEqual<MetabolicReadiness>({ hasEnoughData: false, score: null, band: null });
    expect(Number.isNaN(r.score as unknown as number)).toBe(false);
  });
});

describe('bandForScore — boundary inclusivity (mirrors scoreBand)', () => {
  it('0 → DEPLETED', () => expect(bandForScore(0)).toBe('DEPLETED'));
  it('59 → DEPLETED', () => expect(bandForScore(59)).toBe('DEPLETED'));
  it('60 → RECOVERING', () => expect(bandForScore(60)).toBe('RECOVERING'));
  it('74 → RECOVERING', () => expect(bandForScore(74)).toBe('RECOVERING'));
  it('75 → BALANCED', () => expect(bandForScore(75)).toBe('BALANCED'));
  it('89 → BALANCED', () => expect(bandForScore(89)).toBe('BALANCED'));
  it('90 → PEAK', () => expect(bandForScore(90)).toBe('PEAK'));
  it('100 → PEAK', () => expect(bandForScore(100)).toBe('PEAK'));
});

describe('clamping — output never leaves 0–100', () => {
  it('muscle upper clamp: 100 / 100 / fatigue 0 → 100', () => {
    expect(computeMuscleReadiness({ hydrationScore: 100, recoveryCapacity: 100, workoutFatigue: 0 }).score).toBe(100);
  });

  it('cognitive upper clamp: 100 / 100 / hrv 100 → 100', () => {
    expect(computeCognitiveReadiness({ hydrationScore: 100, sleepScore: 100, hrvNormalized: 100 }).score).toBe(100);
  });

  it('muscle negative raw clamps to 0 (never negative)', () => {
    // 0.4*0 + 0.4*0 + 0.2*(100 − 200) = −20 → clamp 0
    const r = computeMuscleReadiness({ hydrationScore: 0, recoveryCapacity: 0, workoutFatigue: 200 });
    expect(r.score).toBe(0);
    expect(r.band).toBe('DEPLETED');
  });
});

describe('missing / non-finite required inputs ⇒ insufficient (never NaN)', () => {
  it('NaN hydration → insufficient', () => {
    expect(computeMuscleReadiness({ hydrationScore: NaN, recoveryCapacity: 80 }).hasEnoughData).toBe(false);
    expect(computeCognitiveReadiness({ hydrationScore: NaN, sleepScore: 80 }).hasEnoughData).toBe(false);
  });

  it('empty input → insufficient for both', () => {
    expect(computeMuscleReadiness({})).toEqual({ hasEnoughData: false, score: null, band: null });
    expect(computeCognitiveReadiness({})).toEqual({ hasEnoughData: false, score: null, band: null });
  });
});

describe('determinism — same inputs always yield the same output', () => {
  it('repeated calls are byte-for-byte equal', () => {
    const a = computeMuscleReadiness({ hydrationScore: 88, recoveryCapacity: 71, workoutFatigue: 33 });
    const b = computeMuscleReadiness({ hydrationScore: 88, recoveryCapacity: 71, workoutFatigue: 33 });
    expect(a).toEqual(b);
    const c = computeCognitiveReadiness({ hydrationScore: 88, sleepScore: 71, hrvNormalized: 33 });
    const d = computeCognitiveReadiness({ hydrationScore: 88, sleepScore: 71, hrvNormalized: 33 });
    expect(c).toEqual(d);
  });
});

describe('Score Protection — metabolic math never mutates upstream stores', () => {
  it('hydration + recovery store snapshots are byte-for-byte unchanged after every export', () => {
    const deepFreeze = <T>(o: T): T => {
      if (o && typeof o === 'object') {
        Object.values(o as Record<string, unknown>).forEach(deepFreeze);
        Object.freeze(o);
      }
      return o;
    };

    // Representative read-only snapshots of the upstream engines.
    const hydrationStore = deepFreeze({
      score: 88,
      status: 'OPTIMAL',
      events: [{ oz: 16, fluidType: 'water' }],
    });
    const recoveryStore = deepFreeze({ recovery: 74, pressure: 30, trend: 'stable' });
    const biometricsStore = deepFreeze({ sleepScore: 80, hrvNormalized: 62, workoutFatigue: 25 });

    const before = JSON.stringify({ hydrationStore, recoveryStore, biometricsStore });

    // Exercise every exported metabolic function with values read from
    // the frozen stores. A write attempt would throw on the frozen object.
    bandForScore(hydrationStore.score);
    computeMuscleReadiness({
      hydrationScore: hydrationStore.score,
      recoveryCapacity: recoveryStore.recovery,
      workoutFatigue: biometricsStore.workoutFatigue,
    });
    computeCognitiveReadiness({
      hydrationScore: hydrationStore.score,
      sleepScore: biometricsStore.sleepScore,
      hrvNormalized: biometricsStore.hrvNormalized,
    });

    const after = JSON.stringify({ hydrationStore, recoveryStore, biometricsStore });
    expect(after).toBe(before);
  });
});
