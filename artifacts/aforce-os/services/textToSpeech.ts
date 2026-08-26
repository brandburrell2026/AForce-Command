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
import { consumerCopyBlocked } from '@/utils/intelligence/languageGate/runtimeClaimScan';
import { speakWithElevenLabs, stopElevenLabs } from './elevenLabsTts';
import { resolvePersona } from './voicePersonaService';
import { elevenLabsIdFor } from './voiceCatalog';
import type { PerformanceLevel } from '../types';
import type { SupportedLanguage } from './i18nService';
import type { CoachMode } from './coachMode';

// Default ON now that voice output is shipping. The store flips this
// to false when the user toggles "Voice coach" off in Profile.
let enabled = true;

// Coach Mode gate (audit item 7 fix). `services/coachMode.ts` defines
// silent/ambient/spoken and its own `shouldSpeak()` predicate, but until
// this fix NOTHING actually enforced it here — most speak() call sites
// (VoiceOverlay, VoiceCheckInOverlay, useHeatGuard, PerformanceStatement,
// the system-command voice effect in useAppStore.tsx) called speak()
// directly, so DEFAULT_COACH_MODE = 'ambient' ("no speech") did not
// actually stay silent. Only the two Hydration Scan screens happened to
// gate correctly, because they checked shouldSpeak() at their own call
// site.
//
// Rather than sprinkle shouldSpeak() checks at N call sites (easy to miss
// on the next new caller), this is the ONE choke point: every speak()
// passes through here, so gating it here is authoritative for the whole
// app. `components/CoachModeVoiceSync.tsx` mirrors the effective mode
// (the user's stored CoachMode choice, or 'spoken' while `spec_coachV2`
// is off) into this module-level singleton via `setEffectiveCoachMode()`
// — same bridge pattern as `setVoicePlaybackEnabled()` below. Defaults to
// 'spoken' so behavior is unchanged for any caller/test that runs before
// the app has mirrored a real value in.
let effectiveCoachMode: CoachMode = 'spoken';

/** Mirror the effective CoachMode in. See `components/CoachModeVoiceSync.tsx`. */
export function setEffectiveCoachMode(next: CoachMode): void {
  effectiveCoachMode = next;
}

export function getEffectiveCoachMode(): CoachMode {
  return effectiveCoachMode;
}

// Selected coach id (e.g. 'rock'), mirrored from the user's Profile
// picker. The catalog resolves it to the right ElevenLabs voiceId at
// speak() time, so the coach identity layer is decoupled from the
// underlying voice infrastructure. Falls back to the device
// synthesizer only if the network/playback fails — so the coach is
// never silent.
let selectedVoiceId: string | null = null;

export function setSelectedVoiceId(next: string | null): void {
  selectedVoiceId = next && next.trim().length > 0 ? next : null;
}

export function getSelectedVoiceId(): string | null {
  return selectedVoiceId;
}

export const VOICE_PLAYBACK_ENABLED = true;

export function setVoicePlaybackEnabled(next: boolean): void {
  enabled = next;
  if (!next) {
    void ttsStop();
    stopElevenLabs();
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
  /**
   * Server TTS cache opt-in. `'static'` lets an allowlisted common phrase
   * (Voice Check-In intro / questions / acks) be served from the server
   * cache; `'dynamic'` (or omitted) always hits ElevenLabs live. Only the
   * ElevenLabs path honors this — the device-synth fallback ignores it.
   */
  cachePolicy?: 'static' | 'dynamic';
  /** Allowlisted phrase key paired with `cachePolicy: 'static'`. */
  phraseKey?: string;
}

/**
 * Speak `text` if the user has voice playback enabled AND Coach Mode
 * allows it (silent/ambient never speak — only 'spoken' does). The
 * persona resolver picks rate + pitch from the current band so DEPLETED
 * lines land with controlled urgency without sounding excited.
 */
export function speak(text: string, opts: SpeakOpts = {}): void {
  if (!enabled) return;
  if (effectiveCoachMode !== 'spoken') return;
  if (!text || !text.trim()) return;
  // §42 claims gate (Wave-2 PR5): every spoken line passes the block-severity
  // concept scan. Fail closed = stay silent (silence is already a valid
  // outcome of this function); never rewrite the line.
  if (consumerCopyBlocked(text)) {
    console.warn('[AForce] claims gate suppressed a spoken line');
    return;
  }
  const profile = opts.level ? resolvePersona(opts.level).profile : null;

  // If the user has picked an ElevenLabs voice, prefer that — but fall
  // back to the device synthesizer on any failure so the coach never
  // goes silent over a flaky network.
  const elevenLabsId = elevenLabsIdFor(selectedVoiceId);
  if (elevenLabsId) {
    speakWithElevenLabs({
      text,
      voiceId: elevenLabsId,
      ...(opts.cachePolicy ? { cachePolicy: opts.cachePolicy } : {}),
      ...(opts.phraseKey ? { phraseKey: opts.phraseKey } : {}),
    }).catch((err) => {
      console.warn('[AForce] ElevenLabs TTS failed, falling back to device:', err);
      void ttsSpeak(text, {
        ...(opts.language ? { language: opts.language } : {}),
        ...(profile ? { rate: profile.speech_rate, pitch: profile.pitch } : {}),
      });
    });
    return;
  }

  void ttsSpeak(text, {
    ...(opts.language ? { language: opts.language } : {}),
    ...(profile ? { rate: profile.speech_rate, pitch: profile.pitch } : {}),
  });
}

/** Stop any currently-speaking utterance (e.g., on overlay dismiss). */
export function stopSpeaking(): void {
  void ttsStop();
  stopElevenLabs();
}
