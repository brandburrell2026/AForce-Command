/**
 * Mock territory data — coordinates use an abstract 0..100 grid so the
 * stylized map renders consistently regardless of viewport size. When the
 * real Mapbox/Google Maps integration ships, swap to lat/lng and project
 * in `mapAggregationService`.
 */

import type { TerritoryRegion, TerritoryBattle } from '@/types/territory';

export const MOCK_CITIES: TerritoryRegion[] = [
  { regionId: 'city_miami_fl',     name: 'Miami',        kind: 'city', state: 'FL', position: { x: 78, y: 80 }, radius: 4, rank: 2, trend: 'up',
    battleStatus: 'active',
    stats: { avgPerformanceScore: 86, protocolCompletionRate: 0.74, streakDensity: 0.62, recoveryEfficiency: 0.71, momentumScore: 0.42, participants: 4234 } },
  { regionId: 'city_nyc_ny',       name: 'New York',     kind: 'city', state: 'NY', position: { x: 80, y: 32 }, radius: 5, rank: 1, trend: 'flat',
    battleStatus: 'active',
    stats: { avgPerformanceScore: 88, protocolCompletionRate: 0.78, streakDensity: 0.66, recoveryEfficiency: 0.74, momentumScore: 0.18, participants: 9120 } },
  { regionId: 'city_la_ca',        name: 'Los Angeles',  kind: 'city', state: 'CA', position: { x: 12, y: 56 }, radius: 5, rank: 3, trend: 'up',
    battleStatus: 'idle',
    stats: { avgPerformanceScore: 84, protocolCompletionRate: 0.71, streakDensity: 0.60, recoveryEfficiency: 0.69, momentumScore: 0.31, participants: 7340 } },
  { regionId: 'city_chicago_il',   name: 'Chicago',      kind: 'city', state: 'IL', position: { x: 60, y: 38 }, radius: 4, rank: 5, trend: 'flat',
    battleStatus: 'idle',
    stats: { avgPerformanceScore: 81, protocolCompletionRate: 0.69, streakDensity: 0.55, recoveryEfficiency: 0.66, momentumScore: 0.05, participants: 3982 } },
  { regionId: 'city_austin_tx',    name: 'Austin',       kind: 'city', state: 'TX', position: { x: 48, y: 74 }, radius: 4, rank: 4, trend: 'up',
    battleStatus: 'idle',
    stats: { avgPerformanceScore: 83, protocolCompletionRate: 0.72, streakDensity: 0.58, recoveryEfficiency: 0.68, momentumScore: 0.27, participants: 2987 } },
  { regionId: 'city_seattle_wa',   name: 'Seattle',      kind: 'city', state: 'WA', position: { x: 14, y: 18 }, radius: 4, rank: 6, trend: 'down',
    battleStatus: 'idle',
    stats: { avgPerformanceScore: 79, protocolCompletionRate: 0.66, streakDensity: 0.52, recoveryEfficiency: 0.64, momentumScore: -0.08, participants: 2543 } },
  { regionId: 'city_denver_co',    name: 'Denver',       kind: 'city', state: 'CO', position: { x: 36, y: 50 }, radius: 3, rank: 7, trend: 'up',
    battleStatus: 'idle',
    stats: { avgPerformanceScore: 80, protocolCompletionRate: 0.68, streakDensity: 0.54, recoveryEfficiency: 0.65, momentumScore: 0.16, participants: 1820 } },
  { regionId: 'city_phoenix_az',   name: 'Phoenix',      kind: 'city', state: 'AZ', position: { x: 24, y: 64 }, radius: 3, rank: 8, trend: 'down',
    battleStatus: 'idle',
    stats: { avgPerformanceScore: 76, protocolCompletionRate: 0.62, streakDensity: 0.48, recoveryEfficiency: 0.60, momentumScore: -0.12, participants: 1640 } },
  { regionId: 'city_boston_ma',    name: 'Boston',       kind: 'city', state: 'MA', position: { x: 84, y: 28 }, radius: 3, rank: 9, trend: 'flat',
    battleStatus: 'idle',
    stats: { avgPerformanceScore: 78, protocolCompletionRate: 0.65, streakDensity: 0.51, recoveryEfficiency: 0.63, momentumScore: 0.02, participants: 1310 } },
  { regionId: 'city_tampa_fl',     name: 'Tampa',        kind: 'city', state: 'FL', position: { x: 72, y: 78 }, radius: 3, rank: 11, trend: 'up',
    battleStatus: 'idle',
    stats: { avgPerformanceScore: 77, protocolCompletionRate: 0.64, streakDensity: 0.49, recoveryEfficiency: 0.61, momentumScore: 0.21, participants: 980 } },
];

export const MOCK_STATES: TerritoryRegion[] = [
  { regionId: 'state_fl', name: 'Florida',     kind: 'state', position: { x: 76, y: 78 }, radius: 8, rank: 1, trend: 'up',
    battleStatus: 'active',
    stats: { avgPerformanceScore: 84, protocolCompletionRate: 0.72, streakDensity: 0.59, recoveryEfficiency: 0.70, momentumScore: 0.34, participants: 12_204 } },
  { regionId: 'state_ca', name: 'California',  kind: 'state', position: { x: 10, y: 50 }, radius: 9, rank: 2, trend: 'up',
    battleStatus: 'active',
    stats: { avgPerformanceScore: 83, protocolCompletionRate: 0.70, streakDensity: 0.57, recoveryEfficiency: 0.68, momentumScore: 0.27, participants: 18_842 } },
  { regionId: 'state_ny', name: 'New York',    kind: 'state', position: { x: 80, y: 30 }, radius: 6, rank: 3, trend: 'flat',
    battleStatus: 'idle',
    stats: { avgPerformanceScore: 82, protocolCompletionRate: 0.69, streakDensity: 0.56, recoveryEfficiency: 0.67, momentumScore: 0.11, participants: 11_980 } },
  { regionId: 'state_tx', name: 'Texas',       kind: 'state', position: { x: 46, y: 74 }, radius: 9, rank: 4, trend: 'up',
    battleStatus: 'idle',
    stats: { avgPerformanceScore: 80, protocolCompletionRate: 0.67, streakDensity: 0.53, recoveryEfficiency: 0.65, momentumScore: 0.18, participants: 14_206 } },
  { regionId: 'state_il', name: 'Illinois',    kind: 'state', position: { x: 60, y: 38 }, radius: 5, rank: 5, trend: 'flat',
    battleStatus: 'idle',
    stats: { avgPerformanceScore: 78, protocolCompletionRate: 0.65, streakDensity: 0.50, recoveryEfficiency: 0.62, momentumScore: 0.04, participants: 6_420 } },
  { regionId: 'state_co', name: 'Colorado',    kind: 'state', position: { x: 36, y: 50 }, radius: 5, rank: 6, trend: 'up',
    battleStatus: 'idle',
    stats: { avgPerformanceScore: 79, protocolCompletionRate: 0.66, streakDensity: 0.52, recoveryEfficiency: 0.64, momentumScore: 0.14, participants: 4_810 } },
  { regionId: 'state_wa', name: 'Washington',  kind: 'state', position: { x: 14, y: 18 }, radius: 5, rank: 7, trend: 'down',
    battleStatus: 'idle',
    stats: { avgPerformanceScore: 77, protocolCompletionRate: 0.63, streakDensity: 0.48, recoveryEfficiency: 0.61, momentumScore: -0.06, participants: 4_120 } },
];

export const MOCK_TEAMS: TerritoryRegion[] = [
  { regionId: 'team_pulse',    name: 'Team Pulse',    kind: 'team', position: { x: 48, y: 38 }, radius: 4, rank: 1, trend: 'up',   battleStatus: 'active',
    stats: { avgPerformanceScore: 89, protocolCompletionRate: 0.81, streakDensity: 0.71, recoveryEfficiency: 0.78, momentumScore: 0.36, participants: 142 } },
  { regionId: 'team_apex',     name: 'Apex Squad',    kind: 'team', position: { x: 60, y: 56 }, radius: 4, rank: 2, trend: 'flat', battleStatus: 'active',
    stats: { avgPerformanceScore: 86, protocolCompletionRate: 0.78, streakDensity: 0.68, recoveryEfficiency: 0.75, momentumScore: 0.12, participants: 118 } },
  { regionId: 'team_quench',   name: 'Quench Crew',   kind: 'team', position: { x: 30, y: 62 }, radius: 3, rank: 3, trend: 'up',   battleStatus: 'idle',
    stats: { avgPerformanceScore: 84, protocolCompletionRate: 0.74, streakDensity: 0.62, recoveryEfficiency: 0.71, momentumScore: 0.22, participants: 96 } },
];

/**
 * EMPTY by founder ruling (Wave-4). `battleService` used to boot from these
 * and fall back to them whenever `/api/battles` failed, so three invented
 * rivalries with invented live scores and countdowns rendered exactly like
 * server truth — a fabricated social position. The export is kept (the
 * service no longer imports it) so the shape stays declared until the
 * endpoint is the only source.
 */
export const MOCK_BATTLES: TerritoryBattle[] = [];
