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
  // low raised 0.45 → 0.47 (founder ruling 2026-07-18): on a solid-white base
  // (ConfidenceChip, PR #285) over the tuned card #0A0A0F, 0.45 = 4.49:1 (borderline
  // AA for 9px text); 0.47 = 4.82:1, clearing AA with margin. Also lifts §55's
  // SPARSE (CHIP_OPACITY.weak reads this). SIGNAL_OPACITY's 0.30 floor is left as
  // the intentional "absent data" tier (= text.muted convention), unchanged.
  medium: 0.7,
  low: 0.47,
};
