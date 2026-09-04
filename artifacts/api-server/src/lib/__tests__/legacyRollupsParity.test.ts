/**
 * THE SPARSE WIRE, DIFFED AGAINST WHAT `origin/main` ACTUALLY EMITTED.
 *
 * WHY THIS FILE EXISTS. The founder's rollout ruling requires a law proving
 * the legacy path stays byte/behavior compatible. Every other compatibility
 * law in this repo states a PROPERTY someone believed main had — the rows are
 * sorted, the band-carry day survives, no window is applied — which means a
 * future edit that changes the sparse wire in some way nobody thought to
 * assert ships green. This one asserts the OUTPUT ITSELF.
 *
 * HOW THE GOLDENS WERE MADE, and why they are trustworthy: `origin/main` at
 * `e1e7dbde`, `routes/aforce/journal.ts` lines 305-494 — the real handler's
 * real aggregation — was executed verbatim with exactly two substitutions,
 * `Date.now()` → an injected instant (main read the clock directly in the tail
 * clamp; the extracted version takes `now` as a parameter) and
 * `return res.json(` → `return (`. No logic was retyped, so these are not a
 * transcription of what someone believed main did. The generator itself is
 * deliberately NOT in the repo: it only ever needed to run once, and keeping a
 * second copy of the aggregation around is exactly the drift this program
 * keeps having to remove.
 *
 * WHAT IS COMPARED. The three keys main shipped — `rollups`, `days`,
 * `historyStartAt`. The response's new `dense` field is additive and has no
 * counterpart in the goldens, so it is excluded here and pinned separately in
 * journalRollupsAggregation.test.ts. That exclusion is the ONE intentional
 * divergence from main's bytes, and it is stated rather than hidden.
 *
 * TO REGENERATE (only if main's aggregation itself is ever intentionally
 * changed): re-extract those lines from the pinned commit with the two
 * substitutions above, import `CASES` and `NOW` from this file — they are
 * exported for exactly that purpose — and write the result to
 * legacyRollupsGolden.json. Regenerating against HEAD instead of the pinned
 * commit would make this law compare the code to itself.
 */
import { describe, it, expect } from "vitest";
import { buildJournalRollupsResponse } from "../journalRollupsAggregation";
import GOLDEN from "./legacyRollupsGolden.json";

const at = (s: string) => new Date(s);
/** The instant the goldens were generated at. Changing it invalidates them. */
export const NOW = at("2026-09-02T14:30:00.000Z");

export const snap = (iso: string, o: Record<string, unknown> = {}) => ({
  capturedAt: at(iso), score: 80, level: "BALANCED", ozConsumedToday: 60,
  aforceUnitsToday: 2, unitsConsumedToday: 5, sodiumDeliveredMg: 900,
  sodiumLostMg: 400, deficitPct: 12, autopilotActive: false, socialActive: false,
  hydroStateModelVersion: "hydrostate-v1.0", ...o,
});
const intake = (id: number, iso: string) => ({ id, loggedAt: at(iso) });
const STAMP = [{ historyStartAt: at("2026-06-01T00:00:00.000Z") }];

/** The SAME fixtures the goldens were generated from, in the same order. */
export const CASES: Record<string, {
  s: ReturnType<typeof snap>[]; i: ReturnType<typeof intake>[];
  c: { corrected: number | null }[]; st: { historyStartAt: Date | null }[]; days: number;
}> = {
  empty:           { s: [], i: [], c: [], st: STAMP, days: 7 },
  noStateRow:      { s: [snap("2026-08-31T09:00:00.000Z")], i: [], c: [], st: [], days: 7 },
  twoDays:         { s: [snap("2026-08-28T09:00:00.000Z", { score: 70 }), snap("2026-08-31T09:00:00.000Z", { score: 90 })], i: [], c: [], st: STAMP, days: 7 },
  intakeOnly:      { s: [], i: [intake(1, "2026-09-01T10:00:00.000Z"), intake(2, "2026-09-01T12:00:00.000Z")], c: [], st: STAMP, days: 7 },
  correctedIntake: { s: [], i: [intake(1, "2026-09-01T10:00:00.000Z"), intake(2, "2026-09-01T12:00:00.000Z")], c: [{ corrected: 1 }], st: STAMP, days: 7 },
  bandCarry:       { s: [snap("2026-09-01T23:30:00.000Z", { level: "PEAK" })], i: [], c: [], st: STAMP, days: 3 },
  eighthDayEdge:   { s: [snap("2026-08-26T18:00:00.000Z", { score: 55 })], i: [], c: [], st: STAMP, days: 7 },
  beforeStamp:     { s: [snap("2026-08-20T09:00:00.000Z")], i: [], c: [], st: [{ historyStartAt: at("2026-08-25T00:00:00.000Z") }], days: 30 },
  beforeEpoch:     { s: [snap("2026-01-15T09:00:00.000Z"), snap("2026-08-31T09:00:00.000Z")], i: [], c: [], st: [{ historyStartAt: null }], days: 365 },
  futureStamp:     { s: [snap("2026-08-28T09:00:00.000Z"), snap("2026-09-02T09:00:00.000Z")], i: [], c: [], st: [{ historyStartAt: at("2026-09-20T00:00:00.000Z") }], days: 7 },
  modelBoundary:   { s: [snap("2026-09-02T08:00:00.000Z", { hydroStateModelVersion: "hydrostate-v0" }), snap("2026-09-02T10:00:00.000Z")], i: [], c: [], st: STAMP, days: 7 },
  minMaxSessions:  { s: [snap("2026-09-02T08:00:00.000Z", { score: 40, autopilotActive: true }), snap("2026-09-02T08:30:00.000Z", { score: 100, autopilotActive: true }), snap("2026-09-02T09:00:00.000Z", { score: 70, socialActive: true })], i: [], c: [], st: STAMP, days: 7 },
  // Both snapshots BEFORE `now`, and 11h apart, so the 1h gap cap actually
  // decides the band split. An earlier version put the second snapshot after
  // `now`, which made the ratio 100/0 for any cap value — widening the cap
  // to 4h changed nothing and the mutation survived.
  gapCap:          { s: [snap("2026-09-02T02:00:00.000Z", { level: "BALANCED" }), snap("2026-09-02T13:00:00.000Z", { level: "RECOVERING" })], i: [], c: [], st: STAMP, days: 2 },
  // The tail from the LAST snapshot must stop at `now`, not a full hour past
  // it: a member who synced two minutes ago has not spent an hour in that band.
  nowTailClamp:    { s: [snap("2026-09-02T13:30:00.000Z", { level: "RECOVERING" }), snap("2026-09-02T14:15:00.000Z", { level: "PEAK" })], i: [], c: [], st: STAMP, days: 2 },
  monthBoundary:   { s: [snap("2026-08-31T23:00:00.000Z"), snap("2026-09-01T01:00:00.000Z")], i: [], c: [], st: STAMP, days: 5 },
  daysOne:         { s: [snap("2026-09-02T09:00:00.000Z")], i: [], c: [], st: STAMP, days: 1 },
  unsortedInput:   { s: [snap("2026-08-31T09:00:00.000Z"), snap("2026-08-28T09:00:00.000Z")], i: [], c: [], st: STAMP, days: 7 },
};

const run = (name: string, dense: boolean) => {
  const f = CASES[name]!;
  const r = buildJournalRollupsResponse({
    snapshots: f.s as never, intakes: f.i as never, correctionRows: f.c as never,
    historyStartAt: f.st[0]?.historyStartAt ?? null,
    days: f.days, dense, now: NOW,
  });
  // The three keys main shipped. `dense` is additive; see the header.
  return { rollups: r.rollups, days: r.days, historyStartAt: r.historyStartAt };
};

describe("the sparse wire still emits exactly what origin/main emitted", () => {
  it("the goldens and the fixtures have not drifted apart", () => {
    // A case added here but never regenerated — or removed from the goldens —
    // would otherwise silently shrink this law's coverage.
    expect(Object.keys(GOLDEN).sort()).toEqual(Object.keys(CASES).sort());
    expect(Object.keys(CASES).length).toBe(17);
  });

  for (const name of Object.keys(CASES)) {
    it(`${name}: sparse output is identical to main`, () => {
      expect(run(name, false)).toEqual((GOLDEN as Record<string, unknown>)[name]);
    });
  }

  it("ANTI-VACUITY: the comparison DOES detect a difference when one exists", () => {
    // If `toEqual` were somehow blind here, every case above would pass for
    // free. The dense path is a real, large difference on the same fixtures.
    const differing = Object.keys(CASES).filter(
      (n) => JSON.stringify(run(n, true)) !== JSON.stringify((GOLDEN as Record<string, unknown>)[n]),
    );
    expect(differing.length).toBeGreaterThan(8);
    // ...including the cases whose whole point is that dense narrows or fills.
    expect(differing).toContain("eighthDayEdge");
    expect(differing).toContain("beforeEpoch");
    expect(differing).toContain("twoDays");
  });

  it("ANTI-VACUITY: the goldens are real rows, not empty scaffolding", () => {
    const rows = Object.values(GOLDEN as Record<string, { rollups: unknown[] }>)
      .flatMap((g) => g.rollups);
    expect(rows.length).toBeGreaterThan(15);
    expect(Object.keys(rows[0] as object)).toHaveLength(19); // main's row shape
  });
});
