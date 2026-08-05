/**
 * Tests for the pure Oura snapshot fetcher + biometrics blob helpers.
 * Faithful mirror of `whoopSnapshot.test.ts` / `garminSnapshot.test.ts`.
 *
 * Covers:
 *   - Empty / blank / null token -> empty snapshot, no fetch
 *   - Happy path: real Oura v2 wire shapes (data envelope) parse into
 *     the normalized snapshot, including workout-minutes summation
 *   - Per-endpoint 4xx/5xx leaves that endpoint's fields null without
 *     affecting the others
 *   - Per-endpoint network throw is caught (no unhandled rejection)
 *   - Non-finite numbers from Oura (NaN, strings, undefined) coerce to
 *     null — refuses to leak junk into the persisted blob
 *   - "latest" picks the LAST element of the data array (Oura returns
 *     ascending date order)
 *   - The start_date/end_date window is anchored on nowMs
 *   - ouraSnapshotToProviderBlob stamps providerId + fetchedAt
 *   - mergeOuraIntoBiometrics preserves other providers
 */
import { describe, it, expect, vi } from "vitest";
import {
  EMPTY_OURA_SNAPSHOT,
  fetchOuraSnapshot,
  mergeOuraIntoBiometrics,
  ouraSnapshotToProviderBlob,
  OURA_API_BASE,
  type OuraSnapshot,
} from "../ouraSnapshot";

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

const READINESS_URL = `${OURA_API_BASE}/daily_readiness`;
const SLEEP_URL = `${OURA_API_BASE}/sleep`;
const ACTIVITY_URL = `${OURA_API_BASE}/daily_activity`;
const WORKOUT_URL = `${OURA_API_BASE}/workout`;

const FIXED_NOW = 1_700_000_000_000; // 2023-11-14T22:13:20.000Z

describe("fetchOuraSnapshot", () => {
  it("returns the empty snapshot and makes NO network call for a blank/null token", async () => {
    const { fn, calls } = makeFetch({});
    expect(
      await fetchOuraSnapshot({ accessToken: null, fetchImpl: fn }),
    ).toEqual(EMPTY_OURA_SNAPSHOT);
    expect(
      await fetchOuraSnapshot({ accessToken: "   ", fetchImpl: fn }),
    ).toEqual(EMPTY_OURA_SNAPSHOT);
    expect(calls).toHaveLength(0);
  });

  it("parses real Oura v2 wire shapes (data envelope) into the normalized snapshot", async () => {
    const { fn } = makeFetch({
      [READINESS_URL]: () =>
        jsonResponse({
          data: [{ day: "2023-11-13", score: 66 }, { day: "2023-11-14", score: 72 }],
          next_token: null,
        }),
      [SLEEP_URL]: () =>
        jsonResponse({
          data: [
            {
              day: "2023-11-14",
              total_sleep_duration: 7.5 * 3600,
              average_hrv: 48,
              lowest_heart_rate: 52,
            },
          ],
          next_token: null,
        }),
      [ACTIVITY_URL]: () =>
        jsonResponse({
          data: [{ day: "2023-11-14", steps: 8421 }],
          next_token: null,
        }),
      [WORKOUT_URL]: () =>
        jsonResponse({
          data: [
            {
              day: "2023-11-14",
              start_datetime: "2023-11-14T10:00:00.000+00:00",
              end_datetime: "2023-11-14T10:30:00.000+00:00",
            },
          ],
          next_token: null,
        }),
    });
    const snap = await fetchOuraSnapshot({
      accessToken: "AT",
      fetchImpl: fn,
      nowMs: () => FIXED_NOW,
    });
    // RC-2 / Founder Ruling I ADDITIVE FIELD: `latestObservedAtMs` joins this
    // expectation. Every OTHER field/value below is byte-unchanged from
    // before this change (see the PR body's parity-diff disclosure). The
    // fixtures above carry readiness/sleep/activity `day: "2023-11-14"`
    // (midnight UTC) and a workout `end_datetime` of
    // "2023-11-14T10:30:00.000+00:00" — later the same day, so it wins the
    // max.
    expect(snap).toEqual<OuraSnapshot>({
      readinessScore: 72,
      sleepHoursLastNight: 7.5,
      hrvSdnn: 48,
      restingHeartRate: 52,
      stepsToday: 8421,
      workoutMinutesToday: 30,
      latestObservedAtMs: Date.parse("2023-11-14T10:30:00.000+00:00"),
    });
  });

  it("takes the LAST element of the data array (Oura returns ascending date order)", async () => {
    const { fn } = makeFetch({
      [READINESS_URL]: () =>
        jsonResponse({
          data: [
            { day: "2023-11-13", score: 40 },
            { day: "2023-11-14", score: 90 },
          ],
        }),
      [SLEEP_URL]: () => jsonResponse({ data: [] }),
      [ACTIVITY_URL]: () => jsonResponse({ data: [] }),
      [WORKOUT_URL]: () => jsonResponse({ data: [] }),
    });
    const snap = await fetchOuraSnapshot({ accessToken: "AT", fetchImpl: fn });
    expect(snap.readinessScore).toBe(90);
  });

  it("sums workout minutes across multiple workouts in the window", async () => {
    const { fn } = makeFetch({
      [READINESS_URL]: () => jsonResponse({ data: [] }),
      [SLEEP_URL]: () => jsonResponse({ data: [] }),
      [ACTIVITY_URL]: () => jsonResponse({ data: [] }),
      [WORKOUT_URL]: () =>
        jsonResponse({
          data: [
            {
              start_datetime: "2023-11-14T06:00:00.000+00:00",
              end_datetime: "2023-11-14T06:20:00.000+00:00",
            },
            {
              start_datetime: "2023-11-14T18:00:00.000+00:00",
              end_datetime: "2023-11-14T18:45:00.000+00:00",
            },
          ],
        }),
    });
    const snap = await fetchOuraSnapshot({ accessToken: "AT", fetchImpl: fn });
    expect(snap.workoutMinutesToday).toBe(65);
  });

  it("sends Authorization: Bearer <token> on every endpoint call", async () => {
    const authHeaders: string[] = [];
    const captureFetch: typeof fetch = (async (url, init) => {
      authHeaders.push(
        ((init as { headers?: Record<string, string> })?.headers?.[
          "Authorization"
        ] as string) ?? "",
      );
      return jsonResponse({ data: [] });
    }) as unknown as typeof fetch;
    await fetchOuraSnapshot({ accessToken: "TKN", fetchImpl: captureFetch });
    expect(authHeaders).toHaveLength(4);
    for (const h of authHeaders) expect(h).toBe("Bearer TKN");
  });

  it("per-endpoint non-2xx leaves that endpoint's fields null but doesn't poison the others", async () => {
    const warn = vi.fn();
    const { fn } = makeFetch({
      [READINESS_URL]: () => new Response("err", { status: 500 }),
      [SLEEP_URL]: () =>
        jsonResponse({
          data: [{ total_sleep_duration: 8 * 3600, average_hrv: 50, lowest_heart_rate: 55 }],
        }),
      [ACTIVITY_URL]: () => jsonResponse({ data: [{ steps: 5000 }] }),
      [WORKOUT_URL]: () => jsonResponse({ data: [] }),
    });
    const snap = await fetchOuraSnapshot({
      accessToken: "AT",
      fetchImpl: fn,
      log: { warn },
    });
    expect(snap.readinessScore).toBeNull();
    expect(snap.sleepHoursLastNight).toBe(8);
    expect(snap.hrvSdnn).toBe(50);
    expect(snap.restingHeartRate).toBe(55);
    expect(snap.stepsToday).toBe(5000);
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it("per-endpoint network throw is caught — no unhandled rejection", async () => {
    const warn = vi.fn();
    const { fn } = makeFetch({
      [READINESS_URL]: () =>
        Promise.reject(new Error("ECONNRESET")) as unknown as Response,
      [SLEEP_URL]: () => jsonResponse({ data: [] }),
      [ACTIVITY_URL]: () => jsonResponse({ data: [] }),
      [WORKOUT_URL]: () => jsonResponse({ data: [] }),
    });
    const snap = await fetchOuraSnapshot({
      accessToken: "AT",
      fetchImpl: fn,
      log: { warn },
    });
    expect(snap).toEqual(EMPTY_OURA_SNAPSHOT);
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it("coerces non-finite / wrong-typed values to null — refuses to leak junk", async () => {
    const { fn } = makeFetch({
      [READINESS_URL]: () => jsonResponse({ data: [{ score: Number.NaN }] }),
      [SLEEP_URL]: () =>
        jsonResponse({
          data: [
            {
              total_sleep_duration: "not-a-number",
              average_hrv: "48",
              lowest_heart_rate: null,
            },
          ],
        }),
      [ACTIVITY_URL]: () => jsonResponse({ data: [{ steps: "8421" }] }),
      [WORKOUT_URL]: () => jsonResponse({ data: [] }),
    });
    const snap = await fetchOuraSnapshot({ accessToken: "AT", fetchImpl: fn });
    expect(snap.readinessScore).toBeNull();
    expect(snap.sleepHoursLastNight).toBeNull();
    expect(snap.hrvSdnn).toBeNull();
    expect(snap.restingHeartRate).toBeNull();
    expect(snap.stepsToday).toBeNull();
  });

  it("ignores workout entries with missing/invalid datetimes without poisoning the sum", async () => {
    const { fn } = makeFetch({
      [READINESS_URL]: () => jsonResponse({ data: [] }),
      [SLEEP_URL]: () => jsonResponse({ data: [] }),
      [ACTIVITY_URL]: () => jsonResponse({ data: [] }),
      [WORKOUT_URL]: () =>
        jsonResponse({
          data: [
            { start_datetime: "not-a-date", end_datetime: "also-not-a-date" },
            {
              start_datetime: "2023-11-14T06:00:00.000+00:00",
              end_datetime: "2023-11-14T06:10:00.000+00:00",
            },
          ],
        }),
    });
    const snap = await fetchOuraSnapshot({ accessToken: "AT", fetchImpl: fn });
    expect(snap.workoutMinutesToday).toBe(10);
  });

  it("uses a start_date/end_date window anchored on nowMs in the request URLs", async () => {
    const seen: string[] = [];
    const fetchImpl: typeof fetch = (async (url) => {
      seen.push(String(url));
      return jsonResponse({ data: [] });
    }) as unknown as typeof fetch;
    await fetchOuraSnapshot({
      accessToken: "tok",
      fetchImpl,
      nowMs: () => FIXED_NOW,
    });
    const endDate = new Date(FIXED_NOW).toISOString().slice(0, 10);
    const startDate = new Date(FIXED_NOW - 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);
    for (const url of seen) {
      expect(url).toContain(`start_date=${startDate}`);
      expect(url).toContain(`end_date=${endDate}`);
    }
  });
});

describe("latestObservedAtMs derivation (Founder Ruling I, RC-2)", () => {
  it("is absent when no contributing record carries a day/bedtime_end/datetime", async () => {
    const { fn } = makeFetch({
      [READINESS_URL]: () => jsonResponse({ data: [{ score: 70 }] }),
      [SLEEP_URL]: () => jsonResponse({ data: [] }),
      [ACTIVITY_URL]: () => jsonResponse({ data: [] }),
      [WORKOUT_URL]: () => jsonResponse({ data: [] }),
    });
    const snap = await fetchOuraSnapshot({ accessToken: "AT", fetchImpl: fn });
    expect(snap.latestObservedAtMs).toBeUndefined();
    expect("latestObservedAtMs" in snap).toBe(false);
  });

  it("prefers sleep's bedtime_end (full instant) over its day (date-only) when both are present", async () => {
    const { fn } = makeFetch({
      [READINESS_URL]: () => jsonResponse({ data: [] }),
      [SLEEP_URL]: () =>
        jsonResponse({
          data: [
            {
              day: "2026-08-01",
              bedtime_end: "2026-08-02T06:15:00.000Z",
              total_sleep_duration: 7 * 3600,
            },
          ],
        }),
      [ACTIVITY_URL]: () => jsonResponse({ data: [] }),
      [WORKOUT_URL]: () => jsonResponse({ data: [] }),
    });
    const snap = await fetchOuraSnapshot({ accessToken: "AT", fetchImpl: fn });
    expect(snap.latestObservedAtMs).toBe(Date.parse("2026-08-02T06:15:00.000Z"));
  });

  it("only counts a record's timestamp when it actually contributed a metric — a failed readiness endpoint's day (if any) never counts", async () => {
    const { fn } = makeFetch({
      [READINESS_URL]: () => new Response("err", { status: 500 }),
      [SLEEP_URL]: () =>
        jsonResponse({ data: [{ day: "2026-08-01", total_sleep_duration: 7 * 3600 }] }),
      [ACTIVITY_URL]: () => jsonResponse({ data: [] }),
      [WORKOUT_URL]: () => jsonResponse({ data: [] }),
    });
    const snap = await fetchOuraSnapshot({ accessToken: "AT", fetchImpl: fn });
    expect(snap.readinessScore).toBeNull();
    expect(snap.latestObservedAtMs).toBe(Date.parse("2026-08-01"));
  });
});

describe("ouraSnapshotToProviderBlob", () => {
  it("stamps providerId='oura' and the given fetchedAt", () => {
    const blob = ouraSnapshotToProviderBlob(
      {
        readinessScore: 80,
        sleepHoursLastNight: 7,
        hrvSdnn: 45,
        restingHeartRate: 55,
        stepsToday: 9000,
        workoutMinutesToday: 20,
      },
      123_456,
    );
    expect(blob).toEqual({
      providerId: "oura",
      readinessScore: 80,
      sleepHoursLastNight: 7,
      hrvSdnn: 45,
      restingHeartRate: 55,
      stepsToday: 9000,
      workoutMinutesToday: 20,
      fetchedAt: 123_456,
    });
  });

  it("passes through latestObservedAtMs when the snapshot carries it (Founder Ruling I, RC-2)", () => {
    const blob = ouraSnapshotToProviderBlob(
      {
        readinessScore: 80,
        sleepHoursLastNight: 7,
        hrvSdnn: 45,
        restingHeartRate: 55,
        stepsToday: 9000,
        workoutMinutesToday: 20,
        latestObservedAtMs: 555,
      },
      123_456,
    );
    expect(blob.latestObservedAtMs).toBe(555);
  });

  it("preserves null fields without fabricating values", () => {
    const blob = ouraSnapshotToProviderBlob(EMPTY_OURA_SNAPSHOT, FIXED_NOW);
    expect(blob.readinessScore).toBeNull();
    expect(blob.sleepHoursLastNight).toBeNull();
    expect(blob.hrvSdnn).toBeNull();
    expect(blob.restingHeartRate).toBeNull();
    expect(blob.stepsToday).toBeNull();
    expect(blob.workoutMinutesToday).toBeNull();
    expect(blob.fetchedAt).toBe(FIXED_NOW);
  });
});

describe("mergeOuraIntoBiometrics", () => {
  const oura = ouraSnapshotToProviderBlob(
    { ...EMPTY_OURA_SNAPSHOT, readinessScore: 75 },
    FIXED_NOW,
  );

  it("returns an oura-only blob when existing is null/undefined", () => {
    expect(mergeOuraIntoBiometrics(null, oura)).toEqual({ oura });
    expect(mergeOuraIntoBiometrics(undefined, oura)).toEqual({ oura });
  });

  it("preserves every other provider entry untouched", () => {
    const existing = {
      whoop: { providerId: "whoop", recoveryPct: 80 },
      garmin: { providerId: "garmin", steps: 1234 },
    };
    const merged = mergeOuraIntoBiometrics(existing, oura);
    expect(merged["whoop"]).toEqual(existing.whoop);
    expect(merged["garmin"]).toEqual(existing.garmin);
    expect(merged["oura"]).toEqual(oura);
  });

  it("overwrites only the oura key on a repeat merge", () => {
    const first = mergeOuraIntoBiometrics(
      { whoop: { providerId: "whoop" } },
      oura,
    );
    const newer = ouraSnapshotToProviderBlob(
      { ...EMPTY_OURA_SNAPSHOT, readinessScore: 60 },
      FIXED_NOW + 1000,
    );
    const second = mergeOuraIntoBiometrics(first, newer);
    expect(second["oura"]).toEqual(newer);
    expect(second["whoop"]).toEqual({ providerId: "whoop" });
  });

  it("does not mutate the input object (returns a fresh blob)", () => {
    const existing = { whoop: { providerId: "whoop" } };
    const merged = mergeOuraIntoBiometrics(existing, oura);
    expect(merged).not.toBe(existing);
    expect(existing).toEqual({ whoop: { providerId: "whoop" } });
  });
});
