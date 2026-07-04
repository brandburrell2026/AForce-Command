/**
 * Section 59 — Adaptive Response Engine™ types.
 *
 * The Adaptive Response Engine EXTENDS Decision Memory (the append-only
 * Command-Event Ledger) — it does NOT introduce a parallel data store. It learns
 * the user's personal responses across the 11 tracked categories and, per
 * category, surfaces a Personal Response Library entry: What Worked (cause and
 * effect, from the user's own behavior) and Confidence After Action (which grows
 * only as real observations accumulate).
 *
 * Language rule (enforced in utils/intelligence/responseLanguage.ts): any copy
 * derived from these structures is cause-and-effect only — never risk / injury /
 * diagnosis / prevent framing.
 */

/** The 11 tracked response categories (spec Section 59, stable order). */
export type ResponseCategory =
  | 'heat'
  | 'hydration'
  | 'recovery'
  | 'sleep'
  | 'caffeine'
  | 'alcohol'
  | 'travel'
  | 'training'
  | 'cramp'
  | 'recovery_speed'
  | 'performance_consistency';

/** Stable iteration order for the full library (Build 100% · Show 10%). */
export const RESPONSE_CATEGORIES: readonly ResponseCategory[] = [
  'heat',
  'hydration',
  'recovery',
  'sleep',
  'caffeine',
  'alcohol',
  'travel',
  'training',
  'cramp',
  'recovery_speed',
  'performance_consistency',
];

/**
 * The observed cause-and-effect direction for a category, read from the user's
 * own follow-through and self-reported energy. 'unknown' when there is not
 * enough real signal to say — never a fabricated direction.
 */
export type ResponseOutcome = 'improved' | 'steady' | 'declined' | 'unknown';

/**
 * "What Worked" — a structured, cause-and-effect summary for one category.
 * Structured (not prose) so the language guard governs any rendered copy, not
 * this data. `outcome` links acting on this category to the user's own energy.
 */
export interface WhatWorked {
  /** In-window confirmations attributed to this category (followed + not). */
  sampleSize: number;
  /** How many of those the user actually followed. */
  followed: number;
  /** followed / sampleSize in [0,1]. */
  followedRate: number;
  /** Cause-and-effect direction from the user's own data. */
  outcome: ResponseOutcome;
}

/**
 * One category's Personal Response Library entry.
 *
 *  - `status` is 'insufficient' until enough real observations accumulate, then
 *    'ready'. Insufficient entries carry null payloads — no fabrication.
 *  - `confidenceAfterAction` grows only with real sample size; null until ready.
 */
export interface PersonalResponseEntry {
  category: ResponseCategory;
  status: 'insufficient' | 'ready';
  /** Total in-window observations attributed to this category. */
  sampleSize: number;
  /** Cause-and-effect summary when ready; null while insufficient. */
  whatWorked: WhatWorked | null;
  /** Confidence in the learned response, in (0,1]; null while insufficient. */
  confidenceAfterAction: number | null;
}

/** The full Personal Response Library — every category always present. */
export type AdaptiveResponseProfile = Record<ResponseCategory, PersonalResponseEntry>;
