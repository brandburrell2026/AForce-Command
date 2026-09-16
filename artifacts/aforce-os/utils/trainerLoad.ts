/**
 * Training load — session RPE, and acute:chronic workload.
 *
 * Phase 5 of `docs/TRAINER-DASHBOARD-BRIEF.md`. Pure functions, no React, no
 * I/O, so the arithmetic and — more importantly — the honesty rules are
 * testable without a screen.
 *
 * THE RULE THAT MATTERS MORE THAN THE MATHS, quoting the brief:
 *
 *   "Show uncertainty honestly: an ACWR computed on 9 days of data is
 *    labelled as such and rendered in a muted state. NEVER render a confident
 *    number on thin data."
 *
 * So every result here carries its input window and its coverage, and a ratio
 * computed on a chronic window that was mostly empty comes back `partial` —
 * or, below the floor, comes back with a null ratio and a reason. A caller
 * cannot accidentally render a bare number, because there is no bare number
 * to render.
 *
 * Nothing here is predictive. ACWR is a description of what has already been
 * loaded, not a forecast and not a risk score, and the labels say so.
 */

export interface SessionEntry {
  /** `YYYY-MM-DD`, the local day the session counts for. */
  sessionDate: string;
  /** Session rating of perceived exertion, 1-10. */
  rpe: number;
  durationMin: number;
}

/** Session load = RPE × minutes. Derived, never stored. */
export function sessionLoad(entry: SessionEntry): number {
  return entry.rpe * entry.durationMin;
}

/** Sum of session loads per calendar day. */
export function dailyLoads(sessions: readonly SessionEntry[]): Map<string, number> {
  const byDay = new Map<string, number>();
  for (const s of sessions) {
    byDay.set(s.sessionDate, (byDay.get(s.sessionDate) ?? 0) + sessionLoad(s));
  }
  return byDay;
}

function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** The N calendar days ending at `endDate`, oldest first. */
export function dayWindow(endDate: string, days: number): string[] {
  const end = new Date(`${endDate}T00:00:00.000Z`);
  const out: string[] = [];
  for (let i = days - 1; i >= 0; i -= 1) {
    const d = new Date(end);
    d.setUTCDate(d.getUTCDate() - i);
    out.push(dayKey(d));
  }
  return out;
}

/**
 * Exponentially weighted moving average over a day series.
 *
 * λ = 2 / (N + 1), the standard smoothing factor for an N-day EWMA. Days with
 * no session count as zero load: a rest day is information, not a gap.
 */
export function ewma(series: readonly number[], days: number): number {
  if (series.length === 0) return 0;
  const lambda = 2 / (days + 1);
  // Seeded at ZERO, not at the first element. Seeding at series[0] gives the
  // oldest day the largest weight until the series is several times longer
  // than N — which inverts the whole point of the measure, and over a 28-day
  // window would let a heavy day four weeks ago outrank yesterday.
  let value = 0;
  for (const point of series) {
    value = point * lambda + value * (1 - lambda);
  }
  return value;
}

export type LoadCompleteness = "observed" | "partial" | "unavailable";

export interface AcwrResult {
  /** Null whenever the inputs do not support a number. */
  ratio: number | null;
  acute: number;
  chronic: number;
  /** Days in the chronic window that carried at least one session. */
  coveredDays: number;
  windowDays: number;
  acuteDays: number;
  completeness: LoadCompleteness;
  /** Plain-language reason, always present. Rendered next to the figure. */
  note: string;
}

export const ACUTE_DAYS = 7;
export const CHRONIC_DAYS = 28;

/**
 * Below this many covered days in the chronic window, no ratio is produced at
 * all. Two weeks of a four-week denominator is the point below which the
 * figure says more about the gaps than about the athlete.
 */
export const MIN_COVERED_DAYS = 14;

/** At or above this, the window is reported as observed rather than partial. */
export const FULL_COVERAGE_DAYS = 21;

/**
 * Acute:chronic workload ratio, 7:28, exponentially weighted.
 *
 * @param endDate the day the windows end on, `YYYY-MM-DD`.
 */
export function acwr(
  sessions: readonly SessionEntry[],
  endDate: string,
  opts: { acuteDays?: number; chronicDays?: number } = {},
): AcwrResult {
  const acuteDays = opts.acuteDays ?? ACUTE_DAYS;
  const chronicDays = opts.chronicDays ?? CHRONIC_DAYS;

  const byDay = dailyLoads(sessions);
  const chronicWindow = dayWindow(endDate, chronicDays);
  const chronicSeries = chronicWindow.map((d) => byDay.get(d) ?? 0);
  const acuteSeries = chronicSeries.slice(-acuteDays);

  const coveredDays = chronicWindow.reduce((n, d) => n + (byDay.has(d) ? 1 : 0), 0);
  const acute = ewma(acuteSeries, acuteDays);
  const chronic = ewma(chronicSeries, chronicDays);

  const base = { acute, chronic, coveredDays, windowDays: chronicDays, acuteDays };

  if (coveredDays === 0) {
    return {
      ...base,
      ratio: null,
      completeness: "unavailable",
      note: `No sessions recorded in the last ${chronicDays} days.`,
    };
  }

  if (coveredDays < MIN_COVERED_DAYS) {
    // Deliberately no ratio. A number here would be mostly an artefact of the
    // empty days, and a muted number still gets read as a number.
    return {
      ...base,
      ratio: null,
      completeness: "unavailable",
      note: `Only ${coveredDays} of ${chronicDays} days have sessions. Too thin for a ratio.`,
    };
  }

  if (chronic === 0) {
    return {
      ...base,
      ratio: null,
      completeness: "unavailable",
      note: "No chronic load to compare against.",
    };
  }

  const ratio = acute / chronic;
  const completeness: LoadCompleteness = coveredDays >= FULL_COVERAGE_DAYS ? "observed" : "partial";

  return {
    ...base,
    ratio,
    completeness,
    note:
      completeness === "observed"
        ? `${acuteDays}-day load against ${chronicDays}-day load, ${coveredDays} of ${chronicDays} days with sessions.`
        : `Computed on ${coveredDays} of ${chronicDays} days. Treat as provisional.`,
  };
}

/** One decimal, or a dash. Callers must not format a null themselves. */
export function formatRatio(result: AcwrResult): string {
  return result.ratio === null ? "--" : result.ratio.toFixed(2);
}

/**
 * ENVIRONMENT — what we show, and whose statement it is.
 *
 * The brief asks for "the recognized activity-modification guidance surfaced
 * as reference, attributed to its source, never as an instruction the system
 * issues on its own."
 *
 * The recognised guidance is published by professional bodies as WBGT tables.
 * This repo does not hold that document, and attributing specific thresholds
 * to a professional body without it would be fabricating a citation on a
 * medical-adjacent surface. So the reference shown here is the AForce heat
 * engine's own band, attributed to the engine, and the external table is
 * declared as program-configurable and NOT SHIPPED. See the Phase 5 report.
 */
export interface EnvironmentReference {
  /** Heat index in Fahrenheit, or null when nothing was measured. */
  heatIndexF: number | null;
  /** Whether a real local reading produced it. */
  measured: boolean;
  /** Band label from the engine, or null without a reading. */
  band: string | null;
  /** The engine's own short directive for that band. */
  directive: string | null;
  /** Who is saying it. Rendered inline, never omitted. */
  source: string;
  /** Present when the program has not supplied its own WBGT table. */
  externalGuidanceNote: string | null;
}

export const ENGINE_SOURCE = "AForce heat engine (services/heatRiskEngine.ts)";

export const EXTERNAL_GUIDANCE_UNSET =
  "No program WBGT activity-modification table is configured. Staff guidance is not shown.";

export function buildEnvironmentReference(input: {
  heatIndexF: number | null;
  measured: boolean;
  band?: string | null;
  directive?: string | null;
  programGuidance?: { label: string; source: string } | null;
}): EnvironmentReference {
  // An unmeasured reading is not a reading. The heat engine already refuses to
  // explain a heat index it did not observe, and this mirrors that.
  if (input.heatIndexF === null || !input.measured) {
    return {
      heatIndexF: null,
      measured: false,
      band: null,
      directive: null,
      source: ENGINE_SOURCE,
      externalGuidanceNote: input.programGuidance ? null : EXTERNAL_GUIDANCE_UNSET,
    };
  }

  return {
    heatIndexF: input.heatIndexF,
    measured: true,
    band: input.band ?? null,
    directive: input.directive ?? null,
    source: input.programGuidance ? input.programGuidance.source : ENGINE_SOURCE,
    externalGuidanceNote: input.programGuidance ? null : EXTERNAL_GUIDANCE_UNSET,
  };
}
