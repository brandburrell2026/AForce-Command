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
  setSpeakerImpl,
  subscribe,
  subscribePlayback,
} from '../commandVoiceBus';

beforeEach(() => {
  _resetForTests();
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  _resetForTests();
});

describe('commandSpeak', () => {
  it('records the spoken line with category + level + intensity', () => {
    const speaker = vi.fn();
    _setSpeakerForTests(speaker);

    const before = Date.now();
    const rec = commandSpeak('Drink 12 ounces with AForce now.', {
      level: 'RECOVERING',
      intensity: 'pressure',
      category: 'risk_timer',
    });

    expect(rec).not.toBeNull();
    expect(rec!.line).toBe('Drink 12 ounces with AForce now.');
    expect(rec!.level).toBe('RECOVERING');
    expect(rec!.intensity).toBe('pressure');
    expect(rec!.category).toBe('risk_timer');
    expect(rec!.at).toBeGreaterThanOrEqual(before);
    expect(speaker).toHaveBeenCalledOnce();
    expect(speaker).toHaveBeenCalledWith('Drink 12 ounces with AForce now.', { level: 'RECOVERING' });
  });

  it('defaults category to system_command when omitted', () => {
    _setSpeakerForTests(vi.fn());
    const rec = commandSpeak('Hydrate now.');
    expect(rec!.category).toBe('system_command');
  });

  it('returns null and stays silent on empty / whitespace input', () => {
    const speaker = vi.fn();
    _setSpeakerForTests(speaker);
    expect(commandSpeak('')).toBeNull();
    expect(commandSpeak('   ')).toBeNull();
    expect(speaker).not.toHaveBeenCalled();
    expect(getLastCommand()).toBeNull();
  });

  it('exposes the most recent record via getLastCommand', () => {
    _setSpeakerForTests(vi.fn());
    expect(getLastCommand()).toBeNull();
    commandSpeak('First line.');
    expect(getLastCommand()!.line).toBe('First line.');
    commandSpeak('Second line.');
    expect(getLastCommand()!.line).toBe('Second line.');
  });
});

describe('subscribe', () => {
  it('notifies every subscriber on each successful speak', () => {
    _setSpeakerForTests(vi.fn());
    const a = vi.fn();
    const b = vi.fn();
    subscribe(a);
    subscribe(b);

    commandSpeak('Hydrate now.');
    expect(a).toHaveBeenCalledOnce();
    expect(b).toHaveBeenCalledOnce();
    expect(a.mock.calls[0][0].line).toBe('Hydrate now.');
  });

  it('returns an unsubscribe function that detaches the listener', () => {
    _setSpeakerForTests(vi.fn());
    const fn = vi.fn();
    const off = subscribe(fn);
    commandSpeak('A.');
    expect(fn).toHaveBeenCalledOnce();
    off();
    commandSpeak('B.');
    expect(fn).toHaveBeenCalledOnce();
  });

  it('does not let one bad subscriber break the bus for others', () => {
    _setSpeakerForTests(vi.fn());
    const bad = vi.fn(() => { throw new Error('boom'); });
    const good = vi.fn();
    subscribe(bad);
    subscribe(good);

    expect(() => commandSpeak('Test.')).not.toThrow();
    expect(good).toHaveBeenCalledOnce();
  });
});

describe('replayLastCommand', () => {
  it('returns null and stays silent when nothing has been said yet', () => {
    const speaker = vi.fn();
    _setSpeakerForTests(speaker);
    expect(replayLastCommand()).toBeNull();
    expect(speaker).not.toHaveBeenCalled();
  });

  it('re-invokes the speaker with the original line + level', () => {
    const speaker = vi.fn();
    _setSpeakerForTests(speaker);
    commandSpeak('Hydrate now.', { level: 'PEAK' });
    expect(speaker).toHaveBeenCalledOnce();
    const replayed = replayLastCommand();
    expect(speaker).toHaveBeenCalledTimes(2);
    expect(speaker).toHaveBeenLastCalledWith('Hydrate now.', { level: 'PEAK' });
    expect(replayed!.line).toBe('Hydrate now.');
  });

  it('does not overwrite the original "at" timestamp on replay', () => {
    _setSpeakerForTests(vi.fn());
    commandSpeak('Hydrate now.');
    const originalAt = getLastCommand()!.at;
    vi.advanceTimersByTime(5000);
    const replayed = replayLastCommand();
    expect(replayed!.at).toBe(originalAt);
    expect(getLastCommand()!.at).toBe(originalAt);
  });
});

describe('playback lifecycle', () => {
  it('starts idle', () => {
    expect(getPlaybackState()).toBe('idle');
  });

  it('cycles received → playing → idle on a normal speak', () => {
    _setSpeakerForTests(vi.fn());
    const states: string[] = [];
    subscribePlayback((s) => { states.push(s); });

    commandSpeak('Drink water now.');
    expect(getPlaybackState()).toBe('received');

    vi.advanceTimersByTime(220);
    expect(getPlaybackState()).toBe('playing');

    vi.advanceTimersByTime(10_000);
    expect(getPlaybackState()).toBe('idle');

    expect(states).toEqual(['received', 'playing', 'idle']);
  });

  it('jumps straight to error when the speaker throws', () => {
    _setSpeakerForTests(() => { throw new Error('network'); });
    commandSpeak('Hydrate now.');
    expect(getPlaybackState()).toBe('error');
    vi.advanceTimersByTime(2400);
    expect(getPlaybackState()).toBe('idle');
  });

  it('still records the utterance even when the speaker throws', () => {
    _setSpeakerForTests(() => { throw new Error('network'); });
    const rec = commandSpeak('Hydrate now.');
    expect(rec!.line).toBe('Hydrate now.');
    expect(getLastCommand()!.line).toBe('Hydrate now.');
  });

  it('markCycleExecuted pulses executed → idle and supersedes any in-flight playback', () => {
    _setSpeakerForTests(vi.fn());
    commandSpeak('Hydrate now.');
    vi.advanceTimersByTime(220);
    expect(getPlaybackState()).toBe('playing');

    markCycleExecuted();
    expect(getPlaybackState()).toBe('executed');
    vi.advanceTimersByTime(2400);
    expect(getPlaybackState()).toBe('idle');
  });

  it('markVoiceError pulses error → idle', () => {
    markVoiceError();
    expect(getPlaybackState()).toBe('error');
    vi.advanceTimersByTime(2400);
    expect(getPlaybackState()).toBe('idle');
  });
});

describe('setSpeakerImpl', () => {
  it('null restores the noop speaker (no throw, no record loss)', () => {
    setSpeakerImpl(null);
    const rec = commandSpeak('Quiet line.');
    expect(rec!.line).toBe('Quiet line.');
  });
});

/* ────────────────────────────────────────────────────────────────────
 * Merged from prior services/__tests__/ copy — input hygiene,
 * supersede-in-flight, and stale-timer guards.
 * ──────────────────────────────────────────────────────────────────── */

describe('commandSpeak — input hygiene', () => {
  it('trims surrounding whitespace before forwarding to the speaker', () => {
    const speaker = vi.fn();
    _setSpeakerForTests(speaker);
    commandSpeak('   Risk rising. Drink now.   ', { category: 'score_band' });
    expect(speaker).toHaveBeenCalledWith('Risk rising. Drink now.', {});
    expect(getLastCommand()!.line).toBe('Risk rising. Drink now.');
  });
});

describe('playback lifecycle — supersede in-flight', () => {
  it('a back-to-back commandSpeak resets the timer to the new utterance', () => {
    _setSpeakerForTests(vi.fn());
    const transitions: string[] = [];
    subscribePlayback((s) => transitions.push(s));

    commandSpeak('First line.', { category: 'system_command' });
    vi.advanceTimersByTime(100); // mid pre-roll, before 'playing' would fire
    commandSpeak('Second line.', { category: 'system_command' });

    // Two RECEIVED transitions; no orphan PLAYING from the superseded first speak.
    expect(transitions.filter((s) => s === 'received')).toHaveLength(2);
    expect(transitions).not.toContain('playing');
    expect(getPlaybackState()).toBe('received');

    vi.advanceTimersByTime(220);
    expect(getPlaybackState()).toBe('playing');

    vi.advanceTimersByTime(10_000);
    expect(getPlaybackState()).toBe('idle');
  });
});

describe('_resetForTests', () => {
  it('clears playback state and prevents stale timers from firing', () => {
    _setSpeakerForTests(vi.fn());
    commandSpeak('Test line.', { category: 'system_command' });
    expect(getPlaybackState()).toBe('received');

    _resetForTests();
    expect(getPlaybackState()).toBe('idle');

    // A subscriber attached AFTER reset must not see any transitions
    // from the pre-reset cycle's still-pending timers.
    const after = vi.fn();
    subscribePlayback(after);
    vi.advanceTimersByTime(10_000);
    expect(after).not.toHaveBeenCalled();
  });
});
