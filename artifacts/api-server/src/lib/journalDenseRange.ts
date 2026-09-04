/**
 * THE EFFECTIVE HYDROSTATE WINDOW — the canonical dense-rollup contract.
 *
 * FOUNDER RULING (consumer-completeness PR, 2026-09-03): `GET
 * /aforce/journal/rollups` was sparse — one row per calendar day that had a
 * snapshot or an intake, omitting every other day. A day the member skipped
 * entirely simply had NO ROW, which meant every consumer had to independently
 * decide what an absent day meant, and several silently got it wrong: a
 * missing observation was read as a comparability event, a compliance
 * failure, a broken streak, or (via the sentinel `avgScore: 0` that already
 * ships for a real "intake logged, no snapshot captured" day) a measured
 * zero.
 *
 * A prior attempt densified this route and reverted it, because six live
 * client consumers read `rollups.length` as an observation count and would
 * have painted a synthetic gap day as a measured DEPLETED zero. THIS
 * densification ships only once every one of those consumers is migrated
 * onto the observation-aware helpers in the SAME change — see the
 * consumer-completeness PR that adds this file.
 *
 * THE CONTRACT, going forward: **`GET /aforce/journal/rollups` ALWAYS returns
 * one row per calendar day of the member's effective window.**
 * `snapshotsCount === 0` marks a day with no HydroState observation — real
 * activity may still be present (`intakeCount > 0`), but score/band/model
 * fields are the sentinel, never a measurement. Every consumer must check
 * `snapshotsCount` (or use `observedRows`/`observedCount` from
 * `utils/scoring/boundarySeries.ts` on the client) before reading a
 * score-derived field.
 *
 * THREE WINDOWS, never collapsed:
 *   REQUESTED reporting window   what the caller asked for ("30 days")
 *   ELIGIBLE history window      the days AForce could have observed this member
 *   OBSERVED days                the days it actually did
 */
import { canonicalHistoryStart } from "./hydroStateHistoryEpoch";

const DAY_MS = 24 * 60 * 60 * 1000;

/** The UTC calendar day an instant falls on, as `YYYY-MM-DD`. */
export function dayKey(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

export interface EffectiveRangeInput {
  /** The instant the request is being served. Injected so this is testable. */
  now: Date;
  /** The requested window length in days, INCLUSIVE of today. */
  days: number;
  /** The member's own stamp, or null for a row seeded before it existed. */
  historyStartAt: Date | null;
}

/**
 * Every calendar day of the effective window, ascending, as `YYYY-MM-DD`.
 *
 *   effectiveStart = max(requestedStart, historyStartAt ?? EPOCH)
 *   effectiveEnd   = today
 *
 * A member is never charged for days before they existed to us: a stamped
 * 12-day-old member asking for 30 days gets 12 eligible days, not 30 with 18
 * fabricated gaps.
 *
 * Returns `[]` when the eligible start is still in the future — a member
 * seeded moments ago under a skewed clock has no reportable history yet.
 */
export function effectiveRangeKeys(input: EffectiveRangeInput): string[] {
  const { now, days, historyStartAt } = input;
  const todayKey = dayKey(now);
  // The window INCLUDES today, so N days is today plus the previous N-1.
  const requestedStartKey = dayKey(new Date(now.getTime() - (days - 1) * DAY_MS));
  const canonicalStartKey = dayKey(canonicalHistoryStart(historyStartAt));
  // `YYYY-MM-DD` sorts lexicographically, so `>` IS chronological here.
  const startKey =
    requestedStartKey > canonicalStartKey ? requestedStartKey : canonicalStartKey;
  if (startKey > todayKey) return [];

  const out: string[] = [];
  for (
    let cursor = new Date(`${startKey}T00:00:00.000Z`).getTime();
    dayKey(new Date(cursor)) <= todayKey;
    cursor += DAY_MS
  ) {
    out.push(dayKey(new Date(cursor)));
  }
  return out;
}

/** The rollup row shape this route emits. Kept structural, not imported, so a
 *  divergence from the route's own literal is a type error here. */
export interface DenseRollupRow {
  date: string;
  snapshotsCount: number;
  avgScore: number; minScore: number; maxScore: number;
  endOzConsumed: number; endAforceUnits: number; endUnitsConsumed: number;
  endSodiumDelivered: number; endSodiumLost: number; endDeficitPct: number;
  pctTimePeak: number; pctTimeBalanced: number;
  pctTimeRecovering: number; pctTimeDepleted: number;
  intakeCount: number; autopilotSessions: number; socialSessions: number;
  modelVersions: (string | null)[];
}

/**
 * A calendar day inside the eligible window that produced no server row.
 *
 * NOTHING IS FABRICATED. Score, intake, band share and model version are all
 * absent, and `snapshotsCount: 0` is what says so — the same sentinel shape
 * the route already emits for a real day with logged intakes and no
 * captured snapshot, so no consumer needs a new rule to read it.
 */
export function emptyDay(date: string): DenseRollupRow {
  return {
    date,
    snapshotsCount: 0,
    avgScore: 0, minScore: 0, maxScore: 0,
    endOzConsumed: 0, endAforceUnits: 0, endUnitsConsumed: 0,
    endSodiumDelivered: 0, endSodiumLost: 0, endDeficitPct: 0,
    pctTimePeak: 0, pctTimeBalanced: 0, pctTimeRecovering: 0, pctTimeDepleted: 0,
    intakeCount: 0, autopilotSessions: 0, socialSessions: 0,
    modelVersions: [],
  };
}

/**
 * The effective window, one row per calendar day.
 *
 * Days with data use their measured row; days without get the empty day. Rows
 * OUTSIDE the window — before the member's eligible start, or before the
 * requested range — are dropped rather than reported, so the array IS the
 * window and no consumer has to reconstruct it.
 */
export function densifyRollups(
  measured: ReadonlyMap<string, DenseRollupRow>,
  rangeKeys: readonly string[],
): DenseRollupRow[] {
  return rangeKeys.map((key) => measured.get(key) ?? emptyDay(key));
}
