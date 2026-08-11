/**
 * Mock competition dataset. Stable, deterministic, premium-feeling.
 * In production this would be served by /v1/competition/* and live-updated.
 */

import type {
  CompetitorCity, CompetitorState, CompetitorTeam, CompetitorUser, UserCompetitionContext,
} from '../types/competition';

export const MOCK_CITIES: CompetitorCity[] = [
  { id: 'nyc',  name: 'New York',     state: 'NY', participantCount: 4128, averageScore: 88, averagePerformance: 88, averageCompliance: 0.91, averageConsistency: 86, averageRecovery: 87, competitionScore: 0, rank: 0, trend: 'up',   momentum: 'rising'  },
  { id: 'mia',  name: 'Miami',        state: 'FL', participantCount: 3041, averageScore: 86, averagePerformance: 86, averageCompliance: 0.93, averageConsistency: 88, averageRecovery: 84, competitionScore: 0, rank: 0, trend: 'up',   momentum: 'rising'  },
  { id: 'la',   name: 'Los Angeles',  state: 'CA', participantCount: 5223, averageScore: 84, averagePerformance: 84, averageCompliance: 0.86, averageConsistency: 82, averageRecovery: 83, competitionScore: 0, rank: 0, trend: 'flat', momentum: 'steady'  },
  { id: 'phx',  name: 'Phoenix',      state: 'AZ', participantCount: 1894, averageScore: 83, averagePerformance: 83, averageCompliance: 0.84, averageConsistency: 79, averageRecovery: 81, competitionScore: 0, rank: 0, trend: 'down', momentum: 'cooling' },
  { id: 'aus',  name: 'Austin',       state: 'TX', participantCount: 2310, averageScore: 82, averagePerformance: 82, averageCompliance: 0.85, averageConsistency: 80, averageRecovery: 80, competitionScore: 0, rank: 0, trend: 'up',   momentum: 'rising'  },
  { id: 'chi',  name: 'Chicago',      state: 'IL', participantCount: 2902, averageScore: 80, averagePerformance: 80, averageCompliance: 0.82, averageConsistency: 78, averageRecovery: 79, competitionScore: 0, rank: 0, trend: 'flat', momentum: 'steady'  },
  { id: 'den',  name: 'Denver',       state: 'CO', participantCount: 1554, averageScore: 79, averagePerformance: 79, averageCompliance: 0.81, averageConsistency: 76, averageRecovery: 78, competitionScore: 0, rank: 0, trend: 'down', momentum: 'cooling' },
  { id: 'sea',  name: 'Seattle',      state: 'WA', participantCount: 1721, averageScore: 78, averagePerformance: 78, averageCompliance: 0.83, averageConsistency: 77, averageRecovery: 78, competitionScore: 0, rank: 0, trend: 'up',   momentum: 'rising'  },
];

export const MOCK_STATES: CompetitorState[] = [
  { id: 'fl', name: 'Florida',     abbr: 'FL', cityCount: 12, participantCount: 9034,  averageScore: 87, averagePerformance: 87, averageCompliance: 0.92, averageConsistency: 85, averageRecovery: 84, competitionScore: 0, rank: 0, trend: 'up'   },
  { id: 'ny', name: 'New York',    abbr: 'NY', cityCount: 8,  participantCount: 6210,  averageScore: 86, averagePerformance: 86, averageCompliance: 0.90, averageConsistency: 84, averageRecovery: 85, competitionScore: 0, rank: 0, trend: 'up'   },
  { id: 'ca', name: 'California',  abbr: 'CA', cityCount: 14, participantCount: 14188, averageScore: 83, averagePerformance: 83, averageCompliance: 0.85, averageConsistency: 81, averageRecovery: 82, competitionScore: 0, rank: 0, trend: 'flat' },
  { id: 'tx', name: 'Texas',       abbr: 'TX', cityCount: 11, participantCount: 8021,  averageScore: 82, averagePerformance: 82, averageCompliance: 0.84, averageConsistency: 79, averageRecovery: 80, competitionScore: 0, rank: 0, trend: 'up'   },
  { id: 'az', name: 'Arizona',     abbr: 'AZ', cityCount: 5,  participantCount: 3204,  averageScore: 81, averagePerformance: 81, averageCompliance: 0.83, averageConsistency: 77, averageRecovery: 79, competitionScore: 0, rank: 0, trend: 'down' },
  { id: 'co', name: 'Colorado',    abbr: 'CO', cityCount: 6,  participantCount: 2810,  averageScore: 79, averagePerformance: 79, averageCompliance: 0.80, averageConsistency: 76, averageRecovery: 77, competitionScore: 0, rank: 0, trend: 'down' },
];

export const MOCK_TEAMS: CompetitorTeam[] = [
  { id: 't1', name: 'Iron Pulse',     city: 'Miami',    rosterSize: 18, averageScore: 92, averagePerformance: 92, averageCompliance: 0.95, averageConsistency: 92, averageRecovery: 90, competitionScore: 0, rank: 0, trend: 'up',   banner: 'Game day, every day.' },
  { id: 't2', name: 'Strike Crew',    city: 'New York', rosterSize: 22, averageScore: 89, averagePerformance: 89, averageCompliance: 0.92, averageConsistency: 89, averageRecovery: 87, competitionScore: 0, rank: 0, trend: 'up',   banner: 'No off cycles.' },
  { id: 't3', name: 'High Altitude',  city: 'Denver',   rosterSize: 14, averageScore: 86, averagePerformance: 86, averageCompliance: 0.88, averageConsistency: 85, averageRecovery: 86, competitionScore: 0, rank: 0, trend: 'flat', banner: 'Thin air. Heavy work.' },
  { id: 't4', name: 'Ridge Runners',  city: 'Austin',   rosterSize: 19, averageScore: 84, averagePerformance: 84, averageCompliance: 0.86, averageConsistency: 82, averageRecovery: 83, competitionScore: 0, rank: 0, trend: 'down', banner: 'We hold the line.' },
  { id: 't5', name: 'Gulf Tide',      city: 'Miami',    rosterSize: 16, averageScore: 83, averagePerformance: 83, averageCompliance: 0.87, averageConsistency: 81, averageRecovery: 82, competitionScore: 0, rank: 0, trend: 'up',   banner: 'Pull through the heat.' },
];

const CURRENT_USER_ID = 'me';

export const MOCK_INDIVIDUALS: CompetitorUser[] = [
  // "You" is the only row that receives LIVE values (competitionEngine
  // injects the real engine score / compliance / streak-consistency).
  { id: CURRENT_USER_ID, name: 'You', avatarInitials: 'YO', city: 'Miami', state: 'FL', teamId: 't1', performanceScore: 84, complianceRate: 0.86, consistencyScore: 78, recoveryEfficiency: 82, competitionScore: 0, rank: 0, trend: 'up', state_label: 'BALANCED' },
  // Sample cohort — matches the founder's Community comp (2026-08-12) and
  // the marketing site's Community mockup roster. All four axes are set to
  // the target display score so the spec formula computes it exactly.
  { id: 'u1',  name: 'Jordan A.', avatarInitials: 'JA', city: 'Miami',    state: 'FL', teamId: 't1', performanceScore: 95, complianceRate: 0.95, consistencyScore: 95, recoveryEfficiency: 95, competitionScore: 0, rank: 0, trend: 'up',   state_label: 'PEAK',       streakDays: 7,  verified: true,  recentDelta: 3 },
  { id: 'u2',  name: 'Alicia R.', avatarInitials: 'AR', city: 'Miami',    state: 'FL',               performanceScore: 93, complianceRate: 0.93, consistencyScore: 93, recoveryEfficiency: 93, competitionScore: 0, rank: 0, trend: 'flat', state_label: 'PEAK',       streakDays: 30, verified: true,  title: 'Perfect Hydration' },
  { id: 'u3',  name: 'Marcus K.', avatarInitials: 'MK', city: 'Miami',    state: 'FL',               performanceScore: 90, complianceRate: 0.90, consistencyScore: 90, recoveryEfficiency: 90, competitionScore: 0, rank: 0, trend: 'up',   state_label: 'PEAK',       streakDays: 21,                  title: 'Recovery King', recentDelta: 1 },
  { id: 'u4',  name: 'Sasha P.',  avatarInitials: 'SP', city: 'Austin',   state: 'TX', teamId: 't4', performanceScore: 88, complianceRate: 0.88, consistencyScore: 88, recoveryEfficiency: 88, competitionScore: 0, rank: 0, trend: 'down', state_label: 'BALANCED',   streakDays: 9,                   recentDelta: -1 },
  { id: 'u5',  name: 'Cam B.',    avatarInitials: 'CB', city: 'Denver',   state: 'CO', teamId: 't3', performanceScore: 86, complianceRate: 0.86, consistencyScore: 86, recoveryEfficiency: 86, competitionScore: 0, rank: 0, trend: 'up',   state_label: 'BALANCED',   streakDays: 6,                   recentDelta: 2 },
  { id: 'u6',  name: 'Devon R.',  avatarInitials: 'DR', city: 'New York', state: 'NY', teamId: 't2', performanceScore: 78, complianceRate: 0.78, consistencyScore: 78, recoveryEfficiency: 78, competitionScore: 0, rank: 0, trend: 'down', state_label: 'RECOVERING', streakDays: 14,                  recentDelta: -2 },
  { id: 'u7',  name: 'Priya N.',  avatarInitials: 'PN', city: 'Chicago',  state: 'IL',               performanceScore: 75, complianceRate: 0.75, consistencyScore: 75, recoveryEfficiency: 75, competitionScore: 0, rank: 0, trend: 'up',   state_label: 'RECOVERING', streakDays: 5,  verified: true,  recentDelta: 4 },
  { id: 'u8',  name: 'Tyler M.',  avatarInitials: 'TM', city: 'Seattle',  state: 'WA',               performanceScore: 73, complianceRate: 0.73, consistencyScore: 73, recoveryEfficiency: 73, competitionScore: 0, rank: 0, trend: 'down', state_label: 'RECOVERING', streakDays: 4,                   recentDelta: -1 },
  { id: 'u9',  name: 'Nina K.',   avatarInitials: 'NK', city: 'Boston',   state: 'MA',               performanceScore: 72, complianceRate: 0.72, consistencyScore: 72, recoveryEfficiency: 72, competitionScore: 0, rank: 0, trend: 'up',   state_label: 'RECOVERING', streakDays: 11, verified: true,  recentDelta: 2 },
  { id: 'u10', name: 'Andre L.',  avatarInitials: 'AL', city: 'Houston',  state: 'TX',               performanceScore: 70, complianceRate: 0.70, consistencyScore: 70, recoveryEfficiency: 70, competitionScore: 0, rank: 0, trend: 'flat', state_label: 'RECOVERING', streakDays: 3 },
  { id: 'u11', name: 'Sofia G.',  avatarInitials: 'SG', city: 'Phoenix',  state: 'AZ',               performanceScore: 69, complianceRate: 0.69, consistencyScore: 69, recoveryEfficiency: 69, competitionScore: 0, rank: 0, trend: 'up',   state_label: 'RECOVERING', streakDays: 8,                   recentDelta: 5 },
  { id: 'u12', name: 'Ben O.',    avatarInitials: 'BO', city: 'Portland', state: 'OR',               performanceScore: 68, complianceRate: 0.68, consistencyScore: 68, recoveryEfficiency: 68, competitionScore: 0, rank: 0, trend: 'down', state_label: 'RECOVERING', streakDays: 2,                   recentDelta: -3 },
  { id: 'u13', name: 'Maya R.',   avatarInitials: 'MR', city: 'Atlanta',  state: 'GA',               performanceScore: 67, complianceRate: 0.67, consistencyScore: 67, recoveryEfficiency: 67, competitionScore: 0, rank: 0, trend: 'up',   state_label: 'RECOVERING', streakDays: 15, verified: true,  recentDelta: 1 },
  { id: 'u14', name: 'Cole T.',   avatarInitials: 'CT', city: 'Dallas',   state: 'TX',               performanceScore: 66, complianceRate: 0.66, consistencyScore: 66, recoveryEfficiency: 66, competitionScore: 0, rank: 0, trend: 'up',   state_label: 'RECOVERING', streakDays: 6,                   recentDelta: 2 },
];

export const MOCK_USER_CONTEXT: Pick<UserCompetitionContext, 'recentDelta'> = {
  recentDelta: 12, // moved up 12 spots — used for the "personal best" wow moment
};

export const CURRENT_USER_KEY = CURRENT_USER_ID;
