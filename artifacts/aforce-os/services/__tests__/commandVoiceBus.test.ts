/**
 * AForce Command Voice Engine — bus tests.
 *
 * Verifies the recording, replay, and pub/sub wiring around
 * `commandSpeak()`. The underlying TTS layer is stubbed so we can
 * assert on call shape without touching expo-audio / fetch.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  _resetForTests,
  _setSpeakerForTests,
  commandSpeak,
  getLastCommand,
  getPlaybackState,
  markCycleExecuted,
  markVoiceError,
  replayLastCommand,
  subscribe,
  subscribePlayback,
  type PlaybackState,
} from '../voice/commandVoiceBus';

describe('commandVoiceBus', () => {
  // vitest's `vi.fn()` is typed as a wide `Procedure | Constructable`
  // union that strict TS won't narrow to the bus's `Speaker` signature.
  // We pass an explicit no-op stub so vitest infers the right call
  // signature, then keep the variable typed as the inferred Mock so
  // `.mock.calls[i][0]` retains string typing in assertions.
  let speaker: ReturnType<typeof makeSpeakerMock>;
  function makeSpeakerMock() {
    return vi.fn((_text: string, _opts?: { level?: unknown }) => {});
  }

  beforeEach(() => {
    _resetForTests();
    speaker = makeSpeakerMock();
    _setSpeakerForTests(speaker);
  });

  afterEach(() => {
    _resetForTests();
  });

  it('starts with no last command', () => {
    expect(getLastCommand()).toBeNull();
  });

  it('records the line and forwards it to the underlying speaker', () => {
    const at = Date.now();
    const rec = commandSpeak('System optimized. Hydration status is elite.', {
      level: 'PEAK',
      intensity: 'standard',
      category: 'score_band',
    });

    expect(speaker).toHaveBeenCalledTimes(1);
    expect(speaker).toHaveBeenCalledWith(
      'System optimized. Hydration status is elite.',
      { level: 'PEAK' },
    );
    expect(rec).not.toBeNull();
    expect(rec?.line).toBe('System optimized. Hydration status is elite.');
    expect(rec?.category).toBe('score_band');
    expect(rec?.intensity).toBe('standard');
    expect(rec?.level).toBe('PEAK');
    expect(rec?.at).toBeGreaterThanOrEqual(at);
    expect(getLastCommand()).toEqual(rec);
  });

  it('trims whitespace around the spoken line', () => {
    commandSpeak('   Risk rising. Drink now.   ', { category: 'score_band' });
    expect(speaker).toHaveBeenCalledWith('Risk rising. Drink now.', {});
    expect(getLastCommand()?.line).toBe('Risk rising. Drink now.');
  });

  it('skips empty / whitespace-only lines and records nothing', () => {
    expect(commandSpeak('', { category: 'system_command' })).toBeNull();
    expect(commandSpeak('   ', { category: 'system_command' })).toBeNull();
    expect(speaker).not.toHaveBeenCalled();
    expect(getLastCommand()).toBeNull();
  });

  it("defaults the category to 'system_command' when not specified", () => {
    commandSpeak('Cycle complete. System reset.');
    expect(getLastCommand()?.category).toBe('system_command');
  });

  it('replays the last command verbatim with the same level', () => {
    commandSpeak('Hydration command failed. Recovery protocol activated.', {
      level: 'DEPLETED',
      category: 'risk_timer',
    });
    speaker.mockClear();

    const replayed = replayLastCommand();
    expect(replayed?.line).toBe('Hydration command failed. Recovery protocol activated.');
    expect(speaker).toHaveBeenCalledTimes(1);
    expect(speaker).toHaveBeenCalledWith(
      'Hydration command failed. Recovery protocol activated.',
      { level: 'DEPLETED' },
    );
  });

  it('replay is a no-op when the bus has nothing to say', () => {
    expect(replayLastCommand()).toBeNull();
    expect(speaker).not.toHaveBeenCalled();
  });

  it('replay does NOT bump the recorded timestamp', () => {
    const original = commandSpeak('Performance stable. Maintain hydration rhythm.', {
      category: 'score_band',
    });
    const originalAt = original?.at ?? 0;

    // Advance wall clock the cheap way: replay shouldn't refresh `at`.
    replayLastCommand();
    expect(getLastCommand()?.at).toBe(originalAt);
  });

  it('notifies subscribers on every successful speak', () => {
    const listener = vi.fn();
    const unsubscribe = subscribe(listener);

    commandSpeak('Early risk detected. Hydration correction recommended.', {
      category: 'risk_timer',
    });
    commandSpeak('Cycle complete. System reset.', {
      category: 'completion',
    });

    expect(listener).toHaveBeenCalledTimes(2);
    expect(listener.mock.calls[0]?.[0]?.category).toBe('risk_timer');
    expect(listener.mock.calls[1]?.[0]?.category).toBe('completion');

    unsubscribe();
    commandSpeak('Risk rising. Twelve ounces. AForce. Now.', { category: 'score_band' });
    expect(listener).toHaveBeenCalledTimes(2); // unchanged after unsubscribe
  });

  it('does not let a throwing subscriber kill the bus', () => {
    const bad = vi.fn(() => { throw new Error('boom'); });
    const good = vi.fn();
    subscribe(bad);
    subscribe(good);
    commandSpeak('System optimized.', { category: 'score_band' });
    expect(bad).toHaveBeenCalledTimes(1);
    expect(good).toHaveBeenCalledTimes(1);
  });
});

describe('commandVoiceBus — playback lifecycle', () => {
  // Same explicit-no-op factory as the first describe — keeps strict
  // TS happy because vi.fn()'s default type is too wide for `Speaker`.
  function makePlaybackSpeakerMock() {
    return vi.fn((_text: string, _opts?: { level?: unknown }) => {});
  }
  let speaker: ReturnType<typeof makePlaybackSpeakerMock>;

  beforeEach(() => {
    vi.useFakeTimers();
    _resetForTests();
    speaker = makePlaybackSpeakerMock();
    _setSpeakerForTests(speaker);
  });

  afterEach(() => {
    _resetForTests();
    vi.useRealTimers();
  });

  it('starts in the idle state', () => {
    expect(getPlaybackState()).toBe('idle');
  });

  it('transitions idle → received → playing → idle on commandSpeak', () => {
    const transitions: PlaybackState[] = [];
    subscribePlayback((s) => transitions.push(s));

    commandSpeak('Risk rising. Twelve ounces. AForce. Now.', { category: 'score_band' });

    // RECEIVED fires synchronously after the speaker call.
    expect(getPlaybackState()).toBe('received');
    expect(transitions).toEqual(['received']);

    // After the 220ms pre-roll, we flip to PLAYING.
    vi.advanceTimersByTime(220);
    expect(getPlaybackState()).toBe('playing');
    expect(transitions).toEqual(['received', 'playing']);

    // After the estimated speak duration, we return to IDLE.
    vi.advanceTimersByTime(8000);
    expect(getPlaybackState()).toBe('idle');
    expect(transitions).toEqual(['received', 'playing', 'idle']);
  });

  it('a back-to-back commandSpeak supersedes the in-flight cycle', () => {
    const transitions: PlaybackState[] = [];
    subscribePlayback((s) => transitions.push(s));

    commandSpeak('First line.', { category: 'system_command' });
    vi.advanceTimersByTime(100); // mid pre-roll
    commandSpeak('Second line.', { category: 'system_command' });

    // Two RECEIVED transitions, no orphan PLAYING / IDLE from the first.
    expect(transitions.filter(s => s === 'received')).toHaveLength(2);
    expect(transitions).not.toContain('playing'); // not yet
    expect(getPlaybackState()).toBe('received');

    vi.advanceTimersByTime(220);
    expect(getPlaybackState()).toBe('playing');

    vi.advanceTimersByTime(8000);
    expect(getPlaybackState()).toBe('idle');
  });

  it('markCycleExecuted overrides any in-flight state and decays to idle', () => {
    const transitions: PlaybackState[] = [];
    subscribePlayback((s) => transitions.push(s));

    commandSpeak('Hydration cycle complete. System reset.', { category: 'completion' });
    vi.advanceTimersByTime(220);
    expect(getPlaybackState()).toBe('playing');

    markCycleExecuted();
    expect(getPlaybackState()).toBe('executed');
    expect(transitions).toEqual(['received', 'playing', 'executed']);

    vi.advanceTimersByTime(2400);
    expect(getPlaybackState()).toBe('idle');
  });

  it('markCycleExecuted is safe to call from idle (no in-flight speak)', () => {
    expect(getPlaybackState()).toBe('idle');
    markCycleExecuted();
    expect(getPlaybackState()).toBe('executed');
    vi.advanceTimersByTime(2400);
    expect(getPlaybackState()).toBe('idle');
  });

  it('markVoiceError flashes error then decays to idle', () => {
    const transitions: PlaybackState[] = [];
    subscribePlayback((s) => transitions.push(s));

    markVoiceError();
    expect(getPlaybackState()).toBe('error');
    vi.advanceTimersByTime(2400);
    expect(getPlaybackState()).toBe('idle');
    expect(transitions).toEqual(['error', 'idle']);
  });

  it('a synchronously-throwing speaker auto-marks the bus into error', () => {
    _setSpeakerForTests(() => { throw new Error('TTS unavailable'); });
    const transitions: PlaybackState[] = [];
    subscribePlayback((s) => transitions.push(s));

    // Still records the line for replay even when the speaker fails.
    const rec = commandSpeak('Critical risk. Execute Recovery Protocol now.', {
      category: 'risk_timer',
    });
    expect(rec).not.toBeNull();
    expect(getLastCommand()?.line).toBe('Critical risk. Execute Recovery Protocol now.');
    expect(getPlaybackState()).toBe('error');

    // Does not flow through received/playing — error is terminal.
    vi.advanceTimersByTime(2400);
    expect(getPlaybackState()).toBe('idle');
    expect(transitions).toEqual(['error', 'idle']);
  });

  it('replayLastCommand cycles the playback lifecycle just like a fresh speak', () => {
    commandSpeak('Performance stable. Maintain hydration rhythm.', { category: 'score_band' });
    // Drain the original cycle.
    vi.advanceTimersByTime(220 + 8000);
    expect(getPlaybackState()).toBe('idle');

    const transitions: PlaybackState[] = [];
    subscribePlayback((s) => transitions.push(s));
    replayLastCommand();
    expect(transitions).toEqual(['received']);

    vi.advanceTimersByTime(220);
    expect(transitions).toEqual(['received', 'playing']);

    vi.advanceTimersByTime(8000);
    expect(transitions).toEqual(['received', 'playing', 'idle']);
  });

  it('subscribePlayback unsubscribes cleanly', () => {
    const listener = vi.fn();
    const unsub = subscribePlayback(listener);
    commandSpeak('Risk rising. Act now.', { category: 'score_band' });
    expect(listener).toHaveBeenCalledTimes(1); // received
    unsub();
    vi.advanceTimersByTime(220);
    expect(listener).toHaveBeenCalledTimes(1); // no playing transition received
  });

  it('a throwing playback subscriber does not break the bus', () => {
    const bad = vi.fn(() => { throw new Error('boom'); });
    const good = vi.fn();
    subscribePlayback(bad);
    subscribePlayback(good);
    commandSpeak('System optimized.', { category: 'score_band' });
    expect(bad).toHaveBeenCalledTimes(1);
    expect(good).toHaveBeenCalledTimes(1);
  });

  it('_resetForTests clears playback state and timers', () => {
    commandSpeak('Test line.', { category: 'system_command' });
    expect(getPlaybackState()).toBe('received');
    _resetForTests();
    expect(getPlaybackState()).toBe('idle');
    // Stale timer from before reset must not fire.
    const after = vi.fn();
    subscribePlayback(after);
    vi.advanceTimersByTime(10_000);
    expect(after).not.toHaveBeenCalled();
  });
});
