/**
 * IDENTITY / SCOPE LAWS (PR A) — the founder's binding principles, executable.
 *
 *   "UNRESOLVED is not ANONYMOUS."
 *   "No unresolved/unverifiable identity state may ever resolve to a global
 *    member namespace."
 *   "Identity transition invalidates RAM synchronously before any asynchronous
 *    cleanup."
 *
 * WHY THESE ARE BEHAVIOURAL, NOT SOURCE SCANS. This repo has a documented
 * history of source-scan laws passing on a comment, or on a different element
 * that happens to match the same string. Every law below drives the real state
 * machine and the real storage facade over an in-memory backing store, and
 * asserts on OBSERVED KEYS AND VALUES. The one structural claim that cannot be
 * observed at runtime — "no durable I/O happens at module evaluation" — is
 * proved by spying on the backing store across a real `import()`, not by
 * grepping for `void hydrate`.
 *
 * MUTATIONS each law must die to are named in-line, so a future reader can
 * check the law still bites rather than trusting that it once did.
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

const { mem, reads } = vi.hoisted(() => ({
  mem: new Map<string, string>(),
  reads: [] as string[],
}));

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: async (k: string) => {
      reads.push(k);
      return mem.has(k) ? (mem.get(k) as string) : null;
    },
    setItem: async (k: string, v: string) => {
      mem.set(k, v);
    },
    removeItem: async (k: string) => {
      mem.delete(k);
    },
  },
}));

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
  const scoped = await import('../scopedStorage');
  userScope.__resetUserScopeForTests();
  return { userScope, scoped };
}

beforeEach(() => {
  mem.clear();
  reads.length = 0;
});

afterEach(() => {
  vi.useRealTimers();
});

// ── LAW 1 · ANONYMOUS requires an affirmative answer ──────────────────

describe('LAW A1 — ANONYMOUS is reachable only from an affirmative signed-out result', () => {
  it('Clerk silence (isLoaded false) produces NO transition, whatever else it reports', async () => {
    const { userScope } = await fresh();
    // Exhaustive over the other two inputs: while the authority has not
    // answered, nothing it appears to say may move the machine.
    for (const isSignedIn of [true, false, undefined]) {
      for (const userId of ['user_A', null, undefined, '']) {
        expect(
          userScope.mapClerkToScope({ isLoaded: false, isSignedIn, userId }),
          `isLoaded:false signedIn:${String(isSignedIn)} userId:${String(userId)}`,
        ).toBeNull();
      }
    }
    // MUTATION: make mapClerkToScope answer ANONYMOUS when !isLoaded → red.
  });

  it('only isLoaded && !isSignedIn yields ANONYMOUS', async () => {
    const { userScope } = await fresh();
    expect(userScope.mapClerkToScope({ isLoaded: true, isSignedIn: false, userId: null }))
      .toEqual({ status: 'ANONYMOUS' });
    expect(userScope.mapClerkToScope({ isLoaded: true, isSignedIn: true, userId: 'user_A' }))
      .toEqual({ status: 'AUTHENTICATED', userId: 'user_A' });
  });

  it('signed in with no usable id is UNVERIFIABLE — never ANONYMOUS, never global', async () => {
    const { userScope } = await fresh();
    for (const userId of [null, undefined, '']) {
      expect(userScope.mapClerkToScope({ isLoaded: true, isSignedIn: true, userId }))
        .toEqual({ status: 'UNVERIFIABLE', reason: 'signed_in_without_user_id' });
    }
    // This is the `setUserScope(userId ?? null)` defect: an authenticated
    // member whose id was missing was given the SHARED GLOBAL namespace.
    // MUTATION: return { status: 'ANONYMOUS' } here → red.
  });

  it('the WATCHDOG produces UNVERIFIABLE, never ANONYMOUS', async () => {
    vi.useFakeTimers();
    const { userScope } = await fresh();
    userScope.setScopeIsolationEnabled(true);
    userScope.__setScopeWatchdogMsForTests(1000);
    userScope.beginScopeResolution();
    expect(userScope.getScopeState().status).toBe('UNRESOLVED');
    await vi.advanceTimersByTimeAsync(1500);
    expect(userScope.getScopeState()).toEqual({
      status: 'UNVERIFIABLE',
      reason: 'watchdog',
    });
    // MUTATION: watchdog resolves { status: 'ANONYMOUS' } → red.
    // This is the founder's O1 objection made executable: a timeout is a
    // statement about US, never evidence about the member.
  });
});

// ── LAW 2 · no state resolves to a bare account-scoped key ────────────

describe('LAW A2 — no unresolved/unverifiable state ever touches a namespace', () => {
  it('UNVERIFIABLE rejects durable work and writes nothing at all', async () => {
    vi.useFakeTimers();
    const { userScope, scoped } = await fresh();
    userScope.setScopeIsolationEnabled(true);
    userScope.__setScopeWatchdogMsForTests(1000);
    userScope.beginScopeResolution();
    await vi.advanceTimersByTimeAsync(1500);

    await expect(scoped.scopedStorage.setItem('@aforce/x', 'SECRET')).rejects.toThrow(
      userScope.ScopeUnavailableError,
    );
    await expect(scoped.scopedStorage.getItem('@aforce/x')).rejects.toThrow(
      userScope.ScopeUnavailableError,
    );
    // The decisive assertion: nothing landed ANYWHERE — not bare, not scoped.
    expect([...mem.keys()]).toEqual([]);
    // MUTATION: make resolveKey fall through to `base` for 'unavailable' → red.
  });

  it('ANONYMOUS reads empty and drops writes — and creates NO bare key', async () => {
    const { userScope, scoped } = await fresh();
    userScope.setScopeIsolationEnabled(true);
    userScope.resolveScope({ status: 'ANONYMOUS' });

    await scoped.scopedStorage.setItem('@aforce/x', 'SECRET');
    expect(await scoped.scopedStorage.getItem('@aforce/x')).toBeNull();
    expect([...mem.keys()], 'a signed-out write must not create a shared key').toEqual([]);
    // MUTATION: return `base` for 'none' → red (the bare key appears).
  });

  it('a durable op issued while UNRESOLVED waits, then obeys the ANSWER — never the bare key', async () => {
    const { userScope, scoped } = await fresh();
    userScope.setScopeIsolationEnabled(true);
    userScope.beginScopeResolution();

    // Issued before the authority has answered.
    const inFlight = scoped.scopedStorage.setItem('@aforce/x', 'A-VALUE');
    let settled = false;
    void inFlight.then(() => {
      settled = true;
    });
    await Promise.resolve();
    expect(settled, 'must not resolve against a guessed namespace').toBe(false);
    expect([...mem.keys()]).toEqual([]);

    userScope.resolveScope({ status: 'AUTHENTICATED', userId: 'user_A' });
    await inFlight;
    expect(mem.get('@aforce/x:user_A')).toBe('A-VALUE');
    expect(mem.has('@aforce/x'), 'no bare key may ever be created').toBe(false);
    // MUTATION: resolve 'pending' to `base` instead of awaiting → red.
  });
});

// ── LAW 3 · termination ───────────────────────────────────────────────

describe('LAW A3 — every durable operation terminates without inventing identity', () => {
  it('an op issued while UNRESOLVED settles via the watchdog, as a REJECTION', async () => {
    vi.useFakeTimers();
    const { userScope, scoped } = await fresh();
    userScope.setScopeIsolationEnabled(true);
    userScope.__setScopeWatchdogMsForTests(1000);
    userScope.beginScopeResolution();

    // Settle the outcome eagerly: the rejection lands while the timers are
    // advancing, so a handler attached afterwards would surface as an
    // unhandled rejection rather than a result.
    const outcome = scoped.scopedStorage.getItem('@aforce/x').then(
      () => ({ rejected: false, err: null as unknown }),
      (err: unknown) => ({ rejected: true, err }),
    );
    // Clerk never answers. The bound is what makes this terminate.
    await vi.advanceTimersByTimeAsync(1500);
    const result = await outcome;
    expect(result.rejected, 'the op must settle, not hang').toBe(true);
    expect(result.err).toBeInstanceOf(userScope.ScopeUnavailableError);
    // Terminated with a DEFINITE outcome, and no identity was manufactured:
    expect(userScope.getScopeState()).toEqual({ status: 'UNVERIFIABLE', reason: 'watchdog' });
    expect([...mem.keys()]).toEqual([]);
    // MUTATION: never arm the watchdog → this test hangs and fails.
    // MUTATION: make UNVERIFIABLE await instead of reject → hangs and fails.
  });

  it('a member-initiated retry re-arms the bound (the one path back to UNRESOLVED)', async () => {
    vi.useFakeTimers();
    const { userScope } = await fresh();
    userScope.setScopeIsolationEnabled(true);
    userScope.__setScopeWatchdogMsForTests(1000);
    userScope.beginScopeResolution();
    await vi.advanceTimersByTimeAsync(1500);
    expect(userScope.getScopeState().status).toBe('UNVERIFIABLE');

    userScope.retryScopeResolution();
    expect(userScope.getScopeState().status).toBe('UNRESOLVED');
    await vi.advanceTimersByTimeAsync(1500);
    // Still bounded — a retry cannot produce an unterminating state.
    expect(userScope.getScopeState()).toEqual({ status: 'UNVERIFIABLE', reason: 'watchdog' });
  });
});

// ── LAW 4 · phase 1 is synchronous ────────────────────────────────────

describe('LAW A4 — RAM is invalidated synchronously, before any async cleanup', () => {
  it('listeners run inside resolveScope, and see the NEW generation', async () => {
    const { userScope } = await fresh();
    userScope.setScopeIsolationEnabled(true);
    userScope.resolveScope({ status: 'AUTHENTICATED', userId: 'user_A' });

    const genBefore = userScope.getUserScopeGeneration();
    let notifiedAtGeneration: number | null = null;
    userScope.subscribeUserScope(() => {
      notifiedAtGeneration = userScope.getUserScopeGeneration();
    });

    userScope.resolveScope({ status: 'AUTHENTICATED', userId: 'user_B' });
    // No await between the transition and this assertion: if the notification
    // were deferred by even one microtask, this is null and the law fails.
    expect(notifiedAtGeneration, 'listeners must fire synchronously').toBe(genBefore + 1);
    // MUTATION: `await` anything before the listener loop, or defer it with
    // queueMicrotask/setTimeout → red.
    //
    // WHY THIS MATTERS: an earlier draft awaited the cleanup pipeline between
    // the state change and the notification. That opens a window in which the
    // scope reads B while every store still holds A's RAM — and a write during
    // it is APPROVED by the generation guard, because both the capture and the
    // check sit on B's side of the boundary.
  });

  it('phase-2 cleanup has NOT run when the transition returns', async () => {
    const { userScope } = await fresh();
    userScope.setScopeIsolationEnabled(true);
    const order: string[] = [];
    userScope.registerScopeCleanup(async () => {
      order.push('cleanup');
    });
    userScope.subscribeUserScope(() => order.push('ram-invalidated'));

    userScope.resolveScope({ status: 'AUTHENTICATED', userId: 'user_A' });
    expect(order, 'cleanup must not precede or accompany phase 1').toEqual(['ram-invalidated']);
    await userScope.scopeCleanupSettled();
    expect(order).toEqual(['ram-invalidated', 'cleanup']);
  });
});

// ── LAW 5 · one authority; cleanup keeps no scope of its own ──────────

describe('LAW A5 — cleanup is a function of its arguments, not of its own state', () => {
  it('purges the DEPARTING member using the prev passed in, and spares bystanders', async () => {
    vi.resetModules();
    const userScope = await import('../userScope');
    const cleanup = await import('../userScopeCleanup');
    userScope.__resetUserScopeForTests();

    mem.set('@aforce/calendarPrefs:userA', 'A');
    mem.set('@aforce/momentPrepared:userA', 'A');
    mem.set('@aforce/calendarPrefs:userB', 'B');

    const performed = await cleanup.runUserScopeCleanup(
      { status: 'AUTHENTICATED', userId: 'userA' },
      { status: 'ANONYMOUS' },
    );

    // A real sign-out DOES perform every step — so the law above cannot pass
    // by the pipeline being inert.
    expect(performed).toEqual(['whoop-wipe', 'notifications-cancel', 'calendar-purge']);
    expect(mem.has('@aforce/calendarPrefs:userA')).toBe(false);
    expect(mem.has('@aforce/momentPrepared:userA')).toBe(false);
    expect(mem.get('@aforce/calendarPrefs:userB'), 'a bystander must survive').toBe('B');
    // MUTATION: read the departing id from a module variable instead of `prev`
    // → the second source of truth returns, and this law goes red because the
    // function is called directly with no transition to populate it.
  });

  it('an UNVERIFIABLE hop destroys NOTHING', async () => {
    vi.resetModules();
    const cleanup = await import('../userScopeCleanup');
    mem.set('@aforce/calendarPrefs:userA', 'A');

    const performed = await cleanup.runUserScopeCleanup(
      { status: 'AUTHENTICATED', userId: 'userA' },
      { status: 'UNVERIFIABLE', reason: 'watchdog' },
    );

    // Assert on the ACTIONS, not on a surviving key: the calendar key has its
    // own separate sign-out guard, so watching it would leave this law
    // satisfied by a different element while the WHOOP token and the member's
    // scheduled notifications were destroyed by a transport hiccup.
    expect(performed, 'an UNVERIFIABLE hop must perform no destructive step').toEqual([]);
    expect(
      mem.get('@aforce/calendarPrefs:userA'),
      'a transport failure must not destroy a real member’s data',
    ).toBe('A');
    // MUTATION: drop the `next.status` guard → red.
  });
});

// ── LAW 6 · no durable I/O at module evaluation ───────────────────────

describe('LAW A6 — importing a store performs no durable read', () => {
  const STORES = [
    '../commandLedger',
    '../hydroScanHistory',
    '../intentCapture',
    '../performanceMemoryCapture',
    '../voiceCheckIn',
  ];

  it.each(STORES)('%s reads nothing at import time', async (mod) => {
    vi.resetModules();
    const userScope = await import('../userScope');
    userScope.__resetUserScopeForTests();
    reads.length = 0;

    await import(mod);
    // Let any module-evaluation microtask land before asserting.
    await Promise.resolve();
    await Promise.resolve();

    expect(
      reads,
      `${mod} hydrated at module evaluation — before identity exists, so the ` +
        'read resolves to the pre-isolation global key',
    ).toEqual([]);
    // MUTATION: restore `void hydrateX();` at module scope → red.
  });
});

// ── LAW 7 · flag OFF is byte-identical ────────────────────────────────

describe('LAW A7 — with isolation disabled the app behaves exactly as before', () => {
  it('keys are the bare legacy keys, and no transition churns any store', async () => {
    const { userScope, scoped } = await fresh();
    // Flag OFF (the production default in PR A).
    let notifications = 0;
    userScope.subscribeUserScope(() => {
      notifications += 1;
    });

    await scoped.scopedStorage.setItem('@aforce/x', 'v');
    expect(mem.get('@aforce/x')).toBe('v');

    userScope.resolveScope({ status: 'AUTHENTICATED', userId: 'user_A' });
    await scoped.scopedStorage.setItem('@aforce/y', 'w');

    expect(mem.get('@aforce/y'), 'still the legacy key while the flag is off').toBe('w');
    expect(userScope.getUserScopeGeneration()).toBe(0);
    expect(notifications, 'no store may be reset while the flag is off').toBe(0);
  });
});
