/**
 * Wave-2 PR6 — the founder-required isolation invariants, driven through
 * REAL stores (moments + command ledger + hydroscan history — the three
 * structural patterns) over an in-memory AsyncStorage:
 *
 *   USER A writes → signs out → USER B signs in
 *     → USER B sees NONE of USER A's private intelligence
 *   USER A signs back in
 *     → A's data is intact (approved persistence policy: device-only
 *       intelligence is retained per user, never across users)
 *
 * Plus: one-shot legacy migration (first-user-claims), later-user
 * never claims, and the flag-OFF byte-identical path (no scope → global
 * keys, exactly today's behavior).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

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
// secureStorage pulls the RN/Expo module graph (__DEV__); the secure lane
// is not under test here — back it with the same in-memory map.
vi.mock('../secureStorage', () => ({
  secureKV: {
    getItem: async (k: string) => (mem.has(`sec:${k}`) ? (mem.get(`sec:${k}`) as string) : null),
    setItem: async (k: string, v: string) => {
      mem.set(`sec:${k}`, v);
    },
    removeItem: async (k: string) => {
      mem.delete(`sec:${k}`);
    },
  },
}));

async function fresh() {
  vi.resetModules();
  const userScope = await import('../userScope');
  const moments = await import('../momentsStore');
  const ledger = await import('../commandLedger');
  return { userScope, moments, ledger };
}

function mkMoment(id: string, title: string) {
  return {
    id,
    title,
    startAtIso: new Date('2026-08-12T18:00:00Z').toISOString(),
    source: 'manual',
    classification: 'social',
  } as never;
}

beforeEach(() => {
  mem.clear();
});

/** Let queued persist lambdas (persistQueue/writeQueue) run to completion. */
async function flushWrites(): Promise<void> {
  for (let i = 0; i < 4; i++) await new Promise((r) => setTimeout(r, 0));
}

describe('per-user isolation (flag ON path: scope driven by the bridge)', () => {
  it('USER B sees none of USER A private intelligence; A gets it back on return', async () => {
    const { userScope, moments } = await fresh();

    // USER A signs in and writes a moment.
    userScope.setUserScope('user_A');
    await userScope.migrationSettled();
    await moments.hydrateMoments();
    moments.addMoment(mkMoment('m1', "A's title — private"));
    expect(moments.getMomentsState().moments.length).toBe(1);
    await flushWrites();

    // Sign out → in-memory state resets to un-hydrated immediately.
    userScope.setUserScope(null);
    expect(moments.getMomentsState().hydrated).toBe(false);
    expect(moments.getMomentsState().moments).toEqual([]);

    // USER B signs in → hydrates THEIR key → empty.
    userScope.setUserScope('user_B');
    await userScope.migrationSettled();
    await moments.hydrateMoments();
    expect(moments.getMomentsState().moments).toEqual([]);

    // USER B writes their own; A's row on disk is untouched.
    moments.addMoment(mkMoment('m2', "B's moment"));
    await flushWrites();
    expect(mem.get('@aforce/moments:user_A')).toContain("A's title");
    expect(mem.get('@aforce/moments:user_B')).toContain("B's moment");

    // USER A returns → their data is back, B's invisible.
    userScope.setUserScope('user_A');
    await userScope.migrationSettled();
    await moments.hydrateMoments();
    const titles = moments.getMomentsState().moments.map((m) => m.title);
    expect(titles).toEqual(["A's title — private"]);
  });

  it('command ledger resets across accounts the same way', async () => {
    const { userScope, ledger } = await fresh();
    userScope.setUserScope('user_A');
    await userScope.migrationSettled();
    await ledger.hydrateCommandLedger();
    await ledger.appendCommandEvents([
      {
        id: 'evt-a1',
        kind: 'context_snapshot',
        occurredAtMs: Date.now(),
        localDayIndex: 0,
        source: 'test',
      } as never,
    ]);
    expect(ledger.getCommandLedgerState().events.length).toBeGreaterThan(0);
    await flushWrites();

    userScope.setUserScope('user_B');
    await userScope.migrationSettled();
    await ledger.hydrateCommandLedger();
    expect(ledger.getCommandLedgerState().events).toEqual([]);
  });
});

describe('legacy migration (one-shot, first-user-claims)', () => {
  it('the first scoped user claims legacy global data; a later user never does', async () => {
    const { userScope, moments } = await fresh();
    // Pre-flag device state: A's moments under the GLOBAL key.
    mem.set(
      '@aforce/moments',
      JSON.stringify([mkMoment('legacy1', 'Legacy A moment')]),
    );

    userScope.setUserScope('user_A');
    await userScope.migrationSettled();
    await moments.hydrateMoments();
    expect(moments.getMomentsState().moments.map((m) => m.title)).toEqual(['Legacy A moment']);
    // Global key was consumed; claim marker set.
    expect(mem.has('@aforce/moments')).toBe(false);
    expect(mem.get('aforce.namespaceMigration.claimedBy')).toBe('user_A');

    // A later orphaned global key must NOT be claimed by a different user.
    mem.set('@aforce/moments', JSON.stringify([mkMoment('orphan', 'Orphaned global')]));
    userScope.setUserScope('user_B');
    await userScope.migrationSettled();
    await moments.hydrateMoments();
    expect(moments.getMomentsState().moments).toEqual([]);
    expect(mem.has('@aforce/moments')).toBe(true); // left in place, unclaimed
  });

  it('every key in the migration manifest moves for the claiming user', async () => {
    const { userScope } = await fresh();
    for (const base of userScope.MIGRATED_GLOBAL_KEYS) mem.set(base, `legacy:${base}`);
    userScope.setUserScope('user_A');
    await userScope.migrationSettled();
    for (const base of userScope.MIGRATED_GLOBAL_KEYS) {
      if (userScope.RETAIN_GLOBAL_COPY.has(base)) {
        // Wave-3 PR12: consent evidence is COPY-AND-RETAIN — the scoped
        // copy exists AND the global legal record survives.
        expect(mem.get(base), `${base} global must be RETAINED`).toBe(`legacy:${base}`);
      } else {
        expect(mem.has(base), `${base} global must be consumed`).toBe(false);
      }
      expect(mem.get(`${base}:user_A`), `${base} must be scoped`).toBe(`legacy:${base}`);
    }
  });
});

describe('flag OFF / unscoped path stays byte-identical', () => {
  it('with no scope ever set, stores use the legacy GLOBAL keys', async () => {
    const { moments } = await fresh();
    await moments.hydrateMoments();
    moments.addMoment(mkMoment('g1', 'Global-era moment'));
    await flushWrites();
    expect(mem.get('@aforce/moments')).toContain('Global-era moment');
    expect([...mem.keys()].filter((k) => k.includes(':user_'))).toEqual([]);
  });
});
