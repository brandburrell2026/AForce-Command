import { describe, it, expect } from "vitest";

import {
  buildRetentionGates,
  RetentionGatesSchema,
  RETENTION_GATE_DEFS,
  type RetentionGatesRaw,
} from "../retentionGates";

const EMPTY: RetentionGatesRaw = {
  appOpenEntered: 0,
  appOpenConverted: 0,
  profileToCmdEntered: 0,
  profileToCmdMedianSeconds: null,
  d7Cohort: 0,
  d7Retained: 0,
  d30Cohort: 0,
  d30Retained: 0,
  qrEntered: 0,
  qrConverted: 0,
};

const ISO = "2026-06-20T00:00:00.000Z";

function gates(raw: Partial<RetentionGatesRaw>) {
  const dto = buildRetentionGates({ ...EMPTY, ...raw }, ISO);
  return Object.fromEntries(dto.gates.map((g) => [g.id, g]));
}

describe("buildRetentionGates — structure", () => {
  it("returns the five owner gates in order with the right targets", () => {
    const dto = buildRetentionGates(EMPTY, ISO);
    expect(dto.generatedAt).toBe(ISO);
    expect(dto.gates.map((g) => g.id)).toEqual([
      "appOpenToProfile",
      "profileToFirstCommand",
      "d1ToD7",
      "d7ToD30",
      "qrToActivated",
    ]);
    expect(dto.gates.map((g) => g.target.display)).toEqual([
      "80%+",
      "Under 60s",
      "40%+",
      "25%+",
      "50%+",
    ]);
    // The DTO validates against the route's zod schema.
    expect(() => RetentionGatesSchema.parse(dto)).not.toThrow();
  });

  it("keeps the static defs and the DTO gate count in lockstep", () => {
    const dto = buildRetentionGates(EMPTY, ISO);
    expect(dto.gates).toHaveLength(RETENTION_GATE_DEFS.length);
  });
});

describe("buildRetentionGates — awaiting (Score-Protection: never fabricate)", () => {
  it("marks every gate awaiting with null measured when there is no data", () => {
    const dto = buildRetentionGates(EMPTY, ISO);
    for (const g of dto.gates) {
      expect(g.status).toBe("awaiting");
      expect(g.measured).toBeNull();
      expect(g.sampleSize).toBe(0);
    }
  });

  it("a zero-entered rate gate is awaiting, NOT a fabricated 0%", () => {
    const g = gates({ appOpenEntered: 0, appOpenConverted: 0 }).appOpenToProfile;
    expect(g.status).toBe("awaiting");
    expect(g.measured).toBeNull();
  });

  it("the duration gate is awaiting when entered but the median is null", () => {
    const g = gates({
      profileToCmdEntered: 5,
      profileToCmdMedianSeconds: null,
    }).profileToFirstCommand;
    expect(g.status).toBe("awaiting");
    expect(g.measured).toBeNull();
  });
});

describe("buildRetentionGates — rate gates", () => {
  it("passes when the rate meets the target (>=)", () => {
    const g = gates({ appOpenEntered: 100, appOpenConverted: 85 }).appOpenToProfile;
    expect(g.measured).toBeCloseTo(0.85);
    expect(g.status).toBe("passing");
    expect(g.converted).toBe(85);
  });

  it("fails when the rate is below the target", () => {
    const g = gates({ qrEntered: 100, qrConverted: 30 }).qrToActivated;
    expect(g.measured).toBeCloseTo(0.3);
    expect(g.status).toBe("failing");
  });

  it("treats exactly-on-target as passing (boundary, gte)", () => {
    const g = gates({ d7Cohort: 10, d7Retained: 4 }).d1ToD7; // 40% target
    expect(g.measured).toBeCloseTo(0.4);
    expect(g.status).toBe("passing");
  });

  it("clamps converted that exceeds entered (defensive)", () => {
    const g = gates({ d30Cohort: 10, d30Retained: 999 }).d7ToD30;
    expect(g.converted).toBe(10);
    expect(g.measured).toBe(1);
    expect(g.status).toBe("passing");
  });
});

describe("buildRetentionGates — duration gate", () => {
  it("passes when the median is under 60s (boundary lte counts 60)", () => {
    const fast = gates({
      profileToCmdEntered: 8,
      profileToCmdMedianSeconds: 42,
    }).profileToFirstCommand;
    expect(fast.status).toBe("passing");
    expect(fast.measured).toBe(42);

    const onBoundary = gates({
      profileToCmdEntered: 8,
      profileToCmdMedianSeconds: 60,
    }).profileToFirstCommand;
    expect(onBoundary.status).toBe("passing");
  });

  it("fails when the median is over 60s", () => {
    const g = gates({
      profileToCmdEntered: 8,
      profileToCmdMedianSeconds: 95,
    }).profileToFirstCommand;
    expect(g.status).toBe("failing");
    expect(g.converted).toBeNull();
  });
});
