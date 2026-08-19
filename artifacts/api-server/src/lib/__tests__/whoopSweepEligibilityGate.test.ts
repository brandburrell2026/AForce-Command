/**
 * The sweep's eligibility gate — suppression happens BEFORE any fetch work.
 *
 * Uses the bootstrap's own test seams (iterFactory / eligibilityGate /
 * runOnce / dbNow), so what is under test is the real wiring in
 * `maybeStartWhoopFetchSweep`, not a re-implementation. A suppressed user
 * must cost zero runOnce calls — that is the whole point of the redesign:
 * fresh data and backing-off tokens produce NO provider traffic and NO
 * fetch-path DB work.
 *
 * Also pins the boundary rules of the control store and the foreground
 * trigger, and the blob-shape stability that guarantees member-facing WHOOP
 * values cannot change from this redesign.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { maybeStartWhoopFetchSweep } from "../whoopFetchSweepBootstrap";
import {
  initWhoopForegroundRefresh,
  resetWhoopForegroundRefreshForTests,
  triggerWhoopRefreshIfStale,
  FOREGROUND_CHECK_DEBOUNCE_MS,
} from "../whoopForegroundRefresh";
import { whoopSnapshotToProviderBlob, type WhoopSnapshot } from "../whoopSnapshot";
import type { WhoopEligibility } from "../whoopRefreshPolicy";

const log = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };

/** Run one sweep tick through the real bootstrap wiring. */
async function runOneSweep(opts: {
  users: string[];
  gate: (userId: string) => Promise<WhoopEligibility>;
  runOnce: ReturnType<typeof vi.fn>;
}) {
  vi.useFakeTimers();
  try {
    const handle = maybeStartWhoopFetchSweep({
      db: {} as never,
      refreshRegistry: {} as never,
      log,
      env: { WHOOP_FETCH_SWEEP_INTERVAL_MS: "1000" },
      iterFactory: () =>
        (async function* () {
          yield opts.users as readonly string[];
        })(),
      dbNow: async () => new Date(0),
      eligibilityGate: opts.gate,
      runOnce: opts.runOnce as never,
    });
    expect(handle).not.toBeNull();
    await vi.advanceTimersByTimeAsync(1000);
    handle!.stop();
  } finally {
    vi.useRealTimers();
  }
}

beforeEach(() => {
  vi.clearAllMocks();
  resetWhoopForegroundRefreshForTests();
});

describe("sweep eligibility gate (real bootstrap wiring)", () => {
  it("fresh data suppresses the provider fetch entirely", async () => {
    const runOnce = vi.fn(async (userId: string) => ({ userId, status: "ok" as const }));
    await runOneSweep({
      users: ["u1"],
      gate: async () => "skipped_fresh",
      runOnce,
    });
    expect(runOnce).not.toHaveBeenCalled();
  });

  it("stale data is eligible — runOnce runs", async () => {
    const runOnce = vi.fn(async (userId: string) => ({ userId, status: "ok" as const }));
    await runOneSweep({ users: ["u1"], gate: async () => "fetch", runOnce });
    expect(runOnce).toHaveBeenCalledTimes(1);
    expect(runOnce).toHaveBeenCalledWith("u1");
  });

  it("armed backoff suppresses the retry", async () => {
    const runOnce = vi.fn(async (userId: string) => ({ userId, status: "ok" as const }));
    await runOneSweep({ users: ["u1"], gate: async () => "skipped_backoff", runOnce });
    expect(runOnce).not.toHaveBeenCalled();
  });

  it("needs_reauth suppresses automatic retries", async () => {
    const runOnce = vi.fn(async (userId: string) => ({ userId, status: "ok" as const }));
    await runOneSweep({
      users: ["u1", "u2"],
      gate: async () => "skipped_needs_reauth",
      runOnce,
    });
    expect(runOnce).not.toHaveBeenCalled();
  });

  it("suppression is per-user — mixed cohorts fetch only the eligible", async () => {
    const runOnce = vi.fn(async (userId: string) => ({ userId, status: "ok" as const }));
    await runOneSweep({
      users: ["fresh-user", "stale-user", "reauth-user"],
      gate: async (u) =>
        u === "fresh-user"
          ? "skipped_fresh"
          : u === "reauth-user"
            ? "skipped_needs_reauth"
            : "fetch",
      runOnce,
    });
    expect(runOnce.mock.calls.map((c) => c[0])).toEqual(["stale-user"]);
  });

  it("a broken eligibility read fails OPEN to fetch — never silences the sweep", async () => {
    const runOnce = vi.fn(async (userId: string) => ({ userId, status: "ok" as const }));
    await runOneSweep({
      users: ["u1"],
      gate: async () => {
        throw new Error("control-store read failed");
      },
      runOnce,
    });
    expect(runOnce).toHaveBeenCalledTimes(1);
    expect(log.warn).toHaveBeenCalled();
  });
});

describe("foreground refresh (app active + stale → refresh; no client change)", () => {
  it("stale + eligible triggers exactly one fetch", async () => {
    const runOnce = vi.fn(async () => ({ status: "ok" }));
    initWhoopForegroundRefresh({
      db: {} as never,
      refreshRegistry: {} as never,
      log,
      readEligibility: async () => ({
        blobFetchedAtMs: 0,
        failureCount: null,
        backoffUntilMs: null,
        needsReauth: null,
      }),
      runOnce,
      nowMs: () => 10_000_000,
    });
    triggerWhoopRefreshIfStale("u1");
    await vi.waitFor(() => expect(runOnce).toHaveBeenCalledTimes(1));
  });

  it("fresh data → no fetch", async () => {
    const runOnce = vi.fn(async () => ({ status: "ok" }));
    const now = 10_000_000;
    initWhoopForegroundRefresh({
      db: {} as never,
      refreshRegistry: {} as never,
      log,
      readEligibility: async () => ({
        blobFetchedAtMs: now - 60_000, // 1 min old — fresh
        failureCount: null,
        backoffUntilMs: null,
        needsReauth: null,
      }),
      runOnce,
      nowMs: () => now,
    });
    triggerWhoopRefreshIfStale("u1");
    await new Promise((r) => setTimeout(r, 20));
    expect(runOnce).not.toHaveBeenCalled();
  });

  it("no WHOOP connection → no fetch, no error", async () => {
    const runOnce = vi.fn(async () => ({ status: "ok" }));
    initWhoopForegroundRefresh({
      db: {} as never,
      refreshRegistry: {} as never,
      log,
      readEligibility: async () => null,
      runOnce,
      nowMs: () => 10_000_000,
    });
    triggerWhoopRefreshIfStale("u1");
    await new Promise((r) => setTimeout(r, 20));
    expect(runOnce).not.toHaveBeenCalled();
    expect(log.warn).not.toHaveBeenCalled();
  });

  it("a burst of state reads collapses to one consideration per debounce window", async () => {
    const readEligibility = vi.fn(async () => null);
    let clock = 10_000_000;
    initWhoopForegroundRefresh({
      db: {} as never,
      refreshRegistry: {} as never,
      log,
      readEligibility,
      nowMs: () => clock,
    });
    triggerWhoopRefreshIfStale("u1");
    triggerWhoopRefreshIfStale("u1");
    triggerWhoopRefreshIfStale("u1");
    await new Promise((r) => setTimeout(r, 20));
    expect(readEligibility).toHaveBeenCalledTimes(1);
    // After the debounce window, a new consideration is allowed.
    clock += FOREGROUND_CHECK_DEBOUNCE_MS + 1;
    triggerWhoopRefreshIfStale("u1");
    await new Promise((r) => setTimeout(r, 20));
    expect(readEligibility).toHaveBeenCalledTimes(2);
  });

  it("uninitialized module is a safe no-op", () => {
    expect(() => triggerWhoopRefreshIfStale("u1")).not.toThrow();
  });
});

describe("boundary rules (source-scanned)", () => {
  const SRC = resolve(__dirname, "..");
  const read = (f: string) => readFileSync(resolve(SRC, f), "utf8");

  it("the control store never deletes rows and never writes token columns", () => {
    const s = read("whoopRefreshControlStore.ts");
    expect(/\.delete\(/.test(s), "control store must never delete").toBe(false);
    for (const col of ["accessToken", "refreshToken", "accessTokenEnc", "refreshTokenEnc", "expiresAt", "scope"]) {
      expect(
        new RegExp(`\\.set\\([^)]*${col}\\s*:`, "s").test(s),
        `control store must never write token column ${col}`,
      ).toBe(false);
    }
  });

  it("nothing in the redesign deletes token rows", () => {
    for (const f of [
      "whoopRefreshPolicy.ts",
      "whoopRefreshControlStore.ts",
      "whoopForegroundRefresh.ts",
      "whoopFetchSweepBootstrap.ts",
    ]) {
      expect(/aforceWhoopTokens[\s\S]{0,80}\.delete\(|\.delete\([\s\S]{0,80}aforceWhoopTokens/.test(read(f)), `${f} must not delete token rows`).toBe(false);
    }
  });

  it("the redesign imports nothing from scoring or normalization", () => {
    for (const f of [
      "whoopRefreshPolicy.ts",
      "whoopRefreshControlStore.ts",
      "whoopForegroundRefresh.ts",
    ]) {
      const s = read(f);
      expect(/scoringEngine|statusColor|breakdown|heatRiskEngine/.test(s), `${f} touches scoring`).toBe(false);
    }
  });
});

describe("member-facing WHOOP values are unchanged", () => {
  it("the snapshot→blob lift is byte-stable (pinned)", () => {
    // This is the exact function that produces what the member sees. The
    // redesign changes WHEN it runs, never WHAT it returns — pinned here so
    // any accidental value change fails loudly.
    const snapshot: WhoopSnapshot = {
      restingHeartRate: 52,
      hrvSdnn: 68,
      sleepHoursLastNight: 7.4,
      strain: 11.2,
      recoveryPct: 81,
      latestObservedAtMs: 1_755_600_000_000,
    } as WhoopSnapshot;
    expect(whoopSnapshotToProviderBlob(snapshot, 1_755_603_600_000)).toEqual({
      providerId: "whoop",
      restingHeartRate: 52,
      hrvSdnn: 68,
      sleepHoursLastNight: 7.4,
      strain: 11.2,
      recoveryPct: 81,
      fetchedAt: 1_755_603_600_000,
      latestObservedAtMs: 1_755_600_000_000,
    });
  });
});
