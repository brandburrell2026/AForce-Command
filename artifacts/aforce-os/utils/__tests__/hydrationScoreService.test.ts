import { describe, it, expect } from 'vitest';
import {
  computeEventImpact,
  materializedIntakePoints,
  baseEventImpact,
  absorptionEfficiency,
  unitsInWindow,
  HYDRATION_UNIT_OZ,
  ABSORPTION_CAP_UNITS,
  EXCESS_EFFICIENCY,
  HYDRATION_IMMEDIATE_PCT,
  HYDRATION_DELAYED_DURATION_MIN,
} from '../../services/hydrationScoreService';
import type { IntakeEvent } from '../../types';

const ctx = (over: Partial<{ heatGuardActive: boolean; scoreBefore: number }> = {}) => ({
  heatGuardActive: false,
  scoreBefore: 70,
  ...over,
});

describe('hydrationScoreService — water', () => {
  it('scores water at 0.5 pts/oz: 12/16/24/32 → 6/8/12/16', () => {
    expect(baseEventImpact('water', undefined, 12, ctx())).toBe(6);
    expect(baseEventImpact('water', undefined, 16, ctx())).toBe(8);
    expect(baseEventImpact('water', undefined, 24, ctx())).toBe(12);
    expect(baseEventImpact('water', undefined, 32, ctx())).toBe(16);
  });

  it('splits 60% immediate / 40% delayed over 12.5 min', () => {
    const r = computeEventImpact('water', undefined, 12, [], new Date(), ctx());
    expect(r.baseImpact).toBe(6);
    expect(r.capAdjusted).toBe(6);
    expect(r.immediate).toBeCloseTo(6 * HYDRATION_IMMEDIATE_PCT, 5);
    expect(r.delayed).toBeCloseTo(6 * (1 - HYDRATION_IMMEDIATE_PCT), 5);
    expect(r.delayedDurationMin).toBe(HYDRATION_DELAYED_DURATION_MIN);
  });
});

// CONSCIOUS REPIN (RP-8b, founder ruling 2026-08-31). This block pinned the
// brand premium itself: a flat +10/+11 per AForce serving regardless of
// volume, +2 when Heat Guard was on, +2 when the member was below 40, and a
// faster absorption curve. All of it keyed on product identity, none of it on
// a physiological input. The rows below now assert the OPPOSITE — that the
// premium is gone — so the old behaviour cannot return unnoticed.
describe('hydrationScoreService — volume parity (formerly the AForce flavor table)', () => {
  it('every flavor earns the volume rate, and NO flavor earns more', () => {
    for (const flavor of ['berry', 'watermelon', 'soursop', 'unflavored'] as const) {
      expect(baseEventImpact('aforce_stick', flavor, 12, ctx())).toBe(6);
    }
    expect(baseEventImpact('aforce_stick', undefined, 12, ctx())).toBe(6);
  });

  it('Heat Guard buys nothing — the watermelon bonus is unreachable', () => {
    expect(baseEventImpact('aforce_stick', 'watermelon', 12, ctx())).toBe(6);
    expect(baseEventImpact('aforce_stick', 'watermelon', 12, ctx({ heatGuardActive: true }))).toBe(6);
  });

  it('depletion buys nothing — the soursop bonus is unreachable', () => {
    // The old rule paid MORE precisely when the member was most depleted.
    expect(baseEventImpact('aforce_stick', 'soursop', 12, ctx({ scoreBefore: 70 }))).toBe(6);
    expect(baseEventImpact('aforce_stick', 'soursop', 12, ctx({ scoreBefore: 39 }))).toBe(6);
  });

  it('the absorption curve is the same one water gets', () => {
    const r = computeEventImpact('aforce_stick', 'berry', 12, [], new Date(), ctx());
    expect(r.immediate).toBeCloseTo(6 * HYDRATION_IMMEDIATE_PCT, 5);
    expect(r.delayed).toBeCloseTo(6 * (1 - HYDRATION_IMMEDIATE_PCT), 5);
    expect(r.delayedDurationMin).toBe(HYDRATION_DELAYED_DURATION_MIN);
  });
});

describe('hydrationScoreService — 20-min absorption cap', () => {
  it('absorptionEfficiency: under cap = 1.0', () => {
    expect(absorptionEfficiency(0, 1)).toBe(1);
    expect(absorptionEfficiency(0.5, 1)).toBe(1);
  });

  it('absorptionEfficiency: fully over cap = 0.75', () => {
    expect(absorptionEfficiency(ABSORPTION_CAP_UNITS, 1)).toBe(EXCESS_EFFICIENCY);
    expect(absorptionEfficiency(2, 1)).toBe(EXCESS_EFFICIENCY);
  });

  it('absorptionEfficiency: partial over cap = weighted', () => {
    // prev=1u, new=1u → headroom=0.5u full + 0.5u at 0.75 → (0.5+0.375)/1 = 0.875
    expect(absorptionEfficiency(1, 1)).toBeCloseTo(0.875, 5);
  });

  it('caps a back-to-back stick: 2nd stick scaled by 0.875', () => {
    const now = new Date();
    const earlier: IntakeEvent = {
      id: 'a', fluidType: 'aforce_stick', flavor: 'berry', oz: 12, loggedAt: new Date(now.getTime() - 5 * 60_000),
      baseImpact: 10, capAdjusted: 10, immediate: 7, delayed: 3, delayedDurationMin: 25,
      heatGuardActiveAtLog: false, scoreBeforeAtLog: 60,
    };
    const r = computeEventImpact('aforce_stick', 'berry', 12, [earlier], now, ctx());
    // prevUnits = 1 (one 12oz stick), thisUnits = 1, eff = 0.875.
    // The CAP is unchanged by RP-8b; only the base it scales moved from the
    // old flat brand 10 to the volume rate (12 oz x 0.5 = 6) → 6 x 0.875.
    expect(r.absorptionEfficiency).toBeCloseTo(0.875, 5);
    expect(r.capAdjusted).toBeCloseTo(5.25, 5);
  });

  it('clamps a single 32oz water: 2.67 units → eff < 1', () => {
    const r = computeEventImpact('water', undefined, 32, [], new Date(), ctx());
    const newUnits = 32 / HYDRATION_UNIT_OZ;
    const expectedEff = (ABSORPTION_CAP_UNITS + (newUnits - ABSORPTION_CAP_UNITS) * EXCESS_EFFICIENCY) / newUnits;
    expect(r.absorptionEfficiency).toBeCloseTo(expectedEff, 5);
    expect(r.capAdjusted).toBeCloseTo(16 * expectedEff, 5);
  });

  it('unitsInWindow only counts last 20 min', () => {
    const now = new Date();
    const events: IntakeEvent[] = [
      { id: '1', fluidType: 'water', oz: 12, loggedAt: new Date(now.getTime() - 5 * 60_000),
        baseImpact: 6, capAdjusted: 6, immediate: 3.6, delayed: 2.4, delayedDurationMin: 12.5,
        heatGuardActiveAtLog: false, scoreBeforeAtLog: 60 },
      { id: '2', fluidType: 'water', oz: 24, loggedAt: new Date(now.getTime() - 30 * 60_000),
        baseImpact: 12, capAdjusted: 12, immediate: 7.2, delayed: 4.8, delayedDurationMin: 12.5,
        heatGuardActiveAtLog: false, scoreBeforeAtLog: 60 },
    ];
    expect(unitsInWindow(events, now)).toBeCloseTo(1, 5);
  });
});

describe('hydrationScoreService — delayed absorption ramp', () => {
  function evt(loggedMinAgo: number, fluidType: 'water' | 'aforce_stick' = 'aforce_stick'): IntakeEvent {
    const now = new Date();
    return {
      id: `e-${loggedMinAgo}`,
      fluidType,
      flavor: 'berry',
      oz: 12,
      loggedAt: new Date(now.getTime() - loggedMinAgo * 60_000),
      baseImpact: 10,
      capAdjusted: 10,
      immediate: 7,
      delayed: 3,
      delayedDurationMin: 25,
      heatGuardActiveAtLog: false,
      scoreBeforeAtLog: 60,
    };
  }

  it('at t=0: only immediate portion materialized', () => {
    const events = [evt(0)];
    const m = materializedIntakePoints(events, new Date());
    // some tiny elapsed (~0) → near 7
    expect(m.aforcePoints).toBeGreaterThanOrEqual(7);
    expect(m.aforcePoints).toBeLessThan(7.1);
  });

  it('at t=delayedDurationMin: full impact (immediate + delayed)', () => {
    const events = [evt(25)];
    const m = materializedIntakePoints(events, new Date());
    expect(m.aforcePoints).toBeCloseTo(10, 5);
  });

  it('at t=midway: linearly ramps', () => {
    const events = [evt(12.5)]; // half the AForce delayed window
    const m = materializedIntakePoints(events, new Date());
    // immediate 7 + delayed 3 * 0.5 = 8.5
    expect(m.aforcePoints).toBeCloseTo(8.5, 1);
  });

  it('separates water and aforce points', () => {
    const events = [evt(25, 'aforce_stick'), evt(13, 'water')];
    // mutate the water event so it carries water-shaped numbers
    events[1].fluidType = 'water';
    events[1].immediate = 3.6;
    events[1].delayed = 2.4;
    events[1].delayedDurationMin = 12.5;
    const m = materializedIntakePoints(events, new Date());
    expect(m.aforcePoints).toBeCloseTo(10, 5);
    expect(m.waterPoints).toBeCloseTo(6, 1); // delayed ~fully realized at 13min
    expect(m.total).toBeCloseTo(m.waterPoints + m.aforcePoints, 5);
  });
});

describe('hydrationScoreService — anti-game', () => {
  it('4 sticks in 5 min: 4th gets pushed deep into 0.75x band', () => {
    const now = new Date();
    const events: IntakeEvent[] = [];
    let prevPoints = 0;
    for (let i = 0; i < 4; i += 1) {
      const r = computeEventImpact('aforce_stick', 'berry', 12, events, now, ctx());
      events.push({
        id: `s${i}`, fluidType: 'aforce_stick', flavor: 'berry', oz: 12,
        loggedAt: new Date(now.getTime() - (3 - i) * 60_000),
        baseImpact: r.baseImpact, capAdjusted: r.capAdjusted,
        immediate: r.immediate, delayed: r.delayed, delayedDurationMin: r.delayedDurationMin,
        heatGuardActiveAtLog: false, scoreBeforeAtLog: 60,
      });
      prevPoints = r.capAdjusted;
    }
    // Last event: prev = 3 units, new = 1 unit → all over cap → eff = 0.75.
    // Base is now the volume rate (6), not the old flat brand 10 → 6 x 0.75.
    expect(prevPoints).toBeCloseTo(4.5, 5);
  });
});
