/**
 * AForce OS Scoring Engine
 *
 * Score formula (per spec):
 *   hydration_score = base_intake_score + recency_score + consistency_score
 *                   + context_modifier + recovery_momentum + symptom_penalty
 *                   + urine_signal_penalty + output_stress_penalty
 *   score = max(0, min(100, round(score)))
 *
 * Performance State classification — 4-band ladder via resolveState():
 *   PEAK 90–100 / BALANCED 75–89 / RECOVERING 60–74 / DEPLETED 0–59
 *   Drives the orb, riskTimer, and command selection. DISTINCT from the separate
 *   5-band Score Status ladder in theme/statusColor.ts (OPTIMAL / STABLE /
 *   DECLINING / RISK / CRITICAL) that drives status colors + the score read-out.
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
//
// `now` (epoch ms) is injectable end-to-end so the score number is a pure
// function of (state, now). It defaults to `Date.now()`, so every existing
// caller is behaviourally identical; tests and the ledger-hybrid input
// projection can pin a deterministic clock without forking the engine.
export function calculateScore(userState: UserState, now: number = Date.now()): ScoreEngineOutput {
  // HydroState v1.0 band resolution (founder narrow protected-file exception,
  // 2026-09-01 — this call is the ONLY authorized change in this file).
  //
  // `resolveState(score)` read the band off the score alone, which cannot
  // express the v1.0 rule: PEAK is a claim about the member's physiology, so it
  // requires the score threshold AND an eligible positive physiological
  // corroboration AND no material contradiction. `buildBreakdown` already
  // evaluates that evidence, so the canonical band comes back with it rather
  // than being re-derived here from a number that has forgotten why it is high.
  const { score, contributions, decayPerMinute, level } = buildBreakdown(userState, now);
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
  const minutesSinceLast = minutesSince(userState.lastIntakeTime, now);
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
