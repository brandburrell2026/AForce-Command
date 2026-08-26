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
  runWhoopFetchSweepStreaming,
  startWhoopFetchSweepLoop,
} from "../whoopFetchSweep";

async function* pagesOf<T>(...pages: T[][]): AsyncGenerator<T[]> {
  for (const p of pages) yield p;
}

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
      skipped_locked: 0,
      skipped_fresh: 0,
      skipped_backoff: 0,
      skipped_needs_reauth: 0,
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
      skipped_locked: 0,
      skipped_fresh: 0,
      skipped_backoff: 0,
      skipped_needs_reauth: 0,
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

  it("acquireLock acquired:true => runs runOnce inside the lock and tallies the user's status", async () => {
    // Multi-replica path: lock wraps runOnce, the wrapped value's
    // status feeds the tally exactly like the single-replica path.
    const runOnceCalls: string[] = [];
    const lockedUsers: string[] = [];
    const result = await runWhoopFetchSweep({
      userIds: ["a", "b"],
      runOnce: async (id) => {
        runOnceCalls.push(id);
        return { status: "ok" as const };
      },
      acquireLock: async (userId, fn) => {
        lockedUsers.push(userId);
        const value = await fn();
        return { acquired: true as const, value };
      },
    });
    expect(runOnceCalls.sort()).toEqual(["a", "b"]);
    expect(lockedUsers.sort()).toEqual(["a", "b"]);
    expect(result.byStatus.ok).toBe(2);
    expect(result.byStatus.skipped_locked).toBe(0);
    expect(result.byStatus.error).toBe(0);
  });

  it("acquireLock acquired:false => tallies skipped_locked AND does NOT call runOnce (lock owns the user)", async () => {
    // Critical invariant: when the lock declines, we must NOT invoke
    // runOnce. Otherwise we defeat the cross-replica singleflight
    // and double-process the user.
    const runOnceCalls: string[] = [];
    const result = await runWhoopFetchSweep({
      userIds: ["a", "b", "c"],
      runOnce: async (id) => {
        runOnceCalls.push(id);
        return { status: "ok" as const };
      },
      acquireLock: async (userId, fn) => {
        if (userId === "b") return { acquired: false as const };
        return { acquired: true as const, value: await fn() };
      },
    });
    expect(runOnceCalls.sort()).toEqual(["a", "c"]);
    expect(result.byStatus.ok).toBe(2);
    expect(result.byStatus.skipped_locked).toBe(1);
    expect(result.byStatus.error).toBe(0);
    expect(result.total).toBe(3);
  });

  it("acquireLock throws => absorbed into byStatus.error, sweep continues", async () => {
    // A pool/DB error from the lock itself is ambiguous (we don't
    // know if the lock landed). Same path as a runOnce throw: tally
    // error, don't crash the sweep.
    const result = await runWhoopFetchSweep({
      userIds: ["good", "throws", "good2"],
      runOnce: async () => ({ status: "ok" as const }),
      acquireLock: async (userId, fn) => {
        if (userId === "throws") throw new Error("pool exhausted");
        return { acquired: true as const, value: await fn() };
      },
    });
    expect(result.byStatus.ok).toBe(2);
    expect(result.byStatus.error).toBe(1);
    expect(result.byStatus.skipped_locked).toBe(0);
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

describe("runWhoopFetchSweepStreaming", () => {
  it("returns a zero tally with one aggregate log when the iterator yields nothing", async () => {
    const info: unknown[][] = [];
    const result = await runWhoopFetchSweepStreaming({
      pages: pagesOf<string>(),
      runOnce: async () => ({ status: "ok" }),
      nowMs: () => 5_000,
      log: { info: (...a) => info.push(a), warn: () => {}, error: () => {} },
    });
    expect(result.total).toBe(0);
    expect(result.byStatus).toEqual({
      ok: 0,
      skipped_no_token: 0,
      skipped_no_state: 0,
      skipped_locked: 0,
      skipped_fresh: 0,
      skipped_backoff: 0,
      skipped_needs_reauth: 0,
      error: 0,
    });
    expect(result.startedAt).toBe(5_000);
    expect(result.finishedAt).toBe(5_000);
    // One aggregate done log; no per-page done logs (no pages were processed).
    expect(info).toHaveLength(1);
    expect(info[0]?.[1]).toBe("whoopFetchSweepStreaming:done");
    expect((info[0]?.[0] as { pageCount: number }).pageCount).toBe(0);
  });

  it("aggregates tally across multiple pages and never re-materializes the full list", async () => {
    // 3 pages of varied size + status mix. The tally must equal the
    // element-wise sum across pages.
    const plan: Record<string, WhoopFetchOutcomeStatus> = {
      a: "ok",
      b: "skipped_no_token",
      c: "ok",
      d: "error",
      e: "skipped_no_state",
      f: "ok",
      g: "ok",
    };
    const seen: string[] = [];
    const result = await runWhoopFetchSweepStreaming({
      pages: pagesOf(["a", "b"], ["c", "d", "e"], ["f", "g"]),
      runOnce: async (id) => {
        seen.push(id);
        return { status: plan[id]! };
      },
      nowMs: () => 0,
    });
    // Every userId from every page was processed exactly once, in
    // page order (sort to compare independent of intra-page worker
    // scheduling).
    expect(seen.slice().sort()).toEqual(["a", "b", "c", "d", "e", "f", "g"]);
    expect(result.total).toBe(7);
    expect(result.byStatus).toEqual({
      ok: 4,
      skipped_no_token: 1,
      skipped_no_state: 1,
      skipped_locked: 0,
      skipped_fresh: 0,
      skipped_backoff: 0,
      skipped_needs_reauth: 0,
      error: 1,
    });
  });

  it("skips empty pages without invoking the per-page sweep (contract leniency)", async () => {
    let runOnceCalls = 0;
    const result = await runWhoopFetchSweepStreaming({
      pages: pagesOf<string>([], ["solo"], []),
      runOnce: async () => {
        runOnceCalls += 1;
        return { status: "ok" };
      },
      nowMs: () => 0,
    });
    expect(runOnceCalls).toBe(1);
    expect(result.total).toBe(1);
    expect(result.byStatus.ok).toBe(1);
  });

  it("one page's throwing runner is absorbed and does NOT prevent subsequent pages from running", async () => {
    // A throw inside `runOnce` would already be absorbed by
    // `runWhoopFetchSweep`. Pin the cross-page guarantee: page 1's
    // error tally rolls forward into the aggregate, and page 2 still
    // executes.
    const seen: string[] = [];
    const result = await runWhoopFetchSweepStreaming({
      pages: pagesOf(["bad"], ["good"]),
      runOnce: async (id) => {
        seen.push(id);
        if (id === "bad") throw new Error("nope");
        return { status: "ok" };
      },
      nowMs: () => 0,
    });
    expect(seen).toEqual(["bad", "good"]);
    expect(result.byStatus.error).toBe(1);
    expect(result.byStatus.ok).toBe(1);
    expect(result.total).toBe(2);
  });

  it("startedAt is the first nowMs call, finishedAt is the last (across all pages)", async () => {
    // nowMs is called once at entry, then per-page (start + end), then
    // once at exit. We want startedAt = first call (entry), finishedAt
    // = last call (exit). The aggregate `durationMs` measures the full
    // streaming run, not any single page.
    let n = 0;
    const stamps = [100, 200, 300, 400, 500, 600, 700];
    const result = await runWhoopFetchSweepStreaming({
      pages: pagesOf(["a"], ["b"]),
      runOnce: async () => ({ status: "ok" }),
      nowMs: () => stamps[n++]!,
    });
    expect(result.startedAt).toBe(100);
    // finishedAt is whatever nowMs returned at the streaming exit.
    expect(result.finishedAt).toBeGreaterThan(result.startedAt);
    expect(result.durationMs).toBe(result.finishedAt - result.startedAt);
  });

  it("forwards acquireLock through to every page — declines tally skipped_locked across page boundaries", async () => {
    // Regression guard: streaming must propagate the lock seam into
    // the per-page sweep. If a refactor drops the `acquireLock:` arg
    // in the runWhoopFetchSweep call below, this test fails loudly
    // (no skipped_locked tally, all runOnce calls executed).
    const runOnceCalls: string[] = [];
    const result = await runWhoopFetchSweepStreaming({
      pages: pagesOf(["a", "b"], ["c", "d"]),
      runOnce: async (id) => {
        runOnceCalls.push(id);
        return { status: "ok" as const };
      },
      acquireLock: async (userId, fn) => {
        // Decline every other user — spread across both pages.
        if (userId === "b" || userId === "d") {
          return { acquired: false as const };
        }
        return { acquired: true as const, value: await fn() };
      },
      nowMs: () => 0,
    });
    expect(runOnceCalls.sort()).toEqual(["a", "c"]);
    expect(result.byStatus.ok).toBe(2);
    expect(result.byStatus.skipped_locked).toBe(2);
    expect(result.total).toBe(4);
  });

  it("lazily pulls pages: the next page is fetched only AFTER the previous one drains", async () => {
    // Critical for memory bounds: if the iterator were drained eagerly
    // into an array, we'd defeat the streaming wrapper. Prove laziness
    // by parking the runner mid-page-1 and asserting page 2 hasn't
    // been requested yet.
    const pageStarts: number[] = [];
    let release!: () => void;
    const gate = new Promise<void>((r) => {
      release = r;
    });
    async function* lazyPages(): AsyncGenerator<readonly string[]> {
      pageStarts.push(1);
      yield ["a"];
      pageStarts.push(2);
      yield ["b"];
    }
    const sweep = runWhoopFetchSweepStreaming({
      pages: lazyPages(),
      runOnce: async (id) => {
        if (id === "a") await gate;
        return { status: "ok" };
      },
      nowMs: () => 0,
    });
    // Yield enough microtasks for page 1 to be requested and the
    // worker to park inside runOnce("a").
    for (let i = 0; i < 10; i++) await Promise.resolve();
    expect(pageStarts).toEqual([1]);
    // Release page 1's runner. Streaming proceeds to request page 2.
    release();
    const result = await sweep;
    expect(pageStarts).toEqual([1, 2]);
    expect(result.total).toBe(2);
    expect(result.byStatus.ok).toBe(2);
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
            skipped_locked: 0,
      skipped_fresh: 0,
      skipped_backoff: 0,
      skipped_needs_reauth: 0,
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
            skipped_locked: 0,
      skipped_fresh: 0,
      skipped_backoff: 0,
      skipped_needs_reauth: 0,
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
            skipped_locked: 0,
      skipped_fresh: 0,
      skipped_backoff: 0,
      skipped_needs_reauth: 0,
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
            skipped_locked: 0,
      skipped_fresh: 0,
      skipped_backoff: 0,
      skipped_needs_reauth: 0,
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
