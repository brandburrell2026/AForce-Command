/**
 * AForce OS Scoring Engine
 *
 * Score formula (per spec):
 *   hydration_score = base_intake_score + recency_score + consistency_score
 *                   + context_modifier + recovery_momentum + symptom_penalty
 *                   + urine_signal_penalty + output_stress_penalty
 *   score = max(0, min(100, round(score)))
 *
 * State classification:
 *   PEAK 90–100 / BALANCED 75–89 / RECOVERING 60–74 / DEPLETED 0–59
 *
 * AI command rules:
 *   WHAT to do + WHEN/HOW MUCH + OUTCOME, 1–2 sentences, command authority.
 *   No "consider / try / suggest / great job / stay hydrated".
 */

import type {
  UserState,
  ScoreEngineOutput,
} from '../types';
import { buildSocialRollup } from '../services/socialModeEngine';
import {
  resolveState,
  buildBreakdown,
  buildPrediction,
  minutesSince,
} from './scoring/breakdown';
import {
  buildPerformanceState,
  buildPulseConfig,
  generateReasons,
  calculateRiskTimer,
  generateCommand,
  composeExplanation,
  getStateLabel,
  generateCycleIdentityMessage,
  generateNextCycleHint,
} from './scoring/copy';

// ─── Main Engine ──────────────────────────────────────────────────────────────
export function calculateScore(userState: UserState): ScoreEngineOutput {
  const { score, contributions, decayPerMinute } = buildBreakdown(userState);
  const level = resolveState(score);
  const performanceState = buildPerformanceState(level, score);
  const pulseConfig = buildPulseConfig(level);
  const reasons = generateReasons(userState);
  const riskTimer = calculateRiskTimer(userState, level);
  const social = buildSocialRollup(userState, score);
  const command = generateCommand(level, userState, score, social);
  const prediction = buildPrediction(score, decayPerMinute);

  // Performance Command Engine overlay — fold context (heat / time-of-day),
  // pattern recognition (streak), and no-action consequence into the
  // existing explanation field so the AICommandCard renders the upgraded
  // intelligence without any UI changes.
  const minutesSinceLast = minutesSince(userState.lastIntakeTime);
  command.explanation = composeExplanation(
    command.explanation,
    userState,
    score,
    decayPerMinute,
    level,
    !!social && (social.active || social.inRecoveryWindow),
    minutesSinceLast,
  );

  return { score, performanceState, pulseConfig, reasons, riskTimer, command, breakdown: contributions, prediction, social };
}

export { minutesSince, getStateLabel, generateCycleIdentityMessage, generateNextCycleHint };

export * from './scoring/recommendations';
