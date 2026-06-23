import { describe, it, expect } from 'vitest';

import {
  adaptiveRecheckIntervalMin,
  recheckStretchFactor,
  RECHECK_RELIABLE_FOLLOW_RATE,
  MAX_RECHECK_STRETCH,
  type AdaptiveRecheckInput,
} from '../intelligence/adaptiveRecheck';
import type { CategoryLearning } from '../intelligence/commandAdaptiveLearning';
import type { CommandCategory } from '../intelligence/commandCategory';

function ready(followedRate: number): CategoryLearning {
  return {
    category: 'recovery_reset',
    status: 'ready',
    sampleSize: 20,
    followed: Math.round(followedRate * 20),
    followedRate,
  };
}

function insufficient(): CategoryLearning {
  return {
    category: 'recovery_reset',
    status: 'insufficient',
    sampleSize: 4,
    followed: 4,
    followedRate: null,
  };
}

function input(overrides: Partial<AdaptiveRecheckInput> = {}): AdaptiveRecheckInput {
  return {
    baseIntervalMin: 20,
    category: 'recovery_reset',
    learning: ready(1),
    urgency: 'moderate',
    flagEnabled: true,
    ...overrides,
  };
}

describe('adaptiveRecheck — timing only', () => {
  describe('hard no-ops (factor 1, interval unchanged)', () => {
    it('flag disabled', () => {
      const inp = input({ flagEnabled: false });
      expect(recheckStretchFactor(inp)).toBe(1);
      expect(adaptiveRecheckIntervalMin(inp)).toBe(20);
    });

    it('strain: any non-moderate urgency disables the stretch', () => {
      expect(recheckStretchFactor(input({ urgency: 'high' }))).toBe(1);
      expect(recheckStretchFactor(input({ urgency: 'critical' }))).toBe(1);
      expect(adaptiveRecheckIntervalMin(input({ urgency: 'critical' }))).toBe(20);
    });

    it('Water-First: every hydration-flavored category is never lengthened', () => {
      const hydrationCats: CommandCategory[] = [
        'hydration_urgent',
        'hydration_maintain',
        'morning_reset',
      ];
      for (const category of hydrationCats) {
        const inp = input({ category, learning: ready(1) });
        expect(recheckStretchFactor(inp)).toBe(1);
        expect(adaptiveRecheckIntervalMin(inp)).toBe(20);
      }
    });

    it('insufficient learning (below min samples)', () => {
      expect(recheckStretchFactor(input({ learning: insufficient() }))).toBe(1);
    });

    it('null learning', () => {
      expect(recheckStretchFactor(input({ learning: null }))).toBe(1);
    });

    it('reliable-but-below-threshold follow rate', () => {
      const justUnder = RECHECK_RELIABLE_FOLLOW_RATE - 0.01;
      expect(recheckStretchFactor(input({ learning: ready(justUnder) }))).toBe(1);
    });
  });

  describe('eligible stretching (non-hydration, reliably followed, no strain)', () => {
    it('at the threshold the factor is exactly 1 (no spacing yet)', () => {
      expect(recheckStretchFactor(input({ learning: ready(RECHECK_RELIABLE_FOLLOW_RATE) }))).toBe(1);
    });

    it('a perfect follow rate hits the max stretch cap', () => {
      expect(recheckStretchFactor(input({ learning: ready(1) }))).toBeCloseTo(MAX_RECHECK_STRETCH, 10);
      // 20 * 1.5 = 30
      expect(adaptiveRecheckIntervalMin(input({ learning: ready(1), baseIntervalMin: 20 }))).toBe(30);
    });

    it('scales monotonically between threshold and 1.0', () => {
      const mid = recheckStretchFactor(input({ learning: ready(0.85) }));
      expect(mid).toBeGreaterThan(1);
      expect(mid).toBeLessThan(MAX_RECHECK_STRETCH);
    });

    it('never returns less than the base interval (monotonic non-decreasing)', () => {
      for (const rate of [0.7, 0.75, 0.8, 0.9, 1]) {
        const out = adaptiveRecheckIntervalMin(input({ learning: ready(rate), baseIntervalMin: 12 }));
        expect(out).toBeGreaterThanOrEqual(12);
      }
    });
  });

  describe('fail-safe inputs', () => {
    it('non-positive or non-finite base intervals pass through untouched', () => {
      expect(adaptiveRecheckIntervalMin(input({ baseIntervalMin: 0 }))).toBe(0);
      expect(adaptiveRecheckIntervalMin(input({ baseIntervalMin: -5 }))).toBe(-5);
      expect(adaptiveRecheckIntervalMin(input({ baseIntervalMin: Number.NaN }))).toBeNaN();
    });

    it('factor stays within [1, MAX] even for an out-of-range follow rate', () => {
      const f = recheckStretchFactor(input({ learning: ready(2) }));
      expect(f).toBeLessThanOrEqual(MAX_RECHECK_STRETCH);
      expect(f).toBeGreaterThanOrEqual(1);
    });
  });
});
