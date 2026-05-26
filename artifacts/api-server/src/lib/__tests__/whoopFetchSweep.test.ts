/**
 * Tests for the WHOOP fetch sweep — both the single-pass sweep and the
 * interval loop.
 *
 * Pure unit tests. The per-user runner is a fake that records calls
 * and returns whatever outcome the test asks for. Timers in the loop
 * test are vitest fake timers.
 *
 * Covers:
 *   - tally counts by status across mixed outcomes
 *   - empty userIds returns zero tally with finished timestamps
 *   - throwing runner is absorbed into byStatus.error
 *   - concurrency cap is honored (peak in-flight <= cap)
 *   - startWhoopFetchSweepLoop schedules ticks at the configured
 *     interval and the first tick fires AFTER intervalMs (not at t=0)
 *   - stop() prevents further ticks
 *   - re-entrancy: a tick is never scheduled while the previous sweep
 *     is still running (setTimeout chain semantics)
 *   - intervalMs <= 0 throws
 */
import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  afterEach,
} from "vitest";
import type { WhoopFetchOutcomeStatus } from "../whoopFetchWorker";
import {
  runWhoopFetchSweep,
  startWhoopFetchSweepLoop,
} from "../whoopFetchSweep";

describe("runWhoopFetchSweep", () => {
  it("tallies mixed outcomes by status", async () => {
    const plan: Record<string, WhoopFetchOutcomeStatus> = {
      a: "ok",
      b: "ok",
      c: "skipped_no_token",
      d: "skipped_no_state",
      e: "error",
      f: "ok",
    };
    const result = await runWhoopFetchSweep({
      userIds: Object.keys(plan),
      runOnce: async (id) => ({ status: plan[id]! }),
      nowMs: () => 1_000_000,
    });
    expect(result.total).toBe(6);
    expect(result.byStatus).toEqual({
      ok: 3,
      skipped_no_token: 1,
      skipped_no_state: 1,
      error: 1,
    });
    expect(result.startedAt).toBe(1_000_000);
    expect(result.finishedAt).toBe(1_000_000);
    expect(result.durationMs).toBe(0);
  });

  it("returns a zero tally immediately for an empty user list", async () => {
    const calls: string[] = [];
    const result = await runWhoopFetchSweep({
      userIds: [],
      runOnce: async (id) => {
        calls.push(id);
        return { status: "ok" };
      },
    });
    expect(calls).toEqual([]);
    expect(result.total).toBe(0);
    expect(result.byStatus).toEqual({
      ok: 0,
      skipped_no_token: 0,
      skipped_no_state: 0,
      error: 0,
    });
  });

  it("absorbs runner throws into byStatus.error so one bad user can't kill the sweep", async () => {
    const result = await runWhoopFetchSweep({
      userIds: ["good1", "bad", "good2"],
      runOnce: async (id) => {
        if (id === "bad") throw new Error("nope");
        return { status: "ok" };
      },
    });
    expect(result.byStatus.ok).toBe(2);
    expect(result.byStatus.error).toBe(1);
  });

  it("honors the concurrency cap — peak in-flight never exceeds the cap", async () => {
    let inFlight = 0;
    let peak = 0;
    const release: Array<() => void> = [];
    const userIds = ["u1", "u2", "u3", "u4", "u5", "u6", "u7", "u8"];
    const sweep = runWhoopFetchSweep({
      userIds,
      concurrency: 3,
      runOnce: async () => {
        inFlight += 1;
        if (inFlight > peak) peak = inFlight;
        await new Promise<void>((r) => release.push(r));
        inFlight -= 1;
        return { status: "ok" };
      },
    });
    // Let the worker pool spin up.
    await Promise.resolve();
    await Promise.resolve();
    expect(inFlight).toBe(3);
    // Drain — release every slot. Each release lets one worker grab
    // the next userId, which itself parks; the loop continues until
    // the cursor is exhausted.
    while (release.length > 0 || inFlight > 0) {
      const r = release.shift();
      if (r) r();
      // Yield enough microtasks for the worker to grab the next id
      // and re-enter the runner.
      await Promise.resolve();
      await Promise.resolve();
    }
    const result = await sweep;
    expect(peak).toBe(3);
    expect(result.byStatus.ok).toBe(userIds.length);
  });

  it("uses Date.now by default when nowMs is not provided", async () => {
    const before = Date.now();
    const result = await runWhoopFetchSweep({
      userIds: ["u1"],
      runOnce: async () => ({ status: "ok" }),
    });
    const after = Date.now();
    expect(result.startedAt).toBeGreaterThanOrEqual(before);
    expect(result.finishedAt).toBeLessThanOrEqual(after);
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });
});

describe("startWhoopFetchSweepLoop", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("schedules sweeps every intervalMs; the FIRST tick fires after intervalMs (not at t=0)", async () => {
    let calls = 0;
    const stop = startWhoopFetchSweepLoop({
      intervalMs: 1000,
      runSweep: async () => {
        calls += 1;
        return {
          total: 0,
          byStatus: {
            ok: 0,
            skipped_no_token: 0,
            skipped_no_state: 0,
            error: 0,
          },
          startedAt: 0,
          finishedAt: 0,
          durationMs: 0,
        };
      },
    });
    // No call yet — first tick is scheduled at +intervalMs.
    expect(calls).toBe(0);
    await vi.advanceTimersByTimeAsync(999);
    expect(calls).toBe(0);
    await vi.advanceTimersByTimeAsync(1);
    expect(calls).toBe(1);
    await vi.advanceTimersByTimeAsync(1000);
    expect(calls).toBe(2);
    await vi.advanceTimersByTimeAsync(3000);
    expect(calls).toBe(5);
    stop();
  });

  it("stop() prevents further ticks", async () => {
    let calls = 0;
    const stop = startWhoopFetchSweepLoop({
      intervalMs: 1000,
      runSweep: async () => {
        calls += 1;
        return {
          total: 0,
          byStatus: {
            ok: 0,
            skipped_no_token: 0,
            skipped_no_state: 0,
            error: 0,
          },
          startedAt: 0,
          finishedAt: 0,
          durationMs: 0,
        };
      },
    });
    await vi.advanceTimersByTimeAsync(1000);
    expect(calls).toBe(1);
    stop();
    await vi.advanceTimersByTimeAsync(10_000);
    expect(calls).toBe(1);
  });

  it("never overlaps: a slow sweep delays the next tick rather than stacking it", async () => {
    let calls = 0;
    let release!: () => void;
    const gate = new Promise<void>((r) => {
      release = r;
    });
    const stop = startWhoopFetchSweepLoop({
      intervalMs: 1000,
      runSweep: async () => {
        calls += 1;
        // First call parks indefinitely until the test releases it.
        if (calls === 1) await gate;
        return {
          total: 0,
          byStatus: {
            ok: 0,
            skipped_no_token: 0,
            skipped_no_state: 0,
            error: 0,
          },
          startedAt: 0,
          finishedAt: 0,
          durationMs: 0,
        };
      },
    });
    // First tick fires; it parks.
    await vi.advanceTimersByTimeAsync(1000);
    expect(calls).toBe(1);
    // Advance well past the interval — no second tick because the
    // first is still in-flight (setTimeout chain hasn't re-armed).
    await vi.advanceTimersByTimeAsync(10_000);
    expect(calls).toBe(1);
    // Release the parked sweep. Next interval should fire.
    release();
    // Microtask drain + advance.
    await Promise.resolve();
    await Promise.resolve();
    await vi.advanceTimersByTimeAsync(1000);
    expect(calls).toBe(2);
    stop();
  });

  it("throws synchronously for intervalMs <= 0", () => {
    expect(() =>
      startWhoopFetchSweepLoop({
        intervalMs: 0,
        runSweep: async () => {
          throw new Error("unreachable");
        },
      }),
    ).toThrow(/intervalMs must be > 0/);
    expect(() =>
      startWhoopFetchSweepLoop({
        intervalMs: -1,
        runSweep: async () => {
          throw new Error("unreachable");
        },
      }),
    ).toThrow(/intervalMs must be > 0/);
  });

  it("keeps the loop alive when runSweep throws (logs + reschedules)", async () => {
    let calls = 0;
    const warns: unknown[] = [];
    const errors: unknown[] = [];
    const stop = startWhoopFetchSweepLoop({
      intervalMs: 1000,
      runSweep: async () => {
        calls += 1;
        if (calls === 1) throw new Error("sweep crashed");
        return {
          total: 0,
          byStatus: {
            ok: 0,
            skipped_no_token: 0,
            skipped_no_state: 0,
            error: 0,
          },
          startedAt: 0,
          finishedAt: 0,
          durationMs: 0,
        };
      },
      log: {
        info: () => {},
        warn: (...a) => warns.push(a),
        error: (...a) => errors.push(a),
      },
    });
    await vi.advanceTimersByTimeAsync(1000);
    expect(calls).toBe(1);
    expect(errors.length).toBe(1);
    await vi.advanceTimersByTimeAsync(1000);
    expect(calls).toBe(2);
    stop();
  });
});
