/**
 * Text-to-Speech adapter (re-enabled).
 *
 * Public surface for any caller that wants to read a coach line out
 * loud. Delegates to:
 *   - `ttsService.speak()`             → expo-speech, locale-aware
 *   - `voicePersonaService.resolvePersona()` → rate / pitch per band
 *
 * A module-level `enabled` flag (mirrored from the user's Voice Coach
 * toggle in Profile) lets the store mute every callsite at once
 * without scattering guards through the UI. Set via
 * `setVoicePlaybackEnabled()`.
 */

import { speak as ttsSpeak, stop as ttsStop } from './ttsService';
import { resolvePersona } from './voicePersonaService';
import type { PerformanceLevel } from '../types';
import type { SupportedLanguage } from './i18nService';

// Default ON now that voice output is shipping. The store flips this
// to false when the user toggles "Voice coach" off in Profile.
let enabled = true;

export const VOICE_PLAYBACK_ENABLED = true;

export function setVoicePlaybackEnabled(next: boolean): void {
  enabled = next;
  if (!next) {
    void ttsStop();
  }
}

export function isVoicePlaybackEnabled(): boolean {
  return enabled;
}

export interface SpeakOpts {
  /** Caller-known performance level — drives rate / pitch. */
  level?: PerformanceLevel;
  /** Override BCP-47 locale picker. */
  language?: SupportedLanguage;
}

/**
 * Speak `text` if the user has voice playback enabled. The persona
 * resolver picks rate + pitch from the current band so DEPLETED lines
 * land with controlled urgency without sounding excited.
 */
export function speak(text: string, opts: SpeakOpts = {}): void {
  if (!enabled) return;
  if (!text || !text.trim()) return;
  const profile = opts.level ? resolvePersona(opts.level).profile : null;
  void ttsSpeak(text, {
    ...(opts.language ? { language: opts.language } : {}),
    ...(profile ? { rate: profile.speech_rate, pitch: profile.pitch } : {}),
  });
}

/** Stop any currently-speaking utterance (e.g., on overlay dismiss). */
export function stopSpeaking(): void {
  void ttsStop();
}
