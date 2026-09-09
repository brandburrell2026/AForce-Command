/**
 * CROSS-ACCOUNT RACE — THE ACCEPTANCE LAWS (release-blocking).
 *
 * ── WHY THIS FILE EXISTS ───────────────────────────────────────────────────
 *
 * `services/scopedStorage.ts` claimed, from the original Wave-2 PR6 commit
 * (7c918482) until PR A, that its TOCTOU guard was "caught by the isolation
 * suite's cross-account persist race". No such test was ever written. The
 * guard asserted its own proof for the life of the feature. These are the laws
 * that make the claim true, and the founder has designated them
 * release-blocking.
 *
 * ── THE THREE LAWS ─────────────────────────────────────────────────────────
 *
 *   L7  DELAYED READ  — a read issued under A that COMPLETES after the switch
 *                       must not reach B's RAM, B's disk, or B's eyes.
 *   L8  DELAYED WRITE — a write decided under A that DRAINS after the switch
 *                       must not land under B's namespace, and must not create
 *                       a bare key.
 *   L9  NON-VACUITY   — after the switch, B's own reads and writes still work.
 *
 * L9 is not decoration. L7 and L8 are both satisfied by a guard that simply
 * breaks all storage; without L9 the pair could ship green over a facade that
 * refuses everything. Every mutation run below must therefore also confirm L9
 * still passes, or the "kill" is meaningless.
 *
 * ── WHY THE SEQUENCE GOES THROUGH A NON-MEMBER STATE ───────────────────────
 *
 * The founder specified A → UNRESOLVED → B. The machine never returns to
 * UNRESOLVED on its own (that is deliberate — see userScope), so the real
 * paths through a non-member state are A → ANONYMOUS → B (sign out, sign in)
 * and A → UNVERIFIABLE → B (a transport blip mid-switch). Both are exercised,
 * plus the DIRECT A → B switch that `ClerkAuthBridge` actually produces today.
 * That is a superset of the specified sequence, not a substitute for it.
 *
 * ── DETERMINISM ────────────────────────────────────────────────────────────
 *
 * No timers, no sleeps, no real concurrency. The backing store can PARK an
 * operation on an explicit handle the test releases by hand, so each law is a
 * fixed interleaving rather than a hopeful one.
 *
 * The gate is armed only AFTER `migrationSettled()`, because the legacy
 * migration reads the same base keys the stores do and a key-only predicate
 * cannot tell the two apart — arming earlier parks the migration itself and
 * deadlocks every later operation behind `migrationSettled()`.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

type Op = 'get' | 'set' | 'remove';

const { mem, gate } = vi.hoisted(() => {
  const mem = new Map<string, string>();
  const gate = {
    /** Return true to park this operation. Null = park nothing. */
    arm: null as null | ((key: string, op: Op) => boolean),
    parked: [] as Array<{ key: string; op: Op; release: () => void }>,
    reset() {
      this.arm = null;
      this.parked = [];
    },
    /** Release the oldest parked op. */
    releaseFirst() {
      const p = this.parked.shift();
      if (!p) throw new Error('nothing parked to release');
      p.release();
    },
    releaseAll() {
      while (this.parked.length) this.releaseFirst();
    },
  };
  return { mem, gate };
});

function maybePark(key: string, op: Op): Promise<void> | null {
  if (!gate.arm || !gate.arm(key, op)) return null;
  let release!: () => void;
  const held = new Promise<void>((r) => {
    release = r;
  });
  gate.parked.push({ key, op, release });
  return held;
}

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: async (k: string) => {
      const held = maybePark(k, 'get');
      // The value is read at PARK time, so a parked read returns what the
      // departing member's namespace held when the read was issued — which is
      // the whole point of the race.
      const atParkTime = mem.has(k) ? (mem.get(k) as string) : null;
      if (held) await held;
      return atParkTime;
    },
    setItem: async (k: string, v: string) => {
      const held = maybePark(k, 'set');
      if (held) await held;
      mem.set(k, v);
    },
    removeItem: async (k: string) => {
      const held = maybePark(k, 'remove');
      if (held) await held;
      mem.delete(k);
    },
  },
}));

vi.mock('../secureStorage', () => ({
  secureKV: {
    getItem: async () => null,
    setItem: async () => undefined,
    removeItem: async () => undefined,
  },
}));

const A = 'user_A';
const B = 'user_B';
const SCAN_KEY = '@aforce/hydroscan-history';

async function boot() {
  vi.resetModules();
  const userScope = await import('../userScope');
  userScope.__resetUserScopeForTests();
  userScope.setScopeIsolationEnabled(true);
  const scans = await import('../hydroScanHistory');
  return { userScope, scans };
}

/** Let queued lambdas and microtasks drain. */
async function settle(): Promise<void> {
  for (let i = 0; i < 8; i++) await new Promise((r) => setTimeout(r, 0));
}

function scan(id: string) {
  return {
    id,
    scannedAt: new Date(2026, 5, 19, 10, 0).toISOString(),
    productName: id,
    brand: 'TestCo',
    isAForce: false,
    consumption: 'consumed',
    impactLevel: 'NEUTRAL',
    timingLevel: 'GOOD_TIMING',
  } as never;
}

/** The stored shape for a member's scan history. */
function seedFor(userId: string, ids: string[]) {
  mem.set(`${SCAN_KEY}:${userId}`, JSON.stringify(ids.map((i) => scan(i))));
}

beforeEach(() => {
  mem.clear();
  gate.reset();
});

// ── L7 · DELAYED READ ─────────────────────────────────────────────────

describe('L7 (ACCEPTANCE) — a read issued under A cannot publish into B', () => {
  const HOPS: Array<{ name: string; hop: (us: typeof import('../userScope')) => void }> = [
    { name: 'A → ANONYMOUS → B (sign out, sign in)', hop: (us) => us.resolveScope({ status: 'ANONYMOUS' }) },
    {
      name: 'A → UNVERIFIABLE → B (transport blip mid-switch)',
      hop: (us) => us.resolveScope({ status: 'UNVERIFIABLE', reason: 'watchdog' }),
    },
    { name: 'A → B (the direct switch the bridge produces)', hop: () => undefined },
  ];

  it.each(HOPS)('$name', async ({ hop }) => {
    const { userScope, scans } = await boot();
    userScope.resolveScope({ status: 'AUTHENTICATED', userId: A });
    await userScope.migrationSettled();

    seedFor(A, ['A-SECRET-1', 'A-SECRET-2']);

    // Arm only now — after migration, so the gate cannot park the migration's
    // own reads of the same base key.
    gate.arm = (key, op) => op === 'get' && key === `${SCAN_KEY}:${A}`;

    // A's hydrate issues the read and parks INSIDE the native call.
    const inFlight = scans.hydrateHydroScanHistory();
    await settle();
    expect(gate.parked.length, 'the read must actually be in flight').toBe(1);

    // The account changes while A's read is still open.
    hop(userScope);
    userScope.resolveScope({ status: 'AUTHENTICATED', userId: B });
    gate.arm = null;

    // A's read now completes, carrying A's rows.
    gate.releaseAll();
    await inFlight.catch(() => undefined);
    await settle();

    // 1 — A's value did not enter B's RAM.
    const ids = scans.getHydroScanHistoryState().entries.map((e) => e.id);
    expect(ids, "A's scans must not be in B's memory").toEqual([]);

    // 2 — B cannot be shown it.
    expect(scans.getHydroScanHistoryState().entries).toHaveLength(0);

    // 3 — B's own write does not carry A's rows onto B's disk.
    await scans.recordScan(scan('B-1'));
    await settle();
    const bDisk = mem.get(`${SCAN_KEY}:${B}`) ?? '[]';
    expect(bDisk, "A's rows must never reach B's namespace").not.toMatch(/A-SECRET/);

    // 4 — no bare key was created anywhere in the sequence.
    expect(mem.has(SCAN_KEY), 'no bare account-scoped key may exist').toBe(false);

    // 5 — A's own namespace is untouched and still holds A's history.
    expect(mem.get(`${SCAN_KEY}:${A}`)).toMatch(/A-SECRET-1/);
  });
});

// ── L8 · DELAYED WRITE ────────────────────────────────────────────────

describe('L8 (ACCEPTANCE) — a write decided under A cannot land under B', () => {
  it('a persist queued under A and drained after the switch does not write B', async () => {
    const { userScope, scans } = await boot();
    userScope.resolveScope({ status: 'AUTHENTICATED', userId: A });
    await userScope.migrationSettled();
    await scans.hydrateHydroScanHistory();

    // Park the FIRST write so the queue is occupied. The SECOND write is then
    // enqueued — decided under A, with A's rows in its snapshot — but has not
    // yet reached the facade, so its key is not yet bound. That is window W1.
    gate.arm = (key, op) => op === 'set' && key.startsWith(SCAN_KEY);

    void scans.recordScan(scan('A-SECRET-1'));
    await settle();
    expect(gate.parked.length, 'the first write must be parked').toBe(1);

    const second = scans.recordScan(scan('A-SECRET-2'));
    await settle();

    // The account changes while the second write is still queued.
    userScope.resolveScope({ status: 'AUTHENTICATED', userId: B });

    gate.arm = null;
    gate.releaseAll();
    await second.catch(() => undefined);
    await settle();

    // The queued write must not have been re-keyed onto B.
    const bDisk = mem.get(`${SCAN_KEY}:${B}`);
    expect(bDisk ?? '', "A's queued snapshot must not land under B").not.toMatch(/A-SECRET/);
    expect(mem.has(SCAN_KEY), 'no bare account-scoped key may exist').toBe(false);
  });

  it('a write already at the backend when the switch happens still lands under A', async () => {
    // The complement: once the key is bound (W2), A's data belongs in A's
    // namespace and must be written there — not dropped, not moved to B.
    const { userScope, scans } = await boot();
    userScope.resolveScope({ status: 'AUTHENTICATED', userId: A });
    await userScope.migrationSettled();
    await scans.hydrateHydroScanHistory();

    gate.arm = (key, op) => op === 'set' && key === `${SCAN_KEY}:${A}`;
    const w = scans.recordScan(scan('A-ONLY'));
    await settle();
    expect(gate.parked.length).toBe(1);

    userScope.resolveScope({ status: 'AUTHENTICATED', userId: B });
    gate.arm = null;
    gate.releaseAll();
    await w.catch(() => undefined);
    await settle();

    expect(mem.get(`${SCAN_KEY}:${A}`), "A's write belongs in A's namespace").toMatch(/A-ONLY/);
    expect(mem.get(`${SCAN_KEY}:${B}`) ?? '').not.toMatch(/A-ONLY/);
    expect(mem.has(SCAN_KEY)).toBe(false);
  });
});

// ── L9 · NON-VACUITY ──────────────────────────────────────────────────

describe('L9 (ACCEPTANCE) — the guards do not simply break storage', () => {
  it('after a switch, B reads and writes B’s own data normally', async () => {
    const { userScope, scans } = await boot();
    userScope.resolveScope({ status: 'AUTHENTICATED', userId: A });
    await userScope.migrationSettled();
    await scans.hydrateHydroScanHistory();

    userScope.resolveScope({ status: 'AUTHENTICATED', userId: B });
    await userScope.migrationSettled();

    await scans.recordScan(scan('B-1'));
    await settle();
    expect(mem.get(`${SCAN_KEY}:${B}`), "B's own write must succeed").toMatch(/B-1/);

    // And B can read it back on a cold re-hydrate.
    vi.resetModules();
    const us2 = await import('../userScope');
    us2.__resetUserScopeForTests();
    us2.setScopeIsolationEnabled(true);
    us2.resolveScope({ status: 'AUTHENTICATED', userId: B });
    await us2.migrationSettled();
    const scans2 = await import('../hydroScanHistory');
    await scans2.hydrateHydroScanHistory();
    expect(
      scans2.getHydroScanHistoryState().entries.map((e) => e.id),
      "B's own read must succeed",
    ).toEqual(['B-1']);
  });

  it('an UNINTERRUPTED read returns the value — the guard is not always-on', async () => {
    const { userScope, scans } = await boot();
    userScope.resolveScope({ status: 'AUTHENTICATED', userId: A });
    await userScope.migrationSettled();
    seedFor(A, ['A-1']);

    await scans.hydrateHydroScanHistory();
    expect(
      scans.getHydroScanHistoryState().entries.map((e) => e.id),
      'with no switch, hydration must publish normally',
    ).toEqual(['A-1']);
  });

  it('A signing back in still sees A’s own history', async () => {
    // The retention policy the founder approved: device-only intelligence is
    // kept PER USER. Isolation must not read as deletion.
    const { userScope, scans } = await boot();
    userScope.resolveScope({ status: 'AUTHENTICATED', userId: A });
    await userScope.migrationSettled();
    await scans.recordScan(scan('A-1'));
    await settle();

    userScope.resolveScope({ status: 'AUTHENTICATED', userId: B });
    await userScope.migrationSettled();
    await scans.hydrateHydroScanHistory();
    expect(scans.getHydroScanHistoryState().entries).toHaveLength(0);

    userScope.resolveScope({ status: 'AUTHENTICATED', userId: A });
    await userScope.migrationSettled();
    await scans.hydrateHydroScanHistory();
    expect(
      scans.getHydroScanHistoryState().entries.map((e) => e.id),
      'A must get their own history back',
    ).toEqual(['A-1']);
  });
});

// ── BARRIER-SPECIFIC LAWS ─────────────────────────────────────────────
//
// L7 above proves the SYSTEM is safe, but it cannot prove any single barrier,
// because W3 and W4 MASK EACH OTHER: with either one present the store ends up
// empty, so removing the other leaves L7 green. Defence in depth is good; a
// law that cannot see a barrier disappear is not. These three laws each watch
// exactly one window, so each barrier has a mutant that only it can kill.

describe('W3 (barrier) — the facade never RETURNS a value read under another scope', () => {
  it('a read that completes after a switch rejects instead of returning A’s bytes', async () => {
    const { userScope } = await boot();
    const scoped = await import('../scopedStorage');
    userScope.resolveScope({ status: 'AUTHENTICATED', userId: A });
    await userScope.migrationSettled();
    mem.set(`k:${A}`, 'A-SECRET');

    gate.arm = (key, op) => op === 'get' && key === `k:${A}`;
    const read = scoped.scopedStorage.getItem('k').then(
      (v) => ({ ok: true, v }),
      (e) => ({ ok: false, v: e }),
    );
    await settle();
    expect(gate.parked.length).toBe(1);

    userScope.resolveScope({ status: 'AUTHENTICATED', userId: B });
    gate.arm = null;
    gate.releaseAll();

    const r = await read;
    expect(r.ok, 'the facade must refuse, not hand back the departing member’s value').toBe(false);
    expect(r.v).toBeInstanceOf(userScope.ScopeChangedError);
    // MUTATION: delete the post-native re-check in scopedStorage.getItem → red.
    // Only this law sees it; L7 stays green because W4 catches the fallout.
  });
});

describe('W4 (barrier) — a store that could not read stays UN-hydrated', () => {
  it('a stale read must not leave the store falsely hydrated-and-empty', async () => {
    const { userScope, scans } = await boot();
    userScope.resolveScope({ status: 'AUTHENTICATED', userId: A });
    await userScope.migrationSettled();
    seedFor(A, ['A-1']);

    gate.arm = (key, op) => op === 'get' && key === `${SCAN_KEY}:${A}`;
    const inFlight = scans.hydrateHydroScanHistory();
    await settle();
    expect(gate.parked.length).toBe(1);

    userScope.resolveScope({ status: 'AUTHENTICATED', userId: B });
    gate.arm = null;
    gate.releaseAll();
    await inFlight.catch(() => undefined);
    await settle();

    // The distinction this law exists for: "empty because we could not read"
    // is NOT "empty because you have no history". A falsely-hydrated store
    // short-circuits its own future reads and shows B a permanent blank.
    expect(
      scans.getHydroScanHistoryState().hydrated,
      'an abandoned hydrate must not mark the store hydrated',
    ).toBe(false);
    // MUTATION: drop commitIfCurrent from the hydrate → red.
    // Only this law sees it; L7 stays green because W3 already emptied it.
  });
});

describe('W2 (barrier) — the key is bound before the barrier await, not after', () => {
  it('a write issued under A lands under A even if the scope changes during the await', async () => {
    const { userScope } = await boot();
    const scoped = await import('../scopedStorage');

    // Park the legacy-migration read so `migrationSettled()` — the await that
    // sits between key binding and the native call — is held open. This is the
    // only window in which a late key re-resolution would change the answer.
    gate.arm = (key, op) => op === 'get' && key === 'aforce.namespaceMigration.claimedBy';
    userScope.resolveScope({ status: 'AUTHENTICATED', userId: A });
    await settle();
    expect(gate.parked.length, 'migration must be held open').toBe(1);

    const write = scoped.scopedStorage.setItem('k', 'A-DATA');
    await settle();

    userScope.resolveScope({ status: 'AUTHENTICATED', userId: B });
    gate.arm = null;
    gate.releaseAll();
    await write.catch(() => undefined);
    await settle();

    expect(mem.get(`k:${A}`), 'A’s write belongs to A').toBe('A-DATA');
    expect(mem.get(`k:${B}`), 'and must never be re-keyed onto B').toBeUndefined();
    expect(mem.has('k'), 'and must never become a bare key').toBe(false);
    // MUTATION: re-resolve the key after `await migrationSettled()` → red.
  });
});
