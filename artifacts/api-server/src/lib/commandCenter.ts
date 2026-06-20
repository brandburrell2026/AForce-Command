/**
 * Founder Command Center — "Daily Five" pure aggregation math.
 *
 * The SQL in `routes/commandCenterAdmin.ts` does all per-row aggregation
 * inside the database (aggregate-only; no PII row ever leaves PG). This
 * module is the PURE, IO-free other half: it turns the resulting scalar
 * counts/averages into the founder-facing DTO — computing rates with
 * zero-denominator guards and a readiness-score trend direction. Being a
 * deterministic function of its input, it is fully unit-testable.
 *
 * Score-Protection / honesty: every metric is REAL or explicitly null.
 * Rates are `null` (never 0/0 → NaN, never a fabricated value) when their
 * denominator is empty; the score trend is `null` until snapshots exist.
 * Several metrics are PROXIES of the owner's canonical funnel (the Phase-1
 * event catalog has no `first_command_completed`/`qr_scanned` events) and
 * are labeled as such in the UI — see each field's doc comment.
 */

import { z } from "zod";

/** A ratio metric: explicit numerator/denominator + null-safe rate. */
export const RateMetricSchema = z.object({
  numerator: z.number().int().nonnegative(),
  denominator: z.number().int().nonnegative(),
  /** numerator/denominator, or null when denominator === 0 (no data). */
  rate: z.number().nullable(),
});
export type RateMetric = z.infer<typeof RateMetricSchema>;

/** A simple count with an all-time total and a trailing-window "recent". */
export const CountMetricSchema = z.object({
  total: z.number().int().nonnegative(),
  recent: z.number().int().nonnegative(),
});
export type CountMetric = z.infer<typeof CountMetricSchema>;

/** Average readiness score this window vs the previous window + direction. */
export const ScoreTrendMetricSchema = z.object({
  /** Avg score over the trailing window, or null when no snapshots. */
  current: z.number().nullable(),
  /** Avg score over the prior window, or null when no snapshots. */
  previous: z.number().nullable(),
  /** current - previous, or null when either side is missing. */
  delta: z.number().nullable(),
  direction: z.enum(["up", "down", "flat"]).nullable(),
  currentSamples: z.number().int().nonnegative(),
  previousSamples: z.number().int().nonnegative(),
});
export type ScoreTrendMetric = z.infer<typeof ScoreTrendMetricSchema>;

export const CommandCenterDailyFiveSchema = z.object({
  generatedAt: z.string(),
  windowDays: z.literal(7),
  /**
   * Command Activations — PROXY for the owner's "first command completed".
   * The Phase-1 catalog has no first_command_completed event, so this counts
   * distinct pseudonymous identities that fired >=1 `command_followed`.
   * `recent` = identities whose FIRST follow landed in the window.
   */
  activations: CountMetricSchema,
  /** D7+ return rate: of identities first seen >=7d ago, share active >=7d later. */
  d7ReturnRate: RateMetricSchema,
  /** Command confirmation follow rate: followed / all confirmations. */
  commandFollowRate: RateMetricSchema,
  /** Account-level subscription conversion: active|trialing / all users. */
  subscriptionConversion: RateMetricSchema,
  /** Readiness (hydration) score trend — NOT a literal "performance age". */
  readinessScoreTrend: ScoreTrendMetricSchema,
});
export type CommandCenterDailyFive = z.infer<
  typeof CommandCenterDailyFiveSchema
>;

/** Raw scalars the SQL layer hands to the pure builder. */
export interface DailyFiveRaw {
  activationsTotal: number;
  activationsLast7d: number;
  retentionCohort: number;
  retentionRetained: number;
  confirmationsTotal: number;
  confirmationsFollowed: number;
  usersTotal: number;
  usersSubscribed: number;
  scoreCurrentAvg: number | null;
  scoreCurrentSamples: number;
  scorePreviousAvg: number | null;
  scorePreviousSamples: number;
}

/** Below this absolute score-point delta the trend reads as "flat". */
const FLAT_THRESHOLD = 0.5;

function rate(numerator: number, denominator: number): RateMetric {
  return {
    numerator,
    denominator,
    rate: denominator > 0 ? numerator / denominator : null,
  };
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function scoreTrend(raw: DailyFiveRaw): ScoreTrendMetric {
  const current =
    raw.scoreCurrentSamples > 0 && raw.scoreCurrentAvg != null
      ? round1(raw.scoreCurrentAvg)
      : null;
  const previous =
    raw.scorePreviousSamples > 0 && raw.scorePreviousAvg != null
      ? round1(raw.scorePreviousAvg)
      : null;
  let delta: number | null = null;
  let direction: "up" | "down" | "flat" | null = null;
  if (current != null && previous != null) {
    delta = round1(current - previous);
    direction =
      Math.abs(delta) < FLAT_THRESHOLD ? "flat" : delta > 0 ? "up" : "down";
  }
  return {
    current,
    previous,
    delta,
    direction,
    currentSamples: raw.scoreCurrentSamples,
    previousSamples: raw.scorePreviousSamples,
  };
}

/**
 * Assemble the founder Daily Five DTO from raw DB scalars. Pure given
 * `generatedAt`. Never fabricates: empty denominators → null rate, no
 * snapshots → null trend.
 */
export function buildDailyFive(
  raw: DailyFiveRaw,
  generatedAt: string,
): CommandCenterDailyFive {
  return {
    generatedAt,
    windowDays: 7,
    activations: { total: raw.activationsTotal, recent: raw.activationsLast7d },
    d7ReturnRate: rate(raw.retentionRetained, raw.retentionCohort),
    commandFollowRate: rate(raw.confirmationsFollowed, raw.confirmationsTotal),
    subscriptionConversion: rate(raw.usersSubscribed, raw.usersTotal),
    readinessScoreTrend: scoreTrend(raw),
  };
}
