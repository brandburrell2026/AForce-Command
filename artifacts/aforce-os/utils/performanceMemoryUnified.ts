/**
 * Unified Performance Memory — pure, read-through aggregator.
 *
 * Performance Memory™ is "the system remembers you". Until now that memory was
 * scattered across separate read surfaces (Execution Memory, the morning
 * check-in recap, Performance Age trend) and three behaviour streams weren't
 * captured at all (travel, caffeine, self-reported priority). This module is
 * the SINGLE read-through that folds them all into one descriptive snapshot.
 *
 * ── Pure read-through ─────────────────────────────────────────────────────
 * Every field is a projection of data that ALREADY EXISTS in the app's live
 * stores. The hook wires the stores in; this function only describes them. It
 * composes the existing pure engines (`computeExecutionMemory`,
 * `computePerformanceMemory`, `computePerformanceAgeTrend`,
 * `deriveLedgerAdherence`) rather than re-deriving their math, so the unified
 * view can never disagree with the individual surfaces.
 *
 * ── Score-Protection (hard lock) ──────────────────────────────────────────
 * Strictly read-only. It MEASURES recorded behaviour and NEVER reads into,
 * awards, mutates, or fabricates the performance score, and (like every read
 * adapter) the follow-rate it surfaces is never fed back into Command
 * Confidence. There are deliberately NO imports from any scoring / engine
 * module here.
 *
 * ── No fabrication ────────────────────────────────────────────────────────
 * Empty sources map to honest neutral values (available:false, counts 0,
 * rates null, arrays empty) — never an invented number. Each source carries
 * its own coverage metadata so a consumer can tell "no data" from "low data".
 *
 * Pure + RN-free (type-only app imports are erased at build) so it stays
 * unit-testable under the vitest pure-test runner. `nowMs` is injected.
 */

import {
  eventsByKind,
  type CommandEvent,
} from './intelligence/commandEvents';
import { deriveLedgerAdherence } from './intelligence/commandEventAdapters';
import {
  computeExecutionMemory,
  type ExecutionTrend,
} from './intelligence/executionMemory';
import {
  computePerformanceMemory,
  type PerformanceMemoryEntry,
  type PerformanceMemoryResult,
} from './performanceMemory';
import {
  computePerformanceAgeTrend,
  type PerformanceAgeDailySnapshot,
  type PerformanceAgeTrend,
} from './performanceAge';
import type {
  TravelSignal,
  CaffeineSignal,
  UserPrioritySignal,
} from './performanceMemorySignals';

const MS_PER_DAY = 86_400_000;

/** Window (days) used for the Performance Age trend roll-up. */
export const PERFORMANCE_AGE_TREND_WINDOW_DAYS = 30;

/** How many "preferred command types" the roll-up surfaces. */
export const PREFERRED_COMMAND_TYPES_LIMIT = 5;

// ─── Inputs ───────────────────────────────────────────────────────────────

/** One point of hydration behaviour, projected from `state.history`. */
export interface HydrationHistoryPoint {
  atMs: number;
  score: number;
}

/** Current recovery read, projected from `deriveRecoverySnapshot`. */
export interface RecoveryPatternInput {
  recovery: number;
  pressure: number;
  trend: string;
}

export interface UnifiedPerformanceMemoryInputs {
  nowMs?: number;
  /** The shared Command-Event Ledger (confirmations, perf-age, etc.). */
  ledgerEvents?: readonly CommandEvent[];
  /** Hydration behaviour points from `state.history`. */
  hydrationHistory?: readonly HydrationHistoryPoint[];
  /** Morning Voice Check-In entries (authoritative source). */
  checkIns?: readonly PerformanceMemoryEntry[];
  /** Performance Age daily snapshots. */
  performanceAgeSnapshots?: readonly PerformanceAgeDailySnapshot[];
  /** Current recovery snapshot, or null when unavailable. */
  recovery?: RecoveryPatternInput | null;
  /** Capture streams from `services/performanceMemoryCapture.ts`. */
  travel?: readonly TravelSignal[];
  caffeine?: readonly CaffeineSignal[];
  priorities?: readonly UserPrioritySignal[];
}

// ─── Output ─────────────────────────────────────────────────────────────────

/** Per-source completeness so consumers can tell "no data" from "low data". */
export interface SourceCoverage {
  available: boolean;
  sampleSize: number;
  firstDayIndex: number | null;
  lastDayIndex: number | null;
}

export interface HydrationPatterns {
  coverage: SourceCoverage;
  totalLogs: number;
  daysActive: number;
  avgScore: number | null;
  latestScore: number | null;
}

export interface CaffeinePatterns {
  coverage: SourceCoverage;
  totalLogs: number;
  daysWithCaffeine: number;
  byCategory: Record<string, number>;
}

export interface TravelPatterns {
  coverage: SourceCoverage;
  travelDays: number;
}

export interface UserPriorities {
  coverage: SourceCoverage;
  daysRecorded: number;
  byGoal: Record<string, number>;
  topGoal: string | null;
}

export interface CommandHistorySummary {
  coverage: SourceCoverage;
  totalConfirmations: number;
}

export interface CompletionHistorySummary {
  coverage: SourceCoverage;
  followed: number;
  total: number;
  /** All-time followed / total, or null when there are no confirmations. */
  followedRate: number | null;
  /** Recent (trailing-window) follow-rate from the adherence primitive. */
  recentFollowedRate: number | null;
}

export interface ExecutionStreakSummary {
  status: 'empty' | 'insufficient' | 'ready';
  executionStreak: number;
  trend: ExecutionTrend | null;
}

export interface CheckInHistorySummary {
  status: PerformanceMemoryResult['status'];
  entriesLogged: number;
  streak: number;
  energyTrend: PerformanceMemoryResult['energyTrend'];
}

export interface RecoveryPatterns {
  available: boolean;
  recovery: number | null;
  pressure: number | null;
  trend: string | null;
}

export interface PerformanceAgeHistorySummary {
  coverage: SourceCoverage;
  daysOfHistory: number;
  latest: number | null;
  trend: PerformanceAgeTrend;
}

export interface PreferredCommandType {
  commandType: string;
  followedCount: number;
}

export interface UnifiedPerformanceMemory {
  hydrationPatterns: HydrationPatterns;
  caffeinePatterns: CaffeinePatterns;
  travelPatterns: TravelPatterns;
  userPriorities: UserPriorities;
  commandHistory: CommandHistorySummary;
  completionHistory: CompletionHistorySummary;
  executionStreaks: ExecutionStreakSummary;
  checkInHistory: CheckInHistorySummary;
  recoveryPatterns: RecoveryPatterns;
  performanceAgeHistory: PerformanceAgeHistorySummary;
  preferredCommandTypes: PreferredCommandType[];
  /** Newest observed data timestamp across all sources, or null when empty. */
  lastUpdated: number | null;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function isFiniteNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

function utcDay(ms: number): number {
  return Math.floor(ms / MS_PER_DAY);
}

function coverageFromDays(days: number[], sampleSize: number): SourceCoverage {
  if (days.length === 0 || sampleSize === 0) {
    return { available: false, sampleSize, firstDayIndex: null, lastDayIndex: null };
  }
  let min = days[0];
  let max = days[0];
  for (const d of days) {
    if (d < min) min = d;
    if (d > max) max = d;
  }
  return { available: true, sampleSize, firstDayIndex: min, lastDayIndex: max };
}

// ─── Aggregator ──────────────────────────────────────────────────────────────

export function deriveUnifiedPerformanceMemory(
  inputs: UnifiedPerformanceMemoryInputs = {},
): UnifiedPerformanceMemory {
  const now = isFiniteNumber(inputs.nowMs) ? inputs.nowMs : Date.now();
  const ledgerEvents = inputs.ledgerEvents ?? [];
  const hydrationHistory = inputs.hydrationHistory ?? [];
  const checkIns = inputs.checkIns ?? [];
  const perfAgeSnapshots = inputs.performanceAgeSnapshots ?? [];
  const travel = inputs.travel ?? [];
  const caffeine = inputs.caffeine ?? [];
  const priorities = inputs.priorities ?? [];

  let lastUpdated: number | null = null;
  const touch = (ms: number | null | undefined): void => {
    if (isFiniteNumber(ms) && (lastUpdated === null || ms > lastUpdated)) lastUpdated = ms;
  };

  // ── Hydration patterns (from state.history) ──
  const hydrationDays = new Set<number>();
  let scoreSum = 0;
  let scoreCount = 0;
  let latestHydrationAt = -Infinity;
  let latestScore: number | null = null;
  for (const p of hydrationHistory) {
    if (!isFiniteNumber(p.atMs) || p.atMs <= 0) continue;
    hydrationDays.add(utcDay(p.atMs));
    touch(p.atMs);
    if (isFiniteNumber(p.score)) {
      scoreSum += p.score;
      scoreCount += 1;
      if (p.atMs > latestHydrationAt) {
        latestHydrationAt = p.atMs;
        latestScore = p.score;
      }
    }
  }
  const hydrationLogs = hydrationHistory.length;
  const hydrationPatterns: HydrationPatterns = {
    coverage: coverageFromDays([...hydrationDays], hydrationLogs),
    totalLogs: hydrationLogs,
    daysActive: hydrationDays.size,
    avgScore: scoreCount > 0 ? scoreSum / scoreCount : null,
    latestScore,
  };

  // ── Caffeine patterns (capture stream) ──
  const caffeineDays = new Set<number>();
  const caffeineByCategory: Record<string, number> = {};
  for (const c of caffeine) {
    caffeineDays.add(c.dayIndex);
    touch(c.atMs);
    const cat = typeof c.categoryId === 'string' && c.categoryId.length > 0
      ? c.categoryId
      : 'unspecified';
    caffeineByCategory[cat] = (caffeineByCategory[cat] ?? 0) + 1;
  }
  const caffeinePatterns: CaffeinePatterns = {
    coverage: coverageFromDays(caffeine.map((c) => c.dayIndex), caffeine.length),
    totalLogs: caffeine.length,
    daysWithCaffeine: caffeineDays.size,
    byCategory: caffeineByCategory,
  };

  // ── Travel patterns (capture stream) ──
  const travelDays = new Set<number>();
  for (const tDay of travel) {
    travelDays.add(tDay.dayIndex);
    touch(tDay.atMs);
  }
  const travelPatterns: TravelPatterns = {
    coverage: coverageFromDays(travel.map((tDay) => tDay.dayIndex), travel.length),
    travelDays: travelDays.size,
  };

  // ── User priorities (capture stream; latest per day) ──
  const latestPriorityByDay = new Map<number, UserPrioritySignal>();
  for (const p of priorities) {
    touch(p.atMs);
    const prev = latestPriorityByDay.get(p.dayIndex);
    if (!prev || p.atMs > prev.atMs) latestPriorityByDay.set(p.dayIndex, p);
  }
  const priorityByGoal: Record<string, number> = {};
  for (const p of latestPriorityByDay.values()) {
    priorityByGoal[p.goal] = (priorityByGoal[p.goal] ?? 0) + 1;
  }
  let topGoal: string | null = null;
  let topGoalCount = 0;
  for (const [goal, count] of Object.entries(priorityByGoal)) {
    if (count > topGoalCount) {
      topGoal = goal;
      topGoalCount = count;
    }
  }
  const userPriorities: UserPriorities = {
    coverage: coverageFromDays(
      [...latestPriorityByDay.keys()],
      latestPriorityByDay.size,
    ),
    daysRecorded: latestPriorityByDay.size,
    byGoal: priorityByGoal,
    topGoal,
  };

  // ── Command + completion history (from the ledger) ──
  const confirmations = eventsByKind(ledgerEvents, 'command_confirmation');
  let followed = 0;
  const confirmationDays: number[] = [];
  const preferredCounts = new Map<string, { count: number; lastAt: number }>();
  for (const c of confirmations) {
    confirmationDays.push(c.localDayIndex);
    touch(c.occurredAtMs);
    if (c.followed === true) {
      followed += 1;
      if (typeof c.commandType === 'string' && c.commandType.length > 0) {
        const prev = preferredCounts.get(c.commandType);
        if (prev) {
          prev.count += 1;
          if (c.occurredAtMs > prev.lastAt) prev.lastAt = c.occurredAtMs;
        } else {
          preferredCounts.set(c.commandType, { count: 1, lastAt: c.occurredAtMs });
        }
      }
    }
  }
  const totalConfirmations = confirmations.length;
  const commandHistory: CommandHistorySummary = {
    coverage: coverageFromDays(confirmationDays, totalConfirmations),
    totalConfirmations,
  };

  const adherence = deriveLedgerAdherence(ledgerEvents, now);
  const completionHistory: CompletionHistorySummary = {
    coverage: coverageFromDays(confirmationDays, totalConfirmations),
    followed,
    total: totalConfirmations,
    followedRate: totalConfirmations > 0 ? followed / totalConfirmations : null,
    recentFollowedRate: adherence.followedRate,
  };

  const preferredCommandTypes: PreferredCommandType[] = [...preferredCounts.entries()]
    .sort((a, b) => b[1].count - a[1].count || b[1].lastAt - a[1].lastAt)
    .slice(0, PREFERRED_COMMAND_TYPES_LIMIT)
    .map(([commandType, { count }]) => ({ commandType, followedCount: count }));

  // ── Execution streaks (from the ledger) ──
  const execution = computeExecutionMemory(ledgerEvents, now);
  const executionStreaks: ExecutionStreakSummary = {
    status: execution.status,
    executionStreak: execution.executionStreak,
    trend: execution.trend,
  };

  // ── Check-in history (Voice Check-In) ──
  for (const e of checkIns) {
    if (Number.isInteger(e.dayIndex)) touch(e.dayIndex * MS_PER_DAY);
  }
  const checkInResult = computePerformanceMemory([...checkIns], new Date(now));
  const checkInHistory: CheckInHistorySummary = {
    status: checkInResult.status,
    entriesLogged: checkInResult.entriesLogged,
    streak: checkInResult.streak,
    energyTrend: checkInResult.energyTrend,
  };

  // ── Recovery patterns (current snapshot only — engine is stateless) ──
  const rec = inputs.recovery ?? null;
  const recoveryPatterns: RecoveryPatterns = rec
    ? {
        available: true,
        recovery: isFiniteNumber(rec.recovery) ? rec.recovery : null,
        pressure: isFiniteNumber(rec.pressure) ? rec.pressure : null,
        trend: typeof rec.trend === 'string' ? rec.trend : null,
      }
    : { available: false, recovery: null, pressure: null, trend: null };

  // ── Performance Age history (from snapshots) ──
  const perfAgeDays = new Set<number>();
  let latestPerfAgeDay = -Infinity;
  let latestPerfAge: number | null = null;
  for (const s of perfAgeSnapshots) {
    if (!Number.isInteger(s.dayIndex) || !isFiniteNumber(s.performanceAge)) continue;
    perfAgeDays.add(s.dayIndex);
    touch(s.dayIndex * MS_PER_DAY);
    if (s.dayIndex > latestPerfAgeDay) {
      latestPerfAgeDay = s.dayIndex;
      latestPerfAge = s.performanceAge;
    }
  }
  const perfAgeTrend = computePerformanceAgeTrend(
    [...perfAgeSnapshots],
    PERFORMANCE_AGE_TREND_WINDOW_DAYS,
  );
  const performanceAgeHistory: PerformanceAgeHistorySummary = {
    coverage: coverageFromDays([...perfAgeDays], perfAgeDays.size),
    daysOfHistory: perfAgeTrend.daysOfHistory,
    latest: latestPerfAge,
    trend: perfAgeTrend,
  };

  return {
    hydrationPatterns,
    caffeinePatterns,
    travelPatterns,
    userPriorities,
    commandHistory,
    completionHistory,
    executionStreaks,
    checkInHistory,
    recoveryPatterns,
    performanceAgeHistory,
    preferredCommandTypes,
    lastUpdated,
  };
}
