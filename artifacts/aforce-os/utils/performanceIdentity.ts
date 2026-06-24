/**
 * Performance Identity™ — FOUNDATION + raw signal capture ONLY (Phase 2).
 *
 * The long-term vision for Performance Identity is "the system understands what
 * KIND of performer you are" — a single archetype (Operator / Warrior /
 * Optimizer / Builder / Recoverer) inferred from behaviour. This module lays
 * the foundation for that and NOTHING MORE:
 *
 *   1. It declares the archetype VOCABULARY as a type (+ an inert const list)
 *      so future work has a stable contract to map onto.
 *   2. It projects the already-derived Unified Performance Memory snapshot into
 *      a small set of RAW behavioural signals the future classifier would read.
 *
 * ── The classifier is deliberately INERT ──────────────────────────────────
 * There is ZERO archetype-assignment logic in this build. `derivePerformance
 * Identity` HARDCODES `archetype: null` and `confidence: null`; no function
 * here ever reads `PERFORMANCE_ARCHETYPES`, branches on a signal to pick an
 * archetype, or computes a confidence. The const list exists purely as the
 * (currently unused) target vocabulary. Tests pin this: even with maximally
 * strong signals the result stays `{ archetype: null, confidence: null }`.
 *
 * ── Pure read-through ─────────────────────────────────────────────────────
 * Every signal is a straight projection of `UnifiedPerformanceMemory`, which
 * is itself a read-through of the live stores. This module derives no new math
 * of its own — it only re-shapes what Performance Memory already computed.
 *
 * ── Score-Protection (hard lock) ──────────────────────────────────────────
 * Strictly read-only. It MEASURES / re-shapes already-recorded behaviour and
 * NEVER reads into, awards, mutates, or fabricates the performance score, and
 * (like every read adapter) never feeds anything back into Command Confidence.
 * There are deliberately NO imports from any scoring / engine / store module.
 *
 * ── No fabrication ────────────────────────────────────────────────────────
 * Empty sources pass straight through as their honest neutral values
 * (available:false, counts 0, rates null) — never an invented number.
 *
 * Pure + RN-free (type-only imports are erased at build) so it stays
 * unit-testable under the vitest pure-test runner.
 */

import type { UnifiedPerformanceMemory } from './performanceMemoryUnified';
import type { ExecutionTrend } from './intelligence/executionMemory';

// ─── Archetype vocabulary (TYPE ONLY — no assignment logic anywhere) ────────

/**
 * The five Performance Identity archetypes. This is the FUTURE classifier's
 * output vocabulary. It is intentionally inert: nothing in this module maps a
 * signal onto one of these values. It exists so downstream work has a stable
 * type to target without re-defining it.
 */
export type PerformanceArchetype =
  | 'Operator'
  | 'Warrior'
  | 'Optimizer'
  | 'Builder'
  | 'Recoverer';

/**
 * Inert enumeration of the archetypes for future UIs / classifiers. NOT read
 * by any derivation in this module — assigning an archetype is explicitly out
 * of scope for this build.
 */
export const PERFORMANCE_ARCHETYPES: readonly PerformanceArchetype[] = [
  'Operator',
  'Warrior',
  'Optimizer',
  'Builder',
  'Recoverer',
] as const;

// ─── Raw signals (what a future classifier would read) ──────────────────────

/** How regularly the member shows up (hydration logging + morning check-ins). */
export interface ConsistencySignal {
  available: boolean;
  hydrationDaysActive: number;
  hydrationLogs: number;
  checkInStreak: number;
  checkInEntries: number;
}

/** Lifetime command-completion ratio (all-time + recent windowed rate). */
export interface CompletionRateSignal {
  available: boolean;
  followed: number;
  total: number;
  /** All-time followed / total, or null with no confirmations. */
  allTimeRate: number | null;
  /** Recent (trailing-window) follow-rate, or null below the sample floor. */
  recentRate: number | null;
}

/** Current recovery posture (snapshot only — the recovery engine is stateless). */
export interface RecoveryBehaviorSignal {
  available: boolean;
  recovery: number | null;
  pressure: number | null;
  trend: string | null;
}

/** Momentum: execution streak + its trend + the morning check-in streak. */
export interface StreakBehaviorSignal {
  available: boolean;
  executionStreak: number;
  executionTrend: ExecutionTrend | null;
  checkInStreak: number;
}

/** Recent adherence + which command types the member actually follows. */
export interface AdherenceSignal {
  available: boolean;
  recentFollowedRate: number | null;
  preferredCommandTypes: { commandType: string; followedCount: number }[];
}

export interface PerformanceIdentitySignals {
  consistency: ConsistencySignal;
  completionRate: CompletionRateSignal;
  recoveryBehavior: RecoveryBehaviorSignal;
  streakBehavior: StreakBehaviorSignal;
  adherence: AdherenceSignal;
}

export interface PerformanceIdentity {
  /**
   * ALWAYS null in this build. The classifier is INERT — no archetype is ever
   * assigned. Typed as nullable so a future classifier can populate it without
   * a shape change.
   */
  archetype: PerformanceArchetype | null;
  /** ALWAYS null in this build. No confidence is computed. */
  confidence: number | null;
  supportingSignals: PerformanceIdentitySignals;
  lastUpdated: number | null;
}

// ─── Derivation (raw signals only — ZERO archetype mapping) ──────────────────

/**
 * Project the Unified Performance Memory snapshot into the five raw identity
 * signals. PURE re-shaping — no new math, no archetype logic, no fabrication.
 */
export function derivePerformanceIdentitySignals(
  memory: UnifiedPerformanceMemory,
): PerformanceIdentitySignals {
  const { hydrationPatterns, checkInHistory, completionHistory, recoveryPatterns, executionStreaks, preferredCommandTypes } =
    memory;

  const consistency: ConsistencySignal = {
    available: hydrationPatterns.coverage.available || checkInHistory.entriesLogged > 0,
    hydrationDaysActive: hydrationPatterns.daysActive,
    hydrationLogs: hydrationPatterns.totalLogs,
    checkInStreak: checkInHistory.streak,
    checkInEntries: checkInHistory.entriesLogged,
  };

  const completionRate: CompletionRateSignal = {
    available: completionHistory.total > 0,
    followed: completionHistory.followed,
    total: completionHistory.total,
    allTimeRate: completionHistory.followedRate,
    recentRate: completionHistory.recentFollowedRate,
  };

  const recoveryBehavior: RecoveryBehaviorSignal = {
    available: recoveryPatterns.available,
    recovery: recoveryPatterns.recovery,
    pressure: recoveryPatterns.pressure,
    trend: recoveryPatterns.trend,
  };

  const streakBehavior: StreakBehaviorSignal = {
    available:
      executionStreaks.status === 'ready' ||
      executionStreaks.executionStreak > 0 ||
      checkInHistory.streak > 0,
    executionStreak: executionStreaks.executionStreak,
    executionTrend: executionStreaks.trend,
    checkInStreak: checkInHistory.streak,
  };

  const adherence: AdherenceSignal = {
    available: completionHistory.recentFollowedRate !== null,
    recentFollowedRate: completionHistory.recentFollowedRate,
    preferredCommandTypes: preferredCommandTypes.map((p) => ({
      commandType: p.commandType,
      followedCount: p.followedCount,
    })),
  };

  return { consistency, completionRate, recoveryBehavior, streakBehavior, adherence };
}

/**
 * Assemble the Performance Identity record. The classifier is INERT:
 * `archetype` and `confidence` are HARDCODED null — there is intentionally no
 * mapping from signals to an archetype in this build. Only the raw signals and
 * the snapshot's freshness pass through.
 */
export function derivePerformanceIdentity(
  memory: UnifiedPerformanceMemory,
): PerformanceIdentity {
  return {
    archetype: null,
    confidence: null,
    supportingSignals: derivePerformanceIdentitySignals(memory),
    lastUpdated: memory.lastUpdated,
  };
}
