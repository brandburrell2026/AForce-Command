/**
 * Unit tests for `maybeStartWhoopTokenBackfill`.
 *
 * The cron itself is mechanical — what's load-bearing is the env-gate
 * matrix (must require BOTH the interval AND the key) and the
 * per-tick error containment (a thrown backfill must not crash the
 * loop). All DB work is stubbed via the `backfillFn` test seam, so
 * these tests never touch Postgres.
 *
 * Mirrors the shape of `whoopAuthStatePurgeBootstrap.test.ts`.
 */
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { maybeStartWhoopTokenBackfill } from "../whoopTokenBackfillBootstrap";

const FAKE_DB = {} as unknown as NodePgDatabase<Record<string, unknown>>;

function makeLog() {
  return {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };
}

describe("maybeStartWhoopTokenBackfill — env gate", () => {
  it("returns null and stays quiet when the interval env var is unset", () => {
    const log = makeLog();
    const handle = maybeStartWhoopTokenBackfill({
      db: FAKE_DB,
      log,
      env: {},
    });
    expect(handle).toBeNull();
    expect(log.warn).not.toHaveBeenCalled();
    expect(log.info).not.toHaveBeenCalled();
  });

  it("returns null and stays quiet when the interval env var is empty", () => {
    const log = makeLog();
    const handle = maybeStartWhoopTokenBackfill({
      db: FAKE_DB,
      log,
      env: { WHOOP_TOKEN_BACKFILL_INTERVAL_MS: "" },
    });
    expect(handle).toBeNull();
    expect(log.warn).not.toHaveBeenCalled();
  });

  it.each([
    ["not-a-number", "abc"],
    ["NaN literal", "NaN"],
    ["zero", "0"],
    ["negative", "-1000"],
  ])("warns and returns null when interval is %s", (_label, raw) => {
    const log = makeLog();
    const handle = maybeStartWhoopTokenBackfill({
      db: FAKE_DB,
      log,
      env: {
        WHOOP_TOKEN_BACKFILL_INTERVAL_MS: raw,
        WHOOP_TOKEN_ENCRYPTION_KEY: "k",
      },
    });
    expect(handle).toBeNull();
    expect(log.warn).toHaveBeenCalledOnce();
    expect(log.warn.mock.calls[0]![1]).toMatch(/not a positive number/);
  });

  it("LOUD refusal when interval is set but encryption key is missing", () => {
    // The critical failure mode this guards: ops sets the interval
    // assuming backfill is now running, but forgot the key. Silent
    // no-op would hide the misconfiguration.
    const log = makeLog();
    const handle = maybeStartWhoopTokenBackfill({
      db: FAKE_DB,
      log,
      env: { WHOOP_TOKEN_BACKFILL_INTERVAL_MS: "60000" },
    });
    expect(handle).toBeNull();
    expect(log.warn).toHaveBeenCalledOnce();
    expect(log.warn.mock.calls[0]![1]).toMatch(
      /interval is set but encryption key is missing/,
    );
  });

  it("LOUD refusal when interval is set but key is whitespace-only", () => {
    const log = makeLog();
    const handle = maybeStartWhoopTokenBackfill({
      db: FAKE_DB,
      log,
      env: {
        WHOOP_TOKEN_BACKFILL_INTERVAL_MS: "60000",
        WHOOP_TOKEN_ENCRYPTION_KEY: "   ",
      },
    });
    expect(handle).toBeNull();
    expect(log.warn).toHaveBeenCalledOnce();
    expect(log.warn.mock.calls[0]![1]).toMatch(
      /interval is set but encryption key is missing/,
    );
  });

  it("starts the loop when both interval and key are valid", () => {
    const log = makeLog();
    const handle = maybeStartWhoopTokenBackfill({
      db: FAKE_DB,
      log,
      env: {
        WHOOP_TOKEN_BACKFILL_INTERVAL_MS: "60000",
        WHOOP_TOKEN_ENCRYPTION_KEY: "real-key",
      },
      backfillFn: vi.fn().mockResolvedValue(0),
    });
    expect(handle).not.toBeNull();
    expect(handle!.intervalMs).toBe(60000);
    expect(handle!.batchSize).toBe(200);
    expect(log.info).toHaveBeenCalledOnce();
    expect(log.info.mock.calls[0]![1]).toMatch(/bootstrap started/);
    handle!.stop();
  });
});

describe("maybeStartWhoopTokenBackfill — tick behavior", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("calls backfillFn with the configured key and batch size on each tick", async () => {
    const log = makeLog();
    const backfillFn = vi.fn().mockResolvedValue(0);
    const handle = maybeStartWhoopTokenBackfill({
      db: FAKE_DB,
      log,
      env: {
        WHOOP_TOKEN_BACKFILL_INTERVAL_MS: "100",
        WHOOP_TOKEN_ENCRYPTION_KEY: "real-key",
      },
      batchSize: 25,
      backfillFn,
    });
    expect(handle).not.toBeNull();
    await vi.advanceTimersByTimeAsync(100);
    expect(backfillFn).toHaveBeenCalledOnce();
    expect(backfillFn.mock.calls[0]).toEqual([FAKE_DB, "real-key", 25]);
    handle!.stop();
  });

  it("stays quiet on a zero-filled tick (steady state, no log spam)", async () => {
    const log = makeLog();
    const handle = maybeStartWhoopTokenBackfill({
      db: FAKE_DB,
      log,
      env: {
        WHOOP_TOKEN_BACKFILL_INTERVAL_MS: "100",
        WHOOP_TOKEN_ENCRYPTION_KEY: "real-key",
      },
      backfillFn: vi.fn().mockResolvedValue(0),
    });
    log.info.mockClear(); // ignore the bootstrap-started log
    await vi.advanceTimersByTimeAsync(100);
    expect(log.info).not.toHaveBeenCalled();
    expect(log.error).not.toHaveBeenCalled();
    handle!.stop();
  });

  it("logs filled count when > 0", async () => {
    const log = makeLog();
    const handle = maybeStartWhoopTokenBackfill({
      db: FAKE_DB,
      log,
      env: {
        WHOOP_TOKEN_BACKFILL_INTERVAL_MS: "100",
        WHOOP_TOKEN_ENCRYPTION_KEY: "real-key",
      },
      backfillFn: vi.fn().mockResolvedValue(7),
    });
    log.info.mockClear();
    await vi.advanceTimersByTimeAsync(100);
    expect(log.info).toHaveBeenCalledOnce();
    expect(log.info.mock.calls[0]![0]).toEqual({ filled: 7 });
    handle!.stop();
  });

  it("ERROR-RECOVERY — a thrown backfill is caught and the next tick still runs", async () => {
    // This is the load-bearing safety guarantee: one bad backfill
    // (e.g. transient pgcrypto error) must NOT take the loop down.
    const log = makeLog();
    const backfillFn = vi
      .fn()
      .mockRejectedValueOnce(new Error("transient pgcrypto failure"))
      .mockResolvedValueOnce(3);
    const handle = maybeStartWhoopTokenBackfill({
      db: FAKE_DB,
      log,
      env: {
        WHOOP_TOKEN_BACKFILL_INTERVAL_MS: "100",
        WHOOP_TOKEN_ENCRYPTION_KEY: "real-key",
      },
      backfillFn,
    });
    await vi.advanceTimersByTimeAsync(100);
    expect(log.error).toHaveBeenCalledOnce();
    await vi.advanceTimersByTimeAsync(100);
    expect(backfillFn).toHaveBeenCalledTimes(2);
    handle!.stop();
  });

  it("stop() halts the loop — no further ticks after stop", async () => {
    const log = makeLog();
    const backfillFn = vi.fn().mockResolvedValue(0);
    const handle = maybeStartWhoopTokenBackfill({
      db: FAKE_DB,
      log,
      env: {
        WHOOP_TOKEN_BACKFILL_INTERVAL_MS: "100",
        WHOOP_TOKEN_ENCRYPTION_KEY: "real-key",
      },
      backfillFn,
    });
    await vi.advanceTimersByTimeAsync(100);
    expect(backfillFn).toHaveBeenCalledTimes(1);
    handle!.stop();
    await vi.advanceTimersByTimeAsync(500);
    expect(backfillFn).toHaveBeenCalledTimes(1);
  });
});
