import { describe, it, expect, beforeEach, vi } from 'vitest';

// In-memory AsyncStorage backing the service. Hoisted so the vi.mock factory
// (itself hoisted to the top of the file) can close over it, and so it
// survives a vi.resetModules() "cold restart".
const { mem } = vi.hoisted(() => ({ mem: new Map<string, string>() }));

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: async (k: string) => (mem.has(k) ? (mem.get(k) as string) : null),
    setItem: async (k: string, v: string) => {
      mem.set(k, v);
    },
    removeItem: async (k: string) => {
      mem.delete(k);
    },
  },
}));

import type { HydroScanHistoryInput } from '../hydroScanHistory';

function entry(over: Partial<HydroScanHistoryInput> = {}): HydroScanHistoryInput {
  return {
    scannedAt: new Date(2026, 5, 19, 8, 0).toISOString(),
    productName: 'Test Drink',
    brand: 'TestCo',
    isAForce: false,
    consumption: 'consumed',
    impactLevel: 'NEUTRAL',
    timingLevel: 'GOOD_TIMING',
    ...over,
  };
}

async function freshService() {
  vi.resetModules();
  const mod = await import('../hydroScanHistory');
  await mod.hydrateHydroScanHistory();
  return mod;
}

describe('hydroScanHistory · recording', () => {
  beforeEach(() => {
    mem.clear();
  });

  it('records a scan and exposes it most-recent-first', async () => {
    const svc = await freshService();
    await svc.recordScan(entry({ scannedAt: new Date(2026, 5, 19, 8, 0).toISOString() }));
    await svc.recordScan(entry({ scannedAt: new Date(2026, 5, 19, 9, 0).toISOString(), productName: 'Later' }));
    const state = svc.getHydroScanHistoryState();
    expect(state.entries).toHaveLength(2);
    expect(state.entries[0].productName).toBe('Later'); // newest first
    expect(svc.selectLatestScan(state)?.productName).toBe('Later');
  });

  it('generates a stable id when none is supplied', async () => {
    const svc = await freshService();
    await svc.recordScan(entry());
    const e = svc.getHydroScanHistoryState().entries[0];
    expect(typeof e.id).toBe('string');
    expect(e.id.length).toBeGreaterThan(0);
  });

  it('does not clobber a scan recorded during the hydration window', async () => {
    // Seed storage with one persisted entry, then simulate an early
    // recordScan() that lands BEFORE hydrate resolves: import the module
    // (which kicks off hydrate), record immediately, then await hydrate.
    mem.set(
      '@aforce/hydroscan-history',
      JSON.stringify([
        {
          id: 'persisted',
          scannedAt: new Date(2026, 5, 19, 6, 0).toISOString(),
          productName: 'Persisted',
          isAForce: false,
          consumption: 'consumed',
          impactLevel: 'NEUTRAL',
          timingLevel: 'GOOD_TIMING',
        },
      ]),
    );
    vi.resetModules();
    const mod = await import('../hydroScanHistory');
    // Record before awaiting hydration — the in-flight load must not drop it.
    const recordP = mod.recordScan(
      entry({ id: 'early', productName: 'Early', scannedAt: new Date(2026, 5, 19, 10, 0).toISOString() }),
    );
    await mod.hydrateHydroScanHistory();
    await recordP;
    const ids = mod.getHydroScanHistoryState().entries.map((e) => e.id).sort();
    expect(ids).toEqual(['early', 'persisted']);
  });

  it('persists across a cold service restart', async () => {
    const a = await freshService();
    await a.recordScan(entry({ id: 'fixed-1', productName: 'Persisted' }));
    // Cold restart re-imports the module; it must read mem back.
    const b = await freshService();
    const state = b.getHydroScanHistoryState();
    expect(state.entries).toHaveLength(1);
    expect(state.entries[0].id).toBe('fixed-1');
    expect(state.entries[0].productName).toBe('Persisted');
  });

  it('bounds the history to MAX_ENTRIES', async () => {
    const svc = await freshService();
    for (let i = 0; i < svc.MAX_ENTRIES + 10; i++) {
      await svc.recordScan(
        entry({
          id: `e-${i}`,
          scannedAt: new Date(2026, 5, 19, 0, 0, i).toISOString(),
        }),
      );
    }
    expect(svc.getHydroScanHistoryState().entries).toHaveLength(svc.MAX_ENTRIES);
  });

  it('clears all history', async () => {
    const svc = await freshService();
    await svc.recordScan(entry());
    await svc.clearHydroScanHistory();
    expect(svc.getHydroScanHistoryState().entries).toHaveLength(0);
    // And the cleared state survives a cold restart.
    const b = await freshService();
    expect(b.getHydroScanHistoryState().entries).toHaveLength(0);
  });
});

describe('hydroScanHistory · resilience', () => {
  beforeEach(() => {
    mem.clear();
  });

  it('ignores corrupt persisted payloads', async () => {
    mem.set('@aforce/hydroscan-history', '{not json');
    const svc = await freshService();
    expect(svc.getHydroScanHistoryState().entries).toHaveLength(0);
    expect(svc.getHydroScanHistoryState().hydrated).toBe(true);
  });

  it('drops malformed rows but keeps valid ones', async () => {
    mem.set(
      '@aforce/hydroscan-history',
      JSON.stringify([
        { id: 'bad' }, // missing required fields
        {
          id: 'good',
          scannedAt: new Date(2026, 5, 19, 8, 0).toISOString(),
          productName: 'Valid',
          isAForce: false,
          consumption: 'consumed',
          impactLevel: 'NEUTRAL',
          timingLevel: 'GOOD_TIMING',
        },
      ]),
    );
    const svc = await freshService();
    const entries = svc.getHydroScanHistoryState().entries;
    expect(entries).toHaveLength(1);
    expect(entries[0].id).toBe('good');
  });
});

// ── Score-Protection lock ────────────────────────────────────────────────
// "Consumed: Yes" is advisory history only — it must NEVER mutate the
// hydration score. The guarantee is structural: this service is decoupled
// from the reducer / AppState entirely, so there is no code path from
// recording a scan to logIntake or any score-bearing reducer action.
describe('hydroScanHistory · Score-Protection', () => {
  beforeEach(() => {
    mem.clear();
  });

  it('recording a "consumed" scan only writes the history key — never the score', async () => {
    const svc = await freshService();
    // A "consumed" advisory entry — the case most likely to be confused
    // with logging intake — must touch only the dedicated history key.
    await svc.recordScan(entry({ consumption: 'consumed', impactLevel: 'HIGH_SUPPORT' }));
    const touched = [...mem.keys()];
    expect(touched).toEqual(['@aforce/hydroscan-history']);
  });

  it('is statically isolated from the store / reducer / logIntake', async () => {
    const fs = await import('node:fs/promises');
    const path = await import('node:path');
    const url = await import('node:url');
    const dir = path.dirname(url.fileURLToPath(import.meta.url));
    const src = await fs.readFile(path.join(dir, '..', 'hydroScanHistory.ts'), 'utf8');
    // No import of, or reference to, any score-bearing surface. If a future
    // edit wires this advisory store into the reducer, this lock fails.
    expect(src).not.toMatch(/logIntake/);
    expect(src).not.toMatch(/useAppStore/);
    expect(src).not.toMatch(/appStoreReducer/);
    expect(src).not.toMatch(/\bdispatch\b/);
  });
});
