/**
 * THE JOURNAL SHARE SEAM — one call, one window, two outputs.
 *
 * `ShareJournalRecap` and `deriveJournalShareContext` are two outputs of the
 * SAME user action, and they were disagreeing: the card rendered "STREAK —"
 * while the route params from that same press said `streakDays=14`, which the
 * template engine turned into the copy the member posted publicly.
 *
 * The screen used to call them separately, on the raw sparse array:
 *
 *     publishJournalShare(rollups, range);
 *     const ctx = deriveJournalShareContext(rollups, range);
 *
 * Two call sites means two chances to pass a different array, and the raw array
 * is the wrong one for both — a day the member skipped entirely is absent from
 * it, so its absence is invisible and a streak walks straight across the hole.
 *
 * So the seam is a single function returning BOTH. The screen cannot densify
 * for one output and not the other, cannot reorder the two, and cannot hand
 * either of them the undensified rows. That is the whole design: the
 * disagreement is unspellable rather than merely fixed.
 *
 * DENSIFICATION LIVES HERE AND NOWHERE ELSE (founder ruling, Option B). The
 * shared `/journal/rollups` array stays sparse for every other consumer in this
 * PR; migrating them is a separate consumer-completeness change.
 */
import type { JournalRollup } from '@/types';
import { effectiveRangeKeys, densifyRollups } from '@/utils/scoring/journalDenseRange';
import {
  deriveJournalShareContext,
  type JournalShareContext,
} from '@/services/journalShareContext';

export interface JournalShareWindowInput {
  /** The requested window length, as the picker asked for it. */
  rangeDays: number;
  /** The member's history stamp from the rollups response; null is normal. */
  historyStartAt: Date | null;
  /** Injected so the window is deterministic under test. */
  now: Date;
}

export interface PreparedJournalShare {
  /** The dense effective window — what BOTH outputs are computed from. */
  window: JournalRollup[];
  /** The share payload, derived from that same window. */
  context: JournalShareContext;
}

export function prepareJournalShare(
  rollups: readonly JournalRollup[],
  input: JournalShareWindowInput,
): PreparedJournalShare {
  const window = densifyRollups(
    rollups,
    effectiveRangeKeys({
      now: input.now,
      days: input.rangeDays,
      historyStartAt: input.historyStartAt,
    }),
  );
  // The context is derived from `window`, never from `rollups`. Passing the raw
  // array here would reintroduce the exact disagreement this function exists to
  // make impossible.
  return { window, context: deriveJournalShareContext(window, input.rangeDays) };
}
