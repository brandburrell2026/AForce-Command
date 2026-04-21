/**
 * Battle service — list/get/create/join active region rivalries.
 * In-memory today; same surface will adapt to `/api/battles/*`.
 */

import { MOCK_BATTLES } from '@/data/mockTerritoryData';
import { getRegionById } from '@/services/mapAggregationService';
import type { TerritoryBattle, TerritoryRegion } from '@/types/territory';

let battles: TerritoryBattle[] = [...MOCK_BATTLES];

export interface BattleView extends TerritoryBattle {
  side1: TerritoryRegion;
  side2: TerritoryRegion;
}

export function listBattles(): BattleView[] {
  return battles
    .map((b): BattleView | null => {
      const side1 = getRegionById(b.side1RegionId);
      const side2 = getRegionById(b.side2RegionId);
      if (!side1 || !side2) return null;
      return { ...b, side1, side2 };
    })
    .filter((x): x is BattleView => x !== null)
    .sort((a, b) => a.hoursRemaining - b.hoursRemaining);
}

export function getBattle(id: string): BattleView | undefined {
  return listBattles().find(b => b.id === id);
}

/** "Support" a side — tilts the score by 1 in the chosen direction. */
export function supportSide(id: string, side: 'side1' | 'side2'): BattleView | undefined {
  battles = battles.map((b) => {
    if (b.id !== id) return b;
    const next = { ...b };
    if (side === 'side1') next.side1Score = Math.min(100, b.side1Score + 1);
    else                  next.side2Score = Math.min(100, b.side2Score + 1);
    next.leader =
      next.side1Score === next.side2Score ? 'tie'
      : next.side1Score > next.side2Score ? 'side1' : 'side2';
    return next;
  });
  return getBattle(id);
}

/** Open a fresh battle between two regions. */
export function openBattle(side1RegionId: string, side2RegionId: string): BattleView | undefined {
  const id = `b_${Date.now()}`;
  battles.push({
    id, side1RegionId, side2RegionId,
    side1Score: 50, side2Score: 50,
    hoursRemaining: 24, leader: 'tie', trend: 'flat',
  });
  return getBattle(id);
}
