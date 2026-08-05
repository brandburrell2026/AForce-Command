/**
 * Pure normalization tests for the Garmin snapshot module. No network,
 * no Postgres — exercises the resilient fetcher (via an injected fake
 * fetch) and the pure blob/merge helpers.
 *
 * Score-Protection note: these helpers only shape measured provider
 * data; there is no score path here to assert against.
 */
import { describe, it, expect, vi } from "vitest";
import {
  EMPTY_GARMIN_SNAPSHOT,
  fetchGarminSnapshot,
  garminSnapshotToProviderBlob,
  mergeGarminIntoBiometrics,
  type GarminSnapshot,
} from "../lib/garminSnapshot";

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as unknown as Response;
}

const FIXED_NOW = 1_700_000_000_000;

describe("fetchGarminSnapshot", () => {
  it("returns the empty snapshot and makes NO network call for a blank token", async () => {
    const fetchImpl = vi.fn();
    const blank = await fetchGarminSnapshot({
      accessToken: "   ",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    const none = await fetchGarminSnapshot({
      accessToken: null,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(blank).toEqual(EMPTY_GARMIN_SNAPSHOT);
    expect(none).toEqual(EMPTY_GARMIN_SNAPSHOT);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("normalizes dailies + sleeps + hrv into the snapshot", async () => {
    const fetchImpl = vi.fn(async (url: string) => {
      if (url.includes("/dailies"))
        return jsonResponse([
          {
            restingHeartRateInBeatsPerMinute: 52,
            steps: 8421,
            averageStressLevel: 33,
          },
        ]);
      if (url.includes("/sleeps"))
        return jsonResponse([{ sleepTimeInSeconds: 7 * 3600 }]);
      if (url.includes("/hrv")) return jsonResponse([{ lastNightAvg: 64 }]);
      throw new Error("unexpected url " + url);
    });
    const snap = await fetchGarminSnapshot({
      accessToken: "tok",
      fetchImpl: fetchImpl as unknown as typeof fetch,
      nowMs: () => FIXED_NOW,
    });
    expect(snap).toEqual<GarminSnapshot>({
      restingHeartRate: 52,
      hrvMs: 64,
      sleepHoursLastNight: 7,
      stress: 33,
      steps: 8421,
    });
  });

  it("falls back to durationInSeconds when sleepTimeInSeconds is absent", async () => {
    const fetchImpl = vi.fn(async (url: string) => {
      if (url.includes("/sleeps"))
        return jsonResponse([{ durationInSeconds: 6 * 3600 }]);
      return jsonResponse([]);
    });
    const snap = await fetchGarminSnapshot({
      accessToken: "tok",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(snap.sleepHoursLastNight).toBe(6);
  });

  it("keeps a failed endpoint's fields null while others still contribute", async () => {
    const fetchImpl = vi.fn(async (url: string) => {
      if (url.includes("/dailies")) return jsonResponse({}, 500);
      if (url.includes("/sleeps"))
        return jsonResponse([{ sleepTimeInSeconds: 8 * 3600 }]);
      if (url.includes("/hrv")) return jsonResponse([{ lastNightAvg: 50 }]);
      return jsonResponse([]);
    });
    const snap = await fetchGarminSnapshot({
      accessToken: "tok",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    // dailies failed -> RHR/stress/steps null; sleep + hrv still present.
    expect(snap.restingHeartRate).toBeNull();
    expect(snap.stress).toBeNull();
    expect(snap.steps).toBeNull();
    expect(snap.sleepHoursLastNight).toBe(8);
    expect(snap.hrvMs).toBe(50);
  });

  it("survives a network throw on one endpoint", async () => {
    const fetchImpl = vi.fn(async (url: string) => {
      if (url.includes("/hrv")) throw new Error("ECONNRESET");
      if (url.includes("/dailies"))
        return jsonResponse([{ restingHeartRateInBeatsPerMinute: 60 }]);
      return jsonResponse([]);
    });
    const snap = await fetchGarminSnapshot({
      accessToken: "tok",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(snap.hrvMs).toBeNull();
    expect(snap.restingHeartRate).toBe(60);
  });

  it("coerces non-finite / wrong-typed values to null (never fabricates numbers)", async () => {
    const fetchImpl = vi.fn(async (url: string) => {
      if (url.includes("/dailies"))
        return jsonResponse([
          {
            restingHeartRateInBeatsPerMinute: "52",
            steps: Number.NaN,
            averageStressLevel: null,
          },
        ]);
      return jsonResponse([]);
    });
    const snap = await fetchGarminSnapshot({
      accessToken: "tok",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(snap.restingHeartRate).toBeNull();
    expect(snap.steps).toBeNull();
    expect(snap.stress).toBeNull();
  });

  it("uses a 24h window anchored on nowMs in the request URLs", async () => {
    const seen: string[] = [];
    const fetchImpl = vi.fn(async (url: string) => {
      seen.push(url);
      return jsonResponse([]);
    });
    await fetchGarminSnapshot({
      accessToken: "tok",
      fetchImpl: fetchImpl as unknown as typeof fetch,
      nowMs: () => FIXED_NOW,
    });
    const endSec = Math.floor(FIXED_NOW / 1000);
    const startSec = endSec - 24 * 60 * 60;
    for (const url of seen) {
      expect(url).toContain(`uploadStartTimeInSeconds=${startSec}`);
      expect(url).toContain(`uploadEndTimeInSeconds=${endSec}`);
    }
  });
});

describe("latestObservedAtMs derivation (Founder Ruling I, RC-2)", () => {
  it("derives the MAX calendarDate across dailies/sleeps/hrv when they differ", async () => {
    const fetchImpl = vi.fn(async (url: string) => {
      if (url.includes("/dailies"))
        return jsonResponse([
          { restingHeartRateInBeatsPerMinute: 52, calendarDate: "2026-08-01" },
        ]);
      if (url.includes("/sleeps"))
        return jsonResponse([
          { sleepTimeInSeconds: 7 * 3600, calendarDate: "2026-08-03" }, // latest
        ]);
      if (url.includes("/hrv"))
        return jsonResponse([{ lastNightAvg: 64, calendarDate: "2026-08-02" }]);
      throw new Error("unexpected url " + url);
    });
    const snap = await fetchGarminSnapshot({
      accessToken: "tok",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(snap.latestObservedAtMs).toBe(Date.parse("2026-08-03T00:00:00.000Z"));
  });

  it("is absent when no summary carries a calendarDate", async () => {
    const fetchImpl = vi.fn(async (url: string) => {
      if (url.includes("/dailies")) return jsonResponse([{ restingHeartRateInBeatsPerMinute: 52 }]);
      return jsonResponse([]);
    });
    const snap = await fetchGarminSnapshot({
      accessToken: "tok",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(snap.latestObservedAtMs).toBeUndefined();
    expect("latestObservedAtMs" in snap).toBe(false);
  });

  it("only counts a summary's calendarDate when it actually contributed a metric — a failed dailies endpoint's date (if any) never counts", async () => {
    const fetchImpl = vi.fn(async (url: string) => {
      if (url.includes("/dailies")) return jsonResponse({}, 500);
      if (url.includes("/hrv")) return jsonResponse([{ lastNightAvg: 50, calendarDate: "2026-08-01" }]);
      return jsonResponse([]);
    });
    const snap = await fetchGarminSnapshot({
      accessToken: "tok",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(snap.restingHeartRate).toBeNull();
    expect(snap.latestObservedAtMs).toBe(Date.parse("2026-08-01T00:00:00.000Z"));
  });
});

describe("garminSnapshotToProviderBlob", () => {
  it("lifts a snapshot into a provider blob tagged garmin + fetchedAt", () => {
    const snap: GarminSnapshot = {
      restingHeartRate: 55,
      hrvMs: 70,
      sleepHoursLastNight: 7.5,
      stress: 28,
      steps: 10000,
    };
    expect(garminSnapshotToProviderBlob(snap, FIXED_NOW)).toEqual({
      providerId: "garmin",
      restingHeartRate: 55,
      hrvMs: 70,
      sleepHoursLastNight: 7.5,
      stress: 28,
      steps: 10000,
      fetchedAt: FIXED_NOW,
    });
  });

  it("passes through latestObservedAtMs when the snapshot carries it (Founder Ruling I, RC-2)", () => {
    const snap: GarminSnapshot = {
      restingHeartRate: 55,
      hrvMs: 70,
      sleepHoursLastNight: 7.5,
      stress: 28,
      steps: 10000,
      latestObservedAtMs: 777,
    };
    expect(garminSnapshotToProviderBlob(snap, FIXED_NOW).latestObservedAtMs).toBe(777);
  });

  it("preserves null fields without fabricating values", () => {
    const blob = garminSnapshotToProviderBlob(EMPTY_GARMIN_SNAPSHOT, FIXED_NOW);
    expect(blob.restingHeartRate).toBeNull();
    expect(blob.hrvMs).toBeNull();
    expect(blob.sleepHoursLastNight).toBeNull();
    expect(blob.stress).toBeNull();
    expect(blob.steps).toBeNull();
    expect(blob.fetchedAt).toBe(FIXED_NOW);
    expect("latestObservedAtMs" in blob).toBe(false);
  });
});

describe("mergeGarminIntoBiometrics", () => {
  const garmin = garminSnapshotToProviderBlob(
    { ...EMPTY_GARMIN_SNAPSHOT, restingHeartRate: 50 },
    FIXED_NOW,
  );

  it("returns a garmin-only blob when existing is null/undefined", () => {
    expect(mergeGarminIntoBiometrics(null, garmin)).toEqual({ garmin });
    expect(mergeGarminIntoBiometrics(undefined, garmin)).toEqual({ garmin });
  });

  it("preserves every other provider entry untouched", () => {
    const existing = {
      whoop: { providerId: "whoop", recoveryPct: 80 },
      apple: { providerId: "apple", steps: 1234 },
    };
    const merged = mergeGarminIntoBiometrics(existing, garmin);
    expect(merged["whoop"]).toEqual(existing.whoop);
    expect(merged["apple"]).toEqual(existing.apple);
    expect(merged["garmin"]).toEqual(garmin);
  });

  it("overwrites only the garmin key on a repeat merge", () => {
    const first = mergeGarminIntoBiometrics(
      { whoop: { providerId: "whoop" } },
      garmin,
    );
    const newer = garminSnapshotToProviderBlob(
      { ...EMPTY_GARMIN_SNAPSHOT, restingHeartRate: 48 },
      FIXED_NOW + 1000,
    );
    const second = mergeGarminIntoBiometrics(first, newer);
    expect(second["garmin"]).toEqual(newer);
    expect(second["whoop"]).toEqual({ providerId: "whoop" });
  });

  it("does not mutate the input object (returns a fresh blob)", () => {
    const existing = { whoop: { providerId: "whoop" } };
    const merged = mergeGarminIntoBiometrics(existing, garmin);
    expect(merged).not.toBe(existing);
    expect(existing).toEqual({ whoop: { providerId: "whoop" } });
  });
});
