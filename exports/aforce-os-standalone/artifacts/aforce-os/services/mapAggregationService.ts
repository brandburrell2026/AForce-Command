/**
 * Map aggregation — converts raw region stats + selected layer into the
 * marker style the map will render. Keeps visual logic out of components.
 */

import { MOCK_CITIES, MOCK_STATES, MOCK_TEAMS } from '@/data/mockTerritoryData';
import { rankRegions, territoryScore } from '@/services/territoryEngine';
import type {
  TerritoryRegion, RegionKind, TerritoryLayer, MapMarker,
} from '@/types/territory';
import { Colors } from '@/theme/colors';

export function getRegions(kind: RegionKind): TerritoryRegion[] {
  switch (kind) {
    case 'city':  return rankRegions(MOCK_CITIES);
    case 'state': return rankRegions(MOCK_STATES);
    case 'team':  return rankRegions(MOCK_TEAMS);
  }
}

export function getRegionById(regionId: string): TerritoryRegion | undefined {
  return [...MOCK_CITIES, ...MOCK_STATES, ...MOCK_TEAMS].find(r => r.regionId === regionId);
}

/** Pick a state palette for a given 0..100 score. */
function colorForScore(score: number): string {
  if (score >= 85) return Colors.states.PEAK.primary;
  if (score >= 70) return Colors.states.BALANCED.primary;
  if (score >= 55) return Colors.states.RECOVERING.primary;
  return Colors.states.DEPLETED.primary;
}

/** Pick a color for momentum (-1..1). */
function colorForMomentum(m: number): string {
  if (m >= 0.2)  return Colors.states.PEAK.primary;
  if (m >= 0.05) return Colors.states.BALANCED.primary;
  if (m >= -0.05) return Colors.states.RECOVERING.primary;
  return Colors.states.DEPLETED.primary;
}

export function buildMarkers(regions: TerritoryRegion[], layer: TerritoryLayer): MapMarker[] {
  return regions.map((r) => {
    let color: string = Colors.states.BALANCED.primary;
    let intensity = 0.6;
    let label: string | undefined;
    const score = territoryScore(r.stats);

    switch (layer) {
      case 'territory':
        color = colorForScore(score);
        intensity = Math.max(0.4, score / 100);
        if (r.rank <= 3) label = `${r.name} #${r.rank}`;
        break;
      case 'heat':
        color = colorForScore(r.stats.protocolCompletionRate * 100);
        intensity = Math.max(0.35, r.stats.protocolCompletionRate);
        break;
      case 'momentum':
        color = colorForMomentum(r.stats.momentumScore);
        intensity = Math.max(0.4, Math.abs(r.stats.momentumScore) + 0.4);
        if (Math.abs(r.stats.momentumScore) >= 0.25) label = `${r.name} ${r.stats.momentumScore >= 0 ? '↑' : '↓'}`;
        break;
      case 'battle':
        color = r.battleStatus === 'active' ? Colors.states.PEAK.primary : Colors.text.muted;
        intensity = r.battleStatus === 'active' ? 0.95 : 0.35;
        if (r.battleStatus === 'active') label = `${r.name}`;
        break;
    }

    return { regionId: r.regionId, color, intensity, label };
  });
}
