import { describe, it, expect } from "vitest";
import {
  airportInstant,
  createTravelDocuments,
  emptyTravelDocument,
  mergeIntelligenceMoments,
  tripMoments,
} from "../intelligence";
import type { TravelTrip } from "@workspace/api-zod";
const trip: TravelTrip = {
  id: "trip",
  title: "Trip",
  createdAt: "2026-10-28T12:00:00Z",
  completedAt: null,
  legs: [
    {
      id: "leg",
      flight: {
        flightNumber: "DL1181",
        origin: "LGA",
        destination: "FLL",
        departureDate: "2026-10-29",
      },
      departureAt: "2026-10-29T14:45:00Z",
      arrivalAt: "2026-10-29T17:48:00Z",
      originTimeZone: "America/New_York",
      destinationTimeZone: "America/New_York",
    },
  ],
};
describe("device-owned travel plans", () => {
  it("projects one departure plus arrival without duplicating old manual flight Moments", () => {
    const projections = tripMoments([trip]);
    expect(projections.map((p) => p.type)).toEqual(["travel", "recovery"]);
    const merged = mergeIntelligenceMoments(
      [{ ...projections[0], id: "old", title: "Flight to FLL" }],
      [trip],
    );
    expect(merged).toHaveLength(2);
    expect(
      tripMoments([{ ...trip, completedAt: "2026-10-30T12:00:00Z" }]),
    ).toEqual([]);
  });
  it("resolves airport wall times and rejects DST gaps and ambiguous local times", () => {
    expect(airportInstant("LGA", "2026-10-29", "10:45").at).toBe(
      "2026-10-29T14:45:00.000Z",
    );
    expect(() => airportInstant("LGA", "2026-03-08", "02:30")).toThrow();
    expect(() => airportInstant("LGA", "2026-11-01", "01:30")).toThrow();
  });
  it("isolates account documents, persists before success and fails closed on corrupt data", async () => {
    const data = new Map<string, string>();
    const store = {
      getItem: async (k: string) => data.get(k) ?? null,
      setItem: async (k: string, v: string) => {
        data.set(k, v);
      },
      removeItem: async (k: string) => {
        data.delete(k);
      },
    };
    const repo = createTravelDocuments(store);
    await repo.save("A", {
      ...emptyTravelDocument(),
      trips: [trip],
      dirty: true,
    });
    expect((await repo.load("A")).trips).toEqual([trip]);
    expect((await repo.load("B")).trips).toEqual([]);
    data.set([...data.keys()][0], "broken");
    await expect(repo.load("A")).rejects.toThrow();
  });
});

it("rejects a racing local write instead of replacing a newer durable version", async () => {
  const values = new Map<string, string>();
  const repository = createTravelDocuments({
    getItem: async (key) => values.get(key) ?? null,
    setItem: async (key, value) => {
      values.set(key, value);
    },
    removeItem: async (key) => {
      values.delete(key);
    },
  });
  const first = {
    ...emptyTravelDocument(),
    localVersion: 1,
    trips: [trip],
    dirty: true,
  };
  const results = await Promise.allSettled([
    repository.save("A", first, 0),
    repository.save("A", { ...first, trips: [] }, 0),
  ]);
  expect(results.map((result) => result.status)).toEqual([
    "fulfilled",
    "rejected",
  ]);
  expect((await repository.load("A")).trips).toEqual([trip]);
});

it("keeps a travel ritual in Moments and marks only its own departure or arrival prepared", async () => {
  const { markTravelPrepared } = await import("../intelligence");
  const marked = markTravelPrepared(
    [trip],
    "travel2:trip:leg:departure",
    "2026-10-29T12:45:00Z",
  );
  expect(tripMoments(marked)[0].preparedAtIso).toBe("2026-10-29T12:45:00Z");
  expect(tripMoments(marked)[1].preparedAtIso).toBeUndefined();
  expect(() =>
    markTravelPrepared([trip], "travel2:someone-else:leg:departure"),
  ).toThrow();
});

it("accepts either airline-confirmed offset in a repeated airport hour and rejects a mismatched offset", () => {
  expect(airportInstant("LGA", "2026-11-01", "01:30", "-04:00").at).toBe(
    "2026-11-01T05:30:00.000Z",
  );
  expect(airportInstant("LGA", "2026-11-01", "01:30", "-05:00").at).toBe(
    "2026-11-01T06:30:00.000Z",
  );
  expect(() => airportInstant("LGA", "2026-11-01", "01:30", "-06:00")).toThrow(
    "does not match",
  );
});
