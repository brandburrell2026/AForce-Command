/**
 * THE EFFECTIVE HYDROSTATE WINDOW — the canonical dense-rollup contract,
 * server-side (consumer-completeness PR, 2026-09-03).
 *
 * This is now the ONE implementation backing `GET /aforce/journal/rollups`
 * for every consumer, not a share-card-only seam — so it carries the same
 * rigor the client-only prototype had, plus the epoch/immutability laws that
 * moved here with it.
 */
import { describe, it, expect } from "vitest";
import { effectiveRangeKeys, dayKey, densifyRollups, emptyDay } from "../journalDenseRange";
import {
  HYDROSTATE_HISTORY_EPOCH,
  canonicalHistoryStart,
  hydroStateHistoryEpochDate,
} from "../hydroStateHistoryEpoch";

const NOW = new Date("2026-09-02T14:30:00.000Z");
const at = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

describe("HYDROSTATE_HISTORY_EPOCH", () => {
  it("is the ruled date — the day the product could first persist an observation", () => {
    expect(HYDROSTATE_HISTORY_EPOCH).toBe("2026-04-29");
    expect(dayKey(hydroStateHistoryEpochDate())).toBe("2026-04-29");
  });

  it("an UNSTAMPED member falls back to the epoch — never to now()", () => {
    expect(canonicalHistoryStart(null)).toEqual(hydroStateHistoryEpochDate());
    expect(canonicalHistoryStart(undefined)).toEqual(hydroStateHistoryEpochDate());
  });

  it("a STAMPED member uses their own start; an impossible stamp cannot win", () => {
    expect(canonicalHistoryStart(at("2026-08-22"))).toEqual(at("2026-08-22"));
    expect(canonicalHistoryStart(at("2020-01-01"))).toEqual(hydroStateHistoryEpochDate());
  });
});

describe("effective window — requested vs eligible vs observed", () => {
  it("a 30+ day member gets the full requested denominator of 30", () => {
    const keys = effectiveRangeKeys({ now: NOW, days: 30, historyStartAt: at("2026-06-01") });
    expect(keys.length).toBe(30);
    expect(keys[0]).toBe("2026-08-04");
    expect(keys[keys.length - 1]).toBe("2026-09-02");
  });

  it("a STAMPED 12-day-old member in a 30-day window gets a denominator of 12", () => {
    const keys = effectiveRangeKeys({ now: NOW, days: 30, historyStartAt: at("2026-08-22") });
    expect(keys.length).toBe(12);
    expect(keys[0]).toBe("2026-08-22");
  });

  it("an UNSTAMPED legacy member keeps the full requested range", () => {
    const keys = effectiveRangeKeys({ now: NOW, days: 30, historyStartAt: null });
    expect(keys.length).toBe(30);
    expect(keys[0]).toBe("2026-08-04");
  });

  it("the window is CONTIGUOUS, ascending, and exactly the requested length", () => {
    // 365 is deliberately excluded: at this fixture's NOW (2026-09-02), 365
    // days back crosses the 2026-04-29 epoch, so that case necessarily
    // narrows — it is exercised separately below, where the narrowing is the
    // point rather than a confound of this plain contiguity/length check.
    for (const days of [1, 7, 30, 90]) {
      const keys = effectiveRangeKeys({ now: NOW, days, historyStartAt: null });
      expect(keys.length, `${days}-day window`).toBe(days);
      for (let i = 1; i < keys.length; i++) {
        const prev = new Date(`${keys[i - 1]}T00:00:00.000Z`).getTime();
        const cur = new Date(`${keys[i]}T00:00:00.000Z`).getTime();
        expect(cur - prev, `${days}: consecutive`).toBe(86_400_000);
      }
      expect(new Set(keys).size, `${days}: no duplicates`).toBe(keys.length);
      expect(keys[keys.length - 1], `${days}: ends today`).toBe("2026-09-02");
    }
  });

  it("the eligible floor NARROWS and never widens", () => {
    for (const stamp of ["2026-04-01", "2026-04-29", "2026-08-04", "2026-08-25", "2026-09-02"]) {
      const keys = effectiveRangeKeys({ now: NOW, days: 30, historyStartAt: at(stamp) });
      expect(keys.length, `stamp ${stamp}`).toBeLessThanOrEqual(30);
      expect(keys[0], `stamp ${stamp}`).toBe(stamp > "2026-08-04" ? stamp : "2026-08-04");
    }
  });

  it("a member seeded TODAY gets one day; a start in the FUTURE gets none", () => {
    expect(effectiveRangeKeys({ now: NOW, days: 30, historyStartAt: NOW })).toEqual(["2026-09-02"]);
    expect(effectiveRangeKeys({ now: NOW, days: 30, historyStartAt: at("2026-09-20") })).toEqual([]);
  });

  it("the stamp is a DATE, not a day count — midnight and 23:59 are one day", () => {
    const midnight = effectiveRangeKeys({ now: NOW, days: 30, historyStartAt: at("2026-08-30") });
    const evening = effectiveRangeKeys({
      now: NOW, days: 30, historyStartAt: new Date("2026-08-30T23:59:59.999Z") });
    expect(evening).toEqual(midnight);
    expect(midnight.length).toBe(4);
  });

  it("UTC day boundaries throughout, and month/year rollover is exact", () => {
    expect(dayKey(new Date("2026-09-02T00:00:00.000Z"))).toBe("2026-09-02");
    expect(dayKey(new Date("2026-09-02T23:59:59.999Z"))).toBe("2026-09-02");
    const keys = effectiveRangeKeys({
      now: new Date("2027-01-03T10:00:00.000Z"), days: 10, historyStartAt: at("2026-06-01") });
    expect(keys).toEqual([
      "2026-12-25", "2026-12-26", "2026-12-27", "2026-12-28", "2026-12-29",
      "2026-12-30", "2026-12-31", "2027-01-01", "2027-01-02", "2027-01-03",
    ]);
  });

  it("a leap day is one day, not zero and not two", () => {
    const keys = effectiveRangeKeys({
      now: new Date("2028-03-01T12:00:00.000Z"), days: 3, historyStartAt: at("2026-06-01") });
    expect(keys).toEqual(["2028-02-28", "2028-02-29", "2028-03-01"]);
  });

  it("the zod bounds (days: 1 and 365) both produce a well-formed window", () => {
    expect(effectiveRangeKeys({ now: NOW, days: 1, historyStartAt: null })).toEqual(["2026-09-02"]);
    // At a LATER `now`, once the product itself is older than 365 days, a
    // long-tenured member gets the full requested range.
    const laterNow = new Date("2027-06-01T12:00:00.000Z");
    expect(effectiveRangeKeys({ now: laterNow, days: 365, historyStartAt: at("2020-01-01") }).length).toBe(365);
    // At THIS fixture's NOW, the product is only 127 days old, so the epoch
    // correctly narrows a 365-day request rather than fabricating days before
    // any HydroState observation could exist, even at the outer zod bound.
    const epochBound = effectiveRangeKeys({ now: NOW, days: 365, historyStartAt: null });
    expect(epochBound.length).toBe(127);
    expect(epochBound[0]).toBe("2026-04-29");
  });
});

describe("densifyRollups — the array IS the window", () => {
  const measured = (date: string, score: number) => ({
    ...emptyDay(date), snapshotsCount: 4, avgScore: score, minScore: score,
    maxScore: score, intakeCount: 3, modelVersions: ["hydrostate-v1.0"],
  });

  it("a synthetic gap day fabricates NOTHING", () => {
    const d = emptyDay("2026-08-15");
    expect(d.snapshotsCount).toBe(0);
    expect(d.intakeCount).toBe(0);
    expect(d.modelVersions).toEqual([]);
    expect(d.endOzConsumed).toBe(0);
    expect(d.pctTimePeak + d.pctTimeBalanced + d.pctTimeRecovering + d.pctTimeDepleted).toBe(0);
    expect(d.avgScore).toBe(0);
  });

  it("the six wire states stay distinguishable after densification", () => {
    const states = {
      noRow: emptyDay("2026-08-01"),
      intakeNoSnapshot: { ...emptyDay("2026-08-02"), intakeCount: 3, endOzConsumed: 36 },
      measuredRow: measured("2026-08-03", 90),
      measuredZero: measured("2026-08-04", 0),
      provenanceUnknown: { ...measured("2026-08-05", 90), modelVersions: [] },
      provenanceIncompatible: {
        ...measured("2026-08-06", 90),
        modelVersions: ["hydrostate-v0", "hydrostate-v1.0"],
      },
    };
    const sig = (r: ReturnType<typeof emptyDay>) =>
      `${r.snapshotsCount > 0}|${r.intakeCount > 0}|${r.avgScore}|${r.modelVersions.join(",")}`;
    expect(new Set(Object.values(states).map(sig)).size, "six states, six signatures").toBe(6);
    expect(sig(states.noRow)).not.toBe(sig(states.measuredZero));
  });

  it("fills every missing day and drops everything outside the window", () => {
    const keys = ["2026-08-02", "2026-08-03", "2026-08-04"];
    const map = new Map([
      ["2026-08-01", measured("2026-08-01", 88)],   // BEFORE the window
      ["2026-08-03", measured("2026-08-03", 90)],
      ["2026-08-09", measured("2026-08-09", 91)],   // AFTER the window
    ]);
    const out = densifyRollups(map, keys);
    expect(out.map((r) => r.date)).toEqual(keys);
    expect(out[0]!.snapshotsCount, "filled").toBe(0);
    expect(out[1]!.avgScore, "measured survives").toBe(90);
    expect(out[2]!.snapshotsCount, "filled").toBe(0);
  });

  it("the output is exactly the window — never longer, never shorter", () => {
    for (const days of [1, 7, 30, 90]) {
      const keys = effectiveRangeKeys({ now: NOW, days, historyStartAt: null });
      expect(densifyRollups(new Map(), keys).length, `${days}-day window`).toBe(days);
    }
    expect(densifyRollups(new Map(), [])).toEqual([]);
  });
});
