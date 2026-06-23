/**
 * Command Confidence™ — engine-output adapter for adaptive recheck timing
 * (STEP 2, Slice 3 wiring). Pure + RN-free orchestrator that turns a live
 * `ScoreEngineOutput` into the same output with ONLY `riskTimer.minutes`
 * possibly LENGTHENED, for command categories the user reliably completes.
 *
 * This is the single seam the store calls before any timer-resetting dispatch
 * (SET_USER_STATE / CYCLE_SUCCESS / CONFIRM_COMMAND). It never mutates the
 * passed object in place (it clones only when it actually changes something),
 * never touches score / command / any field other than `riskTimer.minutes`,
 * and is a hard no-op when the flag is off or a sweat-autopilot safety window
 * is active (so production behavior is byte-identical until the flag is on).
 *
 * HARD LOCKS (delegated to the pure helpers, re-stated for the reader):
 *  - Water-First / hydration urgency: `categorizeCommand` + the fail-closed
 *    urgency adapter below double-protect hydration so it is never spaced out.
 *  - Score-Protection: timing only; reads the advisory ledger, never a score,
 *    and never the deterministic command itself.
 *  - Monotonic non-decreasing: `adaptiveRecheckIntervalMin` can only space the
 *    recheck OUT — it can never speed up or skip a prompt.
 */
import type { ScoreEngineOutput, FeatureFlags } from '../../types';
import type { CommandEvent } from './commandEvents';
import { categorizeCommand, type CommandUrgency } from './commandCategory';
import { deriveCategoryLearning, categoryLearning } from './commandAdaptiveLearning';
import { adaptiveRecheckIntervalMin, type RecheckUrgency } from './adaptiveRecheck';

/**
 * Minimum base recheck cadence (minutes) before a command may be considered
 * "calm enough" to space out. Below this the adapter fails closed to a strain
 * tier so a short, safety-driven cadence is never lengthened.
 */
export const MODERATE_MIN_BASE_MINUTES = 20;

/** Score below which the user is treated as depleted regardless of band. */
const DEPLETED_SCORE_FLOOR = 40;

const URGENCY_RANK: Record<CommandUrgency, number> = {
  low: 0,
  medium: 1,
  high: 2,
  critical: 3,
};

/**
 * Fail-closed mapping from live engine output to a recheck-urgency tier. Only a
 * genuinely calm command (both command + risk-timer urgency low/medium, not
 * depleted, and a comfortably long base cadence) is allowed to reach
 * `'moderate'` — the only tier the stretch acts on. Everything else (any high /
 * critical signal, depletion, or a short timer) resolves to `'high'`, which is
 * a hard no-op in `adaptiveRecheckIntervalMin`.
 */
export function recheckUrgencyFromEngine(engineOutput: ScoreEngineOutput): RecheckUrgency {
  const cmdUrgency = engineOutput.command?.urgencyLevel ?? 'critical';
  const timerUrgency = engineOutput.riskTimer?.urgency ?? 'critical';
  const worst =
    URGENCY_RANK[cmdUrgency] >= URGENCY_RANK[timerUrgency] ? cmdUrgency : timerUrgency;
  if (worst === 'critical') return 'critical';
  if (worst === 'high') return 'high';
  // worst is low|medium — eligible, subject to the fail-closed guards below.
  const level = engineOutput.performanceState?.level;
  const score = engineOutput.score;
  if (level === 'DEPLETED' || (typeof score === 'number' && score < DEPLETED_SCORE_FLOOR)) {
    return 'high';
  }
  const baseMin = engineOutput.riskTimer?.minutes;
  if (
    typeof baseMin !== 'number' ||
    !Number.isFinite(baseMin) ||
    baseMin < MODERATE_MIN_BASE_MINUTES
  ) {
    return 'high';
  }
  return 'moderate';
}

export interface AdaptEngineOutputInput {
  engineOutput: ScoreEngineOutput;
  flags: FeatureFlags | null | undefined;
  ledgerEvents: readonly CommandEvent[];
  /** Evaluation clock (ms epoch). */
  now: number;
  /** True while a sweat-autopilot recovery window is open (yield to its clamp). */
  autopilotActive: boolean;
}

/**
 * Return `engineOutput` with `riskTimer.minutes` possibly lengthened for a
 * reliably-followed, non-hydration, calm command. Hard no-op (returns the SAME
 * reference) when the flag is off, autopilot is active, the shape is malformed,
 * or nothing changes. Never mutates the input in place.
 */
export function adaptEngineOutputForRecheck(input: AdaptEngineOutputInput): ScoreEngineOutput {
  const { engineOutput, flags, ledgerEvents, now, autopilotActive } = input;
  const flagEnabled = !!flags?.command_confidence_adaptive_enabled;
  // Flag off OR a safety cadence (sweat autopilot) is in force → never touch it.
  if (!flagEnabled || autopilotActive) return engineOutput;
  if (!engineOutput?.riskTimer || !engineOutput.command || !engineOutput.performanceState) {
    return engineOutput;
  }

  const category = categorizeCommand({
    level: engineOutput.performanceState.level,
    score: engineOutput.score,
    urgencyLevel: engineOutput.command.urgencyLevel,
  });
  const urgency = recheckUrgencyFromEngine(engineOutput);
  const learning = categoryLearning(deriveCategoryLearning(ledgerEvents, now), category);

  const base = engineOutput.riskTimer.minutes;
  const next = adaptiveRecheckIntervalMin({
    baseIntervalMin: base,
    category,
    learning,
    urgency,
    flagEnabled: true,
  });
  if (next === base) return engineOutput;
  return {
    ...engineOutput,
    riskTimer: { ...engineOutput.riskTimer, minutes: next },
  };
}
