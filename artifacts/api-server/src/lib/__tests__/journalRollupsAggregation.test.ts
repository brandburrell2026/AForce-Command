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

/* THE CAPABILITY IS NEVER SET INLINE.
 *
 * `dense` is a required field on the input, but this package's tsconfig
 * excludes `src/**\/__tests__/**`, so a test that FORGOT it would not be a type
 * error here — it would silently parse as falsy and assert against the SPARSE
 * response while claiming to test the dense one. That is this program's
 * recurring defect in miniature: an omitted value and an explicit `false`
 * collapsing into one state. Every input below is built through one of these
 * two helpers, so the capability is always stated. */
type Args = Omit<Parameters<typeof buildJournalRollupsResponse>[0], "dense">;
const denseResponse = (a: Args) => buildJournalRollupsResponse({ ...a, dense: true });
const sparseResponse = (a: Args) => buildJournalRollupsResponse({ ...a, dense: false });

describe("buildJournalRollupsResponse — the dense contract, executed for real", () => {
  it("a fully-stamped week with no gaps: one row per day, all measured", () => {
    // Real calendar days, spelled out explicitly to avoid month-boundary
    // arithmetic bugs in the fixture itself (the exact class of
    // test-authoring error this program has been bitten by before).
    const days7 = ["2026-08-27", "2026-08-28", "2026-08-29", "2026-08-30", "2026-08-31", "2026-09-01", "2026-09-02"];
    const realSnapshots = days7.map((d) => snap({ capturedAt: at(`${d}T09:00:00.000Z`) }));
    const result = denseResponse({
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
    const result = denseResponse({
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
    const result = denseResponse({
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
    const result = denseResponse({
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
    const result = denseResponse({
      snapshots: [snap({ capturedAt: at("2026-08-22T09:00:00.000Z") })],
      intakes: [], correctionRows: [],
      historyStartAt: at("2026-08-22T00:00:00.000Z"), days: 30, now: NOW,
    });
    expect(result.rollups.length).toBe(12);
    expect(result.rollups[0]!.date).toBe("2026-08-22");
    expect(result.rollups[result.rollups.length - 1]!.date).toBe("2026-09-02");
  });

  it("an UNSTAMPED legacy member falls back to the epoch, keeping the full requested range", () => {
    const result = denseResponse({
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
    const result = denseResponse({
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
    const result = denseResponse({
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
    const result = denseResponse({
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
    const result = denseResponse({
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
    const result = denseResponse({
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
    const result = denseResponse({
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
    const result = denseResponse({
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

/* ═══════════ THE COMPATIBILITY SURFACE (founder rollout ruling) ═══════════
 *
 * Dense rollups must NOT become the default. An already-installed build sends
 * no `dense` param and has to keep receiving exactly the wire it receives
 * today — otherwise the server deploy changes behavior underneath every phone
 * in the field, which is the one thing the ruling forbids.
 *
 * This is a compatibility surface, not a second intelligence model: BOTH paths
 * run the identical aggregation over the identical rows, and the flag decides
 * only WHICH DAYS ARE PRESENTED. The laws below pin both halves — that the
 * day SETS differ exactly as specified, and that the day VALUES do not differ
 * at all.
 */
describe("dense is an opt-in capability; sparse is the unchanged legacy wire", () => {
  // A member with data on two days of a seven-day window, and nothing else.
  const WINDOW = {
    snapshots: [
      snap({ capturedAt: at("2026-08-28T09:00:00.000Z"), score: 70 }),
      snap({ capturedAt: at("2026-08-31T09:00:00.000Z"), score: 90 }),
    ],
    intakes: [], correctionRows: [],
    historyStartAt: at("2026-06-01T00:00:00.000Z"), days: 7, now: NOW,
  };

  it("NO capability requested → the sparse array, nothing synthesised", () => {
    const r = sparseResponse(WINDOW);
    expect(r.rollups.map((x) => x.date)).toEqual(["2026-08-28", "2026-08-31"]);
    // Not one row per calendar day, and NOT extended to today.
    expect(r.rollups).toHaveLength(2);
    expect(r.rollups.some((x) => x.date === "2026-09-02")).toBe(false);
  });

  it("capability requested → one row per calendar day of the effective window", () => {
    // ANTI-VACUITY for the law above: the SAME inputs, the other answer.
    const r = denseResponse(WINDOW);
    expect(r.rollups).toHaveLength(7);
    expect(r.rollups[r.rollups.length - 1]!.date).toBe("2026-09-02");
  });

  it("BYTE COMPATIBILITY: a day in both responses is identical in both", () => {
    // The flag decides which days are PRESENTED, never how a day is COMPUTED.
    // If it ever changed a value, an old client would see different numbers
    // for the same day the moment the server deployed.
    const sparse = sparseResponse(WINDOW);
    const dense = denseResponse(WINDOW);
    expect(sparse.rollups.length).toBeGreaterThan(0); // anti-vacuity: real overlap
    for (const row of sparse.rollups) {
      const twin = dense.rollups.find((d) => d.date === row.date);
      expect(twin, `${row.date} must exist in the dense window`).toBeDefined();
      expect(twin).toEqual(row);
    }
  });

  it("the dense window adds ONLY empty days — it never drops a measured one", () => {
    const sparse = sparseResponse(WINDOW);
    const dense = denseResponse(WINDOW);
    const added = dense.rollups.filter((d) => !sparse.rollups.some((s2) => s2.date === d.date));
    expect(added).toHaveLength(5);
    expect(added.every((d) => d.snapshotsCount === 0 && d.intakeCount === 0)).toBe(true);
  });

  it("the result declares which contract it SERVED, on both paths", () => {
    // Held only by the HTTP capability suite before this — the aggregation is
    // where the value is produced, so it belongs here too.
    expect(sparseResponse(WINDOW).dense).toBe(false);
    expect(denseResponse(WINDOW).dense).toBe(true);
  });

  it("the declared flag matches the array actually returned, never the request", () => {
    // The whole point of the field: it must be derived from the same branch
    // that shaped the rows, so it cannot drift into reporting an intention.
    for (const dense of [true, false]) {
      const r = buildJournalRollupsResponse({ ...WINDOW, dense });
      expect(r.dense).toBe(dense);
      // dense ⇒ one row per calendar day; sparse ⇒ only days with data.
      expect(r.rollups.length === 7).toBe(dense);
    }
  });

  it("historyStartAt is ADDITIVE and present on BOTH paths", () => {
    // #911 shipped this on the sparse wire and the installed client reads it
    // (`setHistoryStartAt(rl.historyStartAt)`) to floor its share window.
    // Extracting the aggregation out of the route dropped it — a silent break
    // for every build in the field.
    expect(sparseResponse(WINDOW).historyStartAt).toBe("2026-06-01T00:00:00.000Z");
    expect(denseResponse(WINDOW).historyStartAt).toBe("2026-06-01T00:00:00.000Z");
  });

  it("an unstamped member reports null on both paths — 'not recorded', not 'no history'", () => {
    const args = { ...WINDOW, historyStartAt: null };
    expect(sparseResponse(args).historyStartAt).toBeNull();
    expect(denseResponse(args).historyStartAt).toBeNull();
  });

  it("`days` echoes back unchanged on both paths", () => {
    expect(sparseResponse(WINDOW).days).toBe(7);
    expect(denseResponse(WINDOW).days).toBe(7);
  });

  it("sparse rows are in DATE order even when the input is not", () => {
    const r = sparseResponse({
      ...WINDOW,
      snapshots: [
        snap({ capturedAt: at("2026-08-31T09:00:00.000Z") }),
        snap({ capturedAt: at("2026-08-28T09:00:00.000Z") }),
      ],
    });
    expect(r.rollups.map((x) => x.date)).toEqual(["2026-08-28", "2026-08-31"]);
  });

  it("SPARSE KEEPS THE BAND-CARRY DAY — it is not 'days with a snapshot or intake'", () => {
    // THE SUBTLE HALF OF LEGACY COMPATIBILITY. Band time spills past UTC
    // midnight, and the attribution calls `ensure()`, so a day carrying ONLY
    // carried-forward band time has always been a row on this wire — with no
    // snapshot and no intake of its own. Implementing sparse as a filter on
    // `snapshotsCount > 0 || intakeCount > 0` would silently drop it and
    // change legacy behavior for a case nobody would think to look at.
    const r = sparseResponse({
      snapshots: [snap({ capturedAt: at("2026-09-01T23:30:00.000Z"), level: "BALANCED" })],
      intakes: [], correctionRows: [],
      historyStartAt: at("2026-08-01T00:00:00.000Z"), days: 3, now: at("2026-09-02T12:00:00.000Z"),
    });
    expect(r.rollups.map((x) => x.date)).toEqual(["2026-09-01", "2026-09-02"]);
    const spill = r.rollups.find((x) => x.date === "2026-09-02")!;
    expect(spill.snapshotsCount).toBe(0);
    expect(spill.intakeCount).toBe(0);
    expect(spill.pctTimeBalanced).toBe(100); // the reason the row exists
  });

  it("SPARSE IS NOT CLAMPED by historyStartAt — the floor is a dense-window rule", () => {
    // The legacy wire has no window. A day with real data older than the
    // member's history stamp was returned before and must still be returned;
    // clamping it away would be a behavior change dressed up as a fix.
    const args = {
      snapshots: [snap({ capturedAt: at("2026-08-20T09:00:00.000Z") })],
      intakes: [], correctionRows: [],
      historyStartAt: at("2026-08-25T00:00:00.000Z"), days: 30, now: NOW,
    };
    expect(sparseResponse(args).rollups.map((x) => x.date)).toEqual(["2026-08-20"]);
    // ANTI-VACUITY: the dense path DOES apply the floor, so the two genuinely
    // differ here rather than coinciding on this fixture.
    const denseDates = denseResponse(args).rollups.map((x) => x.date);
    expect(denseDates[0]).toBe("2026-08-25");
    expect(denseDates).not.toContain("2026-08-20");
  });

  it("THE 8TH-DAY EDGE: sparse keeps a day the dense window is too narrow to hold", () => {
    // THE LEAST OBVIOUS PARITY TRAP, and the one a plausible "tidy" sparse
    // implementation gets wrong. The route's SQL cutoff is an INSTANT
    // (`now - days*24h`), while the dense window is a CALENDAR range of `days`
    // days ending today. At any time of day past 00:00 UTC the SQL therefore
    // reaches one calendar day FURTHER BACK than the dense window does.
    //
    // now = 2026-09-02T14:30Z, days = 7 → SQL fetches from 2026-08-26T14:30Z,
    // but the dense window is 2026-08-27..2026-09-02. A snapshot at
    // 2026-08-26T18:00Z is fetched and is inside the legacy response.
    //
    // Implementing sparse as "densify, then filter out the empty rows" would
    // pass a synthesis-only review — it adds no synthetic rows — and silently
    // DELETE this member's real measured day on every single request.
    const args = {
      snapshots: [snap({ capturedAt: at("2026-08-26T18:00:00.000Z"), score: 77 })],
      intakes: [], correctionRows: [],
      historyStartAt: at("2026-06-01T00:00:00.000Z"), days: 7, now: NOW,
    };
    const sparse = sparseResponse(args);
    expect(sparse.rollups.map((r) => r.date)).toEqual(["2026-08-26"]);
    expect(sparse.rollups[0]!.avgScore).toBe(77);
    // ANTI-VACUITY: the dense window genuinely cannot hold it, so the two
    // answers differ here rather than coinciding on the fixture.
    const dense = denseResponse(args);
    expect(dense.rollups.map((r) => r.date)).not.toContain("2026-08-26");
    expect(dense.rollups[0]!.date).toBe("2026-08-27");
  });

  it("the sparse path applies NO window at all — the SQL cutoff is the only bound", () => {
    // Generalises the edge above. Whatever the aggregation is handed, sparse
    // returns it; narrowing belongs to the dense window and nowhere else.
    const args = {
      snapshots: [
        snap({ capturedAt: at("2026-01-15T09:00:00.000Z") }), // long before the epoch
        snap({ capturedAt: at("2026-08-31T09:00:00.000Z") }),
      ],
      intakes: [], correctionRows: [], historyStartAt: null, days: 7, now: NOW,
    };
    expect(sparseResponse(args).rollups.map((r) => r.date)).toEqual(["2026-01-15", "2026-08-31"]);
    // ANTI-VACUITY: dense floors at the epoch and drops the January day.
    expect(denseResponse(args).rollups.map((r) => r.date)).not.toContain("2026-01-15");
  });

  it("a FUTURE history stamp never empties the dense window", () => {
    // Proven end to end, because this was total data loss: the member below
    // has two real measured days and used to receive `rollups: []` from the
    // dense path while sparse returned both. A dense client would have shown
    // them an empty journal, and nothing would have errored.
    const args = {
      snapshots: [snap({ capturedAt: at("2026-08-28T09:00:00.000Z") }),
                  snap({ capturedAt: at("2026-09-02T09:00:00.000Z") })],
      intakes: [], correctionRows: [],
      historyStartAt: at("2026-09-20T00:00:00.000Z"), days: 7, now: NOW,
    };
    const dense = denseResponse(args);
    expect(dense.rollups).not.toHaveLength(0);
    expect(dense.rollups).toHaveLength(7);
    expect(dense.rollups.filter((r) => r.snapshotsCount > 0).map((r) => r.date))
      .toEqual(["2026-08-28", "2026-09-02"]);
    // The stamp is still echoed verbatim — this repairs the WINDOW, it does
    // not rewrite the member's record or hide the bad row from anyone.
    expect(dense.historyStartAt).toBe("2026-09-20T00:00:00.000Z");
    // ANTI-VACUITY: sparse was never affected, so this is a dense-path repair.
    expect(sparseResponse(args).rollups.map((r) => r.date))
      .toEqual(["2026-08-28", "2026-09-02"]);
  });

  it("a member with NO data gets an empty sparse array, not a window of blanks", () => {
    const args = { snapshots: [], intakes: [], correctionRows: [], historyStartAt: null, days: 7, now: NOW };
    expect(sparseResponse(args).rollups).toEqual([]);
    expect(denseResponse(args).rollups).toHaveLength(7); // anti-vacuity
  });
});

