/**
 * Video Engine — maps real-time performance state to a coaching video.
 *
 * Decision rules (priority order):
 *   1. DEPLETED state OR score < 40            → depletion_emergency_01
 *   2. RECOVERING state OR score 40–59         → recovery_reset_01 / hydration_action_02
 *   3. Morning reset trigger                   → morning_reset_01
 *   4. PEAK state AND score ≥ 90               → activation_01
 *   5. Default / BALANCED                      → hydration_action_01
 *
 * Pure function — no React, no side effects. Easy to unit-test and easy to
 * swap with a real /v1/videos/match endpoint later.
 */

import type {
  ScoreEngineOutput,
  PerformanceLevel,
  Command,
  UserState,
} from '../types';
import type {
  VideoConfig,
  VideoTriggerInput,
  VideoCommandType,
  VideoProtocol,
} from '../types/video';
import { VIDEO_LIBRARY, FALLBACK_VIDEO_ID } from '../mocks/videoLibrary';

// ─── Public types ─────────────────────────────────────────────────────────────
export interface MatchVideoArgs {
  engineOutput: ScoreEngineOutput;
  userState: UserState;
  source?: VideoTriggerInput['source'];
}

// ─── Inference helpers ────────────────────────────────────────────────────────

function inferProtocol(level: PerformanceLevel, score: number, userState: UserState): VideoProtocol {
  if (userState.heatLoad >= 0.7) return 'heat_stress';
  if (level === 'DEPLETED' || score < 40) return 'depletion_correction';
  if (level === 'RECOVERING' || score < 65) return 'recovery';
  return 'maintenance';
}

function inferCommandType(level: PerformanceLevel, score: number, command: Command): VideoCommandType {
  if (command.urgencyLevel === 'critical') return 'hydration_urgent';
  if (level === 'DEPLETED' || score < 40) return 'hydration_urgent';
  if (level === 'RECOVERING' || score < 65) return 'recovery_reset';
  if (level === 'PEAK' && score >= 90) return 'performance_activation';
  return 'hydration_maintain';
}

function isMorningResetMoment(userState: UserState): boolean {
  // First post-wake moment when user hasn't acted on the morning command yet.
  return userState.isAwake && !userState.hasSeenMorningCommand && userState.unitsConsumedToday === 0;
}

// ─── Core matcher ─────────────────────────────────────────────────────────────

export function matchVideo({ engineOutput, userState, source }: MatchVideoArgs): VideoConfig {
  const { performanceState, score, command } = engineOutput;
  const level = performanceState.level;

  // Priority 1: depletion / urgent
  if (level === 'DEPLETED' || score < 40 || command.urgencyLevel === 'critical') {
    return VIDEO_LIBRARY.depletion_emergency_01;
  }

  // Priority 2: morning reset window (only if not already in trouble)
  if (source === 'morning_reset' || isMorningResetMoment(userState)) {
    return VIDEO_LIBRARY.morning_reset_01;
  }

  // Priority 3: recovery / closing-the-gap
  if (level === 'RECOVERING' || score < 65) {
    // Heat / sweat → action video (close the gap). Otherwise reset breath video.
    if (userState.heatLoad >= 0.5 || userState.sweatRate >= 0.5) {
      return VIDEO_LIBRARY.hydration_action_02;
    }
    return VIDEO_LIBRARY.recovery_reset_01;
  }

  // Priority 4: peak activation
  if (level === 'PEAK' && score >= 90) {
    return VIDEO_LIBRARY.activation_01;
  }

  // Default: maintain
  return VIDEO_LIBRARY.hydration_action_01 ?? VIDEO_LIBRARY[FALLBACK_VIDEO_ID];
}

// ─── Trigger input builder (analytics / preload) ─────────────────────────────

export function buildTriggerInput(args: MatchVideoArgs): VideoTriggerInput {
  const { engineOutput, userState, source } = args;
  return {
    state: engineOutput.performanceState.level,
    score: engineOutput.score,
    protocol: inferProtocol(engineOutput.performanceState.level, engineOutput.score, userState),
    commandType: inferCommandType(engineOutput.performanceState.level, engineOutput.score, engineOutput.command),
    source: source ?? 'manual',
  };
}

// ─── Future: AI-personalized video stub ──────────────────────────────────────
// Reserved for avatar coach + voice customization + sport-specific rendering.
// Intentionally not implemented in this build.
export function maybePersonalize(_video: VideoConfig): VideoConfig {
  return _video;
}
