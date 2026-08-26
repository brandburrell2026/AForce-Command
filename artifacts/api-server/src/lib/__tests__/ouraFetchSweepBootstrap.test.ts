/**
 * Tests for `ouraFetchSweepBootstrap.ts`'s two env-gated boot helpers
 * (`maybeStartOuraFetchSweep`, `maybeStartOuraAuthStatePurge`) and the
 * Oura-namespaced advisory lock (`withOuraUserAdvisoryLock`) added in
 * this lane.
 *
 * All DB-free: `db` is never a real Postgres handle. The sweep
 * bootstrap tests use the `iterFactory` / `dbNow` / `acquireLock` test
 * seams (same pattern as `whoopFetchSweepBootstrap.test.ts`) so the
 * real keyset iterator and real per-user fetch (`buildDefaultOuraFetchDeps`
 * / `runOuraFetchOnce`, which need Postgres + Oura OAuth env) are never
 * invoked.
 *
 * What per-user failure-isolation and repeat-run idempotency actually
 * mean at each layer, and where they're already covered:
 *   - `runOuraFetchOnce`'s own per-branch failure handling (token
 *     resolution throws, fetcher throws, writer throws — never
 *     propagates) is covered by the pre-existing `ouraFetchWorker.test.ts`.
 *   - `runProviderFetchSweep` / `runProviderFetchSweepStreaming`'s
 *     "one thrown runOnce doesn't kill the sweep" / concurrency /
 *     multi-page accumulation guarantees are covered by the
 *     pre-existing `providerKitSweepLoop.test.ts` (READ-ONLY shared
 *     infra this bootstrap now composes, unmodified).
 *   - What's NEW to this lane is the WIRING: cutoff/pageSize threading
 *     into the iterator, the multi-replica lock seam, and the
 *     lock-contention -> skipped_locked path reaching the aggregate
 *     tally through THIS bootstrap. Those are what the tests below
 *     lock down, plus a bootstrap-level determinism ("repeat-run
 *     idempotency") check: running the same tick twice with fixed
 *     inputs and a declining lock produces an identical tally both
 *     times.
 */
import './_ouraEnv';
import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  afterEach,
} from "vitest";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import {
  maybeStartOuraFetchSweep,
  maybeStartOuraAuthStatePurge,
  withOuraUserAdvisoryLock,
  OURA_USER_ADVISORY_LOCK_NAMESPACE,
  type OuraPgClientLike,
  type OuraPgPoolLike,
} from "../ouraFetchSweepBootstrap";
import { createOuraRefreshRegistry } from "../ouraRefreshRegistry";

function silentLog() {
  return {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };
}

function fakeDb() {
  // Never touched in the env-rejection paths or in any test that keeps
  // the iterFactory page set empty / the lock declining — the only
  // thing that would dereference `db` for real is `buildDefaultOuraFetchDeps`
  // inside `runOnce`, which none of these tests reach.
  return {} as unknown as NodePgDatabase<Record<string, unknown>>;
}

function emptyPages(): AsyncGenerator<readonly string[]> {
  return (async function* (): AsyncGenerator<readonly string[]> {})();
}

/* ─── maybeStartOuraFetchSweep — env gate ──────────────────────────────── */

describe("maybeStartOuraFetchSweep — env gate", () => {
  it("env var unset -> returns null, no warn, no info (hidden-infra default)", () => {
    const log = silentLog();
    const handle = maybeStartOuraFetchSweep({
      db: fakeDb(),
      refreshRegistry: createOuraRefreshRegistry(),
      log,
      env: {},
    });
    expect(handle).toBeNull();
    expect(log.warn).not.toHaveBeenCalled();
    expect(log.info).not.toHaveBeenCalled();
  });

  it("env var empty string -> returns null, no warn", () => {
    const log = silentLog();
    const handle = maybeStartOuraFetchSweep({
      db: fakeDb(),
      refreshRegistry: createOuraRefreshRegistry(),
      log,
      env: { OURA_FETCH_SWEEP_INTERVAL_MS: "" },
    });
    expect(handle).toBeNull();
    expect(log.warn).not.toHaveBeenCalled();
  });

  it.each([["5min"], ["0"], ["-1000"], ["NaN"]])(
    "invalid value %j -> returns null and warns (refuses to coerce)",
    (raw) => {
      const log = silentLog();
      const handle = maybeStartOuraFetchSweep({
        db: fakeDb(),
        refreshRegistry: createOuraRefreshRegistry(),
        log,
        env: { OURA_FETCH_SWEEP_INTERVAL_MS: raw },
      });
      expect(handle).toBeNull();
      expect(log.warn).toHaveBeenCalledTimes(1);
    },
  );

  it("respects a custom env var name (override)", () => {
    const log = silentLog();
    const handle = maybeStartOuraFetchSweep({
      db: fakeDb(),
      refreshRegistry: createOuraRefreshRegistry(),
      log,
      env: { CUSTOM_SWEEP_MS: "30000" },
      envVarName: "CUSTOM_SWEEP_MS",
    });
    expect(handle?.intervalMs).toBe(30000);
    handle?.stop();
  });

  it("valid positive number -> starts loop, returns handle with stop fn", () => {
    const log = silentLog();
    const handle = maybeStartOuraFetchSweep({
      db: fakeDb(),
      refreshRegistry: createOuraRefreshRegistry(),
      log,
      env: { OURA_FETCH_SWEEP_INTERVAL_MS: "60000" },
      iterFactory: () => emptyPages(),
    });
    expect(handle).not.toBeNull();
    expect(handle?.intervalMs).toBe(60000);
    expect(typeof handle?.stop).toBe("function");
    expect(log.info).toHaveBeenCalledTimes(1);
    // First tick fires at +60s — never let it run in this test.
    handle?.stop();
  });
});

/* ─── Restart safety ────────────────────────────────────────────────────── */

describe("maybeStartOuraFetchSweep — restart safety (start/stop/start)", () => {
  it("stop() halts the loop and a fresh start() afterwards works independently", () => {
    const log = silentLog();
    const registry = createOuraRefreshRegistry();

    const handle1 = maybeStartOuraFetchSweep({
      db: fakeDb(),
      refreshRegistry: registry,
      log,
      env: { OURA_FETCH_SWEEP_INTERVAL_MS: "1000" },
      iterFactory: () => emptyPages(),
    });
    expect(handle1).not.toBeNull();
    handle1?.stop();
    // Calling stop() twice must not throw (idempotent halt).
    expect(() => handle1?.stop()).not.toThrow();

    const handle2 = maybeStartOuraFetchSweep({
      db: fakeDb(),
      refreshRegistry: registry,
      log,
      env: { OURA_FETCH_SWEEP_INTERVAL_MS: "2000" },
      iterFactory: () => emptyPages(),
    });
    expect(handle2).not.toBeNull();
    expect(handle2?.intervalMs).toBe(2000);
    handle2?.stop();
  });
});

/* ─── Cutoff / pageSize wiring on first tick ───────────────────────────── */

describe("maybeStartOuraFetchSweep — first tick wiring", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("threads dbNow cutoff and pageSize into the iterator factory on first tick", async () => {
    // Regression guard mirroring the WHOOP bootstrap's equivalent test:
    // a future refactor must NOT silently drop the cutoff or pageSize
    // when wiring the iterator.
    const log = silentLog();
    const fixedNow = new Date("2026-03-15T12:34:56Z");
    const dbNowSpy = vi.fn(async () => fixedNow);
    const iterFactorySpy = vi.fn(() => emptyPages());

    const handle = maybeStartOuraFetchSweep({
      db: fakeDb(),
      refreshRegistry: createOuraRefreshRegistry(),
      log,
      env: { OURA_FETCH_SWEEP_INTERVAL_MS: "1000" },
      pageSize: 250,
      iterFactory: iterFactorySpy,
      dbNow: dbNowSpy,
    });
    expect(handle).not.toBeNull();
    try {
      await vi.advanceTimersByTimeAsync(1000);
      for (let i = 0; i < 5; i++) await Promise.resolve();

      expect(dbNowSpy).toHaveBeenCalledTimes(1);
      expect(iterFactorySpy).toHaveBeenCalledTimes(1);
      const [, factoryOpts] = iterFactorySpy.mock.calls[0]!;
      expect(factoryOpts.cutoff).toBe(fixedNow);
      expect(factoryOpts.pageSize).toBe(250);
    } finally {
      handle?.stop();
    }
  });

  it("defaults pageSize to OURA_TOKEN_USERS_DEFAULT_PAGE_SIZE when not overridden", async () => {
    const log = silentLog();
    const iterFactorySpy = vi.fn(() => emptyPages());
    const handle = maybeStartOuraFetchSweep({
      db: fakeDb(),
      refreshRegistry: createOuraRefreshRegistry(),
      log,
      env: { OURA_FETCH_SWEEP_INTERVAL_MS: "1000" },
      iterFactory: iterFactorySpy,
      dbNow: async () => new Date("2026-01-01T00:00:00Z"),
    });
    try {
      await vi.advanceTimersByTimeAsync(1000);
      for (let i = 0; i < 5; i++) await Promise.resolve();
      const [, factoryOpts] = iterFactorySpy.mock.calls[0]!;
      expect(factoryOpts.pageSize).toBe(500);
    } finally {
      handle?.stop();
    }
  });
});

/* ─── OURA_FETCH_SWEEP_MULTI_REPLICA env gate ──────────────────────────── */

describe("maybeStartOuraFetchSweep — OURA_FETCH_SWEEP_MULTI_REPLICA env gate", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  async function bootAndPeekFirstTick(env: Record<string, string>) {
    const log = silentLog();
    const handle = maybeStartOuraFetchSweep({
      db: fakeDb(),
      refreshRegistry: createOuraRefreshRegistry(),
      log,
      env: { OURA_FETCH_SWEEP_INTERVAL_MS: "1000", ...env },
      iterFactory: () => emptyPages(),
      dbNow: async () => new Date("2026-04-01T00:00:00Z"),
    });
    try {
      await vi.advanceTimersByTimeAsync(1000);
      for (let i = 0; i < 5; i++) await Promise.resolve();
    } finally {
      handle?.stop();
    }
    const startupCall = log.info.mock.calls.find(
      (c) => c[1] === "ouraFetchSweep:bootstrap started",
    );
    const startupMeta = startupCall?.[0] as
      | { multiReplica: boolean }
      | undefined;
    return { multiReplica: startupMeta?.multiReplica ?? false };
  }

  it("env var unset => acquireLock is NOT wired (single-replica default, hidden-infra)", async () => {
    const { multiReplica } = await bootAndPeekFirstTick({});
    expect(multiReplica).toBe(false);
  });

  it.each([["0"], ["false"], ["no"], ["off"], ["FALSE"], ["bogus"], [""]])(
    "falsy / unknown value %j => acquireLock NOT wired (strict whitelist)",
    async (raw) => {
      const { multiReplica } = await bootAndPeekFirstTick({
        OURA_FETCH_SWEEP_MULTI_REPLICA: raw,
      });
      expect(multiReplica).toBe(false);
    },
  );

  it.each([["1"], ["true"], ["yes"], ["on"], ["TRUE"], ["  YES  "]])(
    "truthy value %j => acquireLock IS wired",
    async (raw) => {
      const { multiReplica } = await bootAndPeekFirstTick({
        OURA_FETCH_SWEEP_MULTI_REPLICA: raw,
      });
      expect(multiReplica).toBe(true);
    },
  );

  it("explicit acquireLock override takes precedence over env (test seam)", async () => {
    const log = silentLog();
    const fakeLock = vi.fn(
      async <T>(_userId: string, fn: () => Promise<T>) => ({
        acquired: true as const,
        value: await fn(),
      }),
    );
    const handle = maybeStartOuraFetchSweep({
      db: fakeDb(),
      refreshRegistry: createOuraRefreshRegistry(),
      log,
      env: { OURA_FETCH_SWEEP_INTERVAL_MS: "1000" },
      iterFactory: () => emptyPages(),
      acquireLock: fakeLock,
    });
    try {
      const startupCall = log.info.mock.calls.find(
        (c) => c[1] === "ouraFetchSweep:bootstrap started",
      );
      const startupMeta = startupCall?.[0] as { multiReplica: boolean };
      expect(startupMeta.multiReplica).toBe(true);
    } finally {
      handle?.stop();
    }
  });
});

/* ─── Lock-contention -> skipped_locked tally, and repeat-run idempotency ── */

describe("maybeStartOuraFetchSweep — lock-contention tally + repeat-run idempotency", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("a declining acquireLock (acquired:false) tallies skipped_locked and NEVER invokes the real per-user runOnce", async () => {
    // The injected acquireLock always declines and never calls its `fn`
    // argument — which is the REAL `runOuraFetchOnce`/`buildDefaultOuraFetchDeps`
    // chain that would otherwise need Postgres + Oura OAuth env. Because
    // it's never called, this test stays fully DB-free while still
    // proving the lock-contention path reaches the aggregate tally
    // through THIS bootstrap's wiring (new in this lane — the
    // pre-lane bootstrap had no lock seam at all).
    const log = silentLog();
    const declineLock = vi.fn(async () => ({ acquired: false as const }));
    const iterFactorySpy = vi.fn(
      () =>
        (async function* (): AsyncGenerator<readonly string[]> {
          yield ["u1", "u2", "u3"];
        })(),
    );

    const handle = maybeStartOuraFetchSweep({
      db: fakeDb(),
      refreshRegistry: createOuraRefreshRegistry(),
      log,
      env: { OURA_FETCH_SWEEP_INTERVAL_MS: "1000" },
      iterFactory: iterFactorySpy,
      dbNow: async () => new Date("2026-05-01T00:00:00Z"),
      acquireLock: declineLock,
    });
    try {
      await vi.advanceTimersByTimeAsync(1000);
      for (let i = 0; i < 10; i++) await Promise.resolve();

      expect(declineLock).toHaveBeenCalledTimes(3);
      const doneCall = log.info.mock.calls.find(
        (c) => c[1] === "ouraFetchSweepStreaming:done",
      );
      expect(doneCall).toBeDefined();
      const tally = doneCall?.[0] as {
        total: number;
        byStatus: Record<string, number>;
      };
      expect(tally.total).toBe(3);
      expect(tally.byStatus.skipped_locked).toBe(3);
      expect(tally.byStatus.ok).toBe(0);
      expect(tally.byStatus.error).toBe(0);
    } finally {
      handle?.stop();
    }
  });

  it("repeat-run idempotency: two independent sweeps over the same fixed input + declining lock produce an identical tally", async () => {
    const log = silentLog();
    const declineLock = vi.fn(async () => ({ acquired: false as const }));
    const makeIterFactory = () =>
      vi.fn(
        () =>
          (async function* (): AsyncGenerator<readonly string[]> {
            yield ["a", "b"];
            yield ["c"];
          })(),
      );

    async function runOneTick(): Promise<unknown> {
      const iterFactorySpy = makeIterFactory();
      const handle = maybeStartOuraFetchSweep({
        db: fakeDb(),
        refreshRegistry: createOuraRefreshRegistry(),
        log,
        env: { OURA_FETCH_SWEEP_INTERVAL_MS: "1000" },
        iterFactory: iterFactorySpy,
        dbNow: async () => new Date("2026-05-01T00:00:00Z"),
        acquireLock: declineLock,
      });
      try {
        await vi.advanceTimersByTimeAsync(1000);
        for (let i = 0; i < 10; i++) await Promise.resolve();
      } finally {
        handle?.stop();
      }
      const calls = log.info.mock.calls.filter(
        (c) => c[1] === "ouraFetchSweepStreaming:done",
      );
      const last = calls[calls.length - 1]?.[0] as {
        total: number;
        byStatus: Record<string, number>;
      };
      return { total: last.total, byStatus: last.byStatus };
    }

    const first = await runOneTick();
    const second = await runOneTick();
    expect(second).toEqual(first);
    expect(first).toEqual({
      total: 3,
      byStatus: {
        ok: 0,
        skipped_no_token: 0,
        skipped_no_state: 0,
        skipped_locked: 3,
      skipped_fresh: 0,
      skipped_backoff: 0,
      skipped_needs_reauth: 0,
        error: 0,
      },
    });
  });
});

/* ─── maybeStartOuraAuthStatePurge — env gate ──────────────────────────── */

describe("maybeStartOuraAuthStatePurge — env gate", () => {
  it("env var unset -> returns null, no side effects", () => {
    const log = silentLog();
    const handle = maybeStartOuraAuthStatePurge({
      db: fakeDb(),
      log,
      env: {},
    });
    expect(handle).toBeNull();
    expect(log.warn).not.toHaveBeenCalled();
    expect(log.info).not.toHaveBeenCalled();
  });

  it.each([["5min"], ["0"], ["-1"]])(
    "invalid value %j -> returns null and warns",
    (raw) => {
      const log = silentLog();
      const handle = maybeStartOuraAuthStatePurge({
        db: fakeDb(),
        log,
        env: { OURA_AUTH_STATE_PURGE_INTERVAL_MS: raw },
      });
      expect(handle).toBeNull();
      expect(log.warn).toHaveBeenCalledTimes(1);
    },
  );

  it("valid value -> starts an interval and reports ttlMs", () => {
    vi.useFakeTimers();
    try {
      const log = silentLog();
      const purgeFn = vi.fn(async () => 0);
      const handle = maybeStartOuraAuthStatePurge({
        db: fakeDb(),
        log,
        env: { OURA_AUTH_STATE_PURGE_INTERVAL_MS: "5000" },
        purgeFn,
      });
      expect(handle).not.toBeNull();
      expect(handle?.intervalMs).toBe(5000);
      expect(typeof handle?.ttlMs).toBe("number");
      handle?.stop();
    } finally {
      vi.useRealTimers();
    }
  });
});

/* ─── ZERO-BEHAVIOR-CHANGE proof: both bootstraps absent -> no timers ───── */

describe("zero-behavior-change with both Oura env vars absent", () => {
  it("neither bootstrap schedules a timer, logs, or touches the DB when unset", () => {
    vi.useFakeTimers();
    try {
      const log = silentLog();
      const timersBefore = vi.getTimerCount();

      const sweepHandle = maybeStartOuraFetchSweep({
        db: fakeDb(),
        refreshRegistry: createOuraRefreshRegistry(),
        log,
        env: {},
      });
      const purgeHandle = maybeStartOuraAuthStatePurge({
        db: fakeDb(),
        log,
        env: {},
      });

      expect(sweepHandle).toBeNull();
      expect(purgeHandle).toBeNull();
      expect(vi.getTimerCount()).toBe(timersBefore);
      expect(log.info).not.toHaveBeenCalled();
      expect(log.warn).not.toHaveBeenCalled();
      expect(log.error).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });
});

/* ─── withOuraUserAdvisoryLock — Oura-namespaced advisory lock ─────────── */

interface FakeClient extends OuraPgClientLike {
  queries: Array<{ text: string; values?: unknown[] }>;
  releaseCalls: Array<Error | boolean | undefined>;
}

function makeFakeClient(opts: {
  acquired?: boolean;
  acquireThrows?: boolean;
  unlockThrows?: boolean;
}): FakeClient {
  const queries: Array<{ text: string; values?: unknown[] }> = [];
  const releaseCalls: Array<Error | boolean | undefined> = [];
  return {
    queries,
    releaseCalls,
    async query(text, values) {
      queries.push({ text, values });
      if (text.includes("pg_try_advisory_lock")) {
        if (opts.acquireThrows) throw new Error("acquire blew up");
        return { rows: [{ got: opts.acquired ?? true }] };
      }
      if (text.includes("pg_advisory_unlock")) {
        if (opts.unlockThrows) throw new Error("unlock blew up");
        return { rows: [{ pg_advisory_unlock: true }] };
      }
      return { rows: [] };
    },
    release(arg) {
      releaseCalls.push(arg);
    },
  };
}

function makeFakePool(client: OuraPgClientLike): OuraPgPoolLike {
  return {
    async connect() {
      return client;
    },
  };
}

describe("withOuraUserAdvisoryLock — unit (fake pool)", () => {
  it("runs fn and returns value when the lock is acquired, keyed by the OURA namespace", async () => {
    const client = makeFakeClient({ acquired: true });
    const pool = makeFakePool(client);
    const fn = vi.fn(async () => 42);

    const result = await withOuraUserAdvisoryLock(pool, "user-A", fn);

    expect(result).toEqual({ acquired: true, value: 42 });
    expect(fn).toHaveBeenCalledTimes(1);
    expect(client.releaseCalls).toEqual([undefined]);
    expect(client.queries).toHaveLength(2);
    expect(client.queries[0]!.values).toEqual([
      "user-A",
      OURA_USER_ADVISORY_LOCK_NAMESPACE,
    ]);
  });

  it("uses a namespace distinct from WHOOP's (disjoint 64-bit keyspace regions)", async () => {
    // Regression guard: if a future edit accidentally copy-pasted
    // WHOOP's namespace constant, the two providers' locks would
    // collide on shared userIds across features. 0x57480001 is
    // WHOOP's; Oura's must differ.
    expect(OURA_USER_ADVISORY_LOCK_NAMESPACE).not.toBe(0x57480001);
  });

  it("skips fn and returns acquired:false when another holder owns the lock", async () => {
    const client = makeFakeClient({ acquired: false });
    const pool = makeFakePool(client);
    const fn = vi.fn(async () => "should-not-run");

    const result = await withOuraUserAdvisoryLock(pool, "user-B", fn);

    expect(result).toEqual({ acquired: false });
    expect(fn).not.toHaveBeenCalled();
    expect(client.queries).toHaveLength(1);
  });

  it("re-throws fn errors AFTER unlocking and releasing", async () => {
    const client = makeFakeClient({ acquired: true });
    const pool = makeFakePool(client);
    const boom = new Error("fn boom");

    await expect(
      withOuraUserAdvisoryLock(pool, "user-C", async () => {
        throw boom;
      }),
    ).rejects.toBe(boom);

    expect(client.releaseCalls).toEqual([undefined]);
    expect(client.queries).toHaveLength(2);
  });

  it("DESTROYS the client when unlock throws (session may still hold the lock)", async () => {
    const client = makeFakeClient({ acquired: true, unlockThrows: true });
    const pool = makeFakePool(client);

    const result = await withOuraUserAdvisoryLock(
      pool,
      "user-D",
      async () => "ok",
    );
    expect(result).toEqual({ acquired: true, value: "ok" });
    expect(client.releaseCalls).toHaveLength(1);
    expect(client.releaseCalls[0]).toBeInstanceOf(Error);
  });

  it("DESTROYS the client and re-throws when the acquire query itself throws", async () => {
    const client = makeFakeClient({ acquireThrows: true });
    const pool = makeFakePool(client);
    const fn = vi.fn();

    await expect(
      withOuraUserAdvisoryLock(pool, "user-E", fn),
    ).rejects.toThrow("acquire blew up");
    expect(fn).not.toHaveBeenCalled();
    expect(client.releaseCalls).toHaveLength(1);
    expect(client.releaseCalls[0]).toBeInstanceOf(Error);
  });
});
