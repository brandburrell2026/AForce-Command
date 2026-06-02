/**
 * Battle service — list/get/create/join active region rivalries.
 *
 * Backed by the api-server `/api/battles/*` endpoints; keeps a local
 * cache + version stamp so the existing `useSyncExternalStore` snapshot
 * pattern in `useCircleSubscription` continues to work without async
 * propagation through every screen.
 *
 * Mutation strategy: optimistic local cache update + version bump,
 * then background POST. On response we replace the row with the
 * server's authoritative copy and bump again. On failure we re-fetch
 * the whole list to recover.
 */

import { MOCK_BATTLES } from '@/data/mockTerritoryData';
import { getRegionById } from '@/services/mapAggregationService';
import type { TerritoryBattle, TerritoryRegion } from '@/types/territory';
import { getJsonAforceApi, postJsonAforceApi } from '@/services/aforceApiClient';

let battles: TerritoryBattle[] = [...MOCK_BATTLES];
let hydrated = false;
let inflight: Promise<void> | null = null;

let version = 0;
const listeners = new Set<() => void>();

export function subscribeBattles(fn: () => void): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

export function getBattlesVersion(): number {
  return version;
}

function emit() {
  version += 1;
  for (const fn of listeners) {
    try { fn(); } catch { /* swallow — never let one bad listener break others */ }
  }
}

interface ServerBattle {
  id: string;
  side1RegionId: string;
  side2RegionId: string;
  side1Score: number;
  side2Score: number;
  hoursRemaining: number;
  leader: 'side1' | 'side2' | 'tie';
  trend: 'up' | 'flat' | 'down';
}

function applyServerList(list: ServerBattle[]): void {
  battles = list.map((b) => ({
    id: b.id,
    side1RegionId: b.side1RegionId,
    side2RegionId: b.side2RegionId,
    side1Score: b.side1Score,
    side2Score: b.side2Score,
    hoursRemaining: b.hoursRemaining,
    leader: b.leader,
    trend: b.trend,
  }));
}

function upsertLocal(updated: ServerBattle): void {
  const next = {
    id: updated.id,
    side1RegionId: updated.side1RegionId,
    side2RegionId: updated.side2RegionId,
    side1Score: updated.side1Score,
    side2Score: updated.side2Score,
    hoursRemaining: updated.hoursRemaining,
    leader: updated.leader,
    trend: updated.trend,
  };
  const idx = battles.findIndex((b) => b.id === updated.id);
  if (idx === -1) battles = [...battles, next];
  else battles = battles.map((b, i) => (i === idx ? next : b));
}

/**
 * Kick off a background hydrate of the cache from the api-server.
 * First-call sync from MOCK_BATTLES guarantees the UI has data
 * immediately; the network response replaces it once it lands.
 */
function ensureHydrated(): void {
  if (hydrated || inflight) return;
  inflight = (async () => {
    try {
      const res = await getJsonAforceApi<{ battles: ServerBattle[] }>('/battles');
      applyServerList(res.battles);
      hydrated = true;
      emit();
    } catch {
      // Stay on the seed list — caller will see MOCK_BATTLES.
    } finally {
      inflight = null;
    }
  })();
}

export interface BattleView extends TerritoryBattle {
  side1: TerritoryRegion;
  side2: TerritoryRegion;
}

export function listBattles(): BattleView[] {
  ensureHydrated();
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
  // Optimistic local bump.
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
  emit();

  // Fire-and-forget reconcile with the server.
  void (async () => {
    try {
      const res = await postJsonAforceApi<{ battle: ServerBattle }>(
        `/battles/${encodeURIComponent(id)}/support`,
        { side },
      );
      upsertLocal(res.battle);
      emit();
    } catch {
      // Recover by re-syncing the list.
      try {
        const list = await getJsonAforceApi<{ battles: ServerBattle[] }>('/battles');
        applyServerList(list.battles);
        emit();
      } catch { /* leave optimistic state in place */ }
    }
  })();

  return getBattle(id);
}

/** Open a fresh battle between two regions. */
export function openBattle(side1RegionId: string, side2RegionId: string): BattleView | undefined {
  const tempId = `b_local_${Date.now()}`;
  battles = [
    ...battles,
    {
      id: tempId, side1RegionId, side2RegionId,
      side1Score: 50, side2Score: 50,
      hoursRemaining: 24, leader: 'tie', trend: 'flat',
    },
  ];
  emit();

  void (async () => {
    try {
      const res = await postJsonAforceApi<{ battle: ServerBattle }>(
        '/battles',
        { side1RegionId, side2RegionId },
      );
      // Replace the temp row with the server's authoritative one.
      battles = battles.filter((b) => b.id !== tempId);
      upsertLocal(res.battle);
      emit();
    } catch {
      // Drop the optimistic row on failure.
      battles = battles.filter((b) => b.id !== tempId);
      emit();
    }
  })();

  return getBattle(tempId);
}

/** Test-only reset. */
export function __resetBattlesForTests(): void {
  battles = [...MOCK_BATTLES];
  hydrated = false;
  inflight = null;
  emit();
}
