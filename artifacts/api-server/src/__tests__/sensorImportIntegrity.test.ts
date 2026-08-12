/**
 * Wave-1 P0 invariant: sensor import must never create hydration credit.
 *
 * Proven here:
 *  1. Pure mapper: sweat rows produce ZERO consumption (oz/units always 0),
 *     more sweat loss never increases any consumption field, sodium/sweat
 *     provenance is preserved, invalid timestamps are skipped.
 *  2. Route behavior (mocked db): POST /aforce/sensors/import never inserts
 *     intake rows and never updates user state (lastIntakeTime untouched);
 *     only the model-version-stamped snapshot repo is written.
 *  3. Source lock: the route module contains no intake-log insert and no
 *     lastIntakeTime write (regression guard against reintroduction).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import http from "node:http";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const inserted: { table: string; values: unknown }[] = [];
const stateUpdates: unknown[] = [];
const snapshotBatches: unknown[][] = [];

vi.mock("@workspace/db", () => {
  const tx = {
    insert: (table: unknown) => ({
      values: async (v: unknown) => {
        inserted.push({ table: String(table), values: v });
      },
    }),
    update: () => ({
      set: (v: unknown) => ({
        where: async () => {
          stateUpdates.push(v);
        },
      }),
    }),
  };
  return {
    db: { transaction: async (fn: (t: typeof tx) => Promise<void>) => fn(tx) },
    aforceIntakeLogs: "TABLE:aforce_intake_logs",
    aforceUserState: "TABLE:aforce_user_state",
    aforceScoreSnapshots: "TABLE:aforce_score_snapshots",
    createDrizzleScoreSnapshotRepo: () => ({
      createMany: async (rows: unknown[]) => {
        snapshotBatches.push(rows);
      },
    }),
  };
});
vi.mock("../lib/aforceState", () => ({
  DEFAULT_USER_ID: "test-user",
  getUserState: vi.fn(async () => ({})),
}));
vi.mock("../routes/aforce/shared", () => ({
  resolveUserId: () => "test-user",
  unlockAchievementCode: vi.fn(async () => {}),
}));

beforeEach(() => {
  inserted.length = 0;
  stateUpdates.length = 0;
  snapshotBatches.length = 0;
});

describe("mapSensorRowsToSnapshots — pure invariants", () => {
  it("zero consumption regardless of sweat volume; provenance preserved", async () => {
    const { mapSensorRowsToSnapshots } = await import("../routes/aforce/sensors");
    const light = mapSensorRowsToSnapshots("u", "sensor:nix", [
      { timestamp: "2026-08-12T10:00:00Z", sweatLossMl: 100, sodiumMg: 120 },
    ]);
    const heavy = mapSensorRowsToSnapshots("u", "sensor:nix", [
      { timestamp: "2026-08-12T10:00:00Z", sweatLossMl: 4000, sodiumMg: 3200 },
    ]);
    for (const snap of [...light, ...heavy]) {
      expect(snap.ozConsumedToday).toBe(0);
      expect(snap.unitsConsumedToday).toBe(0);
      expect(snap.aforceUnitsToday).toBe(0);
      expect(snap.sodiumDeliveredMg).toBe(0);
    }
    // Greater loss → greater recorded LOSS, never greater credit.
    expect(heavy[0]!.sodiumLostMg).toBeGreaterThan(light[0]!.sodiumLostMg as number);
    expect(heavy[0]!.reason).toBe("sensor:nix");
  });

  it("invalid timestamps are skipped, never coerced", async () => {
    const { mapSensorRowsToSnapshots } = await import("../routes/aforce/sensors");
    const rows = mapSensorRowsToSnapshots("u", "sensor:hdrop", [
      { timestamp: "not-a-date", sweatLossMl: 500 },
      { timestamp: "2026-08-12T10:00:00Z", sweatLossMl: 500 },
    ]);
    expect(rows).toHaveLength(1);
  });
});

describe("route behavior — no intake, no lastIntakeTime", () => {
  async function post(body: unknown): Promise<number> {
    const { default: sensorsRouter } = await import("../routes/aforce/sensors");
    const app = express();
    app.use(express.json());
    app.use("/aforce", sensorsRouter);
    const server = http.createServer(app);
    await new Promise<void>((r) => server.listen(0, r));
    const addr = server.address();
    const port = typeof addr === "object" && addr ? addr.port : 0;
    try {
      const res = await fetch(`http://127.0.0.1:${port}/aforce/sensors/import`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      return res.status;
    } finally {
      await new Promise<void>((r) => server.close(() => r()));
    }
  }

  it("a heavy-sweat import writes provenance snapshots ONLY", async () => {
    const status = await post({
      source: "nix",
      rows: [
        { timestamp: "2026-08-12T10:00:00Z", sweatLossMl: 2000, sodiumMg: 1500 },
        { timestamp: "2026-08-12T10:30:00Z", sweatLossMl: 1800, sodiumMg: 1300 },
      ],
    });
    expect(status).toBe(200);
    expect(inserted).toHaveLength(0); // NO intake rows (no insert of any table)
    expect(stateUpdates).toHaveLength(0); // lastIntakeTime never advanced
    expect(snapshotBatches).toHaveLength(1);
    expect(snapshotBatches[0]).toHaveLength(2);
  });

  it("all-invalid rows → 400, nothing written", async () => {
    const status = await post({ source: "hdrop", rows: [{ timestamp: "garbage", sweatLossMl: 10 }] });
    expect(status).toBe(400);
    expect(inserted).toHaveLength(0);
    expect(stateUpdates).toHaveLength(0);
    expect(snapshotBatches).toHaveLength(0);
  });
});

describe("source lock — regression guard", () => {
  it("the route module contains no intake insert and no lastIntakeTime write", () => {
    const src = readFileSync(join(__dirname, "..", "routes", "aforce", "sensors.ts"), "utf8");
    const code = src.replace(/\/\/[^\n]*\n/g, "\n").replace(/\/\*[\s\S]*?\*\//g, "");
    expect(code).not.toMatch(/aforceIntakeLogs/);
    expect(code).not.toMatch(/lastIntakeTime/);
    expect(code).not.toMatch(/ozAmount/);
  });
});
