/**
 * AForce Voice Engine — persona resolver.
 *
 * Single source of truth for "which TTS profile + which tone rule do we use
 * right now?". Maps PerformanceLevel → VoiceUrgencyMode → ToneRule + VoiceProfile.
 *
 * This service has zero React/store dependencies — it is pure lookup.
 */

import type { PerformanceLevel } from '../types';
import type {
  ToneRule,
  VoiceProfile,
  VoiceUrgencyMode,
} from '../types/voicePersona';
import { levelToMode } from '../types/voicePersona';
import { TONE_RULES } from '../data/voiceTemplates';

/**
 * VoiceProfiles — TTS playback per mode.
 *
 * Defaults sit around speech_rate 0.95 / pitch 0.95–1.0 per spec. We nudge a
 * touch faster + flatter for DEPLETED so the line lands with controlled
 * urgency, never with shouting or excitement.
 */
export const VOICE_PROFILES: Readonly<Record<VoiceUrgencyMode, VoiceProfile>> = Object.freeze({
  peak:       { mode: 'peak',       speech_rate: 0.94, pitch: 1.00, volume: 1.0 },
  balanced:   { mode: 'balanced',   speech_rate: 0.95, pitch: 0.98, volume: 1.0 },
  recovering: { mode: 'recovering', speech_rate: 0.95, pitch: 0.95, volume: 1.0 },
  depleted:   { mode: 'depleted',   speech_rate: 0.97, pitch: 0.95, volume: 1.0 },
});

/** Resolve mode + rule + profile from a PerformanceLevel in one call. */
export function resolvePersona(level: PerformanceLevel): {
  mode: VoiceUrgencyMode;
  rule: ToneRule;
  profile: VoiceProfile;
} {
  const mode = levelToMode(level);
  return {
    mode,
    rule: TONE_RULES[mode],
    profile: VOICE_PROFILES[mode],
  };
}

/** Direct accessor when caller already has the mode. */
export function getProfile(mode: VoiceUrgencyMode): VoiceProfile {
  return VOICE_PROFILES[mode];
}

export function getRule(mode: VoiceUrgencyMode): ToneRule {
  return TONE_RULES[mode];
}
