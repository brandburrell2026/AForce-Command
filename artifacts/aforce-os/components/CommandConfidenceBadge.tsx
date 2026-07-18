/**
 * Section 58 — Command Confidence Display™.
 *
 * Presentational badge that surfaces the ALREADY-COMPUTED Command Confidence™
 * level (how grounded a recommendation is, given its real/fresh data). It does
 * NO calculation and never touches the score — the level is derived by the
 * scoring engine (`utils/scoringEngine.ts`, off-limits) and passed in here.
 *
 * The monochrome opacity ramp is deliberate: confidence must read as "how sure
 * the system is" without colliding with the status-color band
 * (`theme/statusColor.ts`) or the urgency palette. Extracted from AICommandCard
 * so every surface renders it identically (Today's Command, HydroScan
 * Performance Fit, Recovery Window, Sun Recovery Mode).
 */
import React from 'react';
import type { CommandConfidenceLevel } from '../types';
import i18n from '../services/i18nService';
import { CONFIDENCE_LABEL_KEYS, CONFIDENCE_OPACITY } from '../utils/commandConfidenceDisplay';
import { ConfidenceChip } from './ConfidenceChip';

interface Props {
  /** The already-computed confidence level. Renders nothing when absent. */
  level: CommandConfidenceLevel | null | undefined;
}

/**
 * Renders the confidence chip, or nothing when no level is available (no
 * fabricated "confident" state — absent data shows absent, per Score-Protection
 * and the no-fabrication discipline in commandConfidence.ts).
 *
 * Delegates to `ConfidenceChip` — the one monochrome dot+label primitive — so
 * §58 and the Show-10 gradient vocabularies (§53/§54/§55) render through a single
 * component. This badge stays the §58-specific adapter: it owns the level→label
 * (i18n) + level→opacity mapping and passes only the resolved token/opacity down.
 * ConfidenceChip's badge-alone (no `explain`) output is a single row node with
 * identical styles, so this is visually a no-op at every call site (dot + IBM
 * micro-label, same 5px dot, same opacity ramp).
 */
export function CommandConfidenceBadge({ level }: Props) {
  if (!level) return null;
  return (
    <ConfidenceChip label={i18n.t(CONFIDENCE_LABEL_KEYS[level])} opacity={CONFIDENCE_OPACITY[level]} />
  );
}
