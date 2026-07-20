/**
 * Tests for the pure WHOOP snapshot fetcher + biometrics blob
 * helpers.
 *
 * Covers:
 *   - Empty / blank / undefined token -> empty snapshot, no fetch
 *   - Happy path: real WHOOP wire shapes parse into the normalized
 *     snapshot, with the sleep math (in-bed minus awake -> hours)
 *   - Per-endpoint 4xx / 5xx leaves that endpoint's fields null
 *     without affecting the others (the worker treats partial as
 *     valid)
 *   - Per-endpoint network throw is caught (no unhandled rejection)
 *   - Non-finite numbers from WHOOP (NaN, strings, undefined) coerce
 *     to null — refuses to leak junk into the persisted blob
 *   - whoopSnapshotToProviderBlob stamps providerId + fetchedAt
 *   - mergeWhoopIntoBiometrics preserves other providers
 */
import { describe, it, expect, vi } from "vitest";
import {
  fetchWhoopSnapshot,
  whoopSnapshotToProviderBlob,
  mergeWhoopIntoBiometrics,
  WHOOP_API_BASE,
  EMPTY_WHOOP_SNAPSHOT,
} from "../whoopSnapshot";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function makeFetch(
  routes: Record<string, () => Promise<Response> | Response>,
): { fn: typeof fetch; calls: string[] } {
  const calls: string[] = [];
  const fn: typeof fetch = (async (url) => {
    const u = String(url);
    calls.push(u);
    for (const [prefix, handler] of Object.entries(routes)) {
      if (u.startsWith(prefix)) return handler();
    }
    return new Response("not-mocked", { status: 404 });
  }) as unknown as typeof fetch;
  return { fn, calls };
}

const RECOVERY_URL = `${WHOOP_API_BASE}/recovery`;
const CYCLE_URL = `${WHOOP_API_BASE}/cycle`;
const SLEEP_URL = `${WHOOP_API_BASE}/activity/sleep`;

describe("fetchWhoopSnapshot", () => {
  it("returns the empty snapshot when token is null / blank — no fetch", async () => {
    const { fn, calls } = makeFetch({});
    expect(
      await fetchWhoopSnapshot({ accessToken: null, fetchImpl: fn }),
    ).toEqual(EMPTY_WHOOP_SNAPSHOT);
    expect(
      await fetchWhoopSnapshot({ accessToken: "   ", fetchImpl: fn }),
    ).toEqual(EMPTY_WHOOP_SNAPSHOT);
    expect(calls).toHaveLength(0);
  });

  it("parses the real WHOOP wire shapes into the normalized snapshot", async () => {
    const { fn } = makeFetch({
      [RECOVERY_URL]: () =>
        jsonResponse({
          records: [
            {
              score: {
                recovery_score: 72,
                hrv_rmssd_milli: 48.3,
                resting_heart_rate: 58,
              },
            },
          ],
        }),
      [CYCLE_URL]: () =>
        jsonResponse({ records: [{ score: { strain: 14.2 } }] }),
      [SLEEP_URL]: () =>
        jsonResponse({
          records: [
            {
              score: {
                stage_summary: {
                  // 8h in bed, 30min awake -> 7.5h sleep
                  total_in_bed_time_milli: 8 * 3600 * 1000,
                  total_awake_time_milli: 30 * 60 * 1000,
                },
              },
            },
          ],
        }),
    });
    const snap = await fetchWhoopSnapshot({
      accessToken: "AT",
      fetchImpl: fn,
    });
    expect(snap).toEqual({
      recoveryPct: 72,
      strain: 14.2,
      hrvSdnn: 48.3,
      restingHeartRate: 58,
      sleepHoursLastNight: 7.5,
    });
  });

  it("skips unscored records and uses the freshest SCORED one (v2 score_state)", async () => {
    // v2 nulls `score` until a record is SCORED; the newest record (today's,
    // in progress) is PENDING_SCORE. We must fall through to the last night's
    // scored record, not return null.
    const unscored = { score_state: "PENDING_SCORE", score: null };
    const { fn } = makeFetch({
      [RECOVERY_URL]: () =>
        jsonResponse({
          records: [
            unscored,
            { score_state: "SCORED", score: { recovery_score: 28, hrv_rmssd_milli: 31.8, resting_heart_rate: 64 } },
          ],
        }),
      [CYCLE_URL]: () =>
        jsonResponse({ records: [unscored, { score_state: "SCORED", score: { strain: 5.4 } }] }),
      [SLEEP_URL]: () =>
        jsonResponse({
          records: [
            unscored,
            {
              score_state: "SCORED",
              score: { stage_summary: { total_in_bed_time_milli: (5 * 3600 + 10 * 60) * 1000, total_awake_time_milli: 0 } },
            },
          ],
        }),
    });
    const snap = await fetchWhoopSnapshot({ accessToken: "AT", fetchImpl: fn });
    expect(snap.recoveryPct).toBe(28);
    expect(snap.strain).toBe(5.4);
    expect(snap.hrvSdnn).toBe(31.8);
    expect(snap.restingHeartRate).toBe(64);
    expect(snap.sleepHoursLastNight).toBeCloseTo(5 + 10 / 60, 2); // 5h10m
  });

  it("sends Authorization: Bearer <token> on every endpoint call", async () => {
    const authHeaders: string[] = [];
    const captureFetch: typeof fetch = (async (url, init) => {
      authHeaders.push(
        ((init as { headers?: Record<string, string> })?.headers?.[
          "Authorization"
        ] as string) ?? "",
      );
      return jsonResponse({ records: [] });
    }) as unknown as typeof fetch;
    await fetchWhoopSnapshot({ accessToken: "TKN", fetchImpl: captureFetch });
    expect(authHeaders).toHaveLength(3);
    for (const h of authHeaders) expect(h).toBe("Bearer TKN");
  });

  it("per-endpoint non-2xx leaves that endpoint's fields null but doesn't poison the others", async () => {
    const warn = vi.fn();
    const { fn } = makeFetch({
      [RECOVERY_URL]: () => new Response("err", { status: 500 }),
      [CYCLE_URL]: () =>
        jsonResponse({ records: [{ score: { strain: 12.0 } }] }),
      [SLEEP_URL]: () =>
        jsonResponse({
          records: [
            {
              score: {
                stage_summary: {
                  total_in_bed_time_milli: 7 * 3600 * 1000,
                  total_awake_time_milli: 0,
                },
              },
            },
          ],
        }),
    });
    const snap = await fetchWhoopSnapshot({
      accessToken: "AT",
      fetchImpl: fn,
      log: { warn, info: vi.fn() },
    });
    expect(snap.recoveryPct).toBeNull();
    expect(snap.hrvSdnn).toBeNull();
    expect(snap.restingHeartRate).toBeNull();
    expect(snap.strain).toBe(12);
    expect(snap.sleepHoursLastNight).toBe(7);
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it("per-endpoint network throw is caught — no unhandled rejection", async () => {
    const warn = vi.fn();
    const { fn } = makeFetch({
      [RECOVERY_URL]: () =>
        Promise.reject(new Error("ECONNRESET")) as unknown as Response,
      [CYCLE_URL]: () => jsonResponse({ records: [] }),
      [SLEEP_URL]: () => jsonResponse({ records: [] }),
    });
    const snap = await fetchWhoopSnapshot({
      accessToken: "AT",
      fetchImpl: fn,
      log: { warn, info: vi.fn() },
    });
    expect(snap).toEqual(EMPTY_WHOOP_SNAPSHOT);
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it("coerces non-finite numbers from WHOOP to null — refuses to leak NaN/strings", async () => {
    const { fn } = makeFetch({
      [RECOVERY_URL]: () =>
        jsonResponse({
          records: [
            {
              score: {
                recovery_score: Number.NaN,
                hrv_rmssd_milli: "48.3" as unknown as number,
                resting_heart_rate: 58,
              },
            },
          ],
        }),
      [CYCLE_URL]: () => jsonResponse({ records: [] }),
      [SLEEP_URL]: () =>
        jsonResponse({
          records: [
            {
              score: {
                stage_summary: {
                  total_in_bed_time_milli: "not-a-number" as unknown as number,
                  total_awake_time_milli: 0,
                },
              },
            },
          ],
        }),
    });
    const snap = await fetchWhoopSnapshot({
      accessToken: "AT",
      fetchImpl: fn,
    });
    expect(snap.recoveryPct).toBeNull();
    expect(snap.hrvSdnn).toBeNull();
    expect(snap.restingHeartRate).toBe(58);
    expect(snap.sleepHoursLastNight).toBeNull();
  });

  it("clamps sleep to >=0 when WHOOP reports awake > in-bed (defensive)", async () => {
    const { fn } = makeFetch({
      [RECOVERY_URL]: () => jsonResponse({ records: [] }),
      [CYCLE_URL]: () => jsonResponse({ records: [] }),
      [SLEEP_URL]: () =>
        jsonResponse({
          records: [
            {
              score: {
                stage_summary: {
                  total_in_bed_time_milli: 100,
                  total_awake_time_milli: 1_000_000,
                },
              },
            },
          ],
        }),
    });
    const snap = await fetchWhoopSnapshot({
      accessToken: "AT",
      fetchImpl: fn,
    });
    expect(snap.sleepHoursLastNight).toBe(0);
  });
});

describe("whoopSnapshotToProviderBlob", () => {
  it("stamps providerId='whoop' and the given fetchedAt", () => {
    const blob = whoopSnapshotToProviderBlob(
      {
        recoveryPct: 80,
        strain: 10,
        hrvSdnn: 45,
        restingHeartRate: 60,
        sleepHoursLastNight: 7,
      },
      123_456,
    );
    expect(blob).toEqual({
      providerId: "whoop",
      restingHeartRate: 60,
      hrvSdnn: 45,
      sleepHoursLastNight: 7,
      strain: 10,
      recoveryPct: 80,
      fetchedAt: 123_456,
    });
  });
});

describe("mergeWhoopIntoBiometrics", () => {
  it("returns a single-key blob when there were no providers yet", () => {
    const blob = whoopSnapshotToProviderBlob(EMPTY_WHOOP_SNAPSHOT, 1);
    const next = mergeWhoopIntoBiometrics(null, blob);
    expect(Object.keys(next)).toEqual(["whoop"]);
    expect(next["whoop"]).toBe(blob);
  });

  it("preserves other providers and overwrites the whoop entry only", () => {
    const blob = whoopSnapshotToProviderBlob(EMPTY_WHOOP_SNAPSHOT, 2);
    const existing = {
      samsung_health: { providerId: "samsung_health", fetchedAt: 1 },
      whoop: { providerId: "whoop", fetchedAt: 0 },
      oura: { providerId: "oura", fetchedAt: 99 },
    };
    const next = mergeWhoopIntoBiometrics(existing, blob);
    expect(next["samsung_health"]).toBe(existing.samsung_health);
    expect(next["oura"]).toBe(existing.oura);
    expect(next["whoop"]).toBe(blob);
    // Original blob not mutated.
    expect(existing.whoop.fetchedAt).toBe(0);
  });
});
