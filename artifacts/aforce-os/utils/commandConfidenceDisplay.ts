/**
 * Section 58 — pure display mapping for Command Confidence™.
 *
 * Presentation-only: the localized label key + a monochrome opacity per level.
 * No React Native, no calculation, no score — the level itself is derived by
 * the scoring engine (utils/scoringEngine.ts, off-limits) and merely displayed.
 * Kept pure and node-testable; the sole visual consumer is
 * components/CommandConfidenceBadge.tsx, shared across all four Section 58
 * surfaces (Today's Command, HydroScan Performance Fit, Recovery Window,
 * Sun Recovery Mode).
 */
import type { CommandConfidenceLevel } from '../types';

/** Localized label per level. 'low' is framed as "BUILDING", never a failure. */
export const CONFIDENCE_LABEL_KEYS: Record<CommandConfidenceLevel, string> = {
  high: 'coach.confidence_high',
  medium: 'coach.confidence_medium',
  low: 'coach.confidence_low',
};

/**
 * Monochrome opacity ramp — more real data → more opaque. Reads as "how sure
 * the system is" without colliding with the status-color band or urgency
 * palette. Display-only tunable.
 */
export const CONFIDENCE_OPACITY: Record<CommandConfidenceLevel, number> = {
  high: 1,
  medium: 0.7,
  low: 0.45,
};
