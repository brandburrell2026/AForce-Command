/**
 * AForce Voice Engine — TTS config resolver.
 *
 * Resolves the playback parameters (speech rate / pitch / volume) for the
 * current performance level and exposes a tiny helper used by textToSpeech.
 *
 * This service is the single place where "how AForce sounds" is decided.
 * Urgency is expressed through phrasing AND a subtle rate/pitch nudge —
 * never through volume or dramatic inflection.
 */

import type { PerformanceLevel } from '../types';
import type { VoiceProfile, VoiceUrgencyMode } from '../types/voicePersona';
import { getProfile, resolvePersona, VOICE_PROFILES } from './voicePersonaService';

/** Default profile when no engine snapshot is available. */
const DEFAULT_MODE: VoiceUrgencyMode = 'balanced';

let activeMode: VoiceUrgencyMode = DEFAULT_MODE;

/** Update the live mode — called by the orchestrator on every render. */
export function setActiveMode(mode: VoiceUrgencyMode): void {
  activeMode = mode;
}

/** Convenience: set from PerformanceLevel directly. */
export function setActiveLevel(level: PerformanceLevel): void {
  activeMode = resolvePersona(level).mode;
}

/** What the TTS layer reads when it builds an utterance. */
export function getActiveTtsConfig(): VoiceProfile {
  return getProfile(activeMode);
}

/** Read-only view of every profile — useful for settings/debug screens. */
export function listProfiles(): Readonly<Record<VoiceUrgencyMode, VoiceProfile>> {
  return VOICE_PROFILES;
}
