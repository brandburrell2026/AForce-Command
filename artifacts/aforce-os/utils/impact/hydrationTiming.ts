/**
 * HydroScan 2.0™ — Timing Guidance engine (pure, dependency-free).
 *
 * Answers "when should I take this?" with a 3-level result. It reads the
 * already-computed Hydration Impact level, the user's current state, and
 * how long it's been since their last hydration — and stays Water-First:
 *
 *   - plain water ALWAYS reads GOOD_TIMING (water never needs to wait)
 *   - a loading product when the user needs water reads
 *     BEST_AFTER_NEXT_WATER_CYCLE (rehydrate first, then this)
 *   - anything else that should be paired with water reads HYDRATE_FIRST
 *
 * Score-Protection: advisory only — never mutates score.
 */

import type {
  HydrationImpactLevel,
  TimingGuidanceLevel,
  TimingGuidanceResult,
} from '../../types/scan';
import type { PerformanceLevel } from '../../types';

export interface TimingGuidanceInput {
  /** Plain water short-circuits to GOOD_TIMING. */
  isWater: boolean;
  /** The headline impact level from computeHydrationImpact. */
  impactLevel: HydrationImpactLevel;
  state: PerformanceLevel;
  /** Hours since last hydration intake; null/undefined = unknown. */
  hoursSinceLastIntake?: number | null;
}

/** A long enough gap (hours) that the user should rehydrate first. */
export const HYDRATE_GAP_HOURS = 2.5;
/** Shorter gap that matters when already RECOVERING. */
export const RECOVERING_GAP_HOURS = 1.5;

export function computeTimingGuidance(
  input: TimingGuidanceInput,
): TimingGuidanceResult {
  // Water-First: water is always good timing.
  if (input.isWater) return { level: 'GOOD_TIMING' };

  const gap = normalizeGap(input.hoursSinceLastIntake);
  const needsWater =
    input.state === 'DEPLETED' ||
    (gap != null && gap >= HYDRATE_GAP_HOURS) ||
    (input.state === 'RECOVERING' && gap != null && gap >= RECOVERING_GAP_HOURS);

  const isHighLoad = input.impactLevel === 'HIGH_IMPACT';

  let level: TimingGuidanceLevel;
  if (needsWater && isHighLoad) {
    level = 'BEST_AFTER_NEXT_WATER_CYCLE';
  } else if (needsWater) {
    level = 'HYDRATE_FIRST';
  } else if (isHighLoad) {
    // Not depleted, but a high-load product is still best paired with water.
    level = 'HYDRATE_FIRST';
  } else {
    level = 'GOOD_TIMING';
  }

  return { level };
}

function normalizeGap(h: number | null | undefined): number | null {
  if (h == null || !Number.isFinite(h) || h < 0) return null;
  return h;
}
