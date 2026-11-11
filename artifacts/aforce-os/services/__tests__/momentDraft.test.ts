import { describe, it, expect } from "vitest";
import {
  createConfirmedMoment,
  validateMomentDraft,
  type MomentDraft,
} from "../momentDraft";
const draft: MomentDraft = {
  title: "Team dinner",
  date: "2026-10-30",
  time: "19:30",
  type: "personal",
  prepGoal: "Arrive relaxed",
};
const now = new Date(2026, 9, 28).getTime();
describe("explicit Moment confirmation", () => {
  it("rejects missing/ambiguous inputs instead of inventing a schedule", () => {
    for (const change of [
      { title: " " },
      { date: "" },
      { time: "" },
      { time: "7:30" },
      { date: "2026-02-30" },
      { time: "25:00" },
      { date: "2026-10-27" },
    ]) {
      expect(validateMomentDraft({ ...draft, ...change }, now).ok).toBe(false);
    }
  });
  it.each([
    ["America/New_York", "2027-01-08", "19:30", "2027-01-09T00:30:00.000Z"],
    ["America/Los_Angeles", "2027-01-08", "19:30", "2027-01-09T03:30:00.000Z"],
    ["Asia/Kolkata", "2027-01-08", "19:30", "2027-01-08T14:00:00.000Z"],
    ["UTC", "2027-01-08", "00:00", "2027-01-08T00:00:00.000Z"],
  ])(
    "converts an explicit %s wall time to its exact instant",
    (timeZone, date, time, startAtIso) => {
      expect(
        validateMomentDraft({ ...draft, date, time, timeZone }, now),
      ).toEqual({ ok: true, startAtIso });
    },
  );
  it("rejects invalid zones and nonexistent or repeated wall times in the selected zone", () => {
    for (const change of [
      { timeZone: "Invalid/Zone" },
      { timeZone: "America/New_York", date: "2027-03-14", time: "02:30" },
      { timeZone: "America/New_York", date: "2026-11-01", time: "01:30" },
      { timeZone: "Australia/Lord_Howe", date: "2027-04-04", time: "01:45" },
      { timeZone: "UTC", date: "2027-02-30" },
      { timeZone: "UTC", time: "25:00" },
    ])
      expect(validateMomentDraft({ ...draft, ...change }, now).ok).toBe(false);
  });
  it("uses the device local wall time and saves only explicit Moment fields", () => {
    const result = validateMomentDraft(draft, now);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const at = new Date(result.startAtIso);
    expect([
      at.getFullYear(),
      at.getMonth(),
      at.getDate(),
      at.getHours(),
      at.getMinutes(),
    ]).toEqual([2026, 9, 30, 19, 30]);
    const moment = createConfirmedMoment(draft, result.startAtIso);
    expect(moment).toMatchObject({
      source: "manual",
      title: draft.title,
      type: "personal",
      startAtIso: result.startAtIso,
      prepGoal: draft.prepGoal,
    });
    expect(moment).not.toHaveProperty("preparedAtIso");
  });
  it("refuses nonexistent and repeated daylight-saving times", () => {
    const previous = process.env.TZ;
    process.env.TZ = "America/New_York";
    try {
      expect(
        validateMomentDraft(
          { ...draft, date: "2027-03-14", time: "02:30" },
          now,
        ).ok,
      ).toBe(false);
      expect(
        validateMomentDraft(
          { ...draft, date: "2026-11-01", time: "01:30" },
          now,
        ).ok,
      ).toBe(false);
    } finally {
      process.env.TZ = previous;
    }
  });
});
