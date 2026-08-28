/**
 * Server-seed honesty lock (PR-2, founder-authorized).
 *
 * `defaultSeed()` writes the FIRST row for every new account. It
 * previously mirrored the client's DEMO-tuned day (5 units / 45 oz /
 * streak 5 — "keeps the seeded engine score at a BALANCED 76"), which
 * meant every fresh production account was born with a fabricated day
 * that the client then adopted wholesale on first fetch — defeating any
 * client-side seed honesty. This pins the honest empty row.
 *
 * Pure test: defaultSeed builds a value; no DB required.
 */
import { describe, expect, it } from "vitest";
import { defaultSeed } from "../aforceState";

describe("defaultSeed — a new account's first row is the honest empty day", () => {
  const seed = defaultSeed();

  it("claims nothing that did not happen", () => {
    expect(seed.unitsConsumedToday).toBe(0);
    expect(seed.ozConsumedToday).toBe(0);
    expect(seed.aforceUnitsToday).toBe(0);
    expect(seed.complianceStreak).toBe(0);
    expect(seed.overnightLossOz).toBe(0);
    expect(seed.hasSeenMorningCommand).toBe(false);
    expect(seed.symptoms).toEqual([]);
    expect(seed.symptomState).toBe("none");
    expect(seed.urineSignal).toBe(3); // true neutral (2 read as "optimal")
    expect(seed.lastIntakeType).toBe("water");
    expect(seed.wakeTime).toBeNull();
    expect(seed.intakeEvents).toEqual([]);
    expect(seed.socialMode).toBeNull();
    expect(seed.biometrics).toBeNull();
  });

  it("matches the client's fresh-account normalize defaults (drives 4/3/5, targets 8/96)", () => {
    expect(seed.heatLoad).toBe(4);
    expect(seed.sweatRate).toBe(3);
    expect(seed.activityLevel).toBe(5);
    expect(seed.dailyTarget).toBe(8);
    expect(seed.ozTarget).toBe(96);
  });

  it("honors the recorded non-nullable constraints (documented residuals)", () => {
    // W3-PR10: lastIntakeTime non-nullable through the engine — "now",
    // never a tuned "12 minutes ago" and never an epoch sentinel.
    expect(seed.lastIntakeTime).toBeInstanceOf(Date);
    expect(Math.abs(Date.now() - (seed.lastIntakeTime as Date).getTime())).toBeLessThan(60_000);
    // The recorded 180 default (client normalizeUserState ?? 180).
    expect(seed.bodyWeightLbs).toBe(180);
  });
});
