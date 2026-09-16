/**
 * Morning Board — ordering, grouping and the "why" line.
 *
 * Phase 2 of `docs/TRAINER-DASHBOARD-BRIEF.md`. Pure functions, no React, no
 * colors, no I/O: everything the board decides is decided here so it can be
 * tested exhaustively without rendering a screen.
 *
 * Two rules from the brief drive the whole module:
 *
 *   "Roster sorted by *who needs me*, never alphabetically."
 *   "Exception-first: flagged athletes surface above the fold; everyone fine
 *    collapses into a single 'N clear' row that expands."
 *
 * Tiers come from `clutchTier` in the protected scoring engine — Phase 0
 * founder ruling: ONE band system, the engine's. No band names or thresholds
 * are redefined here; a score in means a tier out, and this module only
 * decides how urgent that tier is relative to everything else it knows.
 */

import { clutchRecommendation, clutchTier, type ClutchTier } from "./scoringEngine";

export type Availability = "available" | "limited" | "out" | "unset";

/** One athlete as the board needs them. Assembled by the caller. */
export interface BoardAthlete {
  athleteUserId: string;
  displayName: string;
  position: string;
  positionGroup: string;
  /** False means no health field is known to staff at all (Phase 1 gate). */
  consentGranted: boolean;
  hydrationScore: number | null;
  availability: Availability;
  questionnaireSubmitted: boolean;
  minutesSinceLastIntake: number | null;
  sleepHoursLastNight: number | null;
  /** Minutes since the last device sync. Null when nothing has ever synced. */
  minutesSinceSync: number | null;
  /** True for seeded demo rows. The row renders a SIMULATED marker. */
  isSimulated: boolean;
}

/**
 * Why a row is flagged, worst first. The order IS the sort order — a row's
 * reason and its position on the board come from the same list, so they can
 * never disagree.
 */
export const FLAG_REASONS = [
  "out", // staff have already ruled this athlete out
  "depleted", // engine tier DEPLETED — the pull recommendation
  "limited", // staff ruled limited
  "recovery", // engine tier RECOVERY
  "no_check_in", // questionnaire not submitted this morning
  "stale", // no sync in over 72h — the number on screen is old
  "no_consent", // athlete has not shared with staff; nothing is known
] as const;

export type FlagReason = (typeof FLAG_REASONS)[number];

const STALE_MINUTES = 72 * 60;

/** Minutes → "3h 20m" / "45m" / "4d". Used in the why line and nowhere else. */
export function formatElapsed(minutes: number): string {
  if (minutes < 60) return `${Math.round(minutes)}m`;
  if (minutes < 60 * 24) {
    const h = Math.floor(minutes / 60);
    const m = Math.round(minutes % 60);
    return m === 0 ? `${h}h` : `${h}h ${m}m`;
  }
  return `${Math.floor(minutes / (60 * 24))}d`;
}

/** Hours as a decimal → "5h 10m". Sleep is reported in hours by every provider. */
export function formatHours(hours: number): string {
  const total = Math.round(hours * 60);
  return formatElapsed(total);
}

/**
 * The tier for a row, or null when nothing is known.
 *
 * Consent is checked first: an athlete who has not shared has no tier, not a
 * DEPLETED one. Treating "no data" as the worst band would put an athlete who
 * simply has not opted in at the top of a medical triage list.
 */
export function tierFor(a: BoardAthlete): ClutchTier | null {
  if (!a.consentGranted || a.hydrationScore === null) return null;
  return clutchTier(a.hydrationScore);
}

/** The engine's command for a row, or null when there is no tier. */
export function commandFor(a: BoardAthlete): string | null {
  if (!a.consentGranted || a.hydrationScore === null) return null;
  return clutchRecommendation({ hydrationScore: a.hydrationScore, position: a.position }).command;
}

/** Every reason this row is flagged, worst first. Empty means clear. */
export function flagReasons(a: BoardAthlete): FlagReason[] {
  const reasons: FlagReason[] = [];
  const tier = tierFor(a);

  if (a.availability === "out") reasons.push("out");
  if (tier === "DEPLETED") reasons.push("depleted");
  if (a.availability === "limited") reasons.push("limited");
  if (tier === "RECOVERY") reasons.push("recovery");
  if (!a.questionnaireSubmitted) reasons.push("no_check_in");
  if (a.minutesSinceSync !== null && a.minutesSinceSync > STALE_MINUTES) reasons.push("stale");
  if (!a.consentGranted) reasons.push("no_consent");

  return reasons;
}

export function isFlagged(a: BoardAthlete): boolean {
  return flagReasons(a).length > 0;
}

/** Rank of the worst reason. Lower sorts higher. Clear rows rank last. */
export function urgencyRank(a: BoardAthlete): number {
  const reasons = flagReasons(a);
  if (reasons.length === 0) return FLAG_REASONS.length;
  return Math.min(...reasons.map((r) => FLAG_REASONS.indexOf(r)));
}

/**
 * The one line under the name: the single strongest contributing signal, in
 * plain language.
 *
 * Deliberately ONE line and one signal. The brief asks for "why", not a
 * breakdown — a trainer reading eighteen rows before practice cannot parse
 * three clauses per athlete, and the full picture is one tap away.
 *
 * Never diagnostic, never predictive. Every string here reports an observation
 * or a staff action already taken.
 */
export function whyLine(a: BoardAthlete): string {
  if (!a.consentGranted) return "Not sharing with staff yet.";
  if (a.minutesSinceSync !== null && a.minutesSinceSync > STALE_MINUTES) {
    return `Last sync ${formatElapsed(a.minutesSinceSync)} ago.`;
  }
  if (a.availability === "out") return "Out. Set by staff.";
  if (a.availability === "limited") return "Limited. Set by staff.";
  if (!a.questionnaireSubmitted) return "No check-in this morning.";
  if (a.sleepHoursLastNight !== null && a.sleepHoursLastNight < 6) {
    return `Slept ${formatHours(a.sleepHoursLastNight)}.`;
  }
  if (a.minutesSinceLastIntake !== null && a.minutesSinceLastIntake >= 120) {
    return `${formatElapsed(a.minutesSinceLastIntake)} since last intake.`;
  }
  if (a.hydrationScore !== null) return `Hydration ${a.hydrationScore}.`;
  return "No signal today.";
}

export interface RosterCounts {
  available: number;
  limited: number;
  out: number;
  unset: number;
  flagged: number;
  clear: number;
  total: number;
}

export function rosterCounts(athletes: readonly BoardAthlete[]): RosterCounts {
  const counts: RosterCounts = {
    available: 0,
    limited: 0,
    out: 0,
    unset: 0,
    flagged: 0,
    clear: 0,
    total: athletes.length,
  };
  for (const a of athletes) {
    counts[a.availability] += 1;
    if (isFlagged(a)) counts.flagged += 1;
    else counts.clear += 1;
  }
  return counts;
}

export interface BoardFilters {
  positionGroup?: string | null;
  availability?: Availability | null;
  flaggedOnly?: boolean;
  missingCheckInOnly?: boolean;
}

export function applyFilters(
  athletes: readonly BoardAthlete[],
  filters: BoardFilters,
): BoardAthlete[] {
  return athletes.filter((a) => {
    if (filters.positionGroup && a.positionGroup !== filters.positionGroup) return false;
    if (filters.availability && a.availability !== filters.availability) return false;
    if (filters.flaggedOnly && !isFlagged(a)) return false;
    if (filters.missingCheckInOnly && a.questionnaireSubmitted) return false;
    return true;
  });
}

/**
 * Sort by who needs me: urgency first, then the lower score, then name as the
 * final tie-break so the order is stable across renders.
 *
 * Name is ONLY a tie-break. Alphabetical order is what the brief forbids as a
 * primary sort, because it puts the alphabet ahead of the athlete.
 */
export function sortByNeed(athletes: readonly BoardAthlete[]): BoardAthlete[] {
  return [...athletes].sort((x, y) => {
    const rank = urgencyRank(x) - urgencyRank(y);
    if (rank !== 0) return rank;
    const sx = x.hydrationScore ?? Number.POSITIVE_INFINITY;
    const sy = y.hydrationScore ?? Number.POSITIVE_INFINITY;
    if (sx !== sy) return sx - sy;
    return x.displayName.localeCompare(y.displayName);
  });
}

export interface BoardPartition {
  flagged: BoardAthlete[];
  clear: BoardAthlete[];
}

/** Exception-first split. `clear` collapses behind one row in the UI. */
export function partitionBoard(athletes: readonly BoardAthlete[]): BoardPartition {
  const sorted = sortByNeed(athletes);
  return {
    flagged: sorted.filter(isFlagged),
    clear: sorted.filter((a) => !isFlagged(a)),
  };
}
