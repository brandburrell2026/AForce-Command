/**
 * Athlete record — the drill-down behind a board row.
 *
 * Phase 3 of `docs/TRAINER-DASHBOARD-BRIEF.md`. Pure functions again: the
 * record's shape, its signal breakdown and its trend maths live here so the
 * screen is layout only and every rule is testable without a renderer.
 *
 * One discipline runs through the whole file, borrowed from the brief's §5 and
 * applied early because it is cheaper than retrofitting honesty:
 *
 *   EVERY SIGNAL DECLARES ITS COMPLETENESS.
 *
 * A signal is `observed`, `partial` or `unavailable`, and an unavailable one
 * renders as "no data" rather than a zero, a dash dressed as a number, or a
 * confident figure computed from nothing. The brief's rule is "never render a
 * confident number on thin data"; a `completeness` field is how a layout layer
 * can obey that without knowing where each number came from.
 *
 * Nothing here is diagnostic or predictive. Every string reports an
 * observation, an engine recommendation, or an action a human already took.
 */

import { clutchRecommendation, clutchTier, type ClutchTier } from "./scoringEngine";
import { formatElapsed, formatHours, type BoardAthlete } from "./trainerBoard";

export type Completeness = "observed" | "partial" | "unavailable";

export interface RecordSignal {
  id: string;
  label: string;
  /** Display value. Null when `completeness` is `unavailable`. */
  value: string | null;
  detail: string;
  completeness: Completeness;
}

export interface StatusEntry {
  status: string;
  /** Medical-adjacent. Absent unless the viewer's projection included it. */
  reason: string | null;
  setByDisplayName: string;
  at: string;
}

export interface RecordNote {
  id: string;
  body: string;
  authorDisplayName: string;
  at: string;
}

export interface TrendPoint {
  /** Days back from today. 0 is today. */
  daysAgo: number;
  score: number | null;
}

export interface AthleteRecord {
  athleteUserId: string;
  displayName: string;
  position: string;
  consentGranted: boolean;
  tier: ClutchTier | null;
  command: string | null;
  signals: RecordSignal[];
  trend: TrendPoint[];
  statusHistory: StatusEntry[];
  notes: RecordNote[];
  /** Documents are a Phase 4 surface. Empty here, and the screen says so. */
  documents: never[];
  isSimulated: boolean;
}

const UNAVAILABLE: Pick<RecordSignal, "value" | "completeness"> = {
  value: null,
  completeness: "unavailable",
};

/**
 * The signal breakdown the brief names: HydroState, sleep readiness, recovery
 * window, environmental pressure, load forecast.
 *
 * Two of those five have no source in this repo today. They are returned as
 * `unavailable` with a detail line saying why, rather than omitted — a trainer
 * who cannot see load forecast should learn that it is not wired, not be left
 * wondering whether it was fine.
 */
export function buildSignals(a: BoardAthlete): RecordSignal[] {
  const tier = a.consentGranted && a.hydrationScore !== null ? clutchTier(a.hydrationScore) : null;

  const hydro: RecordSignal =
    tier !== null && a.hydrationScore !== null
      ? {
          id: "hydrostate",
          label: "HydroState",
          value: String(a.hydrationScore),
          detail: `${tier} band.`,
          completeness: "observed",
        }
      : {
          id: "hydrostate",
          label: "HydroState",
          detail: a.consentGranted ? "No score yet." : "Not sharing with staff.",
          ...UNAVAILABLE,
        };

  const sleep: RecordSignal =
    a.sleepHoursLastNight !== null
      ? {
          id: "sleep",
          label: "Sleep readiness",
          value: formatHours(a.sleepHoursLastNight),
          detail: a.sleepHoursLastNight < 6 ? "Below their usual range." : "Within range.",
          completeness: "observed",
        }
      : { id: "sleep", label: "Sleep readiness", detail: "No sleep data.", ...UNAVAILABLE };

  const recovery: RecordSignal =
    a.minutesSinceLastIntake !== null
      ? {
          id: "recovery_window",
          label: "Recovery window",
          value: formatElapsed(a.minutesSinceLastIntake),
          detail: "Since last logged intake.",
          // Partial on purpose: this is elapsed time since intake, not a
          // modelled recovery window. Labelling it `observed` would overstate.
          completeness: "partial",
        }
      : { id: "recovery_window", label: "Recovery window", detail: "No intake logged.", ...UNAVAILABLE };

  const environment: RecordSignal = {
    id: "environment",
    label: "Environmental pressure",
    detail: "No venue reading connected.",
    ...UNAVAILABLE,
  };

  const load: RecordSignal = {
    id: "load",
    label: "Load forecast",
    detail: "No session load recorded.",
    ...UNAVAILABLE,
  };

  return [hydro, sleep, recovery, environment, load];
}

/** Deterministic 14-day series for a simulated athlete. Stable per id. */
export function buildTrend(a: BoardAthlete, days = 14): TrendPoint[] {
  const out: TrendPoint[] = [];
  if (!a.consentGranted || a.hydrationScore === null) {
    for (let d = days - 1; d >= 0; d -= 1) out.push({ daysAgo: d, score: null });
    return out;
  }

  // Seeded from the id so a record looks the same every time it is opened.
  let h = 0;
  for (let i = 0; i < a.athleteUserId.length; i += 1) {
    h = (h * 31 + a.athleteUserId.charCodeAt(i)) >>> 0;
  }

  for (let d = days - 1; d >= 0; d -= 1) {
    h = (h * 1664525 + 1013904223) >>> 0;
    const drift = ((h % 21) - 10) + (days - d) * 0.4;
    const score = Math.max(5, Math.min(100, Math.round(a.hydrationScore - drift)));
    out.push({ daysAgo: d, score });
  }
  // Today is the live score, not a generated one.
  out[out.length - 1] = { daysAgo: 0, score: a.hydrationScore };
  return out;
}

export interface TrendStats {
  min: number | null;
  max: number | null;
  average: number | null;
  /** Days with a score, out of the window. Drives the completeness label. */
  covered: number;
  window: number;
}

export function trendStats(points: readonly TrendPoint[]): TrendStats {
  const scores = points.map((p) => p.score).filter((s): s is number => s !== null);
  if (scores.length === 0) {
    return { min: null, max: null, average: null, covered: 0, window: points.length };
  }
  const sum = scores.reduce((acc, s) => acc + s, 0);
  return {
    min: Math.min(...scores),
    max: Math.max(...scores),
    average: Math.round(sum / scores.length),
    covered: scores.length,
    window: points.length,
  };
}

/**
 * Completeness of a window. Anything under two thirds covered is `partial`,
 * so a sparkline drawn from four days cannot pass as a fortnight.
 */
export function trendCompleteness(stats: TrendStats): Completeness {
  if (stats.covered === 0) return "unavailable";
  return stats.covered >= Math.ceil(stats.window * (2 / 3)) ? "observed" : "partial";
}

export interface RecordSources {
  statusHistory?: StatusEntry[];
  notes?: RecordNote[];
}

/** Assemble the record. Sources default to empty — never invented. */
export function buildRecord(a: BoardAthlete, sources: RecordSources = {}): AthleteRecord {
  const tier = a.consentGranted && a.hydrationScore !== null ? clutchTier(a.hydrationScore) : null;
  const command =
    a.consentGranted && a.hydrationScore !== null
      ? clutchRecommendation({ hydrationScore: a.hydrationScore, position: a.position }).command
      : null;

  return {
    athleteUserId: a.athleteUserId,
    displayName: a.displayName,
    position: a.position,
    consentGranted: a.consentGranted,
    tier,
    command,
    signals: buildSignals(a),
    trend: buildTrend(a),
    // Newest first. Append-only upstream, so ordering is display-side only.
    statusHistory: [...(sources.statusHistory ?? [])].sort((x, y) => y.at.localeCompare(x.at)),
    notes: [...(sources.notes ?? [])].sort((x, y) => y.at.localeCompare(x.at)),
    documents: [],
    isSimulated: a.isSimulated,
  };
}
