/**
 * Tests for `maybeStartWhoopAuthStatePurge` — the env-gated boot
 * helper for the auth-state expiry purge cron.
 *
 * Mirrors the `whoopFetchSweepBootstrap` test shape: env rejection
 * paths use `silentLog()` + a fakeDb (never touched), and the "valid"
 * path uses `vi.useFakeTimers()` to drive the first tick deterministically
 * via an injected `purgeFn` test seam (no real DB).
 */
import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  afterEach,
} from "vitest";
import { maybeStartWhoopAuthStatePurge } from "../whoopAuthStatePurgeBootstrap";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

function silentLog() {
  return {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };
}

function fakeDb() {
  return {} as unknown as NodePgDatabase<Record<string, unknown>>;
}

describe("maybeStartWhoopAuthStatePurge", () => {
  it("env var unset -> returns null, no warn (hidden-infra default)", () => {
    const log = silentLog();
    const handle = maybeStartWhoopAuthStatePurge({
      db: fakeDb(),
      log,
      env: {},
    });
    expect(handle).toBeNull();
    expect(log.warn).not.toHaveBeenCalled();
    expect(log.info).not.toHaveBeenCalled();
  });

  it("env var empty string -> returns null, no warn", () => {
    const log = silentLog();
    const handle = maybeStartWhoopAuthStatePurge({
      db: fakeDb(),
      log,
      env: { WHOOP_AUTH_STATE_PURGE_INTERVAL_MS: "" },
    });
    expect(handle).toBeNull();
    expect(log.warn).not.toHaveBeenCalled();
  });

  it.each([["5min"], ["0"], ["-1000"], ["NaN"]])(
    "invalid value %j -> returns null and warns (refuses to coerce)",
    (raw) => {
      const log = silentLog();
      const handle = maybeStartWhoopAuthStatePurge({
        db: fakeDb(),
        log,
        env: { WHOOP_AUTH_STATE_PURGE_INTERVAL_MS: raw },
      });
      expect(handle).toBeNull();
      expect(log.warn).toHaveBeenCalledTimes(1);
    },
  );

  it("valid positive number -> starts loop, returns handle with stop fn", () => {
    const log = silentLog();
    const handle = maybeStartWhoopAuthStatePurge({
      db: fakeDb(),
      log,
      env: { WHOOP_AUTH_STATE_PURGE_INTERVAL_MS: "60000" },
    });
    expect(handle).not.toBeNull();
    expect(handle?.intervalMs).toBe(60000);
    expect(handle?.ttlMs).toBe(10 * 60 * 1000);
    expect(typeof handle?.stop).toBe("function");
    expect(log.info).toHaveBeenCalledWith(
      expect.objectContaining({ intervalMs: 60000, ttlMs: 10 * 60 * 1000 }),
      "whoopAuthStatePurge:bootstrap started",
    );
    handle?.stop();
  });

  it("respects a custom env var name and ttlMs override", () => {
    const log = silentLog();
    const handle = maybeStartWhoopAuthStatePurge({
      db: fakeDb(),
      log,
      env: { CUSTOM_PURGE_MS: "30000" },
      envVarName: "CUSTOM_PURGE_MS",
      ttlMs: 5_000,
    });
    expect(handle?.intervalMs).toBe(30000);
    expect(handle?.ttlMs).toBe(5_000);
    handle?.stop();
  });

  describe("tick behavior via purgeFn test seam", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });
    afterEach(() => {
      vi.useRealTimers();
    });

    it("first tick calls purgeFn with (db, now, ttlMs) and logs reaped > 0", async () => {
      const log = silentLog();
      const purgeSpy = vi.fn(async () => 3);
      const fixedNow = 1_700_000_000_000;
      const handle = maybeStartWhoopAuthStatePurge({
        db: fakeDb(),
        log,
        env: { WHOOP_AUTH_STATE_PURGE_INTERVAL_MS: "1000" },
        ttlMs: 60_000,
        purgeFn: purgeSpy,
        now: () => fixedNow,
      });
      try {
        await vi.advanceTimersByTimeAsync(1000);
        for (let i = 0; i < 5; i++) await Promise.resolve();
        expect(purgeSpy).toHaveBeenCalledTimes(1);
        expect(purgeSpy.mock.calls[0]).toEqual([
          expect.anything(),
          fixedNow,
          60_000,
        ]);
        const infoCall = log.info.mock.calls.find(
          (c) => c[1] === "whoopAuthStatePurge: rows reaped",
        );
        expect(infoCall?.[0]).toEqual({ reaped: 3 });
      } finally {
        handle?.stop();
      }
    });

    it("zero reaped on a tick is silent (no info log)", async () => {
      const log = silentLog();
      const purgeSpy = vi.fn(async () => 0);
      const handle = maybeStartWhoopAuthStatePurge({
        db: fakeDb(),
        log,
        env: { WHOOP_AUTH_STATE_PURGE_INTERVAL_MS: "1000" },
        purgeFn: purgeSpy,
      });
      try {
        await vi.advanceTimersByTimeAsync(1000);
        for (let i = 0; i < 5; i++) await Promise.resolve();
        expect(purgeSpy).toHaveBeenCalledTimes(1);
        const reapedCall = log.info.mock.calls.find(
          (c) => c[1] === "whoopAuthStatePurge: rows reaped",
        );
        expect(reapedCall).toBeUndefined();
      } finally {
        handle?.stop();
      }
    });

    it("purgeFn rejection is caught, logged, and the loop keeps ticking", async () => {
      const log = silentLog();
      let calls = 0;
      const purgeSpy = vi.fn(async () => {
        calls += 1;
        if (calls === 1) throw new Error("boom");
        return 0;
      });
      const handle = maybeStartWhoopAuthStatePurge({
        db: fakeDb(),
        log,
        env: { WHOOP_AUTH_STATE_PURGE_INTERVAL_MS: "1000" },
        purgeFn: purgeSpy,
      });
      try {
        await vi.advanceTimersByTimeAsync(1000);
        for (let i = 0; i < 5; i++) await Promise.resolve();
        expect(log.error).toHaveBeenCalledTimes(1);
        // Loop survives — second tick fires.
        await vi.advanceTimersByTimeAsync(1000);
        for (let i = 0; i < 5; i++) await Promise.resolve();
        expect(purgeSpy).toHaveBeenCalledTimes(2);
      } finally {
        handle?.stop();
      }
    });
  });
});
