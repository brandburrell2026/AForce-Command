/**
 * Performance Age™ — locked pure-math contract.
 *
 * These cases pin the exact formula weights, composite drop-and-renormalize
 * behaviour, the composite → years-delta mapping, the ±boundary clamp + age
 * floor, the provisional/established lifecycle, the missing-age handling,
 * and the rolling trend helper. The math in `utils/performanceAge.ts` is a
 * READ-ONLY downstream of the engines + analytics, so the final block also
 * proves it cannot mutate the snapshots it reads from (Score Protection).
 */

import { describe, it, expect } from 'vitest';
import {
  bandForComposite,
  deltaFromComposite,
  computePerformanceAge,
  computePerformanceAgeTrend,
  MAX_YEARS_BELOW,
  MAX_YEARS_ABOVE,
  WEEKLY_TREND_DAYS,
  MONTHLY_TREND_DAYS,
  type PerformanceAgeDailySnapshot,
} from '../performanceAge';

// Composite = round( 0.35·hydration + 0.30·recovery + 0.20·sleep + 0.15·activity )
describe('computePerformanceAge — locked composite + mapping', () => {
  it('E1 — full signals, established: 30yo / 80,70,90,60 → composite 76, age 29', () => {
    // 0.35*80 + 0.30*70 + 0.20*90 + 0.15*60 = 28 + 21 + 18 + 9 = 76 (BALANCED)
    // delta = -((76-75)/25)*15 = -0.6 → 30 - 0.6 = 29.4 → 29
    const r = computePerformanceAge({
      actualAge: 30,
      hydrationConsistency: 80,
      recoveryTrend: 70,
      sleepQuality: 90,
      activityConsistency: 60,
      activeDays: 10,
    });
    expect(r.status).toBe('established');
    expect(r.hasEnoughData).toBe(true);
    expect(r.provisional).toBe(false);
    expect(r.composite).toBe(76);
    expect(r.band).toBe('BALANCED');
    expect(r.performanceAge).toBe(29);
    expect(r.yearsDelta).toBe(-1);
    expect(r.availableSignals).toBe(4);
  });

  it('E2 — neutral composite 75 maps to actual age (delta 0)', () => {
    // single sub-score = 75 → composite 75 → delta 0 → age unchanged
    const r = computePerformanceAge({
      actualAge: 35,
      hydrationConsistency: 75,
      recoveryTrend: 75,
      sleepQuality: 75,
      activityConsistency: 75,
      activeDays: 9,
    });
    expect(r.composite).toBe(75);
    expect(r.performanceAge).toBe(35);
    expect(r.yearsDelta).toBe(0);
  });

  it('E3 — drop-and-renormalize when sub-scores are absent (no fabricated default)', () => {
    // Only hydration (0.35) + sleep (0.20) present → renormalize over 0.55:
    // (0.35/0.55)*90 + (0.20/0.55)*60 = 57.2727 + 21.8182 = 79.0909 → 79
    const r = computePerformanceAge({
      actualAge: 40,
      hydrationConsistency: 90,
      sleepQuality: 60,
      activeDays: 12,
    });
    expect(r.composite).toBe(79);
    expect(r.availableSignals).toBe(2);
    // delta = -((79-75)/25)*15 = -2.4 → 40 - 2.4 = 37.6 → 38
    expect(r.performanceAge).toBe(38);
    // only 2/4 sub-scores → still provisional even with enough active days
    expect(r.status).toBe('provisional');
  });
});

describe('deltaFromComposite — anchored at 75, clamped to [-15, +10]', () => {
  it('75 → 0', () => expect(deltaFromComposite(75)).toBeCloseTo(0));
  it('100 → -15 (max below)', () => expect(deltaFromComposite(100)).toBeCloseTo(-MAX_YEARS_BELOW));
  it('0 → +10 (max above)', () => expect(deltaFromComposite(0)).toBeCloseTo(MAX_YEARS_ABOVE));
  it('out-of-range composite is clamped before mapping', () => {
    expect(deltaFromComposite(140)).toBeCloseTo(-MAX_YEARS_BELOW);
    expect(deltaFromComposite(-40)).toBeCloseTo(MAX_YEARS_ABOVE);
  });
});

describe('boundaries — ±clamp and the absolute age floor', () => {
  it('best case never exceeds 15 years below actual age', () => {
    const r = computePerformanceAge({
      actualAge: 50,
      hydrationConsistency: 100,
      recoveryTrend: 100,
      sleepQuality: 100,
      activityConsistency: 100,
      activeDays: 30,
    });
    // 50 - 15 = 35
    expect(r.performanceAge).toBe(35);
    expect(r.yearsDelta).toBe(-MAX_YEARS_BELOW);
  });

  it('worst case never exceeds 10 years above actual age', () => {
    const r = computePerformanceAge({
      actualAge: 50,
      hydrationConsistency: 0,
      recoveryTrend: 0,
      sleepQuality: 0,
      activityConsistency: 0,
      activeDays: 30,
    });
    // 50 + 10 = 60
    expect(r.performanceAge).toBe(60);
    expect(r.yearsDelta).toBe(MAX_YEARS_ABOVE);
  });

  it('display floor (18) prevents an absurdly low Performance Age', () => {
    const r = computePerformanceAge({
      actualAge: 20,
      hydrationConsistency: 100,
      recoveryTrend: 100,
      sleepQuality: 100,
      activityConsistency: 100,
      activeDays: 30,
    });
    // 20 - 15 = 5 → floored to 18
    expect(r.performanceAge).toBe(18);
  });

  it('floor never reports a youth athlete as OLDER than they are', () => {
    const r = computePerformanceAge({
      actualAge: 16,
      hydrationConsistency: 100,
      recoveryTrend: 100,
      sleepQuality: 100,
      activityConsistency: 100,
      activeDays: 30,
    });
    // floor = min(18, 16) = 16, so best case caps at the actual age, not 18
    expect(r.performanceAge).toBe(16);
    expect(r.yearsDelta).toBe(0);
  });
});

describe('lifecycle — missing age / provisional / established', () => {
  it('missing actual age → status missing-age, no number (composite still computed)', () => {
    const r = computePerformanceAge({
      actualAge: null,
      hydrationConsistency: 90,
      recoveryTrend: 80,
      sleepQuality: 85,
      activityConsistency: 70,
      activeDays: 20,
    });
    expect(r.status).toBe('missing-age');
    expect(r.performanceAge).toBeNull();
    expect(r.yearsDelta).toBeNull();
    expect(r.hasEnoughData).toBe(false);
    expect(r.provisional).toBe(false);
    expect(r.composite).not.toBeNull();
  });

  it('age known but no behaviour signal → provisional, no number', () => {
    const r = computePerformanceAge({ actualAge: 30, activeDays: 4 });
    expect(r.status).toBe('provisional');
    expect(r.provisional).toBe(true);
    expect(r.performanceAge).toBeNull();
    expect(r.composite).toBeNull();
    expect(r.availableSignals).toBe(0);
  });

  it('thin history (active days below threshold) → provisional with a number', () => {
    const r = computePerformanceAge({
      actualAge: 25,
      hydrationConsistency: 80,
      recoveryTrend: 80,
      sleepQuality: 80,
      activeDays: 2,
    });
    expect(r.status).toBe('provisional');
    expect(r.provisional).toBe(true);
    expect(r.performanceAge).not.toBeNull();
  });

  it('≥7 active days AND ≥3/4 sub-scores → established', () => {
    const r = computePerformanceAge({
      actualAge: 25,
      hydrationConsistency: 80,
      recoveryTrend: 80,
      sleepQuality: 80,
      activeDays: 7,
    });
    expect(r.status).toBe('established');
    expect(r.hasEnoughData).toBe(true);
  });

  it('NaN sub-scores are ignored, not treated as 0', () => {
    const r = computePerformanceAge({
      actualAge: 30,
      hydrationConsistency: NaN,
      recoveryTrend: 80,
      activeDays: 10,
    });
    expect(r.availableSignals).toBe(1);
    expect(r.composite).toBe(80);
    expect(Number.isNaN(r.performanceAge as number)).toBe(false);
  });
});

describe('bandForComposite — boundary inclusivity (mirrors scoreBand)', () => {
  it('59 → DEPLETED', () => expect(bandForComposite(59)).toBe('DEPLETED'));
  it('60 → RECOVERING', () => expect(bandForComposite(60)).toBe('RECOVERING'));
  it('75 → BALANCED', () => expect(bandForComposite(75)).toBe('BALANCED'));
  it('90 → PEAK', () => expect(bandForComposite(90)).toBe('PEAK'));
});

describe('computePerformanceAgeTrend — honest, history-gated', () => {
  it('no history → unavailable ("collecting")', () => {
    const t = computePerformanceAgeTrend([], WEEKLY_TREND_DAYS);
    expect(t.available).toBe(false);
    expect(t.deltaYears).toBeNull();
    expect(t.daysOfHistory).toBe(0);
  });

  it('weekly window with a baseline ≥7 days back → improving (younger)', () => {
    const snaps: PerformanceAgeDailySnapshot[] = [
      { dayIndex: 100, performanceAge: 30 },
      { dayIndex: 107, performanceAge: 28 },
    ];
    const t = computePerformanceAgeTrend(snaps, WEEKLY_TREND_DAYS);
    expect(t.available).toBe(true);
    expect(t.deltaYears).toBe(-2);
    expect(t.direction).toBe('younger');
    expect(t.daysOfHistory).toBe(2);
  });

  it('same 8-day span is NOT enough for the 30-day window', () => {
    const snaps: PerformanceAgeDailySnapshot[] = [
      { dayIndex: 100, performanceAge: 30 },
      { dayIndex: 107, performanceAge: 28 },
    ];
    const t = computePerformanceAgeTrend(snaps, MONTHLY_TREND_DAYS);
    expect(t.available).toBe(false);
  });

  it('monthly window with a 30-day span → older direction on regression', () => {
    const snaps: PerformanceAgeDailySnapshot[] = [
      { dayIndex: 0, performanceAge: 29 },
      { dayIndex: 30, performanceAge: 32 },
    ];
    const t = computePerformanceAgeTrend(snaps, MONTHLY_TREND_DAYS);
    expect(t.available).toBe(true);
    expect(t.deltaYears).toBe(3);
    expect(t.direction).toBe('older');
  });

  it('equal endpoints → steady', () => {
    const snaps: PerformanceAgeDailySnapshot[] = [
      { dayIndex: 0, performanceAge: 31 },
      { dayIndex: 30, performanceAge: 31 },
    ];
    const t = computePerformanceAgeTrend(snaps, MONTHLY_TREND_DAYS);
    expect(t.direction).toBe('steady');
    expect(t.deltaYears).toBe(0);
  });
});

describe('determinism — same inputs always yield the same output', () => {
  it('repeated calls are deep-equal', () => {
    const inputs = {
      actualAge: 33,
      hydrationConsistency: 88,
      recoveryTrend: 71,
      sleepQuality: 64,
      activityConsistency: 40,
      activeDays: 8,
    };
    expect(computePerformanceAge(inputs)).toEqual(computePerformanceAge(inputs));
  });
});

describe('Score Protection — performance-age math never mutates its inputs', () => {
  it('frozen input snapshots are byte-for-byte unchanged after every export', () => {
    const deepFreeze = <T>(o: T): T => {
      if (o && typeof o === 'object') {
        Object.values(o as Record<string, unknown>).forEach(deepFreeze);
        Object.freeze(o);
      }
      return o;
    };

    const inputs = deepFreeze({
      actualAge: 30,
      hydrationConsistency: 82,
      recoveryTrend: 74,
      sleepQuality: 90,
      activityConsistency: 55,
      activeDays: 11,
    });
    const snaps = deepFreeze([
      { dayIndex: 0, performanceAge: 30 },
      { dayIndex: 30, performanceAge: 28 },
    ]) as PerformanceAgeDailySnapshot[];

    const before = JSON.stringify({ inputs, snaps });

    computePerformanceAge(inputs);
    computePerformanceAgeTrend(snaps, WEEKLY_TREND_DAYS);
    computePerformanceAgeTrend(snaps, MONTHLY_TREND_DAYS);

    const after = JSON.stringify({ inputs, snaps });
    expect(after).toBe(before);
  });
});
