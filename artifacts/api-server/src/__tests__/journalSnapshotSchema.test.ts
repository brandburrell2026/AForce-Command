/**
 * Contract tests for the /journal/snapshot request schema.
 *
 * Motivation: a live-build review observed `POST /journal/snapshot → 400`.
 * These tests pin the app↔backend contract so we can prove which side is at
 * fault. They assert that the exact payload the client sends (services/realApi
 * `JournalSnapshotPayload`, built in store/useAppStore) is accepted — for both
 * the empty-state (all-zero, DEPLETED) and a typical mid-session case — and that
 * malformed input is rejected with field PATHS (never values, for privacy).
 */
import { describe, it, expect } from "vitest";
import { snapshotSchema } from "../routes/aforce/journalSchema";

// Mirror of the client's empty-state payload (readiness 0, no data wired).
const emptyState = {
  score: 0,
  level: "DEPLETED",
  ozConsumedToday: 0,
  aforceUnitsToday: 0,
  unitsConsumedToday: 0,
  sodiumDeliveredMg: 0,
  sodiumLostMg: 0,
  deficitPct: 0,
  clutchActive: false,
  socialActive: false,
  autopilotActive: false,
  reason: "",
};

describe("snapshotSchema — app↔backend contract", () => {
  it("accepts the empty-state payload the client sends (readiness 0 / DEPLETED)", () => {
    const r = snapshotSchema.safeParse(emptyState);
    expect(r.success).toBe(true);
  });

  it("accepts a typical mid-session payload (fractional oz/sodium, recovery layer on)", () => {
    const r = snapshotSchema.safeParse({
      ...emptyState,
      score: 72,
      level: "BALANCED",
      ozConsumedToday: 43.5,
      aforceUnitsToday: 2,
      unitsConsumedToday: 3,
      sodiumDeliveredMg: 50,
      reason: "Start with water — 20 oz now.",
      recoveryScore: 61,
      pressureScore: 40,
      recoveryTrend: "rising",
      recoveryFingerprint: "a1b2c3d4",
      recoveryStory: "Recovery window is open.",
    });
    expect(r.success).toBe(true);
  });

  it("rejects a fractional score with a `score` issue path (integer column)", () => {
    const r = snapshotSchema.safeParse({ ...emptyState, score: 72.4 });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues.map((i) => i.path.join("."))).toContain("score");
  });

  it("rejects an out-of-enum level with a `level` issue path", () => {
    const r = snapshotSchema.safeParse({ ...emptyState, level: "CRITICAL" });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues.map((i) => i.path.join("."))).toContain("level");
  });

  it("rejects a malformed recovery fingerprint (8-hex) when the recovery layer is sent", () => {
    const r = snapshotSchema.safeParse({ ...emptyState, recoveryFingerprint: "NOTHEX" });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues.map((i) => i.path.join("."))).toContain("recoveryFingerprint");
  });

  it("rejects a missing body (undefined) — the classic unparsed-request case", () => {
    const r = snapshotSchema.safeParse(undefined);
    expect(r.success).toBe(false);
  });
});
