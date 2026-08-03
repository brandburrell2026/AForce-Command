/**
 * Tests for `providerKit/sweepLoop.ts` — the provider-agnostic sweep
 * fan-out + interval scheduling + env-cadence parsing extracted from
 * `whoopFetchSweep.ts` / `whoopFetchSweepBootstrap.ts`.
 *
 * Covers:
 *   - runProviderFetchSweep: status tally, concurrency cap, the
 *     acquireLock seam (acquired true/false), and defensive
 *     runOnce-throw absorption.
 *   - runProviderFetchSweepStreaming: multi-page accumulation, empty
 *     pages skipped without contributing to the tally.
 *   - startProviderFetchSweepLoop: fake-timer cadence, first tick
 *     delayed (no synchronous sweep at start), re-entrancy guard,
 *     runSweep-throw survival, stop() halting future ticks.
 *   - parseSweepIntervalMs: the unset/empty/invalid/valid env contract.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  runProviderFetchSweep,
  runProviderFetchSweepStreaming,
  startProviderFetchSweepLoop,
  parseSweepIntervalMs,
  type AcquireUserSweepLock,
} from "../providerKit/sweepLoop";
import type { ProviderFetchOutcomeStatus } from "../providerKit/fetchWorker";

function silentLog() {
  return { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
}

describe("runProviderFetchSweep", () => {
  it("empty userIds -> zero tally, no runOnce calls", async () => {
    const runOnce = vi.fn();
    const result = await runProviderFetchSweep({ userIds: [], runOnce });
    expect(result.total).toBe(0);
    expect(runOnce).not.toHaveBeenCalled();
    expect(result.byStatus).toEqual({
      ok: 0,
      skipped_no_token: 0,
      skipped_no_state: 0,
      skipped_locked: 0,
      error: 0,
    });
  });

  it("tallies outcomes by status across all users", async () => {
    const outcomes: Record<string, ProviderFetchOutcomeStatus> = {
      a: "ok",
      b: "ok",
      c: "skipped_no_token",
      d: "skipped_no_state",
      e: "error",
    };
    const result = await runProviderFetchSweep({
      userIds: Object.keys(outcomes),
      runOnce: async (userId) => ({ status: outcomes[userId]! }),
    });
    expect(result.total).toBe(5);
    expect(result.byStatus).toEqual({
      ok: 2,
      skipped_no_token: 1,
      skipped_no_state: 1,
      skipped_locked: 0,
      error: 1,
    });
  });

  it("a thrown runOnce is absorbed into byStatus.error (defensive — contract is never-throws)", async () => {
    const log = silentLog();
    const result = await runProviderFetchSweep({
      userIds: ["a", "b"],
      runOnce: async (userId) => {
        if (userId === "a") throw new Error("boom");
        return { status: "ok" as const };
      },
      log,
    });
    expect(result.byStatus.error).toBe(1);
    expect(result.byStatus.ok).toBe(1);
    expect(log.error).toHaveBeenCalledTimes(1);
  });

  it("respects the concurrency cap (never more than N in flight)", async () => {
    let inFlight = 0;
    let maxInFlight = 0;
    const userIds = Array.from({ length: 10 }, (_, i) => `u${i}`);
    await runProviderFetchSweep({
      userIds,
      concurrency: 3,
      runOnce: async () => {
        inFlight += 1;
        maxInFlight = Math.max(maxInFlight, inFlight);
        await new Promise((r) => setTimeout(r, 1));
        inFlight -= 1;
        return { status: "ok" as const };
      },
    });
    expect(maxInFlight).toBeLessThanOrEqual(3);
  });

  it("acquireLock: acquired:false tallies as skipped_locked and does not invoke runOnce", async () => {
    const runOnce = vi.fn(async () => ({ status: "ok" as const }));
    const acquireLock: AcquireUserSweepLock = async (userId) =>
      userId === "locked" ? { acquired: false } : { acquired: true, value: await runOnce(userId) };
    const result = await runProviderFetchSweep({
      userIds: ["locked", "free"],
      runOnce,
      acquireLock,
    });
    expect(result.byStatus.skipped_locked).toBe(1);
    expect(result.byStatus.ok).toBe(1);
    expect(runOnce).toHaveBeenCalledTimes(1);
    expect(runOnce).toHaveBeenCalledWith("free");
  });

  it("acquireLock throwing is tallied as error, not retried as a skip", async () => {
    const acquireLock: AcquireUserSweepLock = async () => {
      throw new Error("lock backend down");
    };
    const result = await runProviderFetchSweep({
      userIds: ["u1"],
      runOnce: async () => ({ status: "ok" as const }),
      acquireLock,
    });
    expect(result.byStatus.error).toBe(1);
    expect(result.byStatus.skipped_locked).toBe(0);
  });
});

describe("runProviderFetchSweepStreaming", () => {
  async function* pages(chunks: string[][]): AsyncGenerator<string[]> {
    for (const c of chunks) yield c;
  }

  it("accumulates the tally across multiple pages", async () => {
    const result = await runProviderFetchSweepStreaming({
      pages: pages([["a", "b"], ["c"], ["d", "e", "f"]]),
      runOnce: async () => ({ status: "ok" as const }),
    });
    expect(result.total).toBe(6);
    expect(result.byStatus.ok).toBe(6);
  });

  it("skips empty pages without contributing to the tally or logging", async () => {
    const log = silentLog();
    const result = await runProviderFetchSweepStreaming({
      pages: pages([[], ["a"], []]),
      runOnce: async () => ({ status: "ok" as const }),
      log,
    });
    expect(result.total).toBe(1);
    // Only the aggregate "Streaming:done" log fires; the empty-page
    // per-page "empty" log inside runProviderFetchSweep never runs
    // because empty pages are skipped before calling it.
    expect(
      log.info.mock.calls.filter((c) => String(c[1]).endsWith(":empty")),
    ).toHaveLength(0);
  });

  it("no pages at all -> zero tally", async () => {
    const result = await runProviderFetchSweepStreaming({
      pages: pages([]),
      runOnce: async () => ({ status: "ok" as const }),
    });
    expect(result.total).toBe(0);
  });
});

describe("startProviderFetchSweepLoop", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("throws synchronously when intervalMs is not > 0", () => {
    expect(() =>
      startProviderFetchSweepLoop({ intervalMs: 0, runSweep: async () => ({} as never) }),
    ).toThrow(/intervalMs must be > 0/);
    expect(() =>
      startProviderFetchSweepLoop({ intervalMs: -5, runSweep: async () => ({} as never) }),
    ).toThrow(/intervalMs must be > 0/);
  });

  it("does not run a sweep synchronously at start — first tick fires after intervalMs", async () => {
    const runSweep = vi.fn(async () => ({} as never));
    const stop = startProviderFetchSweepLoop({ intervalMs: 1_000, runSweep });
    expect(runSweep).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(999);
    expect(runSweep).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(runSweep).toHaveBeenCalledTimes(1);
    stop();
  });

  it("schedules the next tick only after the previous sweep settles (setTimeout chain, not setInterval)", async () => {
    let resolveSweep: (() => void) | null = null;
    const runSweep = vi.fn(
      () =>
        new Promise<never>((resolve) => {
          resolveSweep = () => resolve(undefined as never);
        }),
    );
    const stop = startProviderFetchSweepLoop({ intervalMs: 100, runSweep });
    await vi.advanceTimersByTimeAsync(100);
    expect(runSweep).toHaveBeenCalledTimes(1);
    // Advance well past another interval while the sweep is still
    // pending — a setInterval-based loop would have fired again by now.
    await vi.advanceTimersByTimeAsync(500);
    expect(runSweep).toHaveBeenCalledTimes(1);
    resolveSweep!();
    await Promise.resolve();
    await Promise.resolve();
    await vi.advanceTimersByTimeAsync(100);
    expect(runSweep).toHaveBeenCalledTimes(2);
    stop();
  });

  it("runSweep throwing is caught, logged, and the loop keeps ticking", async () => {
    const log = silentLog();
    let calls = 0;
    const runSweep = vi.fn(async () => {
      calls += 1;
      if (calls === 1) throw new Error("boom");
      return {} as never;
    });
    const stop = startProviderFetchSweepLoop({ intervalMs: 100, runSweep, log });
    await vi.advanceTimersByTimeAsync(100);
    expect(log.error).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(100);
    expect(runSweep).toHaveBeenCalledTimes(2);
    stop();
  });

  it("stop() prevents further ticks", async () => {
    const runSweep = vi.fn(async () => ({} as never));
    const stop = startProviderFetchSweepLoop({ intervalMs: 100, runSweep });
    await vi.advanceTimersByTimeAsync(100);
    expect(runSweep).toHaveBeenCalledTimes(1);
    stop();
    await vi.advanceTimersByTimeAsync(1_000);
    expect(runSweep).toHaveBeenCalledTimes(1);
  });
});

describe("parseSweepIntervalMs", () => {
  it("unset -> null, no warn", () => {
    const log = silentLog();
    expect(
      parseSweepIntervalMs({ envVarName: "X_INTERVAL_MS", env: {}, log }),
    ).toBeNull();
    expect(log.warn).not.toHaveBeenCalled();
  });

  it("empty string -> null, no warn", () => {
    const log = silentLog();
    expect(
      parseSweepIntervalMs({
        envVarName: "X_INTERVAL_MS",
        env: { X_INTERVAL_MS: "" },
        log,
      }),
    ).toBeNull();
    expect(log.warn).not.toHaveBeenCalled();
  });

  it.each([["5min"], ["0"], ["-1000"], ["NaN"]])(
    "invalid value %j -> null, warns once (refuses to coerce)",
    (raw) => {
      const log = silentLog();
      expect(
        parseSweepIntervalMs({
          envVarName: "X_INTERVAL_MS",
          env: { X_INTERVAL_MS: raw },
          log,
        }),
      ).toBeNull();
      expect(log.warn).toHaveBeenCalledTimes(1);
    },
  );

  it("valid positive number -> returns the parsed number", () => {
    const log = silentLog();
    expect(
      parseSweepIntervalMs({
        envVarName: "X_INTERVAL_MS",
        env: { X_INTERVAL_MS: "60000" },
        log,
      }),
    ).toBe(60_000);
    expect(log.warn).not.toHaveBeenCalled();
  });
});
