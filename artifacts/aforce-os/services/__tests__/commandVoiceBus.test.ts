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
  replayLastCommand,
  subscribe,
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
