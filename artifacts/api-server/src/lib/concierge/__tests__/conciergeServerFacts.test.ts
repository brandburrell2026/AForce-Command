/**
 * Server facts: freshness labelling mirrors the client config exactly, expired
 * weather is withheld, and provider syncs are labelled from fetchedAt.
 *
 * Cross-boundary parity import (same pattern as hydroStateModelVersionParity):
 * the server cannot import app modules at runtime, so the mirror constants in
 * config.ts are locked here against the client's FRESHNESS_WINDOWS.
 */
import { describe, it, expect } from "vitest";
import { FRESHNESS_WINDOWS } from "../../../../../aforce-os/config/hydroStateModel";
import { CONCIERGE_FRESHNESS_MIRROR } from "../config";
import { freshnessFor, serverFactsFromRow } from "../serverFacts";

const H = 60 * 60 * 1000;
const NOW = Date.parse("2026-10-05T18:00:00.000Z");

describe("freshness mirror parity (server ↔ app config)", () => {
  it("weather windows match artifacts/aforce-os/config/hydroStateModel.ts", () => {
    expect(CONCIERGE_FRESHNESS_MIRROR.weather).toEqual({
      freshUntilMs: FRESHNESS_WINDOWS.weather.freshUntilMs,
      staleAfterMs: FRESHNESS_WINDOWS.weather.staleAfterMs,
      expireAfterMs: FRESHNESS_WINDOWS.weather.expireAfterMs,
    });
  });
  it("wearable_sync windows match the app config", () => {
    expect(CONCIERGE_FRESHNESS_MIRROR.wearable_sync).toEqual({
      freshUntilMs: FRESHNESS_WINDOWS.wearable_sync.freshUntilMs,
      staleAfterMs: FRESHNESS_WINDOWS.wearable_sync.staleAfterMs,
      expireAfterMs: FRESHNESS_WINDOWS.wearable_sync.expireAfterMs,
    });
  });
});

describe("freshnessFor", () => {
  const w = CONCIERGE_FRESHNESS_MIRROR.wearable_sync;
  it("labels by age against the windows", () => {
    expect(freshnessFor(1 * H, w)).toBe("fresh");
    expect(freshnessFor(10 * H, w)).toBe("aging");
    expect(freshnessFor(30 * H, w)).toBe("stale");
    expect(freshnessFor(100 * H, w)).toBe("expired");
  });
  it("never labels a bad age as anything but missing", () => {
    expect(freshnessFor(Number.NaN, w)).toBe("missing");
    expect(freshnessFor(-5, w)).toBe("missing");
  });
});

describe("serverFactsFromRow", () => {
  it("returns an honest empty shape when there is no row", () => {
    expect(serverFactsFromRow(null, NOW)).toEqual({ intake: null, weather: null, providerSyncs: [] });
  });

  it("carries the server-owned intake figures and labels provider syncs", () => {
    const facts = serverFactsFromRow(
      {
        ozConsumedToday: 40,
        ozTarget: 96,
        unitsConsumedToday: 3,
        dailyTarget: 8,
        biometrics: {
          whoop: { providerId: "whoop", fetchedAt: NOW - 10 * H },
          oura: { providerId: "oura", fetchedAt: NOW - 80 * H },
        },
      },
      NOW,
    );
    expect(facts.intake).toEqual({ ozToday: 40, ozTarget: 96, unitsToday: 3, unitsTarget: 8 });
    expect(facts.providerSyncs).toEqual([
      { id: "whoop", fetchedAtIso: new Date(NOW - 10 * H).toISOString(), freshness: "aging" },
      { id: "oura", fetchedAtIso: new Date(NOW - 80 * H).toISOString(), freshness: "expired" },
    ]);
  });

  it("includes weather when current/aging/stale and WITHHOLDS it when expired", () => {
    const row = {
      ozConsumedToday: 0,
      ozTarget: 96,
      unitsConsumedToday: 0,
      dailyTarget: 8,
      weatherTempC: 31,
      weatherHumidity: 60,
      weatherCity: "Miami",
      weatherFetchedAt: new Date(NOW - 2 * H),
    };
    expect(serverFactsFromRow(row, NOW).weather).toMatchObject({ tempC: 31, city: "Miami", freshness: "aging" });
    expect(serverFactsFromRow({ ...row, weatherFetchedAt: new Date(NOW - 20 * H) }, NOW).weather).toBeNull();
  });
});
