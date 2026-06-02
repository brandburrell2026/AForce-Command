/**
 * Per-event Social Mode penalty (`socialIntakePoints`).
 *
 * Pins the contract that every logged drink moves the hydration score
 * immediately — not just via the future decay multiplier. These tests
 * are the source of truth for the "make sure social mode works directly
 * with hydration score" user requirement.
 *
 * Anchor scenarios:
 *   - 0 drinks                                 → 0 penalty
 *   - 1 beer just logged (t=0)                 → 0 (ramp-in starts here)
 *   - 1 beer at t=5                            → -5 (full peak)
 *   - 1 cocktail at t=30                       → -8 (peak)
 *   - 4 cocktails in 5 min                     → -32 → clamped to -30
 *   - 1 beer with hydrated=true at t=10        → -2 (60 % mitigation)
 *   - 1 beer at t=120 min                      → -2.5 (fade midpoint)
 *   - 1 beer at t=200 min                      → 0 (cleared)
 *   - 1 beer at t=-10 (future)                 → 0 (defensive)
 */

import { describe, it, expect } from 'vitest';

import {
  socialIntakePoints,
  SOCIAL_INTAKE_MAX_PENALTY,
} from '../hangoverRisk';
import type { DrinkLog } from '../../types';

const T0 = new Date('2026-04-22T20:00:00Z').getTime();

function drink(
  type: DrinkLog['type'],
  offsetMin: number,
  hydrated: DrinkLog['hydrated'] = null,
): DrinkLog {
  return {
    id: `d-${type}-${offsetMin}`,
    type,
    loggedAt: new Date(T0 + offsetMin * 60_000),
    multiplier: 1,
    hydrated,
  };
}

describe('socialIntakePoints — direct score impact', () => {
  it('returns zero penalty when no drinks are logged', () => {
    const r = socialIntakePoints([], T0);
    expect(r.penalty).toBe(0);
    expect(r.activeDrinks).toBe(0);
    expect(r.peakDrinks).toBe(0);
    expect(r.hydratedDrinks).toBe(0);
  });

  it('a beer just logged (t=0) has zero penalty (ramp-in starts here)', () => {
    const r = socialIntakePoints([drink('beer', 0)], T0);
    expect(r.penalty).toBe(0);
    expect(r.activeDrinks).toBe(1);
  });

  it('a beer at t=5 min hits full peak penalty (riskWeight 1.0 × 5)', () => {
    const r = socialIntakePoints([drink('beer', 0)], T0 + 5 * 60_000);
    expect(r.penalty).toBeCloseTo(-5, 5);
    expect(r.peakDrinks).toBe(1);
  });

  it('a beer at t=2.5 min is half-ramped-in', () => {
    const r = socialIntakePoints([drink('beer', 0)], T0 + 2.5 * 60_000);
    expect(r.penalty).toBeCloseTo(-2.5, 5);
    expect(r.peakDrinks).toBe(0);
  });

  it('a cocktail at t=30 min is at full peak (riskWeight 1.6 × 5 = 8)', () => {
    const r = socialIntakePoints([drink('cocktail', 0)], T0 + 30 * 60_000);
    expect(r.penalty).toBeCloseTo(-8, 5);
    expect(r.peakDrinks).toBe(1);
  });

  it('a liquor shot at t=30 min is at full peak (riskWeight 1.8 × 5 = 9)', () => {
    const r = socialIntakePoints([drink('liquor', 0)], T0 + 30 * 60_000);
    expect(r.penalty).toBeCloseTo(-9, 5);
  });

  it('a wine at t=30 min is at full peak (riskWeight 1.3 × 5 = 6.5)', () => {
    const r = socialIntakePoints([drink('wine', 0)], T0 + 30 * 60_000);
    expect(r.penalty).toBeCloseTo(-6.5, 5);
  });

  it('a hard seltzer at t=30 min is mild (riskWeight 1.0 × 5 = 5)', () => {
    const r = socialIntakePoints([drink('hard_seltzer', 0)], T0 + 30 * 60_000);
    expect(r.penalty).toBeCloseTo(-5, 5);
  });

  it('a custom drink at t=30 min is mid-load (riskWeight 1.4 × 5 = 7)', () => {
    const r = socialIntakePoints([drink('custom', 0)], T0 + 30 * 60_000);
    expect(r.penalty).toBeCloseTo(-7, 5);
  });

  it('multiple drinks within peak window stack additively', () => {
    const drinks = [drink('beer', 0), drink('beer', 0), drink('beer', 0)];
    const r = socialIntakePoints(drinks, T0 + 30 * 60_000);
    expect(r.penalty).toBeCloseTo(-15, 5); // 3 × 5
    expect(r.activeDrinks).toBe(3);
    expect(r.peakDrinks).toBe(3);
  });

  it('clamps total penalty to SOCIAL_INTAKE_MAX_PENALTY (4 cocktails would be -32)', () => {
    const drinks = [
      drink('cocktail', 0),
      drink('cocktail', 0),
      drink('cocktail', 0),
      drink('cocktail', 0),
    ];
    const r = socialIntakePoints(drinks, T0 + 30 * 60_000);
    expect(r.penalty).toBe(-SOCIAL_INTAKE_MAX_PENALTY);
    expect(r.activeDrinks).toBe(4);
  });

  it('hydrated=true cuts the per-drink penalty by 60 %', () => {
    const r = socialIntakePoints([drink('beer', 0, true)], T0 + 30 * 60_000);
    expect(r.penalty).toBeCloseTo(-2, 5); // 5 × 0.4
    expect(r.hydratedDrinks).toBe(1);
  });

  it('hydrated=false is treated like unhydrated (no mitigation)', () => {
    const r = socialIntakePoints([drink('beer', 0, false)], T0 + 30 * 60_000);
    expect(r.penalty).toBeCloseTo(-5, 5);
    expect(r.hydratedDrinks).toBe(0);
  });

  it('mixed hydrated/non-hydrated drinks compose correctly', () => {
    const drinks = [
      drink('beer', 0, true),  // mitigated → -2
      drink('beer', 0, false), // full → -5
      drink('beer', 0, null),  // full → -5
    ];
    const r = socialIntakePoints(drinks, T0 + 30 * 60_000);
    expect(r.penalty).toBeCloseTo(-12, 5);
    expect(r.hydratedDrinks).toBe(1);
    expect(r.activeDrinks).toBe(3);
  });

  it('a beer at t=120 min is at fade midpoint (-2.5)', () => {
    const r = socialIntakePoints([drink('beer', 0)], T0 + 120 * 60_000);
    expect(r.penalty).toBeCloseTo(-2.5, 5);
    expect(r.peakDrinks).toBe(0);
  });

  it('a beer at t=180 min has fully cleared (boundary)', () => {
    const r = socialIntakePoints([drink('beer', 0)], T0 + 180 * 60_000);
    expect(r.penalty).toBeCloseTo(0, 5);
  });

  it('a beer at t=200 min contributes nothing (past fade window)', () => {
    const r = socialIntakePoints([drink('beer', 0)], T0 + 200 * 60_000);
    expect(r.penalty).toBe(0);
    expect(r.activeDrinks).toBe(0);
  });

  it('a future-dated drink (t=-10) is ignored defensively', () => {
    const r = socialIntakePoints([drink('beer', 10)], T0); // logged 10 min in future
    expect(r.penalty).toBe(0);
    expect(r.activeDrinks).toBe(0);
  });

  it('an old drink + a fresh drink only counts the fresh one', () => {
    const drinks = [
      drink('beer', 0),    // 200 min ago at evaluation time → cleared
      drink('beer', 195),  // 5 min ago → full peak
    ];
    const r = socialIntakePoints(drinks, T0 + 200 * 60_000);
    expect(r.penalty).toBeCloseTo(-5, 5);
    expect(r.activeDrinks).toBe(1);
  });

  it('penalty magnitude is monotonically non-decreasing as drinks are added', () => {
    const start = T0 + 30 * 60_000;
    const r1 = socialIntakePoints([drink('beer', 0)], start);
    const r2 = socialIntakePoints([drink('beer', 0), drink('wine', 0)], start);
    const r3 = socialIntakePoints(
      [drink('beer', 0), drink('wine', 0), drink('cocktail', 0)],
      start,
    );
    expect(Math.abs(r1.penalty)).toBeLessThan(Math.abs(r2.penalty));
    expect(Math.abs(r2.penalty)).toBeLessThan(Math.abs(r3.penalty));
  });

  it('penalty is always ≤ 0 (never positive — it is a cost)', () => {
    const cases: DrinkLog[][] = [
      [],
      [drink('beer', 0)],
      [drink('cocktail', 0, true)],
      [drink('liquor', 0), drink('liquor', 0)],
    ];
    for (const drinks of cases) {
      for (const offset of [0, 5, 30, 60, 120, 180]) {
        const r = socialIntakePoints(drinks, T0 + offset * 60_000);
        expect(r.penalty).toBeLessThanOrEqual(0);
      }
    }
  });

  it('penalty magnitude is bounded above by SOCIAL_INTAKE_MAX_PENALTY for any input', () => {
    const huge = Array.from({ length: 20 }, () => drink('liquor', 0));
    const r = socialIntakePoints(huge, T0 + 30 * 60_000);
    expect(Math.abs(r.penalty)).toBeLessThanOrEqual(SOCIAL_INTAKE_MAX_PENALTY);
  });

  it('typical "going out" scenario: 3 beers paced 20 min apart, all hydrated', () => {
    // Logged at -40, -20, 0 from "now". Each is in peak window, all hydrated.
    const drinks = [
      drink('beer', -40, true),
      drink('beer', -20, true),
      drink('beer', 0, true),
    ];
    const r = socialIntakePoints(drinks, T0);
    // -40 and -20: ramped past 5 min, in peak → 5 × 0.4 each = 2 each → 4
    // 0: just logged, envelope=0 → 0
    expect(r.penalty).toBeCloseTo(-4, 5);
    expect(r.activeDrinks).toBe(3);
    expect(r.hydratedDrinks).toBe(3);
  });

  it('worst-case "rapid liquor" scenario: 3 shots in 5 min, no hydration', () => {
    const drinks = [
      drink('liquor', -5),
      drink('liquor', -3),
      drink('liquor', 0),
    ];
    const r = socialIntakePoints(drinks, T0);
    // -5 is at peak (env=1) → -9
    // -3 is at 60 % ramp → -9 × 0.6 = -5.4
    // 0 is at 0 ramp → 0
    expect(r.penalty).toBeCloseTo(-14.4, 1);
    expect(r.activeDrinks).toBe(3);
  });
});
