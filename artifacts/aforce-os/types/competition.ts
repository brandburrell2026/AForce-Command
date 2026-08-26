/**
 * Community Competition — type contracts.
 *
 * Hydration becomes sport. Users, teams, cities, and states compete on real
 * physiological performance — not steps, not posts, not vanity metrics.
 */

import type { PerformanceLevel } from './index';

export type CompetitionScope = 'city' | 'state' | 'team' | 'individual';
export type RankTrend = 'up' | 'down' | 'flat' | 'new';

/** Per-user competition profile. */
export interface CompetitorUser {
  id: string;
  name: string;
  avatarInitials: string;
  city: string;
  state: string;
  teamId?: string;
  performanceScore: number;     // 0-100 (avg)
  complianceRate: number;       // 0-1
  consistencyScore: number;     // 0-100 (streak weighted)
  recoveryEfficiency: number;   // 0-100
  competitionScore: number;     // computed
  rank: number;
  trend: RankTrend;
  state_label: PerformanceLevel;
  /** Current streak in days — leaderboard row subtitle (founder comp). */
  streakDays?: number;
  /** Earned title shown instead of city/state (e.g. "Recovery King"). */
  title?: string;
  /** Verified badge on the leaderboard row. */
  verified?: boolean;
  /** Signed rank movement this cycle (+3 = up 3 spots); undefined = flat. */
  recentDelta?: number;
}

/**
 * Aggregated physiological metrics — same axes as CompetitorUser, averaged
 * across the city/state/team population. Drives the spec scoring formula.
 */
export interface AggregateMetrics {
  averagePerformance: number;   // 0-100
  averageCompliance: number;    // 0-1
  averageConsistency: number;   // 0-100
  averageRecovery: number;      // 0-100
}

export interface CompetitorCity extends AggregateMetrics {
  id: string;
  name: string;
  state: string;
  participantCount: number;
  averageScore: number;          // legacy display field (= averagePerformance)
  competitionScore: number;
  rank: number;
  trend: RankTrend;
  momentum: 'rising' | 'steady' | 'cooling';
}

export interface CompetitorState extends AggregateMetrics {
  id: string;
  name: string;
  abbr: string;
  cityCount: number;
  participantCount: number;
  averageScore: number;
  competitionScore: number;
  rank: number;
  trend: RankTrend;
}

export interface CompetitorTeam extends AggregateMetrics {
  id: string;
  name: string;
  city: string;
  rosterSize: number;
  averageScore: number;
  competitionScore: number;
  rank: number;
  trend: RankTrend;
  banner: string;     // short tagline
}

export type LeaderboardEntry =
  | { kind: 'city';       entry: CompetitorCity }
  | { kind: 'state';      entry: CompetitorState }
  | { kind: 'team';       entry: CompetitorTeam }
  | { kind: 'individual'; entry: CompetitorUser };

export interface UserCompetitionContext {
  user: CompetitorUser;
  cityRank?: number;
  stateRank?: number;
  teamRank?: number;
  globalRank?: number;
  /** Recent rank delta (e.g., +12 spots up). */
  recentDelta: number;
}
