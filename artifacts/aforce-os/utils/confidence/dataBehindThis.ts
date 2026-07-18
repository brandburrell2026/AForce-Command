/**
 * DATA BEHIND THIS — pure assembly for the Show-10 confidence sheet (slice ①).
 *
 * Composes §54 signal quality + §53 data freshness + the shared chip models into
 * the rows the sheet renders: "which signals are behind this read, and — per
 * signal — how good is the source and how current is the reading?" §58 Command
 * Confidence is passed through for the sheet header (the view renders it via
 * CommandConfidenceBadge).
 *
 * NO §56 personalization coverage — its "we're estimating your sex" rows are
 * categories, not a gradient, and are CR-1-gated (founder Q3): excluded from
 * this pass entirely, sheet included.
 *
 * Copy-independence: rows carry only chips (label + opacity), never a sentence —
 * the RN sheet adds any explanatory copy as an optional, CR-1-pending view prop.
 *
 * Pure · no React Native · no score. The RN sheet (slice ①-2) gathers each
 * signal's winning source + capture time from app state and hands them here;
 * keeping the assembly pure makes it node-testable.
 */
import { assessSignalQuality, type SignalQualityInput } from './signalQuality';
import { assessFreshness } from './dataFreshness';
import { signalQualityChip, freshnessChip, type ConfidenceChipModel } from './confidenceChip';
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
  /** §54 source-quality chip. */
  quality: ConfidenceChipModel;
  /** §53 recency chip, or null when the signal has no freshness window. */
  freshness: ConfidenceChipModel | null;
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
  const rows: DataBehindRow[] = input.signals.map((s, i) => ({
    label: s.label,
    quality: signalQualityChip(graded[i].rating),
    freshness: s.freshness
      ? freshnessChip(assessFreshness(s.freshness.kind, s.freshness.capturedAt, input.now).rating)
      : null,
  }));
  return { confidence: input.confidence, rows };
}
