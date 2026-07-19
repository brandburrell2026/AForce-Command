/**
 * Tests for the pure Strava snapshot fetcher + biometrics blob
 * helpers. Faithful mirror of `ouraSnapshot.test.ts`, adapted for a
 * single-endpoint, bare-array wire shape (Strava's
 * `/athlete/activities` has no `{data: [...]}` envelope, unlike Oura's
 * v2 usercollection endpoints).
 *
 * Covers:
 *   - Empty / blank / null token -> empty snapshot, no fetch
 *   - Happy path: real Strava v3 wire shape (bare array) parses into
 *     the normalized snapshot — sums moving_time and suffer_score
 *     across every activity in the window
 *   - Non-2xx -> empty snapshot (logged), never throws
 *   - Network throw -> caught (no unhandled rejection), empty snapshot
 *   - Non-array payload -> empty snapshot (logged), never throws
 *   - Non-finite numbers from Strava (NaN, strings, undefined) coerce
 *     to 0 in the sum — refuses to leak junk into the persisted blob
 *   - Empty activities array -> null fields (not 0) — "no data" stays
 *     distinguishable from "measured zero"
 *   - The `after` window is anchored on nowMs (rolling 24h, documented
 *     approximation of "today" — see module doc comment)
 *   - stravaSnapshotToProviderBlob stamps providerId + fetchedAt
 *   - mergeStravaIntoBiometrics preserves other providers
 *   - NEVER populates restingHeartRate/hrvSdnn/sleepHoursLastNight/etc
 *     — Strava is activity-only, provider-priority rule
 */
import { describe, it, expect, vi } from "vitest";
import {
  EMPTY_STRAVA_SNAPSHOT,
  fetchStravaSnapshot,
  mergeStravaIntoBiometrics,
  stravaSnapshotToProviderBlob,
  STRAVA_API_BASE,
  type StravaSnapshot,
} from "../stravaSnapshot";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

const ACTIVITIES_URL = `${STRAVA_API_BASE}/athlete/activities`;
const FIXED_NOW = 1_700_000_000_000; // 2023-11-14T22:13:20.000Z

describe("fetchStravaSnapshot", () => {
  it("returns the empty snapshot and makes NO network call for a blank/null token", async () => {
    const calls: string[] = [];
    const fn: typeof fetch = (async (url) => {
      calls.push(String(url));
      return jsonResponse([]);
    }) as unknown as typeof fetch;
    expect(
      await fetchStravaSnapshot({ accessToken: null, fetchImpl: fn }),
    ).toEqual(EMPTY_STRAVA_SNAPSHOT);
    expect(
      await fetchStravaSnapshot({ accessToken: "   ", fetchImpl: fn }),
    ).toEqual(EMPTY_STRAVA_SNAPSHOT);
    expect(calls).toHaveLength(0);
  });

  it("parses a real Strava v3 wire shape (bare array, no envelope) and sums across activities", async () => {
    const fn: typeof fetch = (async (url) => {
      expect(String(url)).toContain(ACTIVITIES_URL);
      return jsonResponse([
        { moving_time: 1800, suffer_score: 40 },
        { moving_time: 900, suffer_score: 15 },
      ]);
    }) as unknown as typeof fetch;
    const snap = await fetchStravaSnapshot({
      accessToken: "AT",
      fetchImpl: fn,
      nowMs: () => FIXED_NOW,
    });
    expect(snap).toEqual<StravaSnapshot>({
      workoutMinutesToday: 45, // (1800+900)s / 60
      trainingLoad: 55, // 40 + 15
    });
  });

  it("sends Authorization: Bearer <token>", async () => {
    let authHeader = "";
    const fn: typeof fetch = (async (_url, init) => {
      authHeader =
        ((init as { headers?: Record<string, string> })?.headers?.[
          "Authorization"
        ] as string) ?? "";
      return jsonResponse([]);
    }) as unknown as typeof fetch;
    await fetchStravaSnapshot({ accessToken: "TKN", fetchImpl: fn });
    expect(authHeader).toBe("Bearer TKN");
  });

  it("non-2xx -> empty snapshot, logged, never throws", async () => {
    const warn = vi.fn();
    const fn: typeof fetch = (async () =>
      new Response("err", { status: 500 })) as unknown as typeof fetch;
    const snap = await fetchStravaSnapshot({
      accessToken: "AT",
      fetchImpl: fn,
      log: { warn },
    });
    expect(snap).toEqual(EMPTY_STRAVA_SNAPSHOT);
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it("network throw is caught — no unhandled rejection", async () => {
    const warn = vi.fn();
    const fn: typeof fetch = (async () => {
      throw new Error("ECONNRESET");
    }) as unknown as typeof fetch;
    const snap = await fetchStravaSnapshot({
      accessToken: "AT",
      fetchImpl: fn,
      log: { warn },
    });
    expect(snap).toEqual(EMPTY_STRAVA_SNAPSHOT);
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it("non-array payload -> empty snapshot, logged, never throws", async () => {
    const warn = vi.fn();
    const fn: typeof fetch = (async () =>
      jsonResponse({ message: "not an array" })) as unknown as typeof fetch;
    const snap = await fetchStravaSnapshot({
      accessToken: "AT",
      fetchImpl: fn,
      log: { warn },
    });
    expect(snap).toEqual(EMPTY_STRAVA_SNAPSHOT);
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it("empty activities array -> null fields, not 0 (no data stays distinguishable from measured zero)", async () => {
    const fn: typeof fetch = (async () => jsonResponse([])) as unknown as typeof fetch;
    const snap = await fetchStravaSnapshot({ accessToken: "AT", fetchImpl: fn });
    expect(snap.workoutMinutesToday).toBeNull();
    expect(snap.trainingLoad).toBeNull();
  });

  it("coerces non-finite / wrong-typed / missing suffer_score values to 0 in the sum — refuses to leak junk", async () => {
    const fn: typeof fetch = (async () =>
      jsonResponse([
        { moving_time: "not-a-number", suffer_score: Number.NaN },
        { moving_time: 600, suffer_score: undefined },
        { moving_time: null, suffer_score: "20" },
      ])) as unknown as typeof fetch;
    const snap = await fetchStravaSnapshot({ accessToken: "AT", fetchImpl: fn });
    // Only the second activity's moving_time (600s = 10 min) is a valid
    // finite number; every suffer_score in this batch is invalid/absent.
    expect(snap.workoutMinutesToday).toBe(10);
    expect(snap.trainingLoad).toBe(0);
  });

  it("uses an `after` window anchored on nowMs (rolling 24h) in the request URL", async () => {
    let seenUrl = "";
    const fetchImpl: typeof fetch = (async (url) => {
      seenUrl = String(url);
      return jsonResponse([]);
    }) as unknown as typeof fetch;
    await fetchStravaSnapshot({
      accessToken: "tok",
      fetchImpl,
      nowMs: () => FIXED_NOW,
    });
    const expectedAfter = Math.floor((FIXED_NOW - 24 * 60 * 60 * 1000) / 1000);
    expect(seenUrl).toContain(`after=${expectedAfter}`);
  });
});

describe("stravaSnapshotToProviderBlob", () => {
  it("stamps providerId='strava' and the given fetchedAt", () => {
    const blob = stravaSnapshotToProviderBlob(
      { workoutMinutesToday: 45, trainingLoad: 55 },
      123_456,
    );
    expect(blob).toEqual({
      providerId: "strava",
      workoutMinutesToday: 45,
      trainingLoad: 55,
      fetchedAt: 123_456,
    });
  });

  it("preserves null fields without fabricating values", () => {
    const blob = stravaSnapshotToProviderBlob(EMPTY_STRAVA_SNAPSHOT, FIXED_NOW);
    expect(blob.workoutMinutesToday).toBeNull();
    expect(blob.trainingLoad).toBeNull();
    expect(blob.fetchedAt).toBe(FIXED_NOW);
  });

  it("never carries recovery/sleep/readiness fields — activity-only contributor", () => {
    const blob = stravaSnapshotToProviderBlob(
      { workoutMinutesToday: 10, trainingLoad: 5 },
      1,
    );
    expect(blob).not.toHaveProperty("restingHeartRate");
    expect(blob).not.toHaveProperty("hrvSdnn");
    expect(blob).not.toHaveProperty("sleepHoursLastNight");
    expect(blob).not.toHaveProperty("readinessScore");
    expect(blob).not.toHaveProperty("recoveryPct");
    expect(blob).not.toHaveProperty("stressScore");
  });
});

describe("mergeStravaIntoBiometrics", () => {
  const strava = stravaSnapshotToProviderBlob(
    { workoutMinutesToday: 30, trainingLoad: 20 },
    FIXED_NOW,
  );

  it("returns a strava-only blob when existing is null/undefined", () => {
    expect(mergeStravaIntoBiometrics(null, strava)).toEqual({ strava });
    expect(mergeStravaIntoBiometrics(undefined, strava)).toEqual({ strava });
  });

  it("preserves every other provider entry untouched", () => {
    const existing = {
      whoop: { providerId: "whoop", recoveryPct: 80 },
      oura: { providerId: "oura", readinessScore: 70 },
    };
    const merged = mergeStravaIntoBiometrics(existing, strava);
    expect(merged["whoop"]).toEqual(existing.whoop);
    expect(merged["oura"]).toEqual(existing.oura);
    expect(merged["strava"]).toEqual(strava);
  });

  it("overwrites only the strava key on a repeat merge", () => {
    const first = mergeStravaIntoBiometrics(
      { whoop: { providerId: "whoop" } },
      strava,
    );
    const newer = stravaSnapshotToProviderBlob(
      { workoutMinutesToday: 60, trainingLoad: 40 },
      FIXED_NOW + 1000,
    );
    const second = mergeStravaIntoBiometrics(first, newer);
    expect(second["strava"]).toEqual(newer);
    expect(second["whoop"]).toEqual({ providerId: "whoop" });
  });

  it("does not mutate the input object (returns a fresh blob)", () => {
    const existing = { whoop: { providerId: "whoop" } };
    const merged = mergeStravaIntoBiometrics(existing, strava);
    expect(merged).not.toBe(existing);
    expect(existing).toEqual({ whoop: { providerId: "whoop" } });
  });
});
