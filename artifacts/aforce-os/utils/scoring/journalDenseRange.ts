/**
 * THE EFFECTIVE HYDROSTATE WINDOW — for the Journal share/recap seam ONLY.
 *
 * SCOPE, AND WHY IT IS DELIBERATELY NARROW (founder ruling, Option B).
 * `GET /aforce/journal/rollups` returns only the days it has data for: a
 * calendar day with neither a snapshot nor an intake produces NO ROW. The recap
 * card then read `rollups.length` as the reporting window, and the two
 * questions —
 *
 *     how many days did the SERVER MATERIALISE a row for?
 *     how many days does the reporting window COVER?
 *
 * — are not the same question. A day the member skipped entirely vanished from
 * the array, so its absence was invisible: the streak walked straight across it
 * and published a BROKEN streak, blaming a member for a day HydroState had
 * never observed.
 *
 * The obvious fix was to densify the route. It was tried and REVERTED: six live
 * consumers read `rollups.length` as an observation count and the empty day's
 * `avgScore: 0` sentinel as a measurement, so densifying the shared wire made
 * the Weekly Report paint unobserved days as Signal-Red DEPLETED bars, report
 * them as "days tracked", and count them as compliance failures. A shared wire
 * contract cannot be migrated one caller at a time. That migration is its own
 * PR; until it lands, densification happens HERE — at the one seam whose
 * semantics actually require it — and nowhere else.
 *
 * THREE WINDOWS, never collapsed, because collapsing any two is the defect this
 * program has spent thirteen review rounds removing:
 *
 *   REQUESTED reporting window   what the caller asked for ("30 days")
 *   ELIGIBLE history window      the days AForce could have observed this member
 *   OBSERVED days                the days it actually did
 */
import type { JournalRollup } from '@/types';
import { canonicalHistoryStart } from '@/config/hydroStateHistoryEpoch';

const DAY_MS = 24 * 60 * 60 * 1000;

/** The UTC calendar day an instant falls on, as `YYYY-MM-DD`. */
export function dayKey(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

export interface EffectiveRangeInput {
  /** The instant the window is being built. Injected so this is testable. */
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
 * fabricated gaps. Inside the eligible window a day with no observation stays a
 * gap — that is what makes a missing measurement visible instead of absent.
 *
 * Returns `[]` when the eligible start is still in the future: a member seeded
 * moments ago under a skewed clock has no reportable history yet, and an empty
 * window is the honest answer rather than a day that has not happened.
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

/**
 * A calendar day inside the eligible window that produced no server row.
 *
 * NOTHING IS FABRICATED. Score, intake, band share and model version are all
 * absent, and `snapshotsCount: 0` is what says so — the same sentinel shape the
 * server already emits for a real day with logged intakes and no captured
 * snapshot, so the consumers of this seam need no new rule to read it. The
 * zeros on the score fields ARE that sentinel and are not a measurement: a
 * consumer reading `avgScore` without `snapshotsCount` is reading a sentinel as
 * data, which is the defect this densification closes.
 *
 * The six states stay distinguishable:
 *   no row / no activity     snapshotsCount 0, intakeCount 0
 *   intake, no snapshot      snapshotsCount 0, intakeCount > 0
 *   measured                 snapshotsCount > 0
 *   measured zero            snapshotsCount > 0, avgScore 0
 *   provenance unknown       snapshotsCount > 0, modelVersions [] / [null]
 *   provenance incompatible  snapshotsCount > 0, modelVersions [v0, v1]
 */
export function emptyDay(date: string): JournalRollup {
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
 * Days with data keep their real row; days without get the empty day. Rows
 * OUTSIDE the window — before the member's eligible start, or before the
 * requested range — are dropped rather than reported, so the array IS the
 * window and its consumers do not have to reconstruct it.
 */
export function densifyRollups(
  rollups: readonly JournalRollup[],
  rangeKeys: readonly string[],
): JournalRollup[] {
  const measured = new Map(rollups.map((r) => [r.date, r]));
  return rangeKeys.map((key) => measured.get(key) ?? emptyDay(key));
}
