/**
 * Performance Memory™ — pure recap layer (NEW).
 *
 * Rolls the persisted Voice Check-In history up into a display-only recap:
 * how many mornings have been logged, the current consecutive-day streak,
 * the latest vs previous reported energy, and an energy trend. It is the
 * "the system remembers you" surface on Home.
 *
 * Strictly READ-ONLY / pure: imports nothing from services, stores, React,
 * or I/O, and never awards or mutates score (Score-Protection). It reports
 * only what the handed-in history actually contains — an empty history
 * returns a neutral "first check-in" recap, never a fabricated streak.
 */

export type EnergyTrend = 'rising' | 'steady' | 'declining';

/** Hard cap on how many days the recap will consider (defence in depth). */
export const PERFORMANCE_MEMORY_MAX_ENTRIES = 90;

/** A lightweight check-in entry the recap consumes (decoupled from records). */
export interface PerformanceMemoryEntry {
  /** Local day number (integer) — ordering + streak gap detection. */
  dayIndex: number;
  /** Reported energy 1–5. */
  energy: number;
  /** Reported stress 1–5. */
  stress: number;
  /** Selected goal id. */
  goal: string;
}

export interface PerformanceMemorySample {
  energy: number;
  stress: number;
  goal: string;
}

export interface PerformanceMemoryResult {
  /** 'empty' until at least one check-in exists, then 'ready'. */
  status: 'empty' | 'ready';
  /** Distinct days logged. */
  entriesLogged: number;
  /**
   * Consecutive-day streak ending at the most recent entry, counted as still
   * live only when the latest entry is today or yesterday relative to `now`.
   * A gap resets it to the run ending at the latest entry.
   */
  streak: number;
  /** The most recent check-in, or null. */
  latest: PerformanceMemorySample | null;
  /** The check-in before the latest, or null. */
  previous: PerformanceMemorySample | null;
  /** latest.energy vs previous.energy, or null when there is no previous. */
  energyTrend: EnergyTrend | null;
  /** One-line plain recap. */
  recap: string;
}

/**
 * Compute the Performance Memory recap. Pure + deterministic.
 *
 * `now` is used only to decide whether the streak is still "live" (latest
 * entry is today or yesterday) — it never fabricates data.
 */
export function computePerformanceMemory(
  entries: PerformanceMemoryEntry[],
  now: Date,
): PerformanceMemoryResult {
  // Dedupe by day (latest wins) and order ascending.
  const byDay = new Map<number, PerformanceMemoryEntry>();
  for (const e of entries) {
    if (!isFiniteNumber(e.dayIndex)) continue;
    if (!isFiniteNumber(e.energy) || !isFiniteNumber(e.stress)) continue;
    byDay.set(e.dayIndex, e);
  }
  const ordered = [...byDay.values()]
    .sort((a, b) => a.dayIndex - b.dayIndex)
    .slice(-PERFORMANCE_MEMORY_MAX_ENTRIES);

  const entriesLogged = ordered.length;
  if (entriesLogged === 0) {
    return {
      status: 'empty',
      entriesLogged: 0,
      streak: 0,
      latest: null,
      previous: null,
      energyTrend: null,
      recap: 'Your first check-in starts your performance memory.',
    };
  }

  const latestEntry = ordered[ordered.length - 1];
  const previousEntry = ordered.length >= 2 ? ordered[ordered.length - 2] : null;

  // Streak: walk back while days are consecutive.
  let streak = 1;
  for (let i = ordered.length - 1; i > 0; i--) {
    if (ordered[i].dayIndex - ordered[i - 1].dayIndex === 1) streak++;
    else break;
  }
  // Live only when the latest entry is today or yesterday.
  const nowIndex = localDayIndexOf(now);
  const gapFromNow = nowIndex - latestEntry.dayIndex;
  if (gapFromNow > 1) streak = 0;

  const latest: PerformanceMemorySample = {
    energy: latestEntry.energy,
    stress: latestEntry.stress,
    goal: latestEntry.goal,
  };
  const previous: PerformanceMemorySample | null = previousEntry
    ? {
        energy: previousEntry.energy,
        stress: previousEntry.stress,
        goal: previousEntry.goal,
      }
    : null;

  const energyTrend: EnergyTrend | null = previous
    ? latest.energy > previous.energy
      ? 'rising'
      : latest.energy < previous.energy
        ? 'declining'
        : 'steady'
    : null;

  return {
    status: 'ready',
    entriesLogged,
    streak,
    latest,
    previous,
    energyTrend,
    recap: buildRecap(entriesLogged, streak, energyTrend),
  };
}

function buildRecap(
  entriesLogged: number,
  streak: number,
  energyTrend: EnergyTrend | null,
): string {
  if (entriesLogged === 1) {
    return 'First morning logged — keep the streak going.';
  }
  const streakPart =
    streak >= 2 ? `${streak}-day check-in streak.` : 'Streak reset — check in to rebuild it.';
  const trendPart =
    energyTrend === 'rising'
      ? ' Energy up since your last check-in.'
      : energyTrend === 'declining'
        ? ' Energy down since last time — start with water.'
        : energyTrend === 'steady'
          ? ' Energy steady since your last check-in.'
          : '';
  return `${streakPart}${trendPart}`;
}

// ─── internals ────────────────────────────────────────────────────────

/** Local day number for a Date (kept inline so this module stays dependency-free). */
function localDayIndexOf(date: Date): number {
  return Math.floor(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86_400_000,
  );
}

function isFiniteNumber(n: unknown): n is number {
  return typeof n === 'number' && Number.isFinite(n);
}
