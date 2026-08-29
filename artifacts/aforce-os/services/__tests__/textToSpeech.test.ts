/**
 * textToSpeech — the single Coach Mode choke point (RC-1 Wave 4, audit
 * item 7 fix).
 *
 * Before this fix, `speak()` only checked the "Voice coach" mute toggle
 * (`enabled`); it did NOT check Coach Mode (silent/ambient/spoken), even
 * though `DEFAULT_COACH_MODE = 'ambient'` promises no speech. Most call
 * sites (VoiceCheckInOverlay, useHeatGuard,
 * PerformanceStatementMount, the system-command voice effect in
 * useAppStore.tsx) called speak() directly with no gate of their own, so
 * the default "no speech" mode did not actually stay silent.
 *
 * `setEffectiveCoachMode()` / `getEffectiveCoachMode()` are the bridge
 * `components/CoachModeVoiceSync.tsx` pushes the live mode through. This
 * suite locks:
 *   1. speak() is a no-op in 'silent' / 'ambient' mode, regardless of the
 *      mute toggle.
 *   2. speak() plays in 'spoken' mode (today's behavior), matching the
 *      pre-fix default so no existing surface silently regresses.
 *   3. Defaults to 'spoken' until CoachModeVoiceSync mirrors a real value
 *      in, so any caller/test that never touches the setter is
 *      unaffected (byte-for-byte the pre-fix behavior).
 *   4. The mute toggle (`enabled`) and the Coach Mode gate are
 *      independent — either one alone is enough to silence speak().
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const ttsSpeak = vi.fn().mockResolvedValue(undefined);
const ttsStop = vi.fn().mockResolvedValue(undefined);
vi.mock('../ttsService', () => ({
  speak: (...args: unknown[]) => ttsSpeak(...args),
  stop: (...args: unknown[]) => ttsStop(...args),
}));

const speakWithElevenLabs = vi.fn().mockResolvedValue(undefined);
const stopElevenLabs = vi.fn();
vi.mock('../elevenLabsTts', () => ({
  speakWithElevenLabs: (...args: unknown[]) => speakWithElevenLabs(...args),
  stopElevenLabs: (...args: unknown[]) => stopElevenLabs(...args),
}));

import {
  speak,
  setVoicePlaybackEnabled,
  setEffectiveCoachMode,
  getEffectiveCoachMode,
  setSelectedVoiceId,
} from '../textToSpeech';

describe('textToSpeech.speak — Coach Mode gate', () => {
  beforeEach(() => {
    ttsSpeak.mockClear();
    speakWithElevenLabs.mockClear();
    setVoicePlaybackEnabled(true);
    setSelectedVoiceId(null); // no ElevenLabs voice → device-synth path (ttsSpeak)
  });

  afterEach(() => {
    // Restore the module default so later tests/files aren't affected.
    setEffectiveCoachMode('spoken');
    setVoicePlaybackEnabled(true);
  });

  it('defaults to spoken (pre-fix behavior) until CoachModeVoiceSync mirrors a value in', () => {
    expect(getEffectiveCoachMode()).toBe('spoken');
  });

  it('is a no-op in silent mode', () => {
    setEffectiveCoachMode('silent');
    speak('Recovery window opening.');
    expect(ttsSpeak).not.toHaveBeenCalled();
    expect(speakWithElevenLabs).not.toHaveBeenCalled();
  });

  it('is a no-op in ambient mode (the promised-silent default)', () => {
    setEffectiveCoachMode('ambient');
    speak('Recovery window opening.');
    expect(ttsSpeak).not.toHaveBeenCalled();
    expect(speakWithElevenLabs).not.toHaveBeenCalled();
  });

  it('speaks in spoken mode', () => {
    setEffectiveCoachMode('spoken');
    speak('Recovery window opening.');
    expect(ttsSpeak).toHaveBeenCalledTimes(1);
    expect(ttsSpeak.mock.calls[0]?.[0]).toBe('Recovery window opening.');
  });

  it('the mute toggle silences speak() independently of Coach Mode', () => {
    setEffectiveCoachMode('spoken');
    setVoicePlaybackEnabled(false);
    speak('Recovery window opening.');
    expect(ttsSpeak).not.toHaveBeenCalled();
  });

  it('Coach Mode silences speak() even when the mute toggle is on (voice enabled)', () => {
    setVoicePlaybackEnabled(true);
    setEffectiveCoachMode('ambient');
    speak('Recovery window opening.');
    expect(ttsSpeak).not.toHaveBeenCalled();
  });

  it('setEffectiveCoachMode is readable back via getEffectiveCoachMode (the bridge contract)', () => {
    setEffectiveCoachMode('silent');
    expect(getEffectiveCoachMode()).toBe('silent');
    setEffectiveCoachMode('spoken');
    expect(getEffectiveCoachMode()).toBe('spoken');
  });
});
