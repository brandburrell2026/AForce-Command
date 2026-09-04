/**
 * THE JOURNAL SHARE SEAM — one call, one window, two outputs.
 *
 * `ShareJournalRecap` and `deriveJournalShareContext` are two outputs of the
 * SAME user action, and they were disagreeing: the card rendered "STREAK —"
 * while the route params from that same press said `streakDays=14`, which the
 * template engine turned into the copy the member posted publicly.
 *
 * The screen used to call them separately, on the raw array:
 *
 *     publishJournalShare(rollups, range);
 *     const ctx = deriveJournalShareContext(rollups, range);
 *
 * Two call sites means two chances to pass a different array. So the seam is a
 * single function returning BOTH. The screen cannot compute one output from a
 * different window than the other, cannot reorder them, and cannot hand either
 * of them anything else. That is the whole design: the disagreement is
 * unspellable rather than merely fixed.
 *
 * DENSIFICATION NO LONGER LIVES HERE. It briefly did, when the shared
 * `/journal/rollups` contract was sparse and only this surface needed the
 * effective window. The consumer-completeness PR moved densification into the
 * route itself — every consumer now receives one row per calendar day of the
 * member's eligible window, with the epoch/`historyStartAt` floor applied
 * server-side — so re-deriving it here would be a second, drifting copy of
 * that arithmetic against an already-dense array.
 */
import type { JournalRollup } from '@/types';
import {
  deriveJournalShareContext,
  type JournalShareContext,
} from '@/services/journalShareContext';

export interface JournalShareWindowInput {
  /** The requested window length, as the picker asked for it. */
  rangeDays: number;
}

export interface PreparedJournalShare {
  /** The window BOTH outputs are computed from — already dense off the wire. */
  window: JournalRollup[];
  /** The share payload, derived from that same window. */
  context: JournalShareContext;
}

export function prepareJournalShare(
  rollups: readonly JournalRollup[],
  input: JournalShareWindowInput,
): PreparedJournalShare {
  // The route delivers the effective window already densified, so the window
  // IS the rollups. Copied rather than aliased so neither output can mutate
  // what the other sees.
  const window = [...rollups];
  // The context is derived from `window`, never from a separately-derived
  // array. Recomputing a window here would reintroduce the exact disagreement
  // this function exists to make impossible.
  return { window, context: deriveJournalShareContext(window, input.rangeDays) };
}
