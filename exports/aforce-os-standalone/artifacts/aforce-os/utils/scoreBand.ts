/**
 * scoreBand — single source of truth for "score → performance band → color".
 *
 * The thresholds here MUST match the engine's `levelFromScore` in
 * `utils/scoringEngine.ts` so the displayed orb digit, the AI Coach
 * card, and the engine all agree on which band the user is in.
 *
 * Why this lives separately from scoringEngine:
 *   The engine module pulls in i18next + RN-only deps at top level
 *   (locales, react-native-reanimated via the orb pulse derivation).
 *   We need a tiny, dep-free helper that can run inside a React tween
 *   on every animation frame without dragging the rest of the engine
 *   along — and that can be unit-tested in plain node/vitest.
 */

import { Colors } from '../theme/colors';

export type ScoreLevel = 'PEAK' | 'BALANCED' | 'RECOVERING' | 'DEPLETED';

/**
 * Threshold table — kept in one place so the engine and the UI tween
 * can never drift. Order matters: highest first.
 */
export const BAND_THRESHOLDS: ReadonlyArray<{ min: number; level: ScoreLevel }> = [
  { min: 90, level: 'PEAK' },
  { min: 75, level: 'BALANCED' },
  { min: 60, level: 'RECOVERING' },
  { min: 0, level: 'DEPLETED' },
];

/** Map a numeric score (0..100, but tolerant of out-of-range) to a band. */
export function levelForScore(score: number): ScoreLevel {
  for (const band of BAND_THRESHOLDS) {
    if (score >= band.min) return band.level;
  }
  return 'DEPLETED';
}

export interface BandAccent {
  level: ScoreLevel;
  primary: string;
  glow: string;
}

/** Map a level to its accent + glow swatch from the central palette. */
export function accentForLevel(level: ScoreLevel): BandAccent {
  const swatch = Colors.states[level];
  return { level, primary: swatch.primary, glow: swatch.glow };
}

/** Convenience: score → fully-resolved accent in one call. */
export function accentForScore(score: number): BandAccent {
  return accentForLevel(levelForScore(score));
}
