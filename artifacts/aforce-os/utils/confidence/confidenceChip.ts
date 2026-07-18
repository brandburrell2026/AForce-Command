/**
 * CONFIDENCE CHIP — pure display model (Show-10, §53/§54/§55/§58 surface).
 *
 * Generalizes §58's Command Confidence treatment (`commandConfidenceDisplay.ts`)
 * across the confidence GRADIENT vocabularies: signal quality (§54), data
 * freshness (§53), profile completeness (§55). One monochrome opacity ramp —
 * more real / more current data → more opaque — anchored to §58's
 * `CONFIDENCE_OPACITY` so every confidence chip shares one grammar and never
 * collides with the status-color band or urgency palette.
 *
 * NOT here, deliberately:
 *   - §56 personalization coverage — its states are CATEGORIES, not a gradient
 *     (they never dim; glyph-differentiated), and the surface is CR-1-gated.
 *   - the confidence vocabulary itself — §58 owns it; this REUSES its ramp,
 *     it does not duplicate the mapping.
 *
 * Copy-independence (see docs/design/show10-confidence-surface.md): `label` is
 * the rating token in caps — a STRUCTURAL word that ships regardless of CR-1,
 * never a claim. Any explanatory sentence is a separate optional prop on the
 * view, never produced here. Pure · no React Native · no score · display-tunable.
 */
import { CONFIDENCE_OPACITY } from '../commandConfidenceDisplay';
import type { SignalQualityRating } from './signalQuality';
import type { FreshnessRating } from './dataFreshness';
import type { ProfileCompletenessLevel } from '../profile/profileCompleteness';

export interface ConfidenceChipModel {
  /** Structural rating token, uppercased (e.g. 'RICH', 'EXCELLENT'). Not a claim. */
  label: string;
  /** Monochrome dot opacity (0..1). Higher = more real / more current data. */
  opacity: number;
}

/**
 * The shared opacity ramp. `full`/`strong`/`weak` are anchored to §58's
 * high/medium/low so a §54/§55 chip lines up pixel-for-pixel with a Command
 * Confidence chip; `faint` is the fourth step the 4-level vocabularies need.
 */
export const CHIP_OPACITY = {
  full: CONFIDENCE_OPACITY.high,     // 1
  strong: CONFIDENCE_OPACITY.medium, // 0.7
  weak: CONFIDENCE_OPACITY.low,      // 0.45
  faint: 0.3,                        // absent / expired
} as const;

/** §55 profile completeness → chip. */
export function completenessChip(level: ProfileCompletenessLevel): ConfidenceChipModel {
  switch (level) {
    case 'rich':
      return { label: 'RICH', opacity: CHIP_OPACITY.full };
    case 'partial':
      return { label: 'PARTIAL', opacity: CHIP_OPACITY.strong };
    case 'sparse':
      return { label: 'SPARSE', opacity: CHIP_OPACITY.weak };
  }
}

/** §54 signal quality → chip. */
export function signalQualityChip(rating: SignalQualityRating): ConfidenceChipModel {
  switch (rating) {
    case 'excellent':
      return { label: 'EXCELLENT', opacity: CHIP_OPACITY.full };
    case 'good':
      return { label: 'GOOD', opacity: CHIP_OPACITY.strong };
    case 'limited':
      return { label: 'LIMITED', opacity: CHIP_OPACITY.weak };
    case 'unavailable':
      return { label: 'UNAVAILABLE', opacity: CHIP_OPACITY.faint };
  }
}

/** §53 data freshness → chip. */
export function freshnessChip(rating: FreshnessRating): ConfidenceChipModel {
  switch (rating) {
    case 'fresh':
      return { label: 'FRESH', opacity: CHIP_OPACITY.full };
    case 'aging':
      return { label: 'AGING', opacity: CHIP_OPACITY.strong };
    case 'stale':
      return { label: 'STALE', opacity: CHIP_OPACITY.weak };
    case 'expired':
      return { label: 'EXPIRED', opacity: CHIP_OPACITY.faint };
  }
}
