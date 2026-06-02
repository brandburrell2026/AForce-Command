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

export interface JournalShareContext {
  type: Extract<ShareType, 'score' | 'streak'>;
  score: number;
  state: StateLabel;
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
  if (rollups.length === 0) {
    return { type: 'score', score: 0, state: 'Recovering', rangeDays };
  }

  const avgScore = Math.round(
    rollups.reduce((acc, r) => acc + r.avgScore, 0) / rollups.length,
  );
  const state = scoreToStateLabel(avgScore);

  // Rollups arrive oldest→newest. Walk from the most recent day backwards
  // and count consecutive *calendar* days that cleared the Balanced
  // threshold. /journal/rollups omits days with no data, so we cannot
  // simply count consecutive rows — a high-score row separated from the
  // next high-score row by a missing calendar day must break the streak.
  // Otherwise we would post a "5 day streak" that actually spans a gap,
  // which is exactly the kind of integrity risk worth avoiding when the
  // payload exits the app to social media.
  let streakDays = 0;
  let prevDate: Date | null = null;
  for (let i = rollups.length - 1; i >= 0; i--) {
    const r = rollups[i];
    if (r.avgScore < BALANCED_THRESHOLD) break;
    const d = parseDateUTC(r.date);
    if (!d) break; // malformed date — refuse to count
    if (prevDate && diffInDaysUTC(prevDate, d) !== 1) break;
    streakDays++;
    prevDate = d;
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
  const params: Record<string, string> = {
    type: ctx.type,
    score: String(ctx.score),
    state: ctx.state,
  };
  if (ctx.streakDays != null) params.streakDays = String(ctx.streakDays);
  return params;
}
