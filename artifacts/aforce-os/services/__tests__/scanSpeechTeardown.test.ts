import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * E6-A — PRODUCER 3 of 3: the Scan speech teardown.
 *
 * Scan is the app's only surface that starts a coach narrative and can be
 * left mid-sentence: the member scans, the coach begins speaking, and the
 * screen auto-navigates back ~800ms after a log. `HydrationScanScreenV2`
 * guards that with an unmount cleanup calling `stopSpeaking()`, plus a
 * `handleCoachStop` the card can call directly.
 *
 * Before this file, a repo-wide grep for `stopSpeaking` returned ZERO test
 * files. A recomposition that mounted a new coach band without the cleanup
 * would leave speech running after the member exits — audible, and invisible
 * to every existing suite.
 *
 * This file proves the STOP CONTRACT the teardown depends on: that
 * `stopSpeaking()` silences BOTH engines, unconditionally, and never throws
 * into an unmount path. That it is actually WIRED to unmount is pinned in
 * components/__tests__/scanProducerSafety.test.ts (the screen cannot be
 * imported here — see that file's header).
 *
 * Mocks follow textToSpeech.test.ts exactly.
 */

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

describe('E6-A · stopSpeaking — the teardown Scan depends on', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('silences BOTH engines — the device TTS and the ElevenLabs stream', async () => {
    // Scan can be speaking through either path depending on availability, so
    // stopping only one leaves the member listening to the other.
    const { stopSpeaking } = await import('../textToSpeech');
    stopSpeaking();

    expect(ttsStop).toHaveBeenCalledTimes(1);
    expect(stopElevenLabs).toHaveBeenCalledTimes(1);
  });

  it('stops unconditionally — no coach-mode or mute gate can suppress the teardown', async () => {
    // speak() is gated by Coach Mode; stop() must NOT be. An unmount has to
    // silence speech whatever posture started it, or a mode change between
    // speaking and leaving would strand audio.
    const mod = await import('../textToSpeech');
    mod.setEffectiveCoachMode('silent');
    mod.stopSpeaking();
    mod.setEffectiveCoachMode('spoken');
    mod.stopSpeaking();

    expect(ttsStop).toHaveBeenCalledTimes(2);
    expect(stopElevenLabs).toHaveBeenCalledTimes(2);
  });

  it('is safe to call when nothing is speaking — an unmount never depends on state', async () => {
    const { stopSpeaking } = await import('../textToSpeech');
    expect(() => {
      stopSpeaking();
      stopSpeaking();
    }).not.toThrow();
    expect(ttsStop).toHaveBeenCalledTimes(2);
  });

  it('never throws into the caller even if an engine rejects — unmount must not crash', async () => {
    // The screen calls this from a useEffect cleanup. A throw there is an
    // unhandled error during teardown, so the device stop is fired
    // fire-and-forget (`void ttsStop()`), not awaited.
    ttsStop.mockRejectedValueOnce(new Error('engine gone'));
    const { stopSpeaking } = await import('../textToSpeech');

    expect(() => stopSpeaking()).not.toThrow();
    await Promise.resolve();
  });

  it('stops speech that is actually in flight', async () => {
    // End-to-end through the module's own front door: start, then stop.
    const mod = await import('../textToSpeech');
    mod.setEffectiveCoachMode('spoken');
    await mod.speak('Strong match — stay with it.');
    mod.stopSpeaking();

    expect(ttsStop).toHaveBeenCalled();
    expect(stopElevenLabs).toHaveBeenCalled();
  });
});
