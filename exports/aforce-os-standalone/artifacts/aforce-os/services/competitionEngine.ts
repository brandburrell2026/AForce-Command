/**
 * Competition Engine.
 *
 * Pure ranking/scoring layer. Deterministic. Real-time-ready: re-running
 * after a state change re-ranks every group consistently.
 *
 * Formula (per spec):
 *   competition_score =
 *     avg_performance_score * 0.35 +
 *     compliance_rate       * 0.25 +
 *     consistency_score     * 0.20 +
 *     recovery_efficiency   * 0.20
 */

import type {
  CompetitorCity,
  CompetitorState,
  CompetitorTeam,
  CompetitorUser,
  UserCompetitionContext,
} from '../types/competition';
import {
  MOCK_CITIES, MOCK_STATES, MOCK_TEAMS, MOCK_INDIVIDUALS,
  MOCK_USER_CONTEXT, CURRENT_USER_KEY,
} from '../mocks/competitionData';

// ─── Per-user real-time score injection ──────────────────────────────────────
// When the user's live performance score changes, the "You" row updates and
// the leaderboard re-ranks. Pure function — easy to unit test.

export interface ApplyLiveArgs {
  liveUserScore: number;          // 0-100 from app store
  liveCompliance?: number;        // 0-1 (units consumed / target)
  liveConsistency?: number;       // 0-100 (streak based)
  liveRecovery?: number;          // 0-100
  liveStateLabel?: CompetitorUser['state_label'];
}

function clamp(n: number, lo: number, hi: number): number {
  if (!Number.isFinite(n)) return lo;
  return Math.max(lo, Math.min(hi, n));
}

/**
 * Spec formula — applied identically to individuals AND aggregates.
 *   competition_score =
 *     avg_performance_score * 0.35 +
 *     compliance_rate (0-100) * 0.25 +
 *     consistency_score * 0.20 +
 *     recovery_efficiency * 0.20
 */
function specScore(perf: number, complianceFraction: number, consistency: number, recovery: number): number {
  const p = clamp(perf, 0, 100);
  const c = clamp(complianceFraction * 100, 0, 100);
  const k = clamp(consistency, 0, 100);
  const r = clamp(recovery, 0, 100);
  return Math.round(p * 0.35 + c * 0.25 + k * 0.20 + r * 0.20);
}

function userCompetitionScore(u: CompetitorUser): number {
  return specScore(u.performanceScore, u.complianceRate, u.consistencyScore, u.recoveryEfficiency);
}

function rerank<T extends { competitionScore: number; rank: number }>(items: T[]): T[] {
  const sorted = [...items].sort((a, b) => b.competitionScore - a.competitionScore);
  sorted.forEach((it, i) => { it.rank = i + 1; });
  return sorted;
}

// ─── Snapshot builder ────────────────────────────────────────────────────────
export interface CompetitionSnapshot {
  cities: CompetitorCity[];
  states: CompetitorState[];
  teams: CompetitorTeam[];
  individuals: CompetitorUser[];
  context: UserCompetitionContext;
  /** True if any city has competitionScore >= 90 (drives the "city wins" wow). */
  cityWinsAvailable: boolean;
}

export function buildSnapshot(args: ApplyLiveArgs): CompetitionSnapshot {
  const liveScore = clamp(args.liveUserScore, 0, 100);

  // 1) Update the "You" row in the individual leaderboard with live data.
  const individuals: CompetitorUser[] = MOCK_INDIVIDUALS.map((u) => {
    if (u.id !== CURRENT_USER_KEY) {
      return { ...u, competitionScore: userCompetitionScore(u) };
    }
    const updated: CompetitorUser = {
      ...u,
      performanceScore: liveScore,
      complianceRate:    args.liveCompliance ?? u.complianceRate,
      consistencyScore:  args.liveConsistency ?? u.consistencyScore,
      recoveryEfficiency: args.liveRecovery   ?? u.recoveryEfficiency,
      state_label:       args.liveStateLabel  ?? u.state_label,
      competitionScore: 0,
    };
    updated.competitionScore = userCompetitionScore(updated);
    return updated;
  });

  const rankedIndividuals = rerank(individuals);

  // 2) City scores — same spec formula, aggregated metrics.
  const cities: CompetitorCity[] = MOCK_CITIES.map((c) => ({
    ...c,
    competitionScore: specScore(c.averagePerformance, c.averageCompliance, c.averageConsistency, c.averageRecovery),
  }));
  const rankedCities = rerank(cities);

  // 3) State scores — same spec formula.
  const states: CompetitorState[] = MOCK_STATES.map((s) => ({
    ...s,
    competitionScore: specScore(s.averagePerformance, s.averageCompliance, s.averageConsistency, s.averageRecovery),
  }));
  const rankedStates = rerank(states);

  // 4) Team scores — same spec formula.
  const teams: CompetitorTeam[] = MOCK_TEAMS.map((t) => ({
    ...t,
    competitionScore: specScore(t.averagePerformance, t.averageCompliance, t.averageConsistency, t.averageRecovery),
  }));
  const rankedTeams = rerank(teams);

  // 5) Build user context — find ranks across scopes.
  const me = rankedIndividuals.find(u => u.id === CURRENT_USER_KEY)!;
  const myCity  = rankedCities.find(c => c.name === me.city);
  const myState = rankedStates.find(s => s.name === me.state || s.abbr === me.state);
  const myTeam  = rankedTeams.find(t => t.id === me.teamId);

  const context: UserCompetitionContext = {
    user: me,
    cityRank:   myCity?.rank,
    stateRank:  myState?.rank,
    teamRank:   myTeam?.rank,
    globalRank: me.rank,
    recentDelta: MOCK_USER_CONTEXT.recentDelta,
  };

  return {
    cities: rankedCities,
    states: rankedStates,
    teams: rankedTeams,
    individuals: rankedIndividuals,
    context,
    cityWinsAvailable: rankedCities[0]?.competitionScore >= 90,
  };
}

// ─── Helpers exposed for components ──────────────────────────────────────────
export function trendArrow(trend: 'up' | 'down' | 'flat' | 'new'): '▲' | '▼' | '–' | '★' {
  switch (trend) {
    case 'up':   return '▲';
    case 'down': return '▼';
    case 'new':  return '★';
    default:     return '–';
  }
}
