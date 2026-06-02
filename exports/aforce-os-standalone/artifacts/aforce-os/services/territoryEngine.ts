/**
 * Territory scoring engine. Single source of truth for how a region's
 * competition rank is computed from its component stats.
 *
 * territory_score =
 *   avg_performance_score    * 0.35
 * + protocol_completion_rate * 0.25
 * + streak_density           * 0.15
 * + recovery_efficiency      * 0.15
 * + momentum_score_norm      * 0.10
 *
 * `momentum_score` is signed (-1..+1) — we normalize to (0..1) before the
 * blend so a falling region can still rank above a flat low-score region.
 * Output is always a 0..100 number; NaN-safe.
 */

import type { CompetitionStats, TerritoryRegion } from '@/types/territory';

export const WEIGHTS = {
  performance: 0.35,
  protocol:    0.25,
  streak:      0.15,
  recovery:    0.15,
  momentum:    0.10,
} as const;

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

function clamp100(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, n));
}

export function territoryScore(stats: CompetitionStats): number {
  const perf      = clamp100(stats.avgPerformanceScore) / 100;
  const protocol  = clamp01(stats.protocolCompletionRate);
  const streak    = clamp01(stats.streakDensity);
  const recovery  = clamp01(stats.recoveryEfficiency);
  // Normalize signed momentum (-1..1) to 0..1.
  const momentum  = clamp01((stats.momentumScore + 1) / 2);
  const blended =
      perf      * WEIGHTS.performance
    + protocol  * WEIGHTS.protocol
    + streak    * WEIGHTS.streak
    + recovery  * WEIGHTS.recovery
    + momentum  * WEIGHTS.momentum;
  return Math.round(blended * 100);
}

/** Recompute ranks across a list of regions using the unified score. */
export function rankRegions<T extends TerritoryRegion>(regions: T[]): T[] {
  return [...regions]
    .map(r => ({ r, s: territoryScore(r.stats) }))
    .sort((a, b) => b.s - a.s)
    .map((entry, i) => ({ ...entry.r, rank: i + 1 }));
}

/** Human-readable status — used in detail card subtitles. */
export function statusLabel(rank: number): string {
  if (rank === 1) return 'Leader';
  if (rank <= 3)  return 'Top contender';
  if (rank <= 10) return 'Climbing';
  return 'In the pack';
}
