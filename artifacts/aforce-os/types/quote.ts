/**
 * Quote types for the AForce contextual quote system.
 *
 * Quotes are commands / identity signals / performance triggers —
 * never motivational. The engine selects from one of five pools based
 * on live context (hydration state, behavior, time of day, social mode).
 */

export type QuoteType =
  | 'command'   // direct action trigger ("Take 1 now.")
  | 'result'    // outcome confirmation ("Cycle complete.")
  | 'identity'  // who you are ("Clean AF.")
  | 'product'   // the system ("Not a drink.")
  | 'social';   // social-mode trigger ("Social mode on.")

export interface Quote {
  id: string;
  type: QuoteType;
  /** ≤ 4 words, no filler, no fitness clichés. */
  text: string;
}

/** Why a particular pool was selected — exposed for tests + analytics. */
export type QuoteReason =
  | 'social_mode'
  | 'depleted'
  | 'recent_action_recovering'
  | 'morning'
  | 'night'
  | 'peak_streak'
  | 'default';

export interface SelectedQuote extends Quote {
  reason: QuoteReason;
}
