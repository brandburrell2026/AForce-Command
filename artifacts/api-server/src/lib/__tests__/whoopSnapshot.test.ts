/**
 * Tests for the pure WHOOP snapshot fetcher + biometrics blob
 * helpers.
 *
 * Covers:
 *   - Empty / blank / undefined token -> empty snapshot, no fetch
 *   - Happy path: real WHOOP wire shapes parse into the normalized
 *     snapshot, with the sleep math (in-bed minus awake -> hours)
 *   - A non-positive in-bed-minus-awake net (glitched or zeroed
 *     stage_summary) reports null, never a fabricated measured 0h
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

  it("maps a v2 FLATTENED record — metrics on the record itself, no `score` wrapper", async () => {
    // Defensive: if v2 drops the `score` object and puts the fields on the
    // record, `score ?? record` must still resolve them (score_state SCORED).
    const { fn } = makeFetch({
      [RECOVERY_URL]: () =>
        jsonResponse({ records: [{ score_state: "SCORED", recovery_score: 28, hrv_rmssd_milli: 31.8, resting_heart_rate: 64 }] }),
      [CYCLE_URL]: () =>
        jsonResponse({ records: [{ score_state: "SCORED", strain: 5.4 }] }),
      [SLEEP_URL]: () =>
        jsonResponse({
          records: [{ score_state: "SCORED", stage_summary: { total_in_bed_time_milli: (5 * 3600 + 10 * 60) * 1000, total_awake_time_milli: 0 } }],
        }),
    });
    const snap = await fetchWhoopSnapshot({ accessToken: "AT", fetchImpl: fn });
    expect(snap.recoveryPct).toBe(28);
    expect(snap.strain).toBe(5.4);
    expect(snap.hrvSdnn).toBe(31.8);
    expect(snap.restingHeartRate).toBe(64);
    expect(snap.sleepHoursLastNight).toBeCloseTo(5 + 10 / 60, 2);
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

  it("reports sleep as null (UNKNOWN) when WHOOP reports awake > in-bed (defensive)", async () => {
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
    // Expectation corrected from 0 — the MEANING changed. awake > inBed is
    // corrupt WHOOP data, not a night of zero sleep, and the old clamp
    // published it as a confident measured 0h (a maximal sleep deficit
    // downstream). A non-measurement now reads as unknown.
    expect(snap.sleepHoursLastNight).toBeNull();
  });

  it("reports sleep as null when stage_summary is zeroed/placeholder (in-bed 0)", async () => {
    const { fn } = makeFetch({
      [RECOVERY_URL]: () => jsonResponse({ records: [] }),
      [CYCLE_URL]: () => jsonResponse({ records: [] }),
      [SLEEP_URL]: () =>
        jsonResponse({
          records: [
            {
              score_state: "SCORED",
              score: {
                stage_summary: {
                  total_in_bed_time_milli: 0,
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
    expect(snap.sleepHoursLastNight).toBeNull();
  });
});

describe("latestObservedAtMs derivation (Founder Ruling I, RC-2)", () => {
  it("derives the MAX observation timestamp across recovery/cycle/sleep (here via the created_at fallback)", async () => {
    const { fn } = makeFetch({
      [RECOVERY_URL]: () =>
        jsonResponse({
          records: [
            {
              score_state: "SCORED",
              created_at: "2026-08-01T06:00:00.000Z",
              score: { recovery_score: 70, hrv_rmssd_milli: 50, resting_heart_rate: 55 },
            },
          ],
        }),
      [CYCLE_URL]: () =>
        jsonResponse({
          records: [
            {
              score_state: "SCORED",
              created_at: "2026-08-02T09:00:00.000Z", // latest of the three
              score: { strain: 12 },
            },
          ],
        }),
      [SLEEP_URL]: () =>
        jsonResponse({
          records: [
            {
              score_state: "SCORED",
              created_at: "2026-08-01T22:00:00.000Z",
              score: {
                stage_summary: { total_in_bed_time_milli: 8 * 3600 * 1000, total_awake_time_milli: 0 },
              },
            },
          ],
        }),
    });
    const snap = await fetchWhoopSnapshot({ accessToken: "AT", fetchImpl: fn });
    expect(snap.latestObservedAtMs).toBe(Date.parse("2026-08-02T09:00:00.000Z"));
  });

  it("is absent when no selected record carries a created_at (the golden-fixture shape)", async () => {
    const { fn } = makeFetch({
      [RECOVERY_URL]: () =>
        jsonResponse({ records: [{ score_state: "SCORED", score: { recovery_score: 70 } }] }),
      [CYCLE_URL]: () =>
        jsonResponse({ records: [{ score_state: "SCORED", score: { strain: 12 } }] }),
      [SLEEP_URL]: () => jsonResponse({ records: [] }),
    });
    const snap = await fetchWhoopSnapshot({ accessToken: "AT", fetchImpl: fn });
    expect(snap.latestObservedAtMs).toBeUndefined();
    expect("latestObservedAtMs" in snap).toBe(false);
  });

  it("prefers phenomenon time over created_at — a delayed strap sync must NOT read fresh (#562 B1, §53)", async () => {
    // Sleep ended two days before WHOOP created the record (delayed sync).
    // Deriving from created_at would present 2-day-old sleep as observed-now
    // — the stale-reads-fresh inversion ruling I forbids.
    const sleepEnd = "2026-08-03T06:30:00.000Z";
    const { fn } = makeFetch({
      [RECOVERY_URL]: () => jsonResponse({ records: [] }),
      [CYCLE_URL]: () => jsonResponse({ records: [] }),
      [SLEEP_URL]: () =>
        jsonResponse({
          records: [
            {
              score_state: "SCORED",
              created_at: "2026-08-05T15:00:00.000Z",
              start: "2026-08-02T22:00:00.000Z",
              end: sleepEnd,
              score: {
                stage_summary: { total_in_bed_time_milli: 8 * 3600 * 1000, total_awake_time_milli: 0 },
              },
            },
          ],
        }),
    });
    const snap = await fetchWhoopSnapshot({ accessToken: "AT", fetchImpl: fn });
    expect(snap.latestObservedAtMs).toBe(Date.parse(sleepEnd));
  });

  it("falls back to created_at only when the record carries neither end nor start", async () => {
    const created = "2026-08-01T12:00:00.000Z";
    const { fn } = makeFetch({
      [RECOVERY_URL]: () =>
        jsonResponse({
          records: [
            {
              score_state: "SCORED",
              created_at: created,
              score: { recovery_score: 55, hrv_rmssd_milli: 40, resting_heart_rate: 52 },
            },
          ],
        }),
      [CYCLE_URL]: () => jsonResponse({ records: [] }),
      [SLEEP_URL]: () => jsonResponse({ records: [] }),
    });
    const snap = await fetchWhoopSnapshot({ accessToken: "AT", fetchImpl: fn });
    expect(snap.latestObservedAtMs).toBe(Date.parse(created));
  });

  it("only counts a collection's created_at when it actually contributed a metric — a failed/empty endpoint's timestamp (if any) never counts", async () => {
    const { fn } = makeFetch({
      // Recovery fails outright -> contributes nothing, even though this
      // branch can never actually carry a created_at (there's no body).
      [RECOVERY_URL]: () => new Response("err", { status: 500 }),
      [CYCLE_URL]: () =>
        jsonResponse({
          records: [
            { score_state: "SCORED", created_at: "2026-08-01T00:00:00.000Z", score: { strain: 9 } },
          ],
        }),
      [SLEEP_URL]: () => jsonResponse({ records: [] }),
    });
    const snap = await fetchWhoopSnapshot({ accessToken: "AT", fetchImpl: fn });
    expect(snap.recoveryPct).toBeNull();
    expect(snap.latestObservedAtMs).toBe(Date.parse("2026-08-01T00:00:00.000Z"));
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

  it("passes through latestObservedAtMs when the snapshot carries it (Founder Ruling I, RC-2)", () => {
    const blob = whoopSnapshotToProviderBlob(
      {
        recoveryPct: 80,
        strain: 10,
        hrvSdnn: 45,
        restingHeartRate: 60,
        sleepHoursLastNight: 7,
        latestObservedAtMs: 999,
      },
      123_456,
    );
    expect(blob.latestObservedAtMs).toBe(999);
  });

  it("omits latestObservedAtMs entirely (not undefined-valued) when the snapshot lacks it", () => {
    const blob = whoopSnapshotToProviderBlob(
      { recoveryPct: 80, strain: 10, hrvSdnn: 45, restingHeartRate: 60, sleepHoursLastNight: 7 },
      123_456,
    );
    expect("latestObservedAtMs" in blob).toBe(false);
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
