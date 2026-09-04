/**
 * THE DENSE CALENDAR BOUNDARY (founder ruling R2).
 *
 * THE OBSERVED DIVERGENCE. The same member, the same tap, produced a different
 * publicly-posted score on the two contracts: dense posted 92 / "Peak" while
 * sparse posted a lower average. It is not a scoring bug — it is a POPULATION
 * difference, and the ruling is explicit that the population is what gets
 * fixed, not the score.
 *
 * WHERE IT COMES FROM. The route's SQL cutoff is an INSTANT
 * (`since = now - days*24h`); the dense window is `days` CALENDAR days ending
 * today, floored by the member's `historyStartAt` and by the repository epoch.
 * Those never coincide: at any time of day past 00:00 UTC the fetch reaches a
 * calendar day further back than the window, and a member's own stamp can
 * exclude more still. So the aggregation is routinely handed rows the dense
 * window does not cover.
 *
 * WHAT WAS AND WAS NOT AT RISK. `densifyRollups` maps over the window's keys,
 * so an out-of-window DAY was already dropped — its score, min, max, streak
 * participation and share context never reached a dense client. Band time was
 * the exception: `attributeInterval` splits an interval at UTC midnight, so a
 * snapshot at 23:30 on the day BEFORE the window opened spilled its
 * carry-forward onto the window's FIRST day, handing a row with
 * `snapshotsCount: 0` a full-height `pctTime*` bar sourced from a measurement
 * the window excludes. No shipping consumer reads `pctTime*` today, so that
 * was latent rather than member-facing — which is exactly when it is cheapest
 * to fix, and exactly when a law is worth having.
 *
 * The fix filters the POPULATION to the window before aggregating, so every
 * field of every dense row derives only from in-window measurements by
 * construction rather than by a later step happening to discard the row.
 *
 * SPARSE IS FROZEN (ruling R3) and every assertion below re-checks that.
 */
import { describe, it, expect } from "vitest";
import { buildJournalRollupsResponse } from "../journalRollupsAggregation";
import { effectiveRangeKeys } from "../journalDenseRange";

const at = (s: string) => new Date(s);
/** 18:00 UTC — so the instant cutoff genuinely reaches a day the window does not. */
const NOW = at("2026-09-04T18:00:00.000Z");
const EPOCH_SAFE = at("2026-06-01T00:00:00.000Z");

const snap = (iso: string, o: Record<string, unknown> = {}) => ({
  capturedAt: at(iso), score: 92, level: "PEAK", ozConsumedToday: 60,
  aforceUnitsToday: 2, unitsConsumedToday: 5, sodiumDeliveredMg: 900,
  sodiumLostMg: 400, deficitPct: 12, autopilotActive: false, socialActive: false,
  hydroStateModelVersion: "hydrostate-v1.0", ...o,
});

const build = (
  snapshots: ReturnType<typeof snap>[],
  dense: boolean,
  historyStartAt: Date | null = EPOCH_SAFE,
  days = 7,
) => buildJournalRollupsResponse({
  snapshots: snapshots as never, intakes: [], correctionRows: [],
  historyStartAt, days, dense, now: NOW,
});

const observedOf = (r: { rollups: { snapshotsCount: number }[] }) =>
  r.rollups.filter((x) => x.snapshotsCount > 0);
const avgOf = (r: { rollups: { snapshotsCount: number; avgScore: number }[] }) => {
  const o = observedOf(r) as { avgScore: number }[];
  return o.length === 0 ? null : Math.round(o.reduce((a, x) => a + x.avgScore, 0) / o.length);
};
const peakOf = (r: { rollups: { snapshotsCount: number; maxScore: number }[] }) => {
  const o = observedOf(r) as { maxScore: number }[];
  return o.length === 0 ? null : Math.max(...o.map((x) => x.maxScore));
};

describe("R2 — the observed dense-vs-sparse score divergence, reproduced", () => {
  // days=7 at 18:00Z: SQL reaches back to Aug 28 18:00Z, but the dense window
  // is Aug 29..Sep 4. A snapshot at Aug 28 20:00Z is fetched and out of window.
  const OUT_OF_WINDOW = snap("2026-08-28T20:00:00.000Z", { score: 30, level: "DEPLETED" });
  const IN_WINDOW = [
    snap("2026-09-02T09:00:00.000Z"),
    snap("2026-09-03T09:00:00.000Z"),
    snap("2026-09-04T09:00:00.000Z"),
  ];
  const ALL = [OUT_OF_WINDOW, ...IN_WINDOW];

  it("ANTI-VACUITY: the fetch really does hand over an out-of-window row", () => {
    // If the fixture ever stopped straddling the boundary, every law below
    // would pass while testing nothing.
    const keys = effectiveRangeKeys({ now: NOW, days: 7, historyStartAt: EPOCH_SAFE });
    expect(keys).toHaveLength(7);
    expect(keys[0]).toBe("2026-08-29");
    expect(keys).not.toContain("2026-08-28");
    expect(build(ALL, false).rollups.some((r) => r.date === "2026-08-28")).toBe(true);
  });

  it("THE DIVERGENCE: sparse averages the out-of-window day, dense does not", () => {
    expect(avgOf(build(ALL, true))).toBe(92);
    expect(avgOf(build(ALL, false))).toBe(77); // (30 + 92 + 92 + 92) / 4
    // ...and the dense answer equals the same member WITHOUT that row at all,
    // which is the definition of "the window decided the population".
    expect(avgOf(build(ALL, true))).toBe(avgOf(build(IN_WINDOW, true)));
  });

  it("PEAK obeys the window too", () => {
    const low = [snap("2026-08-28T20:00:00.000Z", { score: 99, level: "PEAK" }), ...IN_WINDOW];
    expect(peakOf(build(low, true))).toBe(92);
    expect(peakOf(build(low, false))).toBe(99); // sparse keeps the outsider
  });

  it("no dense row falls outside the eligible window, for any of these shapes", () => {
    // The general invariant. Everything the ruling lists — AVG, PEAK, streak,
    // chart, share context — is derived by a consumer FROM this array, so a
    // window-clean array makes all five clean at once.
    const shapes: Array<[string, ReturnType<typeof snap>[], Date | null, number]> = [
      ["instant-vs-calendar edge", ALL, EPOCH_SAFE, 7],
      ["before historyStartAt", [snap("2026-09-01T09:00:00.000Z"), ...IN_WINDOW], at("2026-09-03T00:00:00.000Z"), 7],
      ["before the epoch", [snap("2026-04-01T09:00:00.000Z"), ...IN_WINDOW], null, 365],
      ["single day window", ALL, EPOCH_SAFE, 1],
    ];
    for (const [label, snaps, stamp, days] of shapes) {
      const keys = effectiveRangeKeys({ now: NOW, days, historyStartAt: stamp });
      const dense = build(snaps, true, stamp, days);
      expect(dense.rollups.map((r) => r.date), label).toEqual(keys);
      for (const row of dense.rollups) {
        expect(keys, `${label}: ${row.date} must be in the window`).toContain(row.date);
      }
    }
  });
});

describe("R2 — band time cannot cross INTO the window from outside it", () => {
  // 23:30 on the day BEFORE the window opens. Its 1h carry-forward splits at
  // UTC midnight, so 30 minutes land on Aug 29 — the window's first day.
  const SPILLER = snap("2026-08-28T23:30:00.000Z", { level: "DEPLETED" });
  const LATER = snap("2026-09-04T09:00:00.000Z");

  it("the window's first day carries no band time from an excluded measurement", () => {
    const first = build([SPILLER, LATER], true).rollups.find((r) => r.date === "2026-08-29")!;
    expect(first.snapshotsCount).toBe(0);
    expect(
      [first.pctTimePeak, first.pctTimeBalanced, first.pctTimeRecovering, first.pctTimeDepleted],
      "an unobserved day may not be painted by a measurement the window excludes",
    ).toEqual([0, 0, 0, 0]);
  });

  it("SPARSE still carries it — the legacy wire has no window and is frozen", () => {
    const rows = build([SPILLER, LATER], false).rollups;
    const spill = rows.find((r) => r.date === "2026-08-29")!;
    expect(spill.snapshotsCount).toBe(0);
    expect(spill.pctTimeDepleted, "sparse behaviour is unchanged").toBe(100);
    expect(rows.some((r) => r.date === "2026-08-28"), "and it keeps the source row").toBe(true);
  });

  it("ANTI-VACUITY: an IN-WINDOW 23:30 snapshot still spills to the next day", () => {
    // The fix must exclude only measurements the window excludes. Killing
    // legitimate carry-forward would be a different defect wearing the same fix.
    const inside = build(
      [snap("2026-09-01T23:30:00.000Z", { level: "DEPLETED" }), LATER], true,
    ).rollups.find((r) => r.date === "2026-09-02")!;
    expect(inside.snapshotsCount).toBe(0);
    expect(inside.pctTimeDepleted, "carry-forward inside the window survives").toBe(100);
  });
});

describe("R2 — the sparse contract is untouched by any of it", () => {
  it("sparse still returns every fetched day, in date order, with no window", () => {
    const snaps = [
      snap("2026-04-01T09:00:00.000Z", { score: 10 }),   // before the epoch
      snap("2026-08-28T20:00:00.000Z", { score: 30 }),   // outside the calendar window
      snap("2026-09-04T09:00:00.000Z", { score: 92 }),
    ];
    expect(build(snaps, false, null, 365).rollups.map((r) => r.date))
      .toEqual(["2026-04-01", "2026-08-28", "2026-09-04"]);
  });
});
