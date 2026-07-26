import { describe, it, expect } from "vitest";
import {
  resolveScoreProtectionMode,
  evaluateScoreWrite,
  decideScoreWrite,
  SCORE_WRITE_GUARD,
} from "../scoreWriteGuard";

const prior = (score: number) => ({ score, capturedAt: new Date("2026-07-26T00:00:00Z") });
const noEvidence = { confirmations: 0, intakeLogs: 0 };

describe("resolveScoreProtectionMode", () => {
  it("honours an explicit valid mode regardless of NODE_ENV", () => {
    expect(resolveScoreProtectionMode({ SCORE_PROTECTION_MODE: "enforce", NODE_ENV: "production" })).toBe("enforce");
    expect(resolveScoreProtectionMode({ SCORE_PROTECTION_MODE: "OFF" })).toBe("off");
    expect(resolveScoreProtectionMode({ SCORE_PROTECTION_MODE: " shadow " })).toBe("shadow");
  });

  it("defaults to off in production, shadow elsewhere", () => {
    expect(resolveScoreProtectionMode({ NODE_ENV: "production" })).toBe("off");
    expect(resolveScoreProtectionMode({ NODE_ENV: "development" })).toBe("shadow");
    expect(resolveScoreProtectionMode({})).toBe("shadow");
  });

  it("falls back to the default on an unrecognised value", () => {
    expect(resolveScoreProtectionMode({ SCORE_PROTECTION_MODE: "loud", NODE_ENV: "production" })).toBe("off");
  });
});

describe("evaluateScoreWrite", () => {
  it("passes the first-ever snapshot (no prior baseline to protect)", () => {
    const v = evaluateScoreWrite({ proposed: { score: 88 }, prior: null, evidence: noEvidence });
    expect(v.ok).toBe(true);
    expect(v.delta).toBeNull();
  });

  it("passes movement within the unexplained-delta drift band with no evidence", () => {
    const v = evaluateScoreWrite({
      proposed: { score: 70 + SCORE_WRITE_GUARD.UNEXPLAINED_DELTA },
      prior: prior(70),
      evidence: noEvidence,
    });
    expect(v.ok).toBe(true);
    expect(v.violations).toHaveLength(0);
  });

  it("flags large movement with ZERO verified behavior as unexplained", () => {
    const v = evaluateScoreWrite({ proposed: { score: 95 }, prior: prior(50), evidence: noEvidence });
    expect(v.ok).toBe(false);
    expect(v.delta).toBe(45);
    expect(v.violations[0]).toMatchObject({ code: "unexplained_movement", evidenceCount: 0 });
  });

  it("allows the same large movement once a verified record exists", () => {
    const v = evaluateScoreWrite({
      proposed: { score: 95 },
      prior: prior(50),
      evidence: { confirmations: 1, intakeLogs: 0 },
    });
    expect(v.ok).toBe(true);
    expect(v.evidenceCount).toBe(1);
  });

  it("counts intake logs as evidence too", () => {
    const v = evaluateScoreWrite({
      proposed: { score: 20 },
      prior: prior(80),
      evidence: { confirmations: 0, intakeLogs: 2 },
    });
    expect(v.ok).toBe(true);
  });

  it("treats a downward unexplained drop the same as an upward one", () => {
    const v = evaluateScoreWrite({ proposed: { score: 30 }, prior: prior(90), evidence: noEvidence });
    expect(v.ok).toBe(false);
    expect(v.delta).toBe(-60);
  });
});

describe("decideScoreWrite", () => {
  const failing = evaluateScoreWrite({ proposed: { score: 95 }, prior: prior(50), evidence: noEvidence });
  const passing = evaluateScoreWrite({ proposed: { score: 55 }, prior: prior(50), evidence: noEvidence });

  it("shadow never blocks, even on a violation", () => {
    expect(decideScoreWrite("shadow", failing).blocked).toBe(false);
  });

  it("enforce blocks a violation but not a clean verdict", () => {
    expect(decideScoreWrite("enforce", failing).blocked).toBe(true);
    expect(decideScoreWrite("enforce", passing).blocked).toBe(false);
  });

  it("off never blocks", () => {
    expect(decideScoreWrite("off", failing).blocked).toBe(false);
  });
});
