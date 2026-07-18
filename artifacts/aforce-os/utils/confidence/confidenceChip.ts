/**
 * CONFIDENCE CHIP — pure display model (Show-10, §53/§54/§55/§58 surface).
 *
 * Generalizes §58's Command Confidence treatment (`commandConfidenceDisplay.ts`)
 * across the confidence GRADIENT vocabularies: signal quality (§54), data
 * freshness (§53), profile completeness (§55). Monochrome opacity only — never
 * a hue — so it never collides with the status-color band or urgency palette.
 * TWO ramps by step-count (design spec §3): §55/§58 (3-step) anchor to §58's
 * `CONFIDENCE_OPACITY`; the composed §54+§53 signal chip (4-step) has its own
 * smoother ramp (1 / 0.78 / 0.55 / 0.30). §54 and §53 COMPOSE to one effective
 * rating before display (Design Decision 2) — they are never two chips.
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
 * view, never produced here. (§58's CommandConfidenceBadge localizes ITS label
 * via an i18n key; here the label is intentionally a plain structural token — do
 * NOT "fix" it into an i18n key, which would turn a rating token into
 * translatable copy subject to CR-1.) Pure · no RN · no score · display-tunable.
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
 * The 3-STEP ramp for §55/§58 (rich/partial/sparse, high/medium/low). Anchored
 * to §58's `CONFIDENCE_OPACITY` so a §55 chip lines up pixel-for-pixel with a
 * Command Confidence chip.
 */
export const CHIP_OPACITY = {
  full: CONFIDENCE_OPACITY.high,     // 1
  strong: CONFIDENCE_OPACITY.medium, // 0.7
  weak: CONFIDENCE_OPACITY.low,      // 0.45
} as const;

/**
 * The 4-STEP ramp for the COMPOSED §54+§53 signal chip (excellent–fresh …
 * unavailable–expired). Distinct from the 3-step §58 ramp by design — a 4-level
 * vocabulary needs its own smoother steps (design spec §3 ramp table:
 * 1.0 / 0.78 / 0.55 / 0.30). §54 and §53 are composed to ONE effective rating
 * before this maps it (Design Decision 2); they are not two chips.
 */
export const SIGNAL_OPACITY = {
  top: 1,      // excellent / fresh
  high: 0.78,  // good / aging
  mid: 0.55,   // limited / stale
  low: 0.3,    // unavailable / expired (absent still shows, never 0)
} as const;

/** §55 profile completeness → chip (3-step, §58 ramp). */
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

/** §54 signal quality → chip (4-step ramp; also used for the composed §54+§53 rating). */
export function signalQualityChip(rating: SignalQualityRating): ConfidenceChipModel {
  switch (rating) {
    case 'excellent':
      return { label: 'EXCELLENT', opacity: SIGNAL_OPACITY.top };
    case 'good':
      return { label: 'GOOD', opacity: SIGNAL_OPACITY.high };
    case 'limited':
      return { label: 'LIMITED', opacity: SIGNAL_OPACITY.mid };
    case 'unavailable':
      return { label: 'UNAVAILABLE', opacity: SIGNAL_OPACITY.low };
  }
}

/**
 * §53 data freshness → chip (4-step ramp). Reserved for the sheet's detail line
 * (slice ①-2, not yet wired) — dataBehindThis composes freshness INTO the row
 * chip via applyFreshness, so nothing renders a standalone freshness chip yet.
 */
export function freshnessChip(rating: FreshnessRating): ConfidenceChipModel {
  switch (rating) {
    case 'fresh':
      return { label: 'FRESH', opacity: SIGNAL_OPACITY.top };
    case 'aging':
      return { label: 'AGING', opacity: SIGNAL_OPACITY.high };
    case 'stale':
      return { label: 'STALE', opacity: SIGNAL_OPACITY.mid };
    case 'expired':
      return { label: 'EXPIRED', opacity: SIGNAL_OPACITY.low };
  }
}
