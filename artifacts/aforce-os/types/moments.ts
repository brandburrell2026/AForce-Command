/**
 * AForce Moments — types (Phases 1–2, founder approval 2026-08-12).
 *
 * Calendar = what is coming. Signals = where the user is now.
 * AForce OS = what to do next. The Ritual = how it's delivered.
 *
 * Phase 1–2 scope locks (founder constraints):
 *   - `source` is 'manual' | 'demo' ONLY — no calendar ingestion until the
 *     Phase 3 founder decision (governance/proposals/PR-002-aforce-moments.md).
 *   - Recommendations are ADVISORY read-only projections (Score Protection,
 *     DR-001): no field here ever feeds the score engine, and there is no
 *     numeric "moment score" anywhere — importance is a coarse enum.
 *   - Explanations reuse the Evidence Engine's fail-closed CommandEvidence
 *     shape (utils/scoring/commandEvidence.ts) — evidence can never claim a
 *     reason that did not drive the recommendation.
 *   - All tunables live in config/hydroStateModel.ts (Build Rule 13).
 */

import type { CommandEvidence } from '@/utils/scoring/commandEvidence';

export type MomentType =
  | 'work'
  | 'training'
  | 'travel'
  | 'recovery'
  | 'personal'
  | 'performance';

export type MomentImportance = 'high' | 'moderate' | 'low';

/** Phase 3b (DR-011) adds 'calendar' — device-derived, in-memory only. */
export type MomentSource = 'manual' | 'demo' | 'calendar';

export type RitualStageKey = 'pause' | 'hydrate' | 'lock_in' | 'perform';

export interface Moment {
  id: string;
  source: MomentSource;
  /** Display title. Masked upstream when private (Phase 3 concern). */
  title: string;
  type: MomentType;
  importance: MomentImportance;
  startAtIso: string;
  endAtIso?: string;
  /** Optional user-stated prep goal from "Add a Moment". */
  prepGoal?: string;
  /** No readable title → render PRIVATE EVENT (never the raw event). */
  masked?: boolean;
  /** Source calendar event id (calendar moments only). */
  calendarEventId?: string;
  /** Set when the member taps I'M READY — Moments-internal state only. */
  preparedAtIso?: string;
  createdAtIso: string;
}

export interface MomentAction {
  kind: 'hydrate' | 'electrolytes' | 'pause' | 'focus' | 'breathe';
  /** i18n key; params carry real numbers ({ozMin, ozMax, minutes…}). */
  labelKey: string;
  labelParams?: Record<string, string | number>;
  /** ISO time the action is best completed by (window-derived). */
  bestBeforeIso?: string;
}

export type RitualStageState = 'completed' | 'active' | 'upcoming';

export interface RitualStage {
  key: RitualStageKey;
  atIso: string;
  state: RitualStageState;
  /** i18n key for the stage instruction line. */
  instructionKey: string;
  instructionParams?: Record<string, string | number>;
}

/**
 * The preparation projection for one Moment. Pure output of
 * services/momentRecommendation.ts — advisory only, recomputed on read,
 * never persisted as truth.
 */
export interface MomentRecommendation {
  momentId: string;
  prepWindowStartIso: string;
  prepWindowEndIso: string;
  /**
   * The hydration action — a VERBATIM MIRROR of the canonical guarded
   * RecoveryCommand (ruling RP-3: Moments owns context; RecoveryCommand owns
   * the hydration action). Absent when no eligible canonical command was
   * provided: a Moment never manufactures a hydration action — silence is
   * valid.
   */
  primaryAction?: MomentAction;
  secondaryAction?: MomentAction;
  ritual: RitualStage[];
  /** Fail-closed WHY THIS payload (Evidence Engine shape). */
  evidence: CommandEvidence;
  /**
   * Data-grounding of the recommendation. Manual moments are 'high' by
   * construction (explicit user input); degraded signal availability lowers
   * it. Never displayed as a number (no new score — founder constraint).
   */
  confidence: 'high' | 'medium' | 'low';
}
