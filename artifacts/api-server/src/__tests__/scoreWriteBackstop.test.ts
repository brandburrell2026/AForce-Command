/**
 * Wave-2 PR2 invariants: server-side Score Protection backstop.
 *
 * The server must not blindly trust client-supplied score-influencing
 * values. These tests lock the pure input-domain restrictions (bounds +
 * two-sided freshness) added in this PR — they change NO score
 * semantics: every representative legitimate client payload (shape of
 * the deployed build-58 app) must still pass.
 *
 * DB-less lane: journalSchema.ts and intakeSchema.ts are deliberately
 * pure modules; the router-application locks mock @workspace/db.
 */
import { describe, it, expect, vi } from "vitest";

import { snapshotSchema } from "../routes/aforce/journalSchema";
import {
  intakeSchema,
  intakeEventSchema,
  intakeEventTsWithinWindow,
  INTAKE_EVENT_MAX_AGE_MS,
} from "../routes/aforce/intakeSchema";

vi.mock("@workspace/db", () => ({
  db: {},
  aforceUserState: {},
  aforceIntakeLogs: {},
  aforceScoreSnapshots: {},
  aforceAchievements: {},
  createDrizzleScoreSnapshotRepo: () => ({}),
}));
vi.mock("../lib/aforceState", () => ({
  DEFAULT_USER_ID: "test-default-user",
  ALL_FLUID_TYPES: ["water", "aforce", "aforce_rtd"],
  isAforceFluid: (f: string) => f.startsWith("aforce"),
  getUserState: vi.fn(),
  updateUserState: vi.fn(),
}));
vi.mock("../lib/logger", () => ({
  logger: { error: () => {}, warn: () => {}, info: () => {}, debug: () => {} },
}));

const NOW = Date.parse("2026-08-12T12:00:00.000Z");

// ─── Legitimate payloads (deployed-client shapes) MUST pass ───

describe("legitimate client payloads still pass", () => {
  it("representative build-58 snapshot payload passes", () => {
    const parsed = snapshotSchema.safeParse({
      score: 82,
      level: "BALANCED",
      ozConsumedToday: 45,
      aforceUnitsToday: 2,
      unitsConsumedToday: 5,
      sodiumDeliveredMg: 940,
      sodiumLostMg: 1200,
      deficitPct: 18.4,
      clutchActive: false,
      socialActive: false,
      autopilotActive: false,
      reason: "engine refresh",
      recoveryScore: 71,
      pressureScore: 34,
      recoveryTrend: "stable",
    });
    expect(parsed.success).toBe(true);
  });

  it("representative intake payload (water tap, ISO-Z loggedAt) passes", () => {
    const parsed = intakeSchema.safeParse({
      fluidType: "water",
      ozAmount: 12,
      scoreBefore: 70,
      scoreAfter: 74,
      clientEventId: "evt_abc123",
      entrySource: "tap",
      event: {
        id: "evt_abc123",
        fluidType: "water",
        oz: 12,
        loggedAt: "2026-08-12T11:58:03.412Z",
        baseImpact: 3,
        capAdjusted: 3,
        immediate: 1.8,
        delayed: 1.2,
        delayedDurationMin: 90,
        heatGuardActiveAtLog: false,
        scoreBeforeAtLog: 70,
      },
    });
    expect(parsed.success).toBe(true);
  });

  it("offset ISO timestamps are accepted (clock-skewed clients)", () => {
    const parsed = intakeEventSchema.safeParse({
      id: "e1",
      fluidType: "water",
      oz: 8,
      loggedAt: "2026-08-12T13:58:03+02:00",
      baseImpact: 2,
      capAdjusted: 2,
      immediate: 1.2,
      delayed: 0.8,
      delayedDurationMin: 90,
      heatGuardActiveAtLog: false,
      scoreBeforeAtLog: 65,
    });
    expect(parsed.success).toBe(true);
  });
});

// ─── Forged / impossible values MUST be rejected ───

describe("impossible score-influencing values fail closed", () => {
  const legitEvent = {
    id: "e1",
    fluidType: "water",
    oz: 12,
    loggedAt: "2026-08-12T11:58:03.412Z",
    baseImpact: 3,
    capAdjusted: 3,
    immediate: 1.8,
    delayed: 1.2,
    delayedDurationMin: 90,
    heatGuardActiveAtLog: false,
    scoreBeforeAtLog: 70,
  };

  it("score-minting impact points are rejected (the highest-leverage gap)", () => {
    for (const field of ["baseImpact", "capAdjusted", "immediate", "delayed"] as const) {
      const forged = { ...legitEvent, [field]: 1_000_000 };
      expect(
        intakeEventSchema.safeParse(forged).success,
        `${field}=1e6 must be rejected`,
      ).toBe(false);
      const forgedNeg = { ...legitEvent, [field]: -1_000_000 };
      expect(
        intakeEventSchema.safeParse(forgedNeg).success,
        `${field}=-1e6 must be rejected`,
      ).toBe(false);
    }
  });

  it("oz=100000 is rejected on both the intake and the event", () => {
    expect(
      intakeSchema.safeParse({
        fluidType: "water",
        ozAmount: 100_000,
        scoreBefore: 70,
        scoreAfter: 74,
      }).success,
    ).toBe(false);
    expect(intakeEventSchema.safeParse({ ...legitEvent, oz: 100_000 }).success).toBe(false);
  });

  it("out-of-scale scoreBefore/scoreAfter are rejected", () => {
    expect(
      intakeSchema.safeParse({
        fluidType: "water",
        ozAmount: 12,
        scoreBefore: -50,
        scoreAfter: 9999,
      }).success,
    ).toBe(false);
  });

  it("free-form loggedAt strings are rejected", () => {
    expect(
      intakeEventSchema.safeParse({ ...legitEvent, loggedAt: "yesterday-ish" }).success,
    ).toBe(false);
  });

  it("unbounded snapshot fields are rejected (deficitPct / oz / sodium)", () => {
    const base = {
      score: 82,
      level: "BALANCED",
      ozConsumedToday: 45,
      aforceUnitsToday: 2,
      unitsConsumedToday: 5,
      sodiumDeliveredMg: 940,
      sodiumLostMg: 1200,
      deficitPct: 18.4,
    };
    expect(snapshotSchema.safeParse({ ...base, deficitPct: 1e9 }).success).toBe(false);
    expect(snapshotSchema.safeParse({ ...base, ozConsumedToday: 1e6 }).success).toBe(false);
    expect(snapshotSchema.safeParse({ ...base, sodiumLostMg: 1e7 }).success).toBe(false);
    expect(snapshotSchema.safeParse({ ...base, sodiumDeliveredMg: 1e7 }).success).toBe(false);
  });
});

// ─── Two-sided freshness window ───

describe("intake event freshness is two-sided (future-dating closed)", () => {
  it("a now event and small clock skew are within the window", () => {
    expect(intakeEventTsWithinWindow(NOW, NOW)).toBe(true);
    expect(intakeEventTsWithinWindow(NOW + 2 * 60 * 1000, NOW)).toBe(true);
    expect(intakeEventTsWithinWindow(NOW - 60 * 60 * 1000, NOW)).toBe(true);
  });

  it("future-dated events are OUTSIDE the window (previously always passed)", () => {
    expect(intakeEventTsWithinWindow(NOW + 60 * 60 * 1000, NOW)).toBe(false);
    expect(intakeEventTsWithinWindow(NOW + 365 * 24 * 60 * 60 * 1000, NOW)).toBe(false);
  });

  it("events older than 24h age out; NaN never passes", () => {
    expect(intakeEventTsWithinWindow(NOW - INTAKE_EVENT_MAX_AGE_MS - 1, NOW)).toBe(false);
    expect(intakeEventTsWithinWindow(Number.NaN, NOW)).toBe(false);
  });
});

// ─── Sensor import: future rows skipped, mapper stays provenance-only ───

describe("sensor import backstop", () => {
  it("future-dated sensor rows are skipped like invalid timestamps", async () => {
    const { mapSensorRowsToSnapshots } = await import("../routes/aforce/sensors");
    const future = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    const past = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const rows = [
      { timestamp: future, sweatLossMl: 500, sodiumMg: 800 },
      { timestamp: past, sweatLossMl: 500, sodiumMg: 800 },
      { timestamp: "not-a-date", sweatLossMl: 500, sodiumMg: 800 },
    ];
    const snapshots = mapSensorRowsToSnapshots("u1", "sensor:hdrop", rows);
    expect(snapshots.length).toBe(1);
    expect(snapshots[0]!.capturedAt).toEqual(new Date(past));
  });
});

// ─── Route-application locks: the write routes are throttled ───

describe("snapshot-writing routes are rate limited", () => {
  function routeStack(router: unknown, path: string) {
    const layer = (
      router as { stack: Array<{ route?: { path: string; stack: Array<{ handle: { name: string } }> } }> }
    ).stack.find((l) => l.route?.path === path);
    expect(layer?.route, `${path} route must exist`).toBeTruthy();
    return layer!.route!.stack;
  }

  it("POST /journal/snapshot and POST /sensors/import have middleware before the handler", async () => {
    const { default: journalRouter } = await import("../routes/aforce/journal");
    const { default: sensorsRouter } = await import("../routes/aforce/sensors");
    expect(routeStack(journalRouter, "/journal/snapshot").length).toBeGreaterThanOrEqual(2);
    expect(routeStack(sensorsRouter, "/sensors/import").length).toBeGreaterThanOrEqual(2);
  });
});
