/**
 * hydrationStatus — verifies the score-driven home content map.
 *
 * Critical acceptance criteria from the spec:
 *   - Score 28 → label DEPLETED, color red, headline "System under stress."
 *   - Score 100 → label OPTIMIZED, color neon green, headline "System optimized."
 *
 * Plus every band boundary and the formatter helpers.
 */

import { describe, expect, it } from 'vitest';
import {
  getHydrationStatus,
  formatTemperatureF,
  minutesSince,
} from '../hydrationStatus';

describe('getHydrationStatus — spec acceptance criteria', () => {
  it('score 28 is DEPLETED/red with the stress headline + STABILIZE CTA', () => {
    const s = getHydrationStatus(28);
    expect(s.label).toBe('DEPLETED');
    expect(s.band).toBe('CRITICAL');
    expect(s.color.primary).toBe('#FF0026'); // WHOOP recovery red
    expect(s.headline).toBe('System under stress.');
    expect(s.consequence).toBe('Recovery window closing.');
    expect(s.ctaText).toBe('STABILIZE SYSTEM');
    expect(s.command).toBe('Immediate recovery required. Drink 20 oz now.');
  });

  it('score 100 is OPTIMIZED/neon green with HOLD THE LINE', () => {
    const s = getHydrationStatus(100);
    expect(s.label).toBe('OPTIMIZED');
    expect(s.band).toBe('OPTIMAL');
    expect(s.color.primary).toBe('#16EC06'); // WHOOP recovery green
    expect(s.headline).toBe('System optimized.');
    expect(s.consequence).toBe('Output is locked in.');
    expect(s.ctaText).toBe('HOLD THE LINE');
    expect(s.command).toBe('Stay on pace. Next check in 60 minutes.');
  });
});

describe('getHydrationStatus — every band boundary', () => {
  it.each([
    [0, 'DEPLETED', 'CRITICAL'],
    [29, 'DEPLETED', 'CRITICAL'],
    [30, 'RISK', 'RISK'],
    [49, 'RISK', 'RISK'],
    [50, 'DECLINING', 'DECLINING'],
    [69, 'DECLINING', 'DECLINING'],
    [70, 'STABLE', 'STABLE'],
    [84, 'STABLE', 'STABLE'],
    [85, 'OPTIMIZED', 'OPTIMAL'],
    [100, 'OPTIMIZED', 'OPTIMAL'],
  ] as const)('score %i → label %s, band %s', (score, label, band) => {
    const s = getHydrationStatus(score);
    expect(s.label).toBe(label);
    expect(s.band).toBe(band);
  });

  it('clamps out-of-range and non-finite scores to 0 (DEPLETED)', () => {
    expect(getHydrationStatus(-50).label).toBe('DEPLETED');
    expect(getHydrationStatus(150).label).toBe('OPTIMIZED');
    expect(getHydrationStatus(NaN).label).toBe('DEPLETED');
  });

  it('uses CTAs that exactly match the brand spec', () => {
    expect(getHydrationStatus(95).ctaText).toBe('HOLD THE LINE');
    expect(getHydrationStatus(78).ctaText).toBe('MAINTAIN SYSTEM');
    expect(getHydrationStatus(60).ctaText).toBe('CORRECT NOW');
    expect(getHydrationStatus(40).ctaText).toBe('EXECUTE COMMAND');
    expect(getHydrationStatus(15).ctaText).toBe('STABILIZE SYSTEM');
  });
});

describe('formatTemperatureF', () => {
  it('converts C → F with rounding', () => {
    expect(formatTemperatureF(22)).toBe('72°F'); // 71.6 → 72
    expect(formatTemperatureF(0)).toBe('32°F');
    expect(formatTemperatureF(100)).toBe('212°F');
  });
  it('returns null for missing/invalid temps', () => {
    expect(formatTemperatureF(null)).toBeNull();
    expect(formatTemperatureF(undefined)).toBeNull();
    expect(formatTemperatureF(NaN)).toBeNull();
  });
});

describe('minutesSince', () => {
  it('computes whole minutes since a Date', () => {
    const now = 1_000_000_000_000;
    expect(minutesSince(new Date(now - 78 * 60_000), now)).toBe(78);
    expect(minutesSince(now - 30 * 60_000, now)).toBe(30);
  });
  it('returns null for missing/invalid timestamps', () => {
    expect(minutesSince(null)).toBeNull();
    expect(minutesSince(undefined)).toBeNull();
    expect(minutesSince('not-a-date')).toBeNull();
  });
  it('clamps negative deltas to 0', () => {
    const now = 1_000_000_000_000;
    expect(minutesSince(now + 60_000, now)).toBe(0);
  });
});
