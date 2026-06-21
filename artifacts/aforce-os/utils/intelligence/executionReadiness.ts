/**
 * executionReadiness — the ExecutionEngine (Tier-1 Intelligence Core, Step 4).
 *
 * A NEW, standalone metric that estimates how consistently the member is
 * EXECUTING on their commands and rituals, read entirely from the shared
 * Command-Event Ledger. It is deliberately SEPARATE from the three existing
 * engines (Command Confidence, Performance Memory, Performance Age).
 *
 * HARD LOCKS:
 *  - Score-Protection: this is a SANDBOX metric. It only MEASURES the ledger.
 *    Its output (`score`) is NOT a hydration / performance / recovery score
 *    and is NEVER read by `deriveCommandConfidence`, the Performance Index,
 *    Performance Age, or the hydration reducer. Nothing here awards, mutates,
 *    or fabricates a real score. To keep that guarantee, no scoring module
 *    imports this file.
 *  - No fabrication: each signal contributes ONLY when it has real data. A
 *    `score` is returned (0..100) only when at least
 *    `EXECUTION_MIN_READY_SIGNALS` independent signals corroborate; otherwise
 *    the status is `insufficient` / `collecting` and `score` is `null`. The
 *    weighted average is renormalized over the weights of the signals that
 *    actually have data — absent signals are dropped, never defaulted to a
 *    favorable (or unfavorable) value.
 *
 * The reserved execution event families (lock-in / protocol / recovery /
 * performance / generic execution telemetry) have NO live runtime source yet,
 * so the `executionFamily` signal is effectively always "no data" today. It is
 * wired in now so that once those events begin flowing — in a later,
 * separately-approved step — this metric already accounts for them with no
 * further change.
 *
 * Dependency-light + RN-free so it loads under the vitest pure-test runner.
 */

import { eventsInWindow, type CommandEvent } from './commandEvents';
import { deriveLedgerAdherence, type LedgerAdherence } from './commandEventAdapters';

const MS_PER_DAY = 86_400_000;

// ─── Tunables ────────────────────────────────────────────────────────────────────

/** Rolling window (days) for the behaviour / check-in consistency signals. */
export const EXECUTION_CONSISTENCY_WINDOW_DAYS = 7;
/** Minimum intake events in-window before behaviour consistency reports data. */
export const EXECUTION_BEHAVIOR_MIN_EVENTS = 3;
/** Minimum distinct check-in days in-window before that signal reports data. */
export const EXECUTION_CHECKIN_MIN_DAYS = 2;
/** Execution-family event count that maps to a full (1.0) family signal. */
export const EXECUTION_FAMILY_TARGET = 5;
/** Independent signals required before a numeric score is committed. */
export const EXECUTION_MIN_READY_SIGNALS = 2;

/**
 * Signal weights. Command adherence (did they follow what they were told) is
 * the strongest execution evidence, then sustained behaviour, then check-in
 * cadence, then explicit execution-family telemetry (future). Weights only
 * matter relative to one another; the score renormalizes over whichever
 * signals have data.
 */
export const EXECUTION_WEIGHTS = {
  adherence: 0.45,
  behaviorConsistency: 0.3,
  checkInConsistency: 0.15,
  executionFamily: 0.1,
} as const;

// ─── Shapes ──────────────────────────────────────────────────────────────────────

export type ExecutionReadinessStatus = 'insufficient' | 'collecting' | 'ready';

export interface ExecutionSignal {
  /** Normalized 0..1 contribution, or null when this signal has no data. */
  value: number | null;
  /** True only when there is enough real data for this signal to count. */
  hasData: boolean;
}

export interface ExecutionReadinessResult {
  status: ExecutionReadinessStatus;
  /** 0..100 ONLY when status === 'ready'; null otherwise (no fabrication). */
  score: number | null;
  /** Signal ids that had real data and fed the score. */
  signalsUsed: string[];
  /** Machine-readable status reason codes — NOT user copy (engine is UI-less). */
  reasons: string[];
  /** Per-signal diagnostics (read-only, advisory). */
  signals: {
    adherence: ExecutionSignal & { detail: LedgerAdherence };
    behaviorConsistency: ExecutionSignal & { activeDays: number; totalEvents: number };
    checkInConsistency: ExecutionSignal & { activeDays: number };
    executionFamily: ExecutionSignal & { count: number };
  };
}

// ─── Helpers ───────────────────────────────────────────────────────────────────────

function clamp01(v: number): number {
  if (!Number.isFinite(v)) return 0;
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

/** Count of distinct `localDayIndex` values across the given events. */
function distinctDays(events: readonly CommandEvent[]): number {
  const seen = new Set<number>();
  for (const e of events) seen.add(e.localDayIndex);
  return seen.size;
}

/**
 * Count "execution done" events: completed lifecycles + sessions + generic
 * execution telemetry. STARTED-only markers and accept/reject events are not
 * counted (a started ritual is not yet executed). Always 0 today — no source.
 */
function countExecutionFamily(events: readonly CommandEvent[]): number {
  let n = 0;
  for (const e of events) {
    if (
      e.kind === 'execution_event' ||
      e.kind === 'lock_in_completed' ||
      e.kind === 'protocol_completed' ||
      e.kind === 'recovery_session' ||
      e.kind === 'performance_session'
    ) {
      n += 1;
    }
  }
  return n;
}

// ─── Engine ──────────────────────────────────────────────────────────────────────

/**
 * Compute Execution Readiness from the ledger. Pure and read-only.
 *
 * @param events the full Command-Event Ledger (oldest → newest or any order).
 * @param now    evaluation time (ms epoch); defaults to `Date.now()`.
 */
export function computeExecutionReadiness(
  events: readonly CommandEvent[],
  now: number = Date.now(),
): ExecutionReadinessResult {
  const evaluatedAt = Number.isFinite(now) ? now : Date.now();
  const windowMs = EXECUTION_CONSISTENCY_WINDOW_DAYS * MS_PER_DAY;
  const inWindow = eventsInWindow(events, evaluatedAt - windowMs, evaluatedAt);

  // 1. Command adherence — sample-gated (≥ ADHERENCE_MIN_SAMPLES) by the
  //    shared learning primitive; insufficient ⇒ no data (never guessed).
  const adherence = deriveLedgerAdherence(events, evaluatedAt);
  const adherenceSignal: ExecutionSignal =
    adherence.status === 'ready' && adherence.followedRate !== null
      ? { value: clamp01(adherence.followedRate), hasData: true }
      : { value: null, hasData: false };

  // 2. Behaviour consistency — distinct active days of hydration logging.
  const intakeInWindow = inWindow.filter((e) => e.kind === 'intake');
  const behaviorDays = distinctDays(intakeInWindow);
  const behaviorHasData = intakeInWindow.length >= EXECUTION_BEHAVIOR_MIN_EVENTS;
  const behaviorSignal: ExecutionSignal = behaviorHasData
    ? { value: clamp01(behaviorDays / EXECUTION_CONSISTENCY_WINDOW_DAYS), hasData: true }
    : { value: null, hasData: false };

  // 3. Check-in consistency — distinct days with a voice check-in.
  const checkinsInWindow = inWindow.filter((e) => e.kind === 'voice_checkin');
  const checkinDays = distinctDays(checkinsInWindow);
  const checkinHasData = checkinDays >= EXECUTION_CHECKIN_MIN_DAYS;
  const checkinSignal: ExecutionSignal = checkinHasData
    ? { value: clamp01(checkinDays / EXECUTION_CONSISTENCY_WINDOW_DAYS), hasData: true }
    : { value: null, hasData: false };

  // 4. Execution-family telemetry — reserved; no live source yet (count 0).
  const familyCount = countExecutionFamily(inWindow);
  const familyHasData = familyCount > 0;
  const familySignal: ExecutionSignal = familyHasData
    ? { value: clamp01(familyCount / EXECUTION_FAMILY_TARGET), hasData: true }
    : { value: null, hasData: false };

  // Collect only the signals that have real data, with their weights.
  const contributing: Array<{ id: string; weight: number; value: number }> = [];
  if (adherenceSignal.hasData) {
    contributing.push({ id: 'adherence', weight: EXECUTION_WEIGHTS.adherence, value: adherenceSignal.value as number });
  }
  if (behaviorSignal.hasData) {
    contributing.push({
      id: 'behaviorConsistency',
      weight: EXECUTION_WEIGHTS.behaviorConsistency,
      value: behaviorSignal.value as number,
    });
  }
  if (checkinSignal.hasData) {
    contributing.push({
      id: 'checkInConsistency',
      weight: EXECUTION_WEIGHTS.checkInConsistency,
      value: checkinSignal.value as number,
    });
  }
  if (familySignal.hasData) {
    contributing.push({
      id: 'executionFamily',
      weight: EXECUTION_WEIGHTS.executionFamily,
      value: familySignal.value as number,
    });
  }

  const signalsUsed = contributing.map((c) => c.id);
  const reasons: string[] = [];

  let status: ExecutionReadinessStatus;
  let score: number | null;

  if (contributing.length === 0) {
    status = 'insufficient';
    score = null;
    reasons.push('no_execution_signal');
  } else if (contributing.length < EXECUTION_MIN_READY_SIGNALS) {
    status = 'collecting';
    score = null;
    reasons.push('collecting_more_signal');
  } else {
    status = 'ready';
    const totalWeight = contributing.reduce((acc, c) => acc + c.weight, 0);
    const weighted = contributing.reduce((acc, c) => acc + c.weight * c.value, 0);
    // totalWeight is always > 0 here (≥2 positive weights), so this is safe.
    score = Math.round((weighted / totalWeight) * 100);
    reasons.push('ready');
  }

  return {
    status,
    score,
    signalsUsed,
    reasons,
    signals: {
      adherence: { ...adherenceSignal, detail: adherence },
      behaviorConsistency: {
        ...behaviorSignal,
        activeDays: behaviorDays,
        totalEvents: intakeInWindow.length,
      },
      checkInConsistency: { ...checkinSignal, activeDays: checkinDays },
      executionFamily: { ...familySignal, count: familyCount },
    },
  };
}
