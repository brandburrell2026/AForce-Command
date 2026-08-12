/**
 * Wave-3 PR11 — the approved W2-N3 decision: UNKNOWN / NOT_COMPUTED.
 *
 * A sensor snapshot has not been scored by the canonical scoring path,
 * so it must never carry a fabricated 70/BALANCED — and no consumer may
 * present or aggregate the unknown as measured. No HydroState change,
 * no sensor scoring engine, no schema migration (level is an
 * unconstrained text column; the 0 sentinel stays inside the declared
 * 0–100 domain and is never read — safety keys on `level`).
 */
import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

vi.mock("@workspace/db", () => ({
  db: {},
  aforceScoreSnapshots: {},
  aforceUserState: {},
  aforceIntakeLogs: {},
  createDrizzleScoreSnapshotRepo: () => ({}),
}));
vi.mock("../lib/aforceState", () => ({
  DEFAULT_USER_ID: "test-default-user",
  getUserState: vi.fn(),
  ALL_FLUID_TYPES: ["water"],
  isAforceFluid: () => false,
}));
vi.mock("../lib/logger", () => ({
  logger: { error: () => {}, warn: () => {}, info: () => {}, debug: () => {} },
}));

describe("the writer emits honest UNKNOWN rows", () => {
  it("no fake 70, no fake BALANCED — level NOT_COMPUTED with inert 0 sentinel", async () => {
    const { mapSensorRowsToSnapshots } = await import("../routes/aforce/sensors");
    const rows = mapSensorRowsToSnapshots("u1", "sensor:hdrop", [
      { timestamp: new Date(Date.now() - 3600_000).toISOString(), sweatLossMl: 500, sodiumMg: 800 },
    ]);
    expect(rows.length).toBe(1);
    expect(rows[0]!.level).toBe("NOT_COMPUTED");
    expect(rows[0]!.score).toBe(0);
    expect(rows[0]!.reason).toBe("sensor:hdrop"); // provenance preserved
    // provenance fields still carried honestly
    expect(rows[0]!.sodiumLostMg).toBe(800);
    expect(rows[0]!.ozConsumedToday).toBe(0);
  });

  it("nothing in the sensor writer fabricates a physiological value anymore", () => {
    const src = readFileSync(resolve(__dirname, "../routes/aforce/sensors.ts"), "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "");
    expect(src).not.toMatch(/score:\s*70/);
    expect(src).not.toMatch(/level:\s*"BALANCED"/);
  });
});

describe("consumers never present or aggregate UNKNOWN as measured (source locks)", () => {
  const journalSrc = readFileSync(resolve(__dirname, "../routes/aforce/journal.ts"), "utf8");

  it("timeline drops unknown levels (pre-existing validLevels filter intact)", () => {
    expect(journalSrc).toContain("validLevels.has(s.level)");
  });

  it("rollup aggregates are measured-only", () => {
    const rollupsIdx = journalSrc.indexOf('"/journal/rollups"');
    const filtered = journalSrc.indexOf("inArray(aforceScoreSnapshots.level", rollupsIdx);
    expect(rollupsIdx).toBeGreaterThan(-1);
    expect(filtered).toBeGreaterThan(rollupsIdx);
  });

  it("the Score-Protection guard anchors on the last MEASURED score", () => {
    const guardIdx = journalSrc.indexOf("resolveScoreProtectionMode");
    const filtered = journalSrc.indexOf("inArray(aforceScoreSnapshots.level", guardIdx);
    const rollupsIdx = journalSrc.indexOf('"/journal/rollups"');
    expect(filtered).toBeGreaterThan(guardIdx);
    expect(filtered).toBeLessThan(rollupsIdx);
  });

  it("achievements ignore provenance rows; the founder trend is measured-only", () => {
    const achievementsSrc = readFileSync(resolve(__dirname, "../routes/aforce/achievements.ts"), "utf8");
    expect(achievementsSrc).toContain('ne(aforceScoreSnapshots.level, "NOT_COMPUTED")');
    const adminSrc = readFileSync(resolve(__dirname, "../routes/commandCenterAdmin.ts"), "utf8");
    expect(adminSrc).toContain("WHERE level <> 'NOT_COMPUTED'");
  });

  it("clients cannot post NOT_COMPUTED (the request schema stays 4-band)", async () => {
    const { snapshotSchema, LEVELS } = await import("../routes/aforce/journalSchema");
    expect([...LEVELS]).toEqual(["PEAK", "BALANCED", "RECOVERING", "DEPLETED"]);
    const forged = snapshotSchema.safeParse({ score: 0, level: "NOT_COMPUTED" });
    expect(forged.success).toBe(false);
  });
});
