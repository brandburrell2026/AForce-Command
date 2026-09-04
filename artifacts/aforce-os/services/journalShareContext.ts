/**
 * Journal → Share context.
 *
 * Pure helper that turns a window of `JournalRollup` entries into the
 * share-context query params consumed by `/share` (the existing
 * SharePreviewScreen). Lives outside the screen so it is unit-testable
 * without React Native and so the screen stays a thin orchestrator.
 *
 * Headline policy:
 *   - When the user has a meaningful most-recent streak of healthy days
 *     (avgScore >= BALANCED_THRESHOLD for >= 3 consecutive days), the
 *     share leads with the streak (`type=streak&streakDays=N`).
 *   - Otherwise the share leads with the window's average score
 *     (`type=score&score=N&state=<derived>`).
 *
 * Both forms are already supported by the share template engine, so the
 * downstream voice / format / target pickers just work.
 */

import type { JournalRollup } from '../types';
import type { ShareType, StateLabel } from '../types/share';
import { recapStatsScope, classifyStreakEligibility, observedRows } from '../utils/scoring/boundarySeries';
import { computeRecapStats } from '../utils/journalRecapStats';

export interface JournalShareContext {
  type: Extract<ShareType, 'score' | 'streak'>;
  /**
   * NULL when no comparable observation exists — the same condition under which
   * the recap card renders its AVG tile as "—". A number here is a claim the
   * member will post publicly, so it must never be a fallback for "nothing to
   * say": `/share` falls back to the member's LIVE score when this is absent,
   * which is a true present-tense statement rather than a fabricated average.
   */
  score: number | null;
  state: StateLabel | null;
  streakDays?: number;
  rangeDays: number;
}

export const BALANCED_THRESHOLD = 70;
export const MIN_STREAK_FOR_HEADLINE = 3;

export function scoreToStateLabel(s: number): StateLabel {
  if (s >= 90) return 'Peak';
  if (s >= BALANCED_THRESHOLD) return 'Balanced';
  if (s >= 50) return 'Recovering';
  return 'Depleted';
}

export function deriveJournalShareContext(
  rollups: readonly JournalRollup[],
  rangeDays: number,
): JournalShareContext {
  // An empty window has nothing to publish. It used to return
  // `score: 0, state: 'Recovering'` — a fabricated claim in the payload that
  // leaves the app, manufactured out of having no data at all.
  if (rollups.length === 0) {
    return { type: 'score', score: null, state: null, rangeDays };
  }

  // ONE SET OF POPULATIONS, SHARED WITH THE CARD (founder ruling §7,
  // 2026-09-02). The recap card and this payload are two outputs of the SAME
  // tap on the same array, and they were disagreeing: the card rendered
  // "STREAK —" while the params from that same press said `streakDays=14`,
  // which the template engine turned into the copy the member posted publicly.
  //
  // The cause was that this function read the wire directly. It averaged
  // `avgScore` over every row — including the server's sentinel 0 for a day
  // with intakes and no captured snapshot — and its streak walk broke on that
  // same sentinel (`avgScore < BALANCED_THRESHOLD`), scoring an unobserved day
  // as a failure. Both are exactly what the ruling forbids, one function away
  // from the card that had just been fixed.
  //
  // So it now asks the same two questions the card asks, through the same
  // helpers. Neither surface can move without the other.
  const scope = recapStatsScope(rollups);
  const avgScore = scope.length > 0 ? computeRecapStats(scope).avgScore : null;
  const state = avgScore == null ? null : scoreToStateLabel(avgScore);

  // A HydroState-derived streak is UNKNOWABLE across a day HydroState did not
  // observe — it may not be broken (that asserts a failure the member did not
  // have) and may not be skipped (that asserts qualification nobody observed).
  // When it is not eligible, no streak leaves the app at all.
  const eligible = classifyStreakEligibility(rollups).kind === 'eligible';

  // Rollups arrive oldest→newest. Walk from the most recent day backwards and
  // count consecutive *calendar* days that cleared the Balanced threshold.
  // This stays a TRAILING streak, not the card's best-in-window streak: a
  // shared post is a present-tense claim, and posting a best run the member is
  // no longer on would be false in the other direction.
  let streakDays = 0;
  if (eligible) {
    // OBSERVED ROWS ONLY. The dense window always ends at today, which carries
    // the sentinel `avgScore: 0` until the member's first sync after midnight
    // — so walking the raw array broke on that sentinel at the very first step
    // and published a streak of 0 for a member with six qualifying days behind
    // them. A day with no measurement is not a day below the threshold.
    // Adjacency between the OBSERVED days is what still enforces continuity.
    const walk = observedRows(rollups);
    let prevDate: Date | null = null;
    for (let i = walk.length - 1; i >= 0; i--) {
      const r = walk[i]!;
      if (r.avgScore < BALANCED_THRESHOLD) break;
      const d = parseDateUTC(r.date);
      if (!d) break; // malformed date — refuse to count
      if (prevDate && diffInDaysUTC(prevDate, d) !== 1) break;
      streakDays++;
      prevDate = d;
    }
  }

  const type: JournalShareContext['type'] =
    streakDays >= MIN_STREAK_FOR_HEADLINE ? 'streak' : 'score';

  return {
    type,
    score: avgScore,
    state,
    ...(streakDays > 0 ? { streakDays } : {}),
    rangeDays,
  };
}

/**
 * Parse a YYYY-MM-DD rollup date as a UTC midnight Date. Anchoring on
 * UTC sidesteps DST shifts and timezone-induced off-by-one errors when
 * we compare adjacent days.
 */
function parseDateUTC(s: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  const d = new Date(Date.UTC(year, month - 1, day));
  if (
    d.getUTCFullYear() !== year ||
    d.getUTCMonth() !== month - 1 ||
    d.getUTCDate() !== day
  ) {
    return null;
  }
  return d;
}

/** Whole-day difference between two UTC midnight Dates (later − earlier). */
function diffInDaysUTC(later: Date, earlier: Date): number {
  return Math.round((later.getTime() - earlier.getTime()) / 86_400_000);
}

/**
 * Convert the derived context into the query-param shape the `/share`
 * route's `parseContext` accepts. String values only — Expo Router
 * coerces these back to numbers via the screen's allowlist.
 */
export function toShareRouteParams(ctx: JournalShareContext): Record<string, string> {
  const params: Record<string, string> = { type: ctx.type };
  // OMITTED, not zeroed. `SharePreviewScreenV2` falls back to the member's LIVE
  // score when `score` is absent — a true present-tense statement — whereas a
  // `String(null)` or a 0 would post a number nothing measured.
  if (ctx.score != null) params.score = String(ctx.score);
  if (ctx.state != null) params.state = ctx.state;
  if (ctx.streakDays != null) params.streakDays = String(ctx.streakDays);
  return params;
}
