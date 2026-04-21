/**
 * AForce Territory — live competition map types.
 *
 * Aggregations are city- or state-level. We never expose exact user GPS;
 * regions are anonymized buckets of contributing users.
 */

export type RegionKind = 'city' | 'state' | 'team';
export type TrendDirection = 'up' | 'flat' | 'down';
export type BattleStatus = 'idle' | 'active' | 'closing' | 'won' | 'lost';

export interface CompetitionStats {
  avgPerformanceScore: number;       // 0-100
  protocolCompletionRate: number;    // 0-1
  streakDensity: number;             // 0-1 (share of users with active streaks)
  recoveryEfficiency: number;        // 0-1
  momentumScore: number;             // -1..+1, signed delta vs prior period
  participants: number;
}

export interface TerritoryRegion {
  regionId: string;
  name: string;
  kind: RegionKind;
  /** Stylized map coordinates in our abstract US grid (0..100). */
  position: { x: number; y: number };
  /** Approx radius (% of map width) for the region's footprint. */
  radius: number;
  stats: CompetitionStats;
  rank: number;
  trend: TrendDirection;
  battleStatus: BattleStatus;
  /** State code, for city aggregation. */
  state?: string;
}

/** Specialized aliases — same shape, semantic differentiation. */
export type CityCompetitionStats = TerritoryRegion & { kind: 'city' };
export type StateCompetitionStats = TerritoryRegion & { kind: 'state' };
export type TeamCompetitionStats = TerritoryRegion & { kind: 'team' };

export interface TerritoryBattle {
  id: string;
  side1RegionId: string;
  side2RegionId: string;
  side1Score: number;
  side2Score: number;
  /** Hours remaining until close. */
  hoursRemaining: number;
  leader: 'side1' | 'side2' | 'tie';
  trend: TrendDirection;
}

export type TerritoryLayer = 'territory' | 'heat' | 'momentum' | 'battle';

export interface MapMarker {
  regionId: string;
  /** Color for the marker — derived from layer + stats. */
  color: string;
  /** Marker size 0-1 — derived from layer + stats. */
  intensity: number;
  /** Label to render above the marker for prominent regions. */
  label?: string;
}

export interface TerritoryTrend {
  regionId: string;
  /** History of avg score for sparklines, oldest → newest. */
  scoreHistory: number[];
}
