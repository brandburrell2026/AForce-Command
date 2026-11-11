import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import { TravelRepository, TravelConflict } from "../repository";
import {
  flightIdentity,
  travelProposal,
  type TravelTrip,
  type TravelSnapshot,
} from "@workspace/api-zod";
import { travelCrypto } from "../crypto";
import { monitorTravel } from "../monitor";
const db = new PGlite();
const query = async (sql: string, params?: unknown[]) => {
  const r = await db.query(sql, params);
  return { ...r, rowCount: r.affectedRows ?? r.rows.length };
};
const pool = { query, connect: async () => ({ query, release() {} }) };
const repo = new TravelRepository(pool as never);
const trip: TravelTrip = {
  id: "trip",
  title: "New York to LA",
  createdAt: new Date().toISOString(),
  completedAt: null,
  legs: [
    {
      id: "leg",
      flight: {
        flightNumber: "AA123",
        origin: "JFK",
        destination: "LAX",
        departureDate: new Date().toISOString().slice(0, 10),
      },
      departureAt: new Date(Date.now() + 3600000).toISOString(),
      arrivalAt: new Date(Date.now() + 18000000).toISOString(),
      originTimeZone: "America/New_York",
      destinationTimeZone: "America/Los_Angeles",
    },
  ],
};
const report = (
  change: Partial<TravelSnapshot["flight"]> = {},
): TravelSnapshot => ({
  version: 2,
  provider: "flightaware",
  availability: "available",
  fetchedAt: new Date().toISOString(),
  flight: {
    ...trip.legs[0].flight,
    status: "scheduled",
    scheduledDeparture: trip.legs[0].departureAt,
    estimatedDeparture: trip.legs[0].departureAt,
    departureGate: "A1",
    departureTerminal: "1",
    scheduledArrival: trip.legs[0].arrivalAt,
    estimatedArrival: trip.legs[0].arrivalAt,
    actualArrival: null,
    actualDeparture: null,
    originTimeZone: "America/New_York",
    destinationTimeZone: "America/Los_Angeles",
    ...change,
  },
});
beforeAll(async () => {
  await db.exec(
    await readFile(
      new URL(
        "../../../../../../lib/db/migrations/20261029_travel_intelligence.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  );
});
beforeEach(async () => {
  await db.exec("TRUNCATE aforce_travel_accounts CASCADE");
});
afterAll(() => db.close());
describe("isolated PostgreSQL travel storage and migration rehearsal", () => {
  it("checks schema readiness, isolates owners and rejects stale revisions", async () => {
    expect(await repo.ready()).toBe(true);
    await repo.replace("A", 0, [trip]);
    expect((await repo.get("B")).trips).toEqual([]);
    await expect(repo.replace("A", 0, [])).rejects.toBeInstanceOf(
      TravelConflict,
    );
    expect((await repo.get("A")).trips).toEqual([trip]);
  });
  it("stores fresh observations separately and commits only the reviewed proposal", async () => {
    await repo.replace("A", 0, [trip]);
    const snapshot = report({
      estimatedDeparture: new Date(
        Date.parse(trip.legs[0].departureAt) + 600000,
      ).toISOString(),
    });
    await repo.observe("A", "leg", flightIdentity(trip.legs[0]), snapshot);
    expect((await repo.get("A")).trips).toEqual([trip]);
    const p = travelProposal(trip.legs[0], snapshot)!;
    await expect(repo.accept("A", 1, "leg", "stale-key")).rejects.toThrow();
    const accepted = await repo.accept("A", 1, "leg", p.key);
    expect(accepted.trips[0].legs[0].departureAt).toBe(
      snapshot.flight.estimatedDeparture,
    );
    expect(accepted.revision).toBe(2);
  });
  it("creates no first-report alert, deduplicates updates and supersedes finished journeys", async () => {
    await repo.replace("A", 0, [trip]);
    await repo.device("A", "phone", "cipher", "hash", true);
    const first = {
      ...report(),
      fetchedAt: new Date(Date.now() - 1000).toISOString(),
    };
    await repo.observe("A", "leg", flightIdentity(trip.legs[0]), first);
    expect(
      (await query("SELECT * FROM aforce_travel_alerts")).rows,
    ).toHaveLength(0);
    const changed = report({ departureGate: "B2" });
    await repo.observe("A", "leg", flightIdentity(trip.legs[0]), changed);
    await repo.observe("A", "leg", flightIdentity(trip.legs[0]), changed);
    expect(await repo.claimAlerts()).toHaveLength(1);
    await repo.replace("A", 1, [
      { ...trip, completedAt: new Date().toISOString() },
    ]);
    expect(
      (await query("SELECT state FROM aforce_travel_alerts")).rows,
    ).toEqual([{ state: "superseded" }]);
    await repo.purge("A");
    expect(
      (await query("SELECT * FROM aforce_travel_devices")).rows,
    ).toHaveLength(0);
    expect(
      (await query("SELECT * FROM aforce_travel_alerts")).rows,
    ).toHaveLength(0);
  });
  it("leases owners and devices and cancels a replaced leg identity", async () => {
    await repo.replace("A", 0, [trip]);
    await repo.device("A", "phone", "cipher", "hash", true);
    expect(await repo.claimOwners()).toEqual(["A"]);
    expect(await repo.claimOwners()).toEqual([]);
    expect(await repo.claimDevice("A", "phone")).toBe(true);
    expect(await repo.claimDevice("A", "phone")).toBe(false);
    await repo.observe("A", "leg", flightIdentity(trip.legs[0]), {
      ...report(),
      fetchedAt: new Date(Date.now() - 1000).toISOString(),
    });
    await repo.observe(
      "A",
      "leg",
      flightIdentity(trip.legs[0]),
      report({ departureGate: "B2" }),
    );
    await repo.replace("A", 1, [
      {
        ...trip,
        legs: [
          {
            ...trip.legs[0],
            flight: { ...trip.legs[0].flight, flightNumber: "AA456" },
          },
        ],
      },
    ]);
    expect((await repo.get("A")).observations).toEqual({});
    expect(
      (await query("SELECT state FROM aforce_travel_alerts")).rows,
    ).toEqual([{ state: "superseded" }]);
  });
  it("sends generic encrypted-token alerts and verifies a provider receipt", async () => {
    const key = "a".repeat(64),
      crypto = travelCrypto(key);
    await repo.replace("A", 0, [trip]);
    await repo.device(
      "A",
      "phone",
      crypto.encrypt("ExpoPushToken[synthetic]"),
      "hash",
      true,
    );
    await db.exec(
      "UPDATE aforce_travel_accounts SET next_check_at=now()+interval '1 day'",
    );
    await repo.observe("A", "leg", flightIdentity(trip.legs[0]), {
      ...report(),
      fetchedAt: new Date(Date.now() - 1000).toISOString(),
    });
    await repo.observe(
      "A",
      "leg",
      flightIdentity(trip.legs[0]),
      report({ departureGate: "B2" }),
    );
    let sent: any;
    await monitorTravel(repo, new Set(["A"]), key, async (path, body) => {
      expect(path).toBe("send");
      sent = body;
      return { status: "ok", id: "ticket" };
    });
    expect(sent.to).toBe("ExpoPushToken[synthetic]");
    expect(JSON.stringify(sent)).not.toContain("JFK");
    expect(JSON.stringify(sent)).not.toContain("B2");
    expect(sent.data.ownerHash).not.toBe("A");
    expect(
      (await query("SELECT state FROM aforce_travel_alerts")).rows,
    ).toEqual([{ state: "receipt" }]);
    await db.exec("UPDATE aforce_travel_alerts SET next_at=now()");
    await monitorTravel(repo, new Set(["A"]), key, async () => ({
      ticket: { status: "ok" },
    }));
    expect(
      (await query("SELECT state FROM aforce_travel_alerts")).rows,
    ).toEqual([{ state: "delivered" }]);
  });
  it("authenticates encrypted records and rolls back a failed transaction", async () => {
    const c = travelCrypto("a".repeat(64));
    const value = c.encrypt("private-grant");
    expect(c.decrypt(value)).toBe("private-grant");
    expect(() => travelCrypto("b".repeat(64)).decrypt(value)).toThrow();
    await repo.replace("A", 0, [trip]);
    await db.exec("BEGIN");
    await db.query("DELETE FROM aforce_travel_accounts WHERE user_id=$1", [
      "A",
    ]);
    await db.exec("ROLLBACK");
    expect((await repo.get("A")).trips).toHaveLength(1);
  });
});
