/**
 * `buildJournalRollupsResponse` — the real `/journal/rollups` aggregation
 * pipeline, EXECUTED (not a DB-gated integration test, not a source scan).
 *
 * This is the extraction that makes the route-wiring law honest: the route
 * handler's only remaining job is fetch → call this → `res.json(...)`, so
 * these tests exercise the exact logic the route runs — the day-bucketing,
 * band-time attribution, correction accounting, and dense-window
 * densification — with realistic DB-shaped row fixtures.
 */
import { describe, it, expect } from "vitest";
import { buildJournalRollupsResponse, type RollupSnapshotRow, type RollupIntakeRow } from "../journalRollupsAggregation";

const NOW = new Date("2026-09-02T14:30:00.000Z");
const at = (iso: string) => new Date(iso);

function snap(over: Partial<RollupSnapshotRow> = {}): RollupSnapshotRow {
  return {
    capturedAt: at("2026-09-02T09:00:00.000Z"),
    score: 80,
    level: "BALANCED",
    ozConsumedToday: 60,
    aforceUnitsToday: 2,
    unitsConsumedToday: 5,
    sodiumDeliveredMg: 900,
    sodiumLostMg: 400,
    deficitPct: 12,
    autopilotActive: false,
    socialActive: false,
    hydroStateModelVersion: "hydrostate-v1.0",
    ...over,
  };
}

function intake(over: Partial<RollupIntakeRow> = {}): RollupIntakeRow {
  return { id: 1, loggedAt: at("2026-09-02T09:00:00.000Z"), ...over };
}

describe("buildJournalRollupsResponse — the dense contract, executed for real", () => {
  it("a fully-stamped week with no gaps: one row per day, all measured", () => {
    // Real calendar days, spelled out explicitly to avoid month-boundary
    // arithmetic bugs in the fixture itself (the exact class of
    // test-authoring error this program has been bitten by before).
    const days7 = ["2026-08-27", "2026-08-28", "2026-08-29", "2026-08-30", "2026-08-31", "2026-09-01", "2026-09-02"];
    const realSnapshots = days7.map((d) => snap({ capturedAt: at(`${d}T09:00:00.000Z`) }));
    const result = buildJournalRollupsResponse({
      snapshots: realSnapshots, intakes: [], correctionRows: [],
      historyStartAt: at("2026-06-01T00:00:00.000Z"), days: 7, now: NOW,
    });
    expect(result.days).toBe(7);
    expect(result.rollups.map((r) => r.date)).toEqual(days7);
    expect(result.rollups.every((r) => r.snapshotsCount === 1)).toBe(true);
    expect(result.rollups.every((r) => r.avgScore === 80)).toBe(true);
  });

  it("a day the member skipped entirely is an honest empty day, never fabricated", () => {
    const days7 = ["2026-08-27", "2026-08-28", "2026-08-29", "2026-08-30", "2026-08-31", "2026-09-01", "2026-09-02"];
    const realSnapshots = days7
      .filter((d) => d !== "2026-08-30")
      .map((d) => snap({ capturedAt: at(`${d}T09:00:00.000Z`) }));
    const result = buildJournalRollupsResponse({
      snapshots: realSnapshots, intakes: [], correctionRows: [],
      historyStartAt: at("2026-06-01T00:00:00.000Z"), days: 7, now: NOW,
    });
    expect(result.rollups.map((r) => r.date)).toEqual(days7);
    const gap = result.rollups.find((r) => r.date === "2026-08-30")!;
    expect(gap.snapshotsCount).toBe(0);
    expect(gap.avgScore).toBe(0);
    expect(gap.intakeCount).toBe(0);
    expect(gap.modelVersions).toEqual([]);
    // THE ±INFINITY SEEDS MUST NOT REACH THE WIRE. `minScore`/`maxScore` are
    // seeded POSITIVE_INFINITY / NEGATIVE_INFINITY and only overwritten by a
    // real snapshot, so an unobserved day is the ONLY row where the guard that
    // replaces them with 0 actually does anything. The existing finiteness law
    // asserted this on a day WITH snapshots, where the seeds are overwritten
    // regardless and the guard could be deleted with the suite still green —
    // JSON would then ship `null` for a member's min and max.
    expect(gap.minScore).toBe(0);
    expect(gap.maxScore).toBe(0);
    expect(Number.isFinite(gap.minScore)).toBe(true);
    expect(Number.isFinite(gap.maxScore)).toBe(true);
  });

  it("intake with no snapshot: real activity, sentinel score — same day, both facts survive", () => {
    const result = buildJournalRollupsResponse({
      snapshots: [], intakes: [intake({ loggedAt: at("2026-09-02T10:00:00.000Z") })], correctionRows: [],
      historyStartAt: at("2026-09-01T00:00:00.000Z"), days: 2, now: NOW,
    });
    const day = result.rollups.find((r) => r.date === "2026-09-02")!;
    expect(day.snapshotsCount).toBe(0);
    expect(day.intakeCount).toBe(1);
    expect(day.avgScore).toBe(0); // the sentinel — snapshotsCount is what says it's not real
    // THE ±INFINITY SEEDS MUST NOT REACH THE WIRE, and THIS is the row where
    // that guard is load-bearing. A day the member skipped ENTIRELY never
    // enters the accumulator at all — it is materialised by `emptyDay()`,
    // which writes 0 directly — so asserting there exercises nothing. Only an
    // INTAKE-WITHOUT-SNAPSHOT day builds an accumulator entry whose
    // `minScore`/`maxScore` are still the POSITIVE_INFINITY / NEGATIVE_INFINITY
    // seeds, because no snapshot ever ran `Math.min`/`Math.max` over them.
    // Without the guard, JSON ships `null` for this member's min and max.
    expect(day.minScore).toBe(0);
    expect(day.maxScore).toBe(0);
    expect(Number.isFinite(day.minScore)).toBe(true);
    expect(Number.isFinite(day.maxScore)).toBe(true);
  });

  it("a corrected intake does not count — undo leaves the day's count honest", () => {
    const result = buildJournalRollupsResponse({
      snapshots: [],
      intakes: [
        intake({ id: 1, loggedAt: at("2026-09-02T09:00:00.000Z") }),
        intake({ id: 2, loggedAt: at("2026-09-02T10:00:00.000Z") }),
      ],
      correctionRows: [{ corrected: 1 }],
      historyStartAt: at("2026-09-01T00:00:00.000Z"), days: 2, now: NOW,
    });
    const day = result.rollups.find((r) => r.date === "2026-09-02")!;
    expect(day.intakeCount).toBe(1); // id 1 was corrected away; id 2 counts
  });

  it("a STAMPED 12-day-old member in a 30-day request gets a 12-row window", () => {
    const result = buildJournalRollupsResponse({
      snapshots: [snap({ capturedAt: at("2026-08-22T09:00:00.000Z") })],
      intakes: [], correctionRows: [],
      historyStartAt: at("2026-08-22T00:00:00.000Z"), days: 30, now: NOW,
    });
    expect(result.rollups.length).toBe(12);
    expect(result.rollups[0]!.date).toBe("2026-08-22");
    expect(result.rollups[result.rollups.length - 1]!.date).toBe("2026-09-02");
  });

  it("an UNSTAMPED legacy member falls back to the epoch, keeping the full requested range", () => {
    const result = buildJournalRollupsResponse({
      snapshots: [], intakes: [], correctionRows: [],
      historyStartAt: null, days: 7, now: NOW,
    });
    expect(result.rollups.length).toBe(7);
  });

  it("the 1h GAP CAP is enforced — idle time is not attributed to a band", () => {
    // THE LAW THE GATE FOUND VACUOUS. The old version asserted only
    // `pctTimeBalanced > 0`, which passes with the cap set to Infinity, with
    // the cap deleted, and with almost any attribution bug. The cap is the
    // thing that stops an overnight gap being reported as "still BALANCED",
    // so it has to be measured in MINUTES, not merely in "greater than zero".
    //
    // BALANCED at 08:00, then RECOVERING at 20:00 — a 12h gap. Only the
    // first HOUR may be attributed to BALANCED. The tail from 20:00 is capped
    // at 1h too, so the day holds exactly 1h BALANCED + 1h RECOVERING = 50/50.
    const result = buildJournalRollupsResponse({
      snapshots: [
        snap({ capturedAt: at("2026-09-02T08:00:00.000Z"), level: "BALANCED" }),
        snap({ capturedAt: at("2026-09-02T20:00:00.000Z"), level: "RECOVERING" }),
      ],
      intakes: [], correctionRows: [],
      historyStartAt: at("2026-09-01T00:00:00.000Z"), days: 2, now: at("2026-09-02T23:00:00.000Z"),
    });
    const day = result.rollups.find((r) => r.date === "2026-09-02")!;
    // Uncapped, BALANCED would hold 12 of the 13 attributed hours (~92%).
    expect(day.pctTimeBalanced).toBe(50);
    expect(day.pctTimeRecovering).toBe(50);
    expect(day.pctTimePeak).toBe(0);
    expect(day.pctTimeDepleted).toBe(0);
  });

  it("band time splits at UTC midnight rather than landing wholly on one day", () => {
    // A snapshot at 23:30 with a 1h tail must give 30 min to each calendar
    // day. This is also why an UNOBSERVED day can legitimately carry band
    // time: the attribution is a carry-forward from the previous day's
    // snapshot, which is exactly why consumers gate on `snapshotsCount`
    // rather than inferring "no data" from the band fields.
    const result = buildJournalRollupsResponse({
      snapshots: [snap({ capturedAt: at("2026-09-01T23:30:00.000Z"), level: "BALANCED" })],
      intakes: [], correctionRows: [],
      historyStartAt: at("2026-08-01T00:00:00.000Z"), days: 3, now: at("2026-09-02T12:00:00.000Z"),
    });
    const first = result.rollups.find((r) => r.date === "2026-09-01")!;
    const second = result.rollups.find((r) => r.date === "2026-09-02")!;
    expect(first.snapshotsCount).toBe(1);
    expect(first.pctTimeBalanced).toBe(100);
    // The spill-over day has NO observation of its own...
    expect(second.snapshotsCount).toBe(0);
    // ...but does carry the carried-forward band time. Both facts are true;
    // `snapshotsCount` is the one that says whether a score exists.
    expect(second.pctTimeBalanced).toBe(100);
    expect(second.avgScore).toBe(0);
  });

  it("min/max are the real extremes, not the average or each other", () => {
    const result = buildJournalRollupsResponse({
      snapshots: [
        snap({ capturedAt: at("2026-09-02T08:00:00.000Z"), score: 40 }),
        snap({ capturedAt: at("2026-09-02T09:00:00.000Z"), score: 100 }),
        snap({ capturedAt: at("2026-09-02T10:00:00.000Z"), score: 70 }),
      ],
      intakes: [], correctionRows: [],
      historyStartAt: at("2026-09-01T00:00:00.000Z"), days: 2, now: at("2026-09-02T12:00:00.000Z"),
    });
    const day = result.rollups.find((r) => r.date === "2026-09-02")!;
    expect(day.minScore).toBe(40);
    expect(day.maxScore).toBe(100);
    expect(day.avgScore).toBe(70);
    // The ±Infinity seeds must never reach the wire.
    expect(Number.isFinite(day.minScore)).toBe(true);
    expect(Number.isFinite(day.maxScore)).toBe(true);
  });

  it("end-of-day totals take the LAST snapshot's values, not the first or a sum", () => {
    const result = buildJournalRollupsResponse({
      snapshots: [
        snap({ capturedAt: at("2026-09-02T08:00:00.000Z"), ozConsumedToday: 20, aforceUnitsToday: 1 }),
        snap({ capturedAt: at("2026-09-02T18:00:00.000Z"), ozConsumedToday: 90, aforceUnitsToday: 3 }),
      ],
      intakes: [], correctionRows: [],
      historyStartAt: at("2026-09-01T00:00:00.000Z"), days: 2, now: at("2026-09-02T19:00:00.000Z"),
    });
    const day = result.rollups.find((r) => r.date === "2026-09-02")!;
    expect(day.endOzConsumed).toBe(90);
    expect(day.endAforceUnits).toBe(3);
  });

  it("session counts are EDGES, not samples — a run of active snapshots is one session", () => {
    const result = buildJournalRollupsResponse({
      snapshots: [
        snap({ capturedAt: at("2026-09-02T08:00:00.000Z"), autopilotActive: true }),
        snap({ capturedAt: at("2026-09-02T08:30:00.000Z"), autopilotActive: true }),
        snap({ capturedAt: at("2026-09-02T09:00:00.000Z"), autopilotActive: false }),
        snap({ capturedAt: at("2026-09-02T09:30:00.000Z"), autopilotActive: true }),
      ],
      intakes: [], correctionRows: [],
      historyStartAt: at("2026-09-01T00:00:00.000Z"), days: 2, now: at("2026-09-02T10:00:00.000Z"),
    });
    const day = result.rollups.find((r) => r.date === "2026-09-02")!;
    // Two rising edges, not three active samples.
    expect(day.autopilotSessions).toBe(2);
  });

  it("a model-boundary day keeps every distinct version, order preserved", () => {
    const result = buildJournalRollupsResponse({
      snapshots: [
        snap({ capturedAt: at("2026-09-02T08:00:00.000Z"), hydroStateModelVersion: "hydrostate-v0" }),
        snap({ capturedAt: at("2026-09-02T10:00:00.000Z"), hydroStateModelVersion: "hydrostate-v1.0" }),
      ],
      intakes: [], correctionRows: [],
      historyStartAt: at("2026-09-01T00:00:00.000Z"), days: 2, now: NOW,
    });
    const day = result.rollups.find((r) => r.date === "2026-09-02")!;
    expect(day.modelVersions).toEqual(["hydrostate-v0", "hydrostate-v1.0"]);
  });

  it("the trailing interval stops at NOW, not a full hour past the last snapshot", () => {
    // THE OTHER HALF OF THE GAP CAP, and the half nothing held: the tail from
    // the last snapshot is capped at an hour, but it must ALSO stop at the
    // present moment. Without the `now` clamp, a member who synced two minutes
    // ago has a full hour of band time attributed to a state they have only
    // just entered — the app reporting time that has not happened yet.
    //
    // RECOVERING at 08:00, BALANCED at 08:30, and it is now 08:45. The first
    // interval is a real 30 min; the tail is 15 min, not 60.
    const result = buildJournalRollupsResponse({
      snapshots: [
        snap({ capturedAt: at("2026-09-02T08:00:00.000Z"), level: "RECOVERING" }),
        snap({ capturedAt: at("2026-09-02T08:30:00.000Z"), level: "BALANCED" }),
      ],
      intakes: [], correctionRows: [],
      historyStartAt: at("2026-09-01T00:00:00.000Z"), days: 2, now: at("2026-09-02T08:45:00.000Z"),
    });
    const day = result.rollups.find((r) => r.date === "2026-09-02")!;
    // 30 min RECOVERING + 15 min BALANCED of 45 total.
    expect(day.pctTimeRecovering).toBe(67);
    expect(day.pctTimeBalanced).toBe(33);
    // Uncapped, the tail would be a full hour: 30 of 90 (33%) vs 60 of 90 (67%)
    // — the two bands would swap places.
    expect(day.pctTimeBalanced).not.toBe(67);
  });
});
