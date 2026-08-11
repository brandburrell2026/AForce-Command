/**
 * circleV3Presentation — pure view-model for the flag-gated Circle screen V3
 * (`circle_v3_dashboard_enabled`, founder comps 2026-08-11; canonical name
 * "Circle" per RC-L1 founder ruling 2026-07-26). Deterministic: callers pass
 * every input; no store reads, no I/O, no clocks.
 *
 * HONEST-DATA CONTRACT (recon wf_52be292a-d9c):
 *  - The comp's ranked leaderboard of named people with city/state is NOT
 *    renderable honestly (competitionEngine ranks MOCK_INDIVIDUALS; the comp's
 *    "up 12 spots" is the hardcoded mock `recentDelta: 12`), and a public
 *    named leaderboard is stop-shipped (SS-07). The boards here are the app's
 *    ONLY real cross-user surface: the anonymous referral leaderboard
 *    (GET /api/referrals/leaderboard — "Operator XXXX" handles, zero PII,
 *    recognition only). No named humans, live or sample.
 *  - "You" carries only real fields: engine score/band, real score trend
 *    (useScoreTrend), compliance streak (same field Protocol V3 renders),
 *    profile display name, server-persisted weather city. Missing → omitted.
 *  - Weekly challenge is own-baseline only (Compliance §5: users are never
 *    compared to one another): days with logged intake out of the last 7,
 *    from real JournalRollups. No rollups → posture, never a number.
 *  - Friends online / activity feed have NO real source (circle members are
 *    mock-seeded client caches) → those comp sections are omitted entirely.
 *  - The comp's always-on "LIVE" pill is corrected: live only when the boards
 *    actually returned server data.
 */

import type { JournalRollup, PerformanceLevel } from '@/types';
import type { ScoreTrend } from '@/hooks/useScoreTrend';
import { resolveHomePresentation } from '@/components/home/homePresentation';

/** Matches @workspace/api-client-react's ReferralLeaderboard (structural). */
export interface CircleBoardEntry {
  handle: string;
  tier: { label: string };
  claims: number;
  rank: number;
  isYou: boolean;
}
export interface CircleBoard {
  entries: CircleBoardEntry[];
  yourRank: number; // 0 = unranked
  yourClaims: number;
  totalParticipants: number;
}

export interface CircleV3Inputs {
  score: number;
  level: PerformanceLevel;
  trend: ScoreTrend | null;
  displayName: string;
  /** Server-persisted weather city, or null — never a geocoder fallback. */
  city: string | null;
  complianceStreak: number;
  /** Last-7-day rollups; empty array = challenge renders its posture. */
  rollups: JournalRollup[];
  /** Referral leaderboard; null = still loading or failed (see boardFailed). */
  board: CircleBoard | null;
  boardFailed: boolean;
}

export interface CircleYouView {
  initials: string;
  /** "City · Band" pieces; city omitted when unknown. */
  city: string | null;
  bandKey: 'peak' | 'balanced' | 'recovering' | 'depleted';
  accent: string;
  score: number;
  streak: number;
  /** Real score movement; null when flat (no pill, comp's fake "↑12 spots" dropped). */
  trendPill: { direction: 'rising' | 'falling'; delta: number } | null;
  /** Real board rank; null = unranked (chip renders an em dash). */
  boardRank: number | null;
  claims: number;
}

export interface CircleChallengeView {
  /** Days with any logged intake in the window. */
  hydrationDays: number;
  windowDays: number;
  fraction: number; // 0..1
}

export type CircleBoardStatus = 'live' | 'loading' | 'empty' | 'offline';

export interface CircleBoardRowView {
  rank: number;
  handle: string;
  tierLabel: string;
  claims: number;
  isYou: boolean;
}

export interface CircleV3Model {
  live: boolean;
  you: CircleYouView;
  challenge: CircleChallengeView | null;
  boardStatus: CircleBoardStatus;
  boardRows: CircleBoardRowView[];
  /** Rendered under the list when ranked but absent from the visible rows. */
  youRow: CircleBoardRowView | null;
  stats: { operators: number; yourClaims: number; topTier: string | null } | null;
}

export const CIRCLE_BOARD_MAX_ROWS = 10;

export function initialsFor(displayName: string): string {
  const parts = displayName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '—';
  const first = parts[0]!.charAt(0);
  const last = parts.length > 1 ? parts[parts.length - 1]!.charAt(0) : '';
  return (first + last).toUpperCase();
}

export function buildCircleV3Model(input: CircleV3Inputs): CircleV3Model {
  const presentation = resolveHomePresentation(input.level);
  const score = Math.max(0, Math.min(100, Math.round(input.score)));

  const trendPill =
    input.trend && input.trend.direction !== 'flat'
      ? {
          direction: input.trend.direction,
          delta: Math.abs(Math.round(input.trend.delta)),
        }
      : null;

  const board = input.board;
  const boardRows: CircleBoardRowView[] = (board?.entries ?? [])
    .slice(0, CIRCLE_BOARD_MAX_ROWS)
    .map((e) => ({
      rank: e.rank,
      handle: e.handle,
      tierLabel: e.tier.label,
      claims: Math.max(0, e.claims),
      isYou: e.isYou,
    }));
  const youRow: CircleBoardRowView | null =
    board && board.yourRank > 0 && !boardRows.some((r) => r.isYou)
      ? (() => {
          const own = board.entries.find((e) => e.isYou);
          return {
            rank: board.yourRank,
            handle: own?.handle ?? 'You',
            tierLabel: own?.tier.label ?? '',
            claims: board.yourClaims,
            isYou: true,
          };
        })()
      : null;

  const boardStatus: CircleBoardStatus = board
    ? boardRows.length > 0
      ? 'live'
      : 'empty'
    : input.boardFailed
      ? 'offline'
      : 'loading';

  const hydrationDays = input.rollups.filter((r) => r.endUnitsConsumed > 0).length;
  const challenge: CircleChallengeView | null =
    input.rollups.length > 0
      ? {
          hydrationDays,
          windowDays: 7,
          fraction: Math.max(0, Math.min(1, hydrationDays / 7)),
        }
      : null;

  return {
    live: boardStatus === 'live',
    you: {
      initials: initialsFor(input.displayName),
      city: input.city?.trim() ? input.city.trim() : null,
      bandKey: input.level.toLowerCase() as CircleYouView['bandKey'],
      accent: presentation.accent,
      score,
      streak: Math.max(0, input.complianceStreak | 0),
      trendPill,
      boardRank: board && board.yourRank > 0 ? board.yourRank : null,
      claims: board?.yourClaims ?? 0,
    },
    challenge,
    boardStatus,
    boardRows,
    youRow,
    stats:
      board && boardRows.length > 0
        ? {
            operators: board.totalParticipants,
            yourClaims: board.yourClaims,
            topTier: boardRows[0]?.tierLabel ?? null,
          }
        : null,
  };
}
