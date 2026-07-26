import { describe, it, expect } from "vitest";
import { planIntakeCorrection, CORRECTION_LIVE_WINDOW_MS } from "../intakeCorrection";

const NOW = 1_800_000_000_000;
const log = (over: Partial<Parameters<typeof planIntakeCorrection>[0]["log"] & object> = {}) => ({
  id: 1,
  userId: "u1",
  fluidType: "water",
  ozAmount: 12,
  clientEventId: "evt-1",
  correctsIntakeId: null,
  loggedAt: new Date(NOW - 60_000),
  ...over,
});

const base = { requestUserId: "u1", alreadyCorrected: false, isAforceFluid: false, nowMs: NOW };

describe("planIntakeCorrection (§10 / RC-L12)", () => {
  it("allows a fresh correction and reverses today's counters", () => {
    const plan = planIntakeCorrection({ ...base, log: log() });
    expect(plan).toMatchObject({ ok: true, reverseCounters: true, removeEventId: "evt-1", ozToReverse: 12 });
  });

  it("rejects: missing, foreign, correction-of-correction, double-correction", () => {
    expect(planIntakeCorrection({ ...base, log: null })).toEqual({ ok: false, reason: "not_found" });
    expect(planIntakeCorrection({ ...base, log: log({ userId: "other" }) })).toEqual({ ok: false, reason: "not_owner" });
    expect(planIntakeCorrection({ ...base, log: log({ correctsIntakeId: 9 }) })).toEqual({ ok: false, reason: "is_a_correction" });
    expect(planIntakeCorrection({ ...base, alreadyCorrected: true, log: log() })).toEqual({ ok: false, reason: "already_corrected" });
  });

  it("outside the 24h live window: correction records but counters stand", () => {
    const old = log({ loggedAt: new Date(NOW - CORRECTION_LIVE_WINDOW_MS - 1) });
    const plan = planIntakeCorrection({ ...base, log: old });
    expect(plan).toMatchObject({ ok: true, reverseCounters: false });
  });

  it("legacy keyless row: counters reverse, no event linkage (documented residual)", () => {
    const plan = planIntakeCorrection({ ...base, log: log({ clientEventId: null }) });
    expect(plan).toMatchObject({ ok: true, reverseCounters: true, removeEventId: null });
  });

  it("aforce fluid flags the aforce counter for reversal", () => {
    const plan = planIntakeCorrection({ ...base, isAforceFluid: true, log: log({ fluidType: "aforce_rtd" }) });
    expect(plan).toMatchObject({ ok: true, isAforce: true });
  });
});
