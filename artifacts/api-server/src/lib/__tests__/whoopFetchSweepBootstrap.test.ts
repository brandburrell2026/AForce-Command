/**
 * Tests for `maybeStartWhoopFetchSweep` — the env-gated boot helper
 * that decides whether to start the WHOOP fetch sweep loop.
 *
 * We don't reach the DB or WHOOP — the sweep is only STARTED in the
 * "valid env" test, and we stop it before it can tick (first tick
 * fires at +intervalMs, not synchronously).
 */
import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  afterEach,
} from "vitest";
import { maybeStartWhoopFetchSweep } from "../whoopFetchSweepBootstrap";
import { createWhoopRefreshRegistry } from "../whoopRefreshRegistry";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

function silentLog() {
  return {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };
}

function fakeDb() {
  // Never touched in the env-rejection paths; the only path that uses
  // it is the "valid env" test which we stop() before the first tick.
  return {} as unknown as NodePgDatabase<Record<string, unknown>>;
}

describe("maybeStartWhoopFetchSweep", () => {
  it("env var unset -> returns null, no warn (hidden-infra default)", () => {
    const log = silentLog();
    const handle = maybeStartWhoopFetchSweep({
      db: fakeDb(),
      refreshRegistry: createWhoopRefreshRegistry(),
      log,
      env: {},
    });
    expect(handle).toBeNull();
    expect(log.warn).not.toHaveBeenCalled();
    expect(log.info).not.toHaveBeenCalled();
  });

  it("env var empty string -> returns null, no warn", () => {
    const log = silentLog();
    const handle = maybeStartWhoopFetchSweep({
      db: fakeDb(),
      refreshRegistry: createWhoopRefreshRegistry(),
      log,
      env: { WHOOP_FETCH_SWEEP_INTERVAL_MS: "" },
    });
    expect(handle).toBeNull();
    expect(log.warn).not.toHaveBeenCalled();
  });

  it("non-numeric value -> returns null and warns (refuses to coerce)", () => {
    const log = silentLog();
    const handle = maybeStartWhoopFetchSweep({
      db: fakeDb(),
      refreshRegistry: createWhoopRefreshRegistry(),
      log,
      env: { WHOOP_FETCH_SWEEP_INTERVAL_MS: "5min" },
    });
    expect(handle).toBeNull();
    expect(log.warn).toHaveBeenCalledTimes(1);
  });

  it("zero -> returns null and warns (intervalMs must be positive)", () => {
    const log = silentLog();
    const handle = maybeStartWhoopFetchSweep({
      db: fakeDb(),
      refreshRegistry: createWhoopRefreshRegistry(),
      log,
      env: { WHOOP_FETCH_SWEEP_INTERVAL_MS: "0" },
    });
    expect(handle).toBeNull();
    expect(log.warn).toHaveBeenCalledTimes(1);
  });

  it("negative -> returns null and warns", () => {
    const log = silentLog();
    const handle = maybeStartWhoopFetchSweep({
      db: fakeDb(),
      refreshRegistry: createWhoopRefreshRegistry(),
      log,
      env: { WHOOP_FETCH_SWEEP_INTERVAL_MS: "-1000" },
    });
    expect(handle).toBeNull();
    expect(log.warn).toHaveBeenCalledTimes(1);
  });

  it("valid positive number -> starts loop, returns handle with stop fn", () => {
    const log = silentLog();
    const handle = maybeStartWhoopFetchSweep({
      db: fakeDb(),
      refreshRegistry: createWhoopRefreshRegistry(),
      log,
      env: { WHOOP_FETCH_SWEEP_INTERVAL_MS: "60000" },
    });
    expect(handle).not.toBeNull();
    expect(handle?.intervalMs).toBe(60000);
    expect(typeof handle?.stop).toBe("function");
    expect(log.info).toHaveBeenCalledTimes(1);
    // CRITICAL: stop the loop synchronously so the test process exits
    // cleanly. First tick fires at +60s — we never let it run, so the
    // fakeDb is never touched.
    handle?.stop();
  });

  describe("first tick — sweep wiring via test seams", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });
    afterEach(() => {
      vi.useRealTimers();
    });

    it("threads dbNow cutoff and pageSize into the iterator factory on first tick", async () => {
      // Regression guard for the architect's PR-21 round-2 follow-up:
      // a future refactor must NOT silently drop the cutoff or
      // pageSize when wiring the iterator — this test fails loudly
      // if either is missing. Uses the bootstrap's `iterFactory` /
      // `dbNow` test seams so we don't need a real DB or to mock
      // the worker module.
      const log = silentLog();
      const fixedNow = new Date("2026-03-15T12:34:56Z");
      const dbNowSpy = vi.fn(async () => fixedNow);
      const iterFactorySpy = vi.fn(
        () =>
          // Empty page set — streaming sweep finishes immediately
          // with a zero tally. We only care that the factory was
          // called with the right args.
          (async function* (): AsyncGenerator<readonly string[]> {})(),
      );

      const handle = maybeStartWhoopFetchSweep({
        db: fakeDb(),
        refreshRegistry: createWhoopRefreshRegistry(),
        log,
        env: { WHOOP_FETCH_SWEEP_INTERVAL_MS: "1000" },
        pageSize: 250,
        iterFactory: iterFactorySpy,
        dbNow: dbNowSpy,
      });
      expect(handle).not.toBeNull();
      try {
        // Advance past intervalMs so the first tick fires, then drain
        // the microtask queue so the async runSweep gets to call
        // dbNow + iterFactory.
        await vi.advanceTimersByTimeAsync(1000);
        // Extra microtask flush — runSweep awaits dbNow then iterates
        // a generator, which needs a couple of microtask hops.
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
  });

  describe("WHOOP_FETCH_SWEEP_MULTI_REPLICA env gate", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });
    afterEach(() => {
      vi.useRealTimers();
    });

    // Helper: spin up the loop, advance to the first tick, capture
    // whether the injected iterFactory's per-user runOnce was wrapped
    // by an acquireLock. We do this by passing an explicit
    // `acquireLock` override OR by observing that the env-gated path
    // produced one via the `multiReplica` field on the bootstrap log.
    async function bootAndPeekFirstTick(env: Record<string, string>) {
      const log = silentLog();
      const dbNowSpy = vi.fn(async () => new Date("2026-04-01T00:00:00Z"));
      const iterFactorySpy = vi.fn(
        () => (async function* (): AsyncGenerator<readonly string[]> {})(),
      );
      const handle = maybeStartWhoopFetchSweep({
        db: fakeDb(),
        refreshRegistry: createWhoopRefreshRegistry(),
        log,
        env: { WHOOP_FETCH_SWEEP_INTERVAL_MS: "1000", ...env },
        iterFactory: iterFactorySpy,
        dbNow: dbNowSpy,
      });
      try {
        await vi.advanceTimersByTimeAsync(1000);
        for (let i = 0; i < 5; i++) await Promise.resolve();
      } finally {
        handle?.stop();
      }
      // The bootstrap startup info log carries `{ multiReplica }` —
      // the only externally observable signal of whether the env
      // gate enabled the lock seam. Verified against
      // whoopFetchSweepBootstrap.ts:182.
      const startupCall = log.info.mock.calls.find(
        (c) => c[1] === "whoopFetchSweep:bootstrap started",
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
          WHOOP_FETCH_SWEEP_MULTI_REPLICA: raw,
        });
        expect(multiReplica).toBe(false);
      },
    );

    it.each([["1"], ["true"], ["yes"], ["on"], ["TRUE"], ["  YES  "]])(
      "truthy value %j => acquireLock IS wired",
      async (raw) => {
        const { multiReplica } = await bootAndPeekFirstTick({
          WHOOP_FETCH_SWEEP_MULTI_REPLICA: raw,
        });
        expect(multiReplica).toBe(true);
      },
    );

    it("explicit acquireLock override takes precedence over env (test seam)", async () => {
      const log = silentLog();
      // env is OFF, but we pass an explicit acquireLock — bootstrap
      // should still wire it (test override always wins).
      const fakeLock = vi.fn(
        async <T>(_userId: string, fn: () => Promise<T>) => ({
          acquired: true as const,
          value: await fn(),
        }),
      );
      const handle = maybeStartWhoopFetchSweep({
        db: fakeDb(),
        refreshRegistry: createWhoopRefreshRegistry(),
        log,
        env: { WHOOP_FETCH_SWEEP_INTERVAL_MS: "1000" },
        acquireLock: fakeLock,
      });
      try {
        const startupCall = log.info.mock.calls.find(
          (c) => c[1] === "whoopFetchSweep:bootstrap started",
        );
        const startupMeta = startupCall?.[0] as { multiReplica: boolean };
        expect(startupMeta.multiReplica).toBe(true);
      } finally {
        handle?.stop();
      }
    });

    it("custom multiReplicaEnvVarName override is honored", async () => {
      const log = silentLog();
      const handle = maybeStartWhoopFetchSweep({
        db: fakeDb(),
        refreshRegistry: createWhoopRefreshRegistry(),
        log,
        env: {
          WHOOP_FETCH_SWEEP_INTERVAL_MS: "1000",
          CUSTOM_MR_FLAG: "1",
        },
        multiReplicaEnvVarName: "CUSTOM_MR_FLAG",
      });
      try {
        const startupCall = log.info.mock.calls.find(
          (c) => c[1] === "whoopFetchSweep:bootstrap started",
        );
        const startupMeta = startupCall?.[0] as { multiReplica: boolean };
        expect(startupMeta.multiReplica).toBe(true);
      } finally {
        handle?.stop();
      }
    });
  });

  it("respects a custom env var name (override)", () => {
    const log = silentLog();
    const handle = maybeStartWhoopFetchSweep({
      db: fakeDb(),
      refreshRegistry: createWhoopRefreshRegistry(),
      log,
      env: { CUSTOM_SWEEP_MS: "30000" },
      envVarName: "CUSTOM_SWEEP_MS",
    });
    expect(handle?.intervalMs).toBe(30000);
    handle?.stop();
  });
});
