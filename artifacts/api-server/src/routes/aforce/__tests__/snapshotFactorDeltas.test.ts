/**
 * factor_deltas wire contract — bounded, numeric, optional.
 *
 * The column is additive instrumentation (founder-approved 2026-08-18;
 * governance/SCORE-SNAPSHOT-INSTRUMENTATION-PROPOSAL.md). The server is
 * content-agnostic about WHICH factors exist — the client's canonical breakdown
 * owns that — but the field is bounded hard so it cannot become a free-form
 * dumping ground: short keys, finite numeric values, a key-count cap, and it
 * stays optional so pre-instrumentation clients keep writing snapshots
 * unchanged.
 */
import { describe, it, expect } from "vitest";

import { snapshotSchema } from "../journalSchema";

const BASE = {
  score: 57,
  level: "DEPLETED",
  ozConsumedToday: 120,
  aforceUnitsToday: 0,
  unitsConsumedToday: 5,
  sodiumDeliveredMg: 0,
  sodiumLostMg: 0,
  deficitPct: 0,
  clutchActive: false,
  socialActive: false,
  autopilotActive: false,
  reason: "engine refresh",
};

const VECTOR = {
  base: 31.2,
  aforce_bonus: 0,
  recency: -12.4,
  confirmation: 0,
  consistency: 6,
  context: -4,
  recovery: 9.75,
  symptom: -22,
  urine: -8,
  output: -3,
  sleep: 0,
  health_signals: 0,
  social_intake: 0,
  raw: -2.45,
  clamped: 0,
};

describe("snapshot factorDeltas contract", () => {
  it("accepts the real vector shape", () => {
    const r = snapshotSchema.safeParse({ ...BASE, factorDeltas: VECTOR });
    expect(r.success, JSON.stringify(!r.success && r.error.issues)).toBe(true);
    if (r.success) expect(r.data.factorDeltas).toEqual(VECTOR);
  });

  it("stays optional — a pre-instrumentation payload still parses", () => {
    // Older clients (Builds <= 67) never send the field; their snapshots must
    // keep landing or instrumenting would silently break the journal.
    const r = snapshotSchema.safeParse(BASE);
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.factorDeltas).toBeUndefined();
  });

  it("rejects non-finite values", () => {
    for (const bad of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
      const r = snapshotSchema.safeParse({ ...BASE, factorDeltas: { urine: bad } });
      expect(r.success, `must reject ${bad}`).toBe(false);
    }
  });

  it("rejects string values — the field can never carry text or PII", () => {
    const r = snapshotSchema.safeParse({
      ...BASE,
      factorDeltas: { urine: "user_3FjQDHNJakRe4CfDPvmSgNw4piC" },
    });
    expect(r.success).toBe(false);
  });

  it("rejects nested objects", () => {
    const r = snapshotSchema.safeParse({
      ...BASE,
      factorDeltas: { urine: { label: "Hydration signal (1-8)", delta: -8 } },
    });
    expect(r.success).toBe(false);
  });

  it("rejects more than 24 keys", () => {
    const big: Record<string, number> = {};
    for (let i = 0; i < 25; i++) big[`k${i}`] = i;
    const r = snapshotSchema.safeParse({ ...BASE, factorDeltas: big });
    expect(r.success).toBe(false);
  });

  it("rejects keys longer than 32 characters", () => {
    const r = snapshotSchema.safeParse({
      ...BASE,
      factorDeltas: { ["x".repeat(33)]: 1 },
    });
    expect(r.success).toBe(false);
  });
});
