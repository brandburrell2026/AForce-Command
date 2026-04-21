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
  { id: CURRENT_USER_ID, name: 'You',           avatarInitials: 'YO', city: 'Miami',      state: 'FL', teamId: 't1', performanceScore: 84, complianceRate: 0.86, consistencyScore: 78, recoveryEfficiency: 82, competitionScore: 0, rank: 0, trend: 'up',   state_label: 'BALANCED'  },
  { id: 'u1',            name: 'Jordan A.',     avatarInitials: 'JA', city: 'Miami',      state: 'FL', teamId: 't1', performanceScore: 95, complianceRate: 0.96, consistencyScore: 94, recoveryEfficiency: 92, competitionScore: 0, rank: 0, trend: 'up',   state_label: 'PEAK'      },
  { id: 'u2',            name: 'Mia R.',        avatarInitials: 'MR', city: 'Miami',      state: 'FL', teamId: 't1', performanceScore: 92, complianceRate: 0.93, consistencyScore: 90, recoveryEfficiency: 89, competitionScore: 0, rank: 0, trend: 'flat', state_label: 'PEAK'      },
  { id: 'u3',            name: 'Devon K.',      avatarInitials: 'DK', city: 'New York',   state: 'NY', teamId: 't2', performanceScore: 91, complianceRate: 0.89, consistencyScore: 91, recoveryEfficiency: 88, competitionScore: 0, rank: 0, trend: 'up',   state_label: 'PEAK'      },
  { id: 'u4',            name: 'Sasha P.',      avatarInitials: 'SP', city: 'Austin',     state: 'TX', teamId: 't4', performanceScore: 89, complianceRate: 0.85, consistencyScore: 84, recoveryEfficiency: 86, competitionScore: 0, rank: 0, trend: 'down', state_label: 'BALANCED'  },
  { id: 'u5',            name: 'Cam B.',        avatarInitials: 'CB', city: 'Denver',     state: 'CO', teamId: 't3', performanceScore: 88, complianceRate: 0.84, consistencyScore: 82, recoveryEfficiency: 86, competitionScore: 0, rank: 0, trend: 'up',   state_label: 'BALANCED'  },
  { id: 'u6',            name: 'Lex T.',        avatarInitials: 'LT', city: 'Los Angeles',state: 'CA',                performanceScore: 87, complianceRate: 0.83, consistencyScore: 79, recoveryEfficiency: 84, competitionScore: 0, rank: 0, trend: 'flat', state_label: 'BALANCED'  },
  { id: 'u7',            name: 'Quinn V.',      avatarInitials: 'QV', city: 'Phoenix',    state: 'AZ',                performanceScore: 81, complianceRate: 0.79, consistencyScore: 76, recoveryEfficiency: 80, competitionScore: 0, rank: 0, trend: 'down', state_label: 'RECOVERING' },
];

export const MOCK_USER_CONTEXT: Pick<UserCompetitionContext, 'recentDelta'> = {
  recentDelta: 12, // moved up 12 spots — used for the "personal best" wow moment
};

export const CURRENT_USER_KEY = CURRENT_USER_ID;
