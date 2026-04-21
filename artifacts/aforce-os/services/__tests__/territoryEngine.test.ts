/**
 * Unit tests for the Territory scoring engine — pure math, no React/Expo.
 *
 * Validates: weight totals, NaN/Infinity safety, clamping, monotonicity of
 * each input dimension, and rank stability under `rankRegions`.
 */

import { describe, it, expect } from 'vitest';

import { territoryScore, rankRegions, statusLabel, WEIGHTS } from '../territoryEngine';
import type { CompetitionStats, TerritoryRegion } from '../../types/territory';

const baseStats: CompetitionStats = {
  avgPerformanceScore: 50,
  protocolCompletionRate: 0.5,
  streakDensity: 0.5,
  recoveryEfficiency: 0.5,
  momentumScore: 0,            // signed -1..+1, normalized to 0.5
  participants: 1000,
};

function region(id: string, stats: Partial<CompetitionStats> = {}): TerritoryRegion {
  return {
    regionId: id,
    name: id,
    kind: 'city',
    rank: 0,
    radius: 4,
    position: { x: 50, y: 30 },
    stats: { ...baseStats, ...stats },
    trend: 'flat',
    battleStatus: 'idle',
  };
}

describe('territoryEngine — weights', () => {
  it('weights sum to exactly 1.0', () => {
    const total = WEIGHTS.performance + WEIGHTS.protocol + WEIGHTS.streak
                + WEIGHTS.recovery   + WEIGHTS.momentum;
    expect(total).toBeCloseTo(1.0, 10);
  });
});

describe('territoryEngine — territoryScore', () => {
  it('returns 0..100', () => {
    const s = territoryScore(baseStats);
    expect(s).toBeGreaterThanOrEqual(0);
    expect(s).toBeLessThanOrEqual(100);
  });

  it('returns 100 for a perfect region', () => {
    const s = territoryScore({
      ...baseStats,
      avgPerformanceScore: 100,
      protocolCompletionRate: 1,
      streakDensity: 1,
      recoveryEfficiency: 1,
      momentumScore: 1,
    });
    expect(s).toBe(100);
  });

  it('returns a low score for a depleted region', () => {
    const s = territoryScore({
      ...baseStats,
      avgPerformanceScore: 0,
      protocolCompletionRate: 0,
      streakDensity: 0,
      recoveryEfficiency: 0,
      momentumScore: -1,
    });
    expect(s).toBe(0);
  });

  it('is NaN-safe — coerces NaN inputs to 0 contribution', () => {
    const s = territoryScore({
      ...baseStats,
      avgPerformanceScore: NaN,
      protocolCompletionRate: NaN,
      streakDensity: NaN,
      recoveryEfficiency: NaN,
      momentumScore: NaN,
    });
    expect(Number.isFinite(s)).toBe(true);
    expect(s).toBeGreaterThanOrEqual(0);
    expect(s).toBeLessThanOrEqual(100);
  });

  it('is Infinity-safe', () => {
    const s = territoryScore({
      ...baseStats,
      avgPerformanceScore: Infinity,
      momentumScore: Infinity,
    });
    expect(Number.isFinite(s)).toBe(true);
    expect(s).toBeLessThanOrEqual(100);
  });

  it('clamps out-of-range inputs (negative perf, >1 protocol, >1 momentum)', () => {
    const s = territoryScore({
      ...baseStats,
      avgPerformanceScore: -50,
      protocolCompletionRate: 5,
      streakDensity: 5,
      recoveryEfficiency: 5,
      momentumScore: 10,
    });
    // perf clamps to 0; everything else clamps to 1; momentum 10 → norm 1.
    // Expected blended = 0*.35 + .25 + .15 + .15 + .10 = 0.65 → 65.
    expect(s).toBe(65);
  });

  it('momentum normalization is monotone — higher momentum never lowers score', () => {
    let prev = -Infinity;
    for (const m of [-1, -0.5, 0, 0.5, 1]) {
      const s = territoryScore({ ...baseStats, momentumScore: m });
      expect(s).toBeGreaterThanOrEqual(prev);
      prev = s;
    }
  });

  it('each input dimension is monotone in isolation', () => {
    const dims = ['avgPerformanceScore', 'protocolCompletionRate',
      'streakDensity', 'recoveryEfficiency'] as const;
    for (const dim of dims) {
      const stepValues = dim === 'avgPerformanceScore' ? [0, 25, 50, 75, 100] : [0, 0.25, 0.5, 0.75, 1];
      let prev = -Infinity;
      for (const v of stepValues) {
        const s = territoryScore({ ...baseStats, [dim]: v });
        expect(s).toBeGreaterThanOrEqual(prev);
        prev = s;
      }
    }
  });
});

describe('territoryEngine — rankRegions', () => {
  it('ranks regions descending by score, assigning sequential ranks', () => {
    const ranked = rankRegions([
      region('low',  { avgPerformanceScore: 20 }),
      region('high', { avgPerformanceScore: 95, momentumScore: 1, protocolCompletionRate: 1, streakDensity: 1, recoveryEfficiency: 1 }),
      region('mid',  { avgPerformanceScore: 60 }),
    ]);
    expect(ranked.map(r => r.regionId)).toEqual(['high', 'mid', 'low']);
    expect(ranked.map(r => r.rank)).toEqual([1, 2, 3]);
  });

  it('does not mutate the input array', () => {
    const input = [region('a'), region('b'), region('c')];
    const ids = input.map(r => r.regionId);
    rankRegions(input);
    expect(input.map(r => r.regionId)).toEqual(ids);
    // ranks on the originals were 0; rankRegions returns new objects.
    expect(input.every(r => r.rank === 0)).toBe(true);
  });

  it('handles an empty input', () => {
    expect(rankRegions([])).toEqual([]);
  });
});

describe('territoryEngine — statusLabel', () => {
  it('maps rank 1 → Leader, 2-3 → Top contender, 4-10 → Climbing, rest → In the pack', () => {
    expect(statusLabel(1)).toBe('Leader');
    expect(statusLabel(2)).toBe('Top contender');
    expect(statusLabel(3)).toBe('Top contender');
    expect(statusLabel(4)).toBe('Climbing');
    expect(statusLabel(10)).toBe('Climbing');
    expect(statusLabel(11)).toBe('In the pack');
    expect(statusLabel(999)).toBe('In the pack');
  });
});
