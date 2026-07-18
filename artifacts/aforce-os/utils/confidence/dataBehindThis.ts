/**
 * DATA BEHIND THIS — pure assembly for the Show-10 confidence sheet (slice ①).
 *
 * Composes §54 signal quality + §53 data freshness into the rows the sheet
 * renders: "which signals are behind this read, and — per signal — how strong is
 * it once source quality and recency are taken together?" §54 and §53 compose to
 * ONE chip (Design Decision 2): `applyFreshness` takes the lower of the source
 * rating and the freshness ceiling, so a fresh-but-weak source and a
 * strong-but-stale one both land where they should without stacking two chips.
 * The raw contributing ratings ride along (`sourceRating` / `freshnessRating`)
 * so the sheet's optional detail line can spell out both facts — the chip is one,
 * the explanation can name two. §58 Command Confidence is passed through for the
 * sheet header (the view renders it via CommandConfidenceBadge).
 *
 * NO §56 personalization coverage — its "we're estimating your sex" rows are
 * categories, not a gradient, and are CR-1-gated (founder Q3): excluded from
 * this pass entirely, sheet included.
 *
 * Copy-independence: rows carry only the chip (label + opacity) plus the raw
 * ratings — never a sentence. The RN sheet adds any explanatory copy as an
 * optional, CR-1-pending view prop; strip it and the row still reads as a chip.
 *
 * Pure · no React Native · no score. The RN sheet (slice ①-2) gathers each
 * signal's winning source + capture time from app state and hands them here;
 * keeping the assembly pure makes it node-testable.
 */
import { assessSignalQuality, type SignalQualityInput, type SignalQualityRating } from './signalQuality';
import { assessFreshness, applyFreshness, type FreshnessRating } from './dataFreshness';
import { signalQualityChip, type ConfidenceChipModel } from './confidenceChip';
import type { FreshnessSignalKind } from '../../config/hydroStateModel';
import type { CommandConfidenceLevel } from '../../types';

export interface DataBehindSignal {
  /** Display label — structural (e.g. 'Sleep'), not a claim. */
  label: string;
  /** §54 quality input for this signal (kind + winning source, from resolveSignal). */
  quality: SignalQualityInput;
  /** §53 freshness, present only when this signal has a timestamp + a freshness window. */
  freshness?: { kind: FreshnessSignalKind; capturedAt: number | null };
}

export interface DataBehindRow {
  label: string;
  /**
   * The ONE composed chip (§54 ⊓ §53). Quality graded, then capped by freshness
   * via `applyFreshness` — Design Decision 2. This is the only chip the row draws.
   */
  chip: ConfidenceChipModel;
  /** Raw §54 source rating that fed the chip — for the sheet's optional detail line. */
  sourceRating: SignalQualityRating;
  /** Raw §53 recency rating, or null when the signal has no freshness window. */
  freshnessRating: FreshnessRating | null;
}

export interface DataBehindThis {
  /** §58 Command Confidence level for the header; null when unavailable. */
  confidence: CommandConfidenceLevel | null;
  rows: DataBehindRow[];
}

/**
 * Assemble the sheet. Pure + deterministic; row order mirrors input order (§54
 * grades all signals in one pass, preserving order; §53 is per-signal).
 */
export function buildDataBehindThis(input: {
  confidence: CommandConfidenceLevel | null;
  signals: readonly DataBehindSignal[];
  now: number;
}): DataBehindThis {
  const graded = assessSignalQuality(input.signals.map((s) => s.quality)).signals;
  const rows: DataBehindRow[] = input.signals.map((s, i) => {
    const sourceRating = graded[i].rating;
    const freshnessRating = s.freshness
      ? assessFreshness(s.freshness.kind, s.freshness.capturedAt, input.now).rating
      : null;
    // Compose: freshness is a CEILING on the source rating, never a second chip.
    const effective = freshnessRating ? applyFreshness(sourceRating, freshnessRating) : sourceRating;
    return { label: s.label, chip: signalQualityChip(effective), sourceRating, freshnessRating };
  });
  return { confidence: input.confidence, rows };
}
