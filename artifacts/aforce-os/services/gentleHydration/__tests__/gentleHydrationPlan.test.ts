import { describe, expect, it } from "vitest";
import {
  createGentleHydrationPlan,
  localDayKey,
} from "../../gentleHydrationPlan";

const now = new Date("2026-11-05T14:00:00.000Z");

describe("Gentle Hydration daily plan", () => {
  it("uses the existing plan only and never creates a fluid prescription", () => {
    const plan = createGentleHydrationPlan({
      cadence: "gentle",
      ozConsumedToday: 12,
      ozTarget: 80,
      now,
    });
    expect(plan).toMatchObject({
      checkIns: 5,
      nextMove: "log",
      headline: "One small check-in at a time.",
    });
    expect(JSON.stringify(plan)).not.toMatch(/oz|ml|prescrib|dose/i);
  });

  it("supports a no-penalty defer and a private pause for the calendar day", () => {
    expect(
      createGentleHydrationPlan({
        cadence: "steady",
        ozConsumedToday: 0,
        ozTarget: 80,
        deferredUntil: "2026-11-05T14:30:00.000Z",
        now,
      }).nextMove,
    ).toBe("wait");
    expect(
      createGentleHydrationPlan({
        cadence: "minimal",
        ozConsumedToday: 0,
        ozTarget: 80,
        pausedOnDayKey: localDayKey(now),
        now,
      }).nextMove,
    ).toBe("rest");
  });

  it("does not keep a pause after the day ends", () => {
    expect(
      createGentleHydrationPlan({
        cadence: "gentle",
        ozConsumedToday: 0,
        ozTarget: 80,
        pausedOnDayKey: "2026-11-04",
        now,
      }).nextMove,
    ).toBe("log");
  });
});
