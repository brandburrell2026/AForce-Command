/**
 * circleV3Presentation — pure view-model for the flag-gated Community screen
 * V3 (`circle_v3_dashboard_enabled`; founder comp 2026-08-12: "Update the
 * community screen to look like this"). Deterministic: callers pass every
 * input; no store reads, no I/O, no clocks.
 *
 * DATA CONTRACT (founder-directed revision of PR #710's substitution):
 *  - The ranked cohort comes from the SAME pipeline the shipped V2 screen
 *    used: `competitionEngine.buildSnapshot` over the sample roster in
 *    mocks/competitionData.ts, with the member's OWN row carrying live
 *    values (real engine score / compliance / streak-consistency / band).
 *    The cohort is sample data by design (the founder's comp) until the
 *    /v1/competition backend exists — SS-07 remains the founder-owned
 *    register item for that model.
 *  - Everything about YOU is real where a source exists: live engine score
 *    and band (accent via resolveHomePresentation — never statusColor.ts),
 *    real compliance streak, server-persisted weather city when present.
 *  - The weekly challenge is own-baseline only: days with logged intake out
 *    of 7 from real JournalRollups; no rollups → the bar is omitted.
 *  - Score tints on rows use each row's band label through the same
 *    homePresentation accents as every other V3 screen ("lights match").
 */

import type { PerformanceLevel } from '@/types';
import type { CompetitionSnapshot } from '@/services/competitionEngine';
import type { CompetitorUser } from '@/types/competition';
import { resolveHomePresentation } from '@/components/home/homePresentation';
import { bandForScore } from '@/components/hydration/signalV3Presentation';
import { af } from '@/theme';

export type CircleTab = 'rank' | 'cities' | 'friends' | 'challenge';

/**
 * Comp avatar palette (site Community mockup) — cycled by row order. Brand
 * fills map to af.* (Signal Red, Soursop Green); the amber/blue/violet
 * sample-avatar fills are comp-specific and carried in the reviewed
 * rawColorBaseline entry for this file.
 */
export const CIRCLE_AVATAR_PALETTE = [
  '#E8A13A',
  '#5FB0FF',
  af.red,
  '#8C7BFF',
  af.green,
] as const;

export interface CircleV3Inputs {
  snapshot: CompetitionSnapshot;
  /** Server-persisted weather city, or null → the cohort row's city is shown. */
  cityOverride: string | null;
  /** Days with logged intake in the last 7 (real rollups); null = no rollups. */
  hydrationDaysThisWeek: number | null;
  tab: CircleTab;
}

export interface CircleV3YouView {
  initials: string;
  name: string;
  /** "Miami, FL · Peak" pieces (band translated by the component). */
  cityLine: string;
  bandKey: 'peak' | 'balanced' | 'recovering' | 'depleted';
  accent: string;
  /** Rank movement this cycle (the comp's "↑ 12 spots"); null → no pill. */
  deltaSpots: number | null;
  globalRank: number | null;
  cityRank: number | null;
  stateRank: number | null;
  teamRank: number | null;
  score: number;
}

export interface CircleV3Move {
  dir: 'up' | 'down' | 'flat';
  n: number;
}

export interface CircleV3RowView {
  key: string;
  rank: number;
  initials: string;
  avatarColor: string;
  name: string;
  verified: boolean;
  /** Pre-built subtitle pieces; component renders `left · streak`. */
  subtitleLeft: string;
  streakDays: number | null;
  score: number;
  scoreAccent: string;
  move: CircleV3Move;
  isYou: boolean;
}

export interface CircleV3Model {
  you: CircleV3YouView;
  /** Own-baseline weekly hydration; null → bar omitted. */
  challengePct: number | null;
  hydrationDays: number | null;
  tab: CircleTab;
  rows: CircleV3RowView[];
}

function bandKeyFor(level: PerformanceLevel): CircleV3YouView['bandKey'] {
  return level.toLowerCase() as CircleV3YouView['bandKey'];
}

function moveFor(delta: number | undefined): CircleV3Move {
  if (typeof delta !== 'number' || !Number.isFinite(delta) || delta === 0) {
    return { dir: 'flat', n: 0 };
  }
  return { dir: delta > 0 ? 'up' : 'down', n: Math.abs(Math.round(delta)) };
}

function individualRow(u: CompetitorUser, index: number, youId: string): CircleV3RowView {
  return {
    key: u.id,
    rank: u.rank,
    initials: u.avatarInitials,
    avatarColor: CIRCLE_AVATAR_PALETTE[index % CIRCLE_AVATAR_PALETTE.length]!,
    name: u.name,
    verified: u.verified === true,
    subtitleLeft: u.title ?? `${u.city}, ${u.state}`,
    streakDays: typeof u.streakDays === 'number' ? u.streakDays : null,
    score: u.competitionScore,
    // Row band label → the shared accent module (never statusColor.ts).
    scoreAccent: resolveHomePresentation(u.state_label).accent,
    move: moveFor(u.recentDelta),
    isYou: u.id === youId,
  };
}

export function buildCircleV3Model(input: CircleV3Inputs): CircleV3Model {
  const { snapshot } = input;
  const me = snapshot.context;
  const youUser = me.user;

  const cityLine = `${input.cityOverride?.trim() || youUser.city}, ${youUser.state}`;

  const you: CircleV3YouView = {
    initials: youUser.avatarInitials,
    name: youUser.name,
    cityLine,
    bandKey: bandKeyFor(youUser.state_label),
    accent: resolveHomePresentation(youUser.state_label).accent,
    deltaSpots:
      typeof me.recentDelta === 'number' && me.recentDelta !== 0 ? me.recentDelta : null,
    globalRank: me.globalRank ?? null,
    cityRank: me.cityRank ?? null,
    stateRank: me.stateRank ?? null,
    teamRank: me.teamRank ?? null,
    score: youUser.competitionScore,
  };

  const hydrationDays =
    typeof input.hydrationDaysThisWeek === 'number'
      ? Math.max(0, Math.min(7, input.hydrationDaysThisWeek))
      : null;
  const challengePct =
    hydrationDays != null ? Math.round((hydrationDays / 7) * 100) : null;

  let rows: CircleV3RowView[] = [];
  switch (input.tab) {
    case 'rank':
      rows = snapshot.individuals.map((u, i) => individualRow(u, i, youUser.id));
      break;
    case 'cities':
      rows = snapshot.cities.map((c, i) => ({
        key: c.id,
        rank: c.rank,
        initials: c.state,
        avatarColor: CIRCLE_AVATAR_PALETTE[i % CIRCLE_AVATAR_PALETTE.length]!,
        name: c.name,
        verified: false,
        subtitleLeft: `${c.participantCount.toLocaleString()} athletes`,
        streakDays: null,
        score: c.competitionScore,
        scoreAccent: resolveHomePresentation(bandForScore(c.competitionScore)).accent,
        move: moveFor(c.trend === 'up' ? 1 : c.trend === 'down' ? -1 : 0),
        isYou: c.name === youUser.city,
      }));
      break;
    case 'friends': {
      // Your team's roster, re-ranked within the team — no separate dataset.
      const teamId = youUser.teamId;
      rows = snapshot.individuals
        .filter((u) => teamId != null && u.teamId === teamId)
        .map((u, i) => ({ ...individualRow(u, i, youUser.id), rank: i + 1 }));
      break;
    }
    case 'challenge':
      rows = [];
      break;
  }

  return { you, challengePct, hydrationDays, tab: input.tab, rows };
}
