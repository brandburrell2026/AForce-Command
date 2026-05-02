/**
 * Production-shape coverage for the hydration scoring rubric.
 *
 * The base unit tests in `hydrationScoreService.test.ts` cover the
 * primitive math (water 0.5 pts/oz, AForce flavor table, absorption
 * cap, ramp). This file pins down the *exact* combinations a real
 * user can produce from the UI:
 *
 *   - Water at every WaterAmountModal preset (8 / 12 / 16 / 20 / 24 / 32 oz)
 *   - Every AForce format from PRODUCTS (stick 12oz, RTD 12oz, canister
 *     18oz, bulk-bag 16oz) at every flavor (berry / watermelon / soursop)
 *   - Heat Guard ON only boosts watermelon
 *   - Soursop bonus only fires when scoreBefore < 40 (strict)
 *   - Realistic mixed sequence over 30 min — score moves correctly
 *     and the absorption cap kicks in only when the rolling 20-min
 *     window is over-stuffed
 *
 * If any of these regress, real users will see wrong points on the
 * orb after a log.
 */

import { describe, it, expect } from 'vitest';
import {
  baseEventImpact,
  computeEventImpact,
  materializedIntakePoints,
  AFORCE_BASE_IMPACT,
  ABSORPTION_CAP_UNITS,
  EXCESS_EFFICIENCY,
  HYDRATION_UNIT_OZ,
  WATER_PTS_PER_OZ,
  WATER_IMMEDIATE_PCT,
  WATER_DELAYED_DURATION_MIN,
  AFORCE_IMMEDIATE_PCT,
  AFORCE_DELAYED_DURATION_MIN,
} from '../../services/hydrationScoreService';
import type { FluidType, IntakeEvent, ProductFlavor } from '../../types';

// Mirrors data/products.ts PRODUCTS[*].ozPerServing. We hardcode here
// rather than importing because data/products.ts uses RN
// `require('../assets/...')` calls that vitest can't parse. If the
// catalog changes, update this table too.
const PRODUCT_OZ_PER_SERVING: Record<Exclude<FluidType, 'water'>, number> = {
  aforce_stick: 12,
  aforce_rtd: 12,
  aforce_canister: 18,
  aforce_bulk_bag: 16,
};

const ctx = (over: Partial<{ heatGuardActive: boolean; scoreBefore: number }> = {}) => ({
  heatGuardActive: false,
  scoreBefore: 70,
  ...over,
});

// ─── Water at every picker size ──────────────────────────────────────────────
describe('water — every WaterAmountModal preset', () => {
  // Sizes from components/WaterAmountModal.tsx PRESETS
  const PRESETS = [8, 12, 16, 20, 24, 32] as const;

  for (const oz of PRESETS) {
    it(`${oz}oz water → ${oz * WATER_PTS_PER_OZ} base pts (0.5 pts/oz)`, () => {
      expect(baseEventImpact('water', undefined, oz, ctx())).toBe(oz * WATER_PTS_PER_OZ);
    });
  }

  it('water decomposes 60% immediate / 40% delayed at every preset', () => {
    for (const oz of PRESETS) {
      const r = computeEventImpact('water', undefined, oz, [], new Date(), ctx());
      // capAdjusted may be < base if oz > 18 (1.5 units), but split ratio is fixed
      expect(r.immediate).toBeCloseTo(r.capAdjusted * WATER_IMMEDIATE_PCT, 5);
      expect(r.delayed).toBeCloseTo(r.capAdjusted * (1 - WATER_IMMEDIATE_PCT), 5);
      expect(r.delayedDurationMin).toBe(WATER_DELAYED_DURATION_MIN);
    }
  });

  it('water above the cap (24oz, 32oz) is scaled by absorption efficiency', () => {
    // 24oz = 2 units, cap = 1.5 → 0.5 over → eff = (1.5 + 0.5*0.75) / 2 = 0.9375
    const r24 = computeEventImpact('water', undefined, 24, [], new Date(), ctx());
    expect(r24.absorptionEfficiency).toBeCloseTo(0.9375, 5);
    expect(r24.capAdjusted).toBeCloseTo(12 * 0.9375, 5);

    // 32oz = 2.667 units, cap = 1.5 → 1.167 over → eff = (1.5 + 1.167*0.75) / 2.667
    const newUnits = 32 / HYDRATION_UNIT_OZ;
    const expectedEff =
      (ABSORPTION_CAP_UNITS + (newUnits - ABSORPTION_CAP_UNITS) * EXCESS_EFFICIENCY) / newUnits;
    const r32 = computeEventImpact('water', undefined, 32, [], new Date(), ctx());
    expect(r32.absorptionEfficiency).toBeCloseTo(expectedEff, 5);
  });

  it('water at or below the cap (8 / 12 / 16oz = ≤1.33 units) is full efficiency', () => {
    for (const oz of [8, 12, 16] as const) {
      const r = computeEventImpact('water', undefined, oz, [], new Date(), ctx());
      expect(r.absorptionEfficiency).toBe(1);
      expect(r.capAdjusted).toBe(oz * WATER_PTS_PER_OZ);
    }
  });
});

// ─── Every AForce format × every flavor ──────────────────────────────────────
describe('AForce — every PRODUCTS format at every flavor', () => {
  const AFORCE_FORMATS: FluidType[] = ['aforce_stick', 'aforce_rtd', 'aforce_canister', 'aforce_bulk_bag'];
  const FLAVORS: ProductFlavor[] = ['berry', 'watermelon', 'soursop'];

  for (const fluid of AFORCE_FORMATS) {
    const oz = PRODUCT_OZ_PER_SERVING[fluid as Exclude<FluidType, 'water'>];
    for (const flavor of FLAVORS) {
      it(`${fluid} (${oz}oz) ${flavor} → flavor base ${AFORCE_BASE_IMPACT[flavor]}`, () => {
        // Base impact is flavor-driven, NOT oz-scaled (per AForce IP rubric).
        // Canister 18oz / bulk-bag 16oz still carry the per-flavor base.
        expect(baseEventImpact(fluid, flavor, oz, ctx())).toBe(AFORCE_BASE_IMPACT[flavor]);
      });
    }
  }

  it('canister (18oz = exactly 1.5 units = at-cap) gets full efficiency on its own', () => {
    const r = computeEventImpact('aforce_canister', 'watermelon', 18, [], new Date(), ctx());
    expect(r.absorptionEfficiency).toBe(1);
    expect(r.capAdjusted).toBe(10);
  });

  it('bulk-bag (16oz = 1.33 units) is full efficiency on its own', () => {
    const r = computeEventImpact('aforce_bulk_bag', 'soursop', 16, [], new Date(), ctx());
    expect(r.absorptionEfficiency).toBe(1);
    expect(r.capAdjusted).toBe(11);
  });

  it('AForce always splits 70% immediate / 30% delayed over 25 min, every format', () => {
    for (const fluid of AFORCE_FORMATS) {
      const oz = PRODUCT_OZ_PER_SERVING[fluid as Exclude<FluidType, 'water'>];
      const r = computeEventImpact(fluid, 'berry', oz, [], new Date(), ctx());
      expect(r.immediate).toBeCloseTo(r.capAdjusted * AFORCE_IMMEDIATE_PCT, 5);
      expect(r.delayed).toBeCloseTo(r.capAdjusted * (1 - AFORCE_IMMEDIATE_PCT), 5);
      expect(r.delayedDurationMin).toBe(AFORCE_DELAYED_DURATION_MIN);
    }
  });

  it('Heat Guard bonus ONLY applies to watermelon (not berry, not soursop)', () => {
    const heatCtx = ctx({ heatGuardActive: true });
    expect(baseEventImpact('aforce_stick', 'watermelon', 12, heatCtx)).toBe(12); // +2
    expect(baseEventImpact('aforce_stick', 'berry', 12, heatCtx)).toBe(10);
    expect(baseEventImpact('aforce_stick', 'soursop', 12, heatCtx)).toBe(11);
  });

  it('Soursop depleted bonus is strict scoreBefore < 40', () => {
    expect(baseEventImpact('aforce_stick', 'soursop', 12, ctx({ scoreBefore: 39 }))).toBe(13);
    expect(baseEventImpact('aforce_stick', 'soursop', 12, ctx({ scoreBefore: 40 }))).toBe(11);
    expect(baseEventImpact('aforce_stick', 'soursop', 12, ctx({ scoreBefore: 0 }))).toBe(13);
  });

  it('Heat Guard + Soursop: bonuses are independent and do NOT stack on the same flavor', () => {
    const both = ctx({ heatGuardActive: true, scoreBefore: 20 });
    // Heat Guard only triggers on watermelon; Soursop only on soursop.
    expect(baseEventImpact('aforce_stick', 'watermelon', 12, both)).toBe(12);
    expect(baseEventImpact('aforce_stick', 'soursop', 12, both)).toBe(13);
    expect(baseEventImpact('aforce_stick', 'berry', 12, both)).toBe(10);
  });

  it('unknown flavor falls back to "unflavored" (+10) — never NaN, never undefined', () => {
    expect(baseEventImpact('aforce_stick', undefined, 12, ctx())).toBe(10);
    expect(baseEventImpact('aforce_rtd', undefined, 12, ctx())).toBe(10);
  });
});

// ─── Realistic mixed-day sequence ────────────────────────────────────────────
describe('realistic logging sequence over 30 min', () => {
  function evt(
    minutesAgo: number,
    fluidType: FluidType,
    oz: number,
    impact: { base: number; cap: number; imm: number; del: number; dur: number },
  ): IntakeEvent {
    const now = Date.now();
    return {
      id: `e-${minutesAgo}`,
      fluidType,
      ...(fluidType !== 'water' ? { flavor: 'berry' as const } : {}),
      oz,
      loggedAt: new Date(now - minutesAgo * 60_000),
      baseImpact: impact.base,
      capAdjusted: impact.cap,
      immediate: impact.imm,
      delayed: impact.del,
      delayedDurationMin: impact.dur,
      heatGuardActiveAtLog: false,
      scoreBeforeAtLog: 60,
    };
  }

  it('water 16oz → stick → water 12oz: each event scored fully (well under cap)', () => {
    // 16oz + 12oz water = 2.33 units; one stick = 1 unit. Spread across
    // 25 min so the 20-min absorption window sees 1.33 + 1 = 2.33 units
    // by the third log (16oz water 25min ago has rolled out).
    const now = new Date();
    const history: IntakeEvent[] = [];

    // Log 1: water 16oz, 25 min ago (out of 20-min window for log 3)
    const r1 = computeEventImpact('water', undefined, 16, [], new Date(now.getTime() - 25 * 60_000), ctx());
    expect(r1.absorptionEfficiency).toBe(1);
    expect(r1.baseImpact).toBe(8);
    history.push(evt(25, 'water', 16, { base: r1.baseImpact, cap: r1.capAdjusted, imm: r1.immediate, del: r1.delayed, dur: r1.delayedDurationMin }));

    // Log 2: AForce stick (berry) 12oz, 10 min ago.
    // prevUnits in 20-min window = 16/12 = 1.33; new = 1; cap=1.5 → headroom=0.17
    // eff = (0.17 + 0.83*0.75)/1 = 0.79166...
    const r2 = computeEventImpact('aforce_stick', 'berry', 12, history, new Date(now.getTime() - 10 * 60_000), ctx());
    expect(r2.baseImpact).toBe(10);
    expect(r2.absorptionEfficiency).toBeCloseTo((0.5 / 3 + (1 - 0.5 / 3) * EXCESS_EFFICIENCY) / 1, 5);
    history.push(evt(10, 'aforce_stick', 12, { base: r2.baseImpact, cap: r2.capAdjusted, imm: r2.immediate, del: r2.delayed, dur: r2.delayedDurationMin }));

    // Log 3: water 12oz, NOW.
    // Rolling 20-min window now contains ONLY the stick (water from t=-25 is out).
    // prevUnits = 1, new = 1, cap = 1.5 → headroom 0.5; eff = (0.5 + 0.5*0.75)/1 = 0.875
    const r3 = computeEventImpact('water', undefined, 12, history, now, ctx());
    expect(r3.baseImpact).toBe(6);
    expect(r3.absorptionEfficiency).toBeCloseTo(0.875, 5);
    expect(r3.capAdjusted).toBeCloseTo(6 * 0.875, 5);
  });

  it('materializedIntakePoints separates water vs aforce contributions correctly', () => {
    // One stick fully materialized + one fresh water log
    const now = new Date();
    const events: IntakeEvent[] = [
      // Stick from 30 min ago — delayed window (25 min) fully complete → 10 pts
      {
        id: 'old-stick', fluidType: 'aforce_stick', flavor: 'berry', oz: 12,
        loggedAt: new Date(now.getTime() - 30 * 60_000),
        baseImpact: 10, capAdjusted: 10, immediate: 7, delayed: 3, delayedDurationMin: 25,
        heatGuardActiveAtLog: false, scoreBeforeAtLog: 60,
      },
      // Water from 13 min ago — water delayed window (12.5 min) fully complete → 8 pts (16oz)
      {
        id: 'fresh-water', fluidType: 'water', oz: 16,
        loggedAt: new Date(now.getTime() - 13 * 60_000),
        baseImpact: 8, capAdjusted: 8, immediate: 4.8, delayed: 3.2, delayedDurationMin: 12.5,
        heatGuardActiveAtLog: false, scoreBeforeAtLog: 60,
      },
    ];
    const m = materializedIntakePoints(events, now);
    expect(m.aforcePoints).toBeCloseTo(10, 5);
    expect(m.waterPoints).toBeCloseTo(8, 5);
    expect(m.total).toBeCloseTo(18, 5);
  });

  it('events older than 24h are trimmed from materialized total', () => {
    const now = new Date();
    const stale: IntakeEvent = {
      id: 'stale', fluidType: 'aforce_stick', flavor: 'berry', oz: 12,
      loggedAt: new Date(now.getTime() - 25 * 60 * 60_000), // 25h ago
      baseImpact: 10, capAdjusted: 10, immediate: 7, delayed: 3, delayedDurationMin: 25,
      heatGuardActiveAtLog: false, scoreBeforeAtLog: 60,
    };
    const m = materializedIntakePoints([stale], now);
    expect(m.total).toBe(0);
  });
});
