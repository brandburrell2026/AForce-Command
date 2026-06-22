/**
 * Founder Command Center — pure builder for the Performance Age™ population
 * trend, computed over the pseudonymous `performance_age_snapshot` analytics
 * events. Pure + dependency-free so it is unit-testable in isolation; the route
 * does the SQL aggregation and hands the scalar results here.
 *
 * What it answers: across the member base, is the cohort's Performance Age
 * trending YOUNGER (the product working) or OLDER, comparing the most recent
 * 7-day window to the prior 7-day window. The mobile client emits only the
 * privacy-safe years DELTA (performanceAge − actualAge; negative = younger),
 * never the absolute age, so this trend reveals direction without ever exposing
 * any member's real age.
 *
 * Honesty / Score-Protection guarantees baked in here:
 *   - k-ANONYMITY: a window backed by fewer than MIN_COHORT_MEMBERS distinct
 *     identities reports a NULL average — never a number a single member could
 *     be reverse-engineered from. The SQL may compute an average over 3 people;
 *     this builder withholds it.
 *   - NO FABRICATION: an empty window reports `awaiting` (avg null), a thin
 *     window reports `collecting` (avg null), and only a window at/above the
 *     k-anon floor reports `measured` with a real average. The change vs the
 *     prior window is computed ONLY when BOTH windows are measured; otherwise it
 *     is null. We never invent a slope from missing data.
 */

import { z } from "zod";

/** Each window is one calendar week. */
export const PERF_AGE_TREND_WINDOW_DAYS = 7;

/**
 * k-anonymity floor. A window must contain at least this many DISTINCT
 * pseudonymous identities before its average years-delta is surfaced. Below it,
 * the average is withheld (null) so no individual's health estimate can be
 * inferred from a small-cohort mean.
 */
export const PERF_AGE_MIN_COHORT_MEMBERS = 5;

export type PerformanceAgeWindowStatus = "awaiting" | "collecting" | "measured";
export type PerformanceAgeChangeDirection = "younger" | "older" | "steady";

/** Raw per-window aggregate as produced by the SQL (one snapshot per identity
 *  per UTC day already collapsed in-DB). */
export interface PerformanceAgeWindowAgg {
  /** Mean years-delta across the window's daily snapshots, or null when empty. */
  avgDeltaYears: number | null;
  /** Total daily snapshots in the window (after per-identity-per-day dedupe). */
  snapshotCount: number;
  /** Distinct pseudonymous identities contributing to the window. */
  distinctMembers: number;
}

export interface PerformanceAgeTrendsInput {
  current: PerformanceAgeWindowAgg;
  previous: PerformanceAgeWindowAgg;
}

const WindowSchema = z.object({
  avgDeltaYears: z.number().nullable(),
  snapshotCount: z.number().int().nonnegative(),
  distinctMembers: z.number().int().nonnegative(),
  status: z.enum(["awaiting", "collecting", "measured"]),
});

export const PerformanceAgeTrendsSchema = z.object({
  generatedAt: z.string(),
  windowDays: z.number().int().positive(),
  minCohort: z.number().int().positive(),
  current: WindowSchema,
  previous: WindowSchema,
  change: z.object({
    /** current.avgDeltaYears − previous.avgDeltaYears, only when both measured. */
    deltaYears: z.number().nullable(),
    direction: z.enum(["younger", "older", "steady"]).nullable(),
    status: z.enum(["awaiting", "collecting", "measured"]),
  }),
});

export type PerformanceAgeTrendsDTO = z.infer<typeof PerformanceAgeTrendsSchema>;
export type PerformanceAgeWindowDTO = z.infer<typeof WindowSchema>;

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function cohortStatus(members: number): PerformanceAgeWindowStatus {
  if (members <= 0) return "awaiting";
  if (members < PERF_AGE_MIN_COHORT_MEMBERS) return "collecting";
  return "measured";
}

function buildWindow(agg: PerformanceAgeWindowAgg): PerformanceAgeWindowDTO {
  const snapshotCount = Math.max(0, Math.trunc(agg.snapshotCount));
  const distinctMembers = Math.max(0, Math.trunc(agg.distinctMembers));
  const byCohort = cohortStatus(distinctMembers);
  const hasAvg =
    agg.avgDeltaYears !== null && Number.isFinite(agg.avgDeltaYears);
  // A cohort at/above the floor but somehow without a finite average (defensive;
  // shouldn't happen when snapshots exist) degrades to "collecting", never a
  // "measured" window with a null number.
  const status: PerformanceAgeWindowStatus =
    byCohort === "measured" ? (hasAvg ? "measured" : "collecting") : byCohort;
  return {
    avgDeltaYears:
      status === "measured" ? round1(agg.avgDeltaYears as number) : null,
    snapshotCount,
    distinctMembers,
    status,
  };
}

export function buildPerformanceAgeTrends(
  input: PerformanceAgeTrendsInput,
  generatedAt: string,
): PerformanceAgeTrendsDTO {
  const current = buildWindow(input.current);
  const previous = buildWindow(input.previous);

  let change: PerformanceAgeTrendsDTO["change"];
  if (
    current.status === "measured" &&
    previous.status === "measured" &&
    current.avgDeltaYears !== null &&
    previous.avgDeltaYears !== null
  ) {
    const deltaYears = round1(current.avgDeltaYears - previous.avgDeltaYears);
    // A LOWER years-delta means the cohort skews younger than before — the
    // outcome the product is trying to drive — so a negative change is "younger".
    const direction: PerformanceAgeChangeDirection =
      deltaYears < 0 ? "younger" : deltaYears > 0 ? "older" : "steady";
    change = { deltaYears, direction, status: "measured" };
  } else {
    const anyMembers =
      current.distinctMembers > 0 || previous.distinctMembers > 0;
    change = {
      deltaYears: null,
      direction: null,
      status: anyMembers ? "collecting" : "awaiting",
    };
  }

  return {
    generatedAt,
    windowDays: PERF_AGE_TREND_WINDOW_DAYS,
    minCohort: PERF_AGE_MIN_COHORT_MEMBERS,
    current,
    previous,
    change,
  };
}
