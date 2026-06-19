/**
 * HydroScan 2.0™ — copy lock + i18n key maps (pure, dependency-free).
 *
 * Water-First lock: every water-facing line is POSITIVE about water. A
 * banned-terms guard + lock test keep anyone from re-introducing copy
 * that frames water as boring / plain / "just water". The actual visible
 * strings are translated via i18n keys; the constants here are the
 * English source + the compliance guard.
 */

import type {
  HydrationImpactLevel,
  TimingGuidanceLevel,
} from '../../types/scan';

/** Positive, Water-First reinforcement lines (English source copy). */
export const WATER_POSITIVE_LINES = [
  'Good hydration choice — water leads.',
  'Hydration cycle progressing. Keep water close.',
  'Momentum building. Stay ahead with water.',
  'Strong call. Water keeps you locked in.',
] as const;

/**
 * Terms that frame water negatively. Copy that contains any of these is
 * non-compliant with the Water-First lock.
 */
export const BANNED_WATER_TERMS = [
  'boring',
  'plain water',
  'just water',
  'only water',
  'basic',
  'bland',
  'tasteless',
] as const;

/** i18n key suffix for each Hydration Impact level. */
export const IMPACT_I18N_KEY: Record<HydrationImpactLevel, string> = {
  HIGH_SUPPORT: 'hydroScan2.impact.highSupport',
  NEUTRAL: 'hydroScan2.impact.neutral',
  MODERATE_IMPACT: 'hydroScan2.impact.moderateImpact',
  HIGH_IMPACT: 'hydroScan2.impact.highImpact',
};

/** i18n key suffix for each Timing Guidance level. */
export const TIMING_I18N_KEY: Record<TimingGuidanceLevel, string> = {
  GOOD_TIMING: 'hydroScan2.timing.good',
  HYDRATE_FIRST: 'hydroScan2.timing.hydrateFirst',
  BEST_AFTER_NEXT_WATER_CYCLE: 'hydroScan2.timing.afterNextCycle',
};

/** i18n key for an impact driver chip. */
export function impactDriverKey(driverKey: string): string {
  return `hydroScan2.driver.${driverKey}`;
}

/**
 * True when `text` contains no banned water term (case-insensitive).
 * Used by the copy-lock test and any runtime copy assertion.
 */
export function isWaterCopyCompliant(text: string): boolean {
  const lower = String(text ?? '').toLowerCase();
  return !BANNED_WATER_TERMS.some((term) => lower.includes(term));
}

/** Deterministic positive water line by seed (no Math.random). */
export function waterPositiveLine(seed: number): string {
  const i = Math.abs(Math.trunc(seed)) % WATER_POSITIVE_LINES.length;
  return WATER_POSITIVE_LINES[i];
}
