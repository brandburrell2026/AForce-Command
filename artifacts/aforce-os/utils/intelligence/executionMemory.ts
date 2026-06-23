/**
 * Execution Memory™ — pure read-only recap of how the member has been
 * FOLLOWING AForce commands recently, derived entirely from the shared
 * Command-Event Ledger's `command_confirmation` events.
 *
 * This is the command-behaviour expansion of Performance Memory™: where
 * `performanceMemory.ts` remembers the morning Voice Check-In self-report,
 * this remembers EXECUTION — "you've followed N of your recent commands,
 * X-day execution streak." It is the second "the system remembers you"
 * surface, and it reads the SAME ledger that Command Confidence™ writes.
 *
 * ── Score-Protection (hard lock) ──────────────────────────────────────────
 * Strictly READ-ONLY / pure. It MEASURES already-recorded confirmations and
 * NEVER reads into, awards, mutates, or fabricates the performance score.
 * Critically it is a SURFACE primitive only: the follow-rate is reported for
 * display, and is NEVER fed into `deriveCommandConfidence` — doing so would
 * let follow-rate silently upgrade a recommendation's confidence, the exact
 * breach `commandEventAdapters` documents and forbids. Confidence's inputs
 * stay untouched; this layer only describes behaviour that already happened.
 *
 * ── No fabrication ────────────────────────────────────────────────────────
 * Below `ADHERENCE_MIN_SAMPLES` confirmations in the window it reports
 * 'insufficient' with a null rate/trend rather than guessing; with no history
 * at all it reports 'empty'. Malformed / out-of-window / non-confirmation
 * events are dropped, never invented.
 *
 * ── Day-index convention ──────────────────────────────────────────────────
 * `command_confirmation` events bucket by the UTC day
 * (`floor(occurredAtMs / 86_400_000)`), so the execution streak and its
 * "live today/yesterday" test both use the UTC day index — NOT the local
 * calendar day that Voice Check-In streaks (`performanceMemory.ts`) use. The
 * two streak helpers are intentionally kept SEPARATE to avoid mixing
 * incompatible day buckets.
 *
 * Pure + RN-free (type-only app imports are erased at build) so it stays
 * unit-testable under the vitest pure-test runner. `nowMs` is injected for
 * deterministic windows.
 */

import {
  eventsInWindow,
  type CommandEvent,
  type CommandConfirmationCommandEvent,
} from './commandEvents';
import {
  deriveLedgerAdherence,
  ADHERENCE_WINDOW_MS,
} from './commandEventAdapters';

const MS_PER_DAY = 86_400_000;

/**
 * Each half of the trailing window needs at least this many confirmations
 * before a trend is claimed — defence against a single-sample half swinging
 * the read.
 */
export const EXECUTION_TREND_MIN_PER_HALF = 2;

/**
 * Minimum follow-rate change (0..1) between the older and newer half of the
 * window to read as improving / declining; anything smaller is 'steady'.
 */
export const EXECUTION_TREND_EPSILON = 0.1;

export type ExecutionTrend = 'improving' | 'steady' | 'declining';

export interface ExecutionMemoryResult {
  /** 'empty' with no history, 'insufficient' below the sample floor, else 'ready'. */
  status: 'empty' | 'insufficient' | 'ready';
  /** Confirmations counted in the trailing window. */
  sampleSize: number;
  /** How many of those were "followed". */
  followed: number;
  /** followed / sampleSize once at/above the sample floor, else null. */
  followedRate: number | null;
  /**
   * Consecutive UTC days (ending at the latest followed day) that each had at
   * least one followed confirmation. 0 unless the latest followed day is today
   * or yesterday (the streak is otherwise no longer "live").
   */
  executionStreak: number;
  /** UTC day index of the most recent followed confirmation, or null. */
  latestFollowedDayIndex: number | null;
  /** Newer-half vs older-half follow-rate trend, or null below the floor. */
  trend: ExecutionTrend | null;
  /** Most-followed `commandType` in the window (recency tie-break), or null. */
  topCommandType: string | null;
  /** One-line plain recap (English, matching the performanceMemory convention). */
  recap: string;
}

function isFiniteNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

/** UTC day bucket — same convention `command_confirmation` events are stored with. */
function utcDay(ms: number): number {
  return Math.floor(ms / MS_PER_DAY);
}

function followedCount(events: readonly CommandConfirmationCommandEvent[]): number {
  return events.reduce((acc, e) => acc + (e.followed ? 1 : 0), 0);
}

/**
 * Compute the Execution Memory recap. Pure + deterministic.
 *
 * `nowMs` bounds the trailing window and decides whether the execution streak
 * is still "live"; it never fabricates data. `windowMs` defaults to the same
 * 14-day window the adherence primitive uses.
 */
export function computeExecutionMemory(
  events: readonly CommandEvent[],
  nowMs: number = Date.now(),
  windowMs: number = ADHERENCE_WINDOW_MS,
): ExecutionMemoryResult {
  const now = isFiniteNumber(nowMs) ? nowMs : Date.now();
  const span = isFiniteNumber(windowMs) && windowMs > 0 ? windowMs : ADHERENCE_WINDOW_MS;

  // Windowed command_confirmation events (eventsInWindow already drops NaN /
  // out-of-range timestamps, so this set matches deriveLedgerAdherence's).
  const windowed = eventsInWindow(events, now - span, now).filter(
    (e): e is CommandConfirmationCommandEvent => e.kind === 'command_confirmation',
  );

  if (windowed.length === 0) return emptyResult();

  // Headline counts + sample floor come from the existing adherence primitive,
  // so the displayed rate can never disagree with the learning primitive.
  const adherence = deriveLedgerAdherence(events, now, span);
  const { sampleSize, followed, followedRate } = adherence;

  const followedEvents = windowed.filter((e) => e.followed === true);
  const { executionStreak, latestFollowedDayIndex } = computeStreak(followedEvents, now);
  const topCommandType = computeTopCommandType(followedEvents);

  if (adherence.status === 'insufficient') {
    return {
      status: 'insufficient',
      sampleSize,
      followed,
      followedRate: null,
      executionStreak,
      latestFollowedDayIndex,
      trend: null,
      topCommandType,
      recap: 'Building your execution memory — keep following your commands.',
    };
  }

  const trend = computeTrend(windowed, now, span);

  return {
    status: 'ready',
    sampleSize,
    followed,
    followedRate,
    executionStreak,
    latestFollowedDayIndex,
    trend,
    topCommandType,
    recap: buildRecap(executionStreak, followed, sampleSize, trend),
  };
}

// ─── internals ────────────────────────────────────────────────────────────

function emptyResult(): ExecutionMemoryResult {
  return {
    status: 'empty',
    sampleSize: 0,
    followed: 0,
    followedRate: null,
    executionStreak: 0,
    latestFollowedDayIndex: null,
    trend: null,
    topCommandType: null,
    recap: 'Follow your first command to start your execution memory.',
  };
}

/**
 * Consecutive-UTC-day execution streak from the FOLLOWED confirmations. A day
 * counts when it had at least one followed confirmation; days are deduped so
 * multiple confirmations on one day count once. The streak is live only when
 * the latest followed day is today or yesterday relative to `nowMs`.
 */
function computeStreak(
  followedEvents: readonly CommandConfirmationCommandEvent[],
  nowMs: number,
): { executionStreak: number; latestFollowedDayIndex: number | null } {
  if (followedEvents.length === 0) {
    return { executionStreak: 0, latestFollowedDayIndex: null };
  }
  const daySet = new Set<number>();
  for (const e of followedEvents) daySet.add(utcDay(e.occurredAtMs));
  const days = [...daySet].sort((a, b) => a - b);
  const latest = days[days.length - 1];

  // Not live when the latest followed day is older than yesterday.
  if (utcDay(nowMs) - latest > 1) {
    return { executionStreak: 0, latestFollowedDayIndex: latest };
  }

  let streak = 1;
  for (let i = days.length - 1; i > 0; i--) {
    if (days[i] - days[i - 1] === 1) streak++;
    else break;
  }
  return { executionStreak: streak, latestFollowedDayIndex: latest };
}

/**
 * The most-followed `commandType` among followed confirmations, breaking ties
 * by recency (the type the member followed most recently). Returns null when no
 * followed confirmation carried a usable commandType.
 */
function computeTopCommandType(
  followedEvents: readonly CommandConfirmationCommandEvent[],
): string | null {
  const counts = new Map<string, { count: number; lastAt: number }>();
  for (const e of followedEvents) {
    if (typeof e.commandType !== 'string' || e.commandType.length === 0) continue;
    const prev = counts.get(e.commandType);
    if (prev) {
      prev.count += 1;
      if (e.occurredAtMs > prev.lastAt) prev.lastAt = e.occurredAtMs;
    } else {
      counts.set(e.commandType, { count: 1, lastAt: e.occurredAtMs });
    }
  }
  let best: string | null = null;
  let bestCount = 0;
  let bestLastAt = -Infinity;
  for (const [type, { count, lastAt }] of counts) {
    if (count > bestCount || (count === bestCount && lastAt > bestLastAt)) {
      best = type;
      bestCount = count;
      bestLastAt = lastAt;
    }
  }
  return best;
}

/**
 * Newer-half vs older-half follow-rate trend across the window, split at the
 * window midpoint. Returns null unless BOTH halves clear
 * `EXECUTION_TREND_MIN_PER_HALF`, so a sparse half can never swing the read.
 */
function computeTrend(
  windowed: readonly CommandConfirmationCommandEvent[],
  nowMs: number,
  span: number,
): ExecutionTrend | null {
  const mid = nowMs - span / 2;
  const older = windowed.filter((e) => e.occurredAtMs < mid);
  const newer = windowed.filter((e) => e.occurredAtMs >= mid);
  if (
    older.length < EXECUTION_TREND_MIN_PER_HALF ||
    newer.length < EXECUTION_TREND_MIN_PER_HALF
  ) {
    return null;
  }
  const diff = followedCount(newer) / newer.length - followedCount(older) / older.length;
  if (diff > EXECUTION_TREND_EPSILON) return 'improving';
  if (diff < -EXECUTION_TREND_EPSILON) return 'declining';
  return 'steady';
}

function buildRecap(
  streak: number,
  followed: number,
  sampleSize: number,
  trend: ExecutionTrend | null,
): string {
  const streakPart =
    streak >= 2
      ? `${streak}-day execution streak.`
      : streak === 1
        ? 'Back on track — 1 day on your commands.'
        : "Execution streak reset — follow today's command to rebuild it.";
  const ratePart = ` You've followed ${followed} of ${sampleSize} recent commands.`;
  const trendPart =
    trend === 'improving'
      ? ' Trending up — lock in.'
      : trend === 'declining'
        ? ' Slipping — start with water and lock back in.'
        : '';
  return `${streakPart}${ratePart}${trendPart}`;
}
