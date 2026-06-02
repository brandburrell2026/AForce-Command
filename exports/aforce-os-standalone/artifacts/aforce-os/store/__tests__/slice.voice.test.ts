/**
 * Voice slice — the voice overlay drives "silent" cycle completions
 * and AI command confirmation. These tests assert the reducer paths
 * the voice flow relies on: silent cycle success, confirmation
 * resolution, and the recheck-timer behavior around them.
 */

import { describe, it, expect } from 'vitest';

import { reducer } from '../appStoreReducer';
import {
  baseEngine,
  baseUser,
  makeCycleResult,
  makeEngine,
  makeHistoryEntry,
  makeState,
} from './_fixtures';

describe('store · voice slice', () => {
  it('voice-driven CYCLE_SUCCESS (silent=true) does NOT trigger the hero overlay', () => {
    const next = reducer(makeState(), {
      type: 'CYCLE_SUCCESS',
      payload: {
        result: makeCycleResult(),
        newUserState: baseUser,
        engineOutput: baseEngine,
        historyEntry: makeHistoryEntry('voice-1'),
        silent: true,
      },
    });
    expect(next.showCycleSuccess).toBe(false);
  });

  it('voice-driven CYCLE_SUCCESS still records the result so the response card can render', () => {
    const result = makeCycleResult(82);
    const next = reducer(makeState(), {
      type: 'CYCLE_SUCCESS',
      payload: {
        result,
        newUserState: baseUser,
        engineOutput: baseEngine,
        historyEntry: makeHistoryEntry('voice-2'),
        silent: true,
      },
    });
    expect(next.lastCycleResult).toBe(result);
  });

  it('voice-driven CYCLE_SUCCESS still updates the burst timestamp for the orb pulse', () => {
    const before = Date.now();
    const next = reducer(makeState(), {
      type: 'CYCLE_SUCCESS',
      payload: {
        result: makeCycleResult(),
        newUserState: baseUser,
        engineOutput: baseEngine,
        historyEntry: makeHistoryEntry('voice-3'),
        silent: true,
      },
    });
    expect(next.lastIntakeBurstAt).toBeGreaterThanOrEqual(before);
  });

  it('CONFIRM_COMMAND clears pendingConfirmation after the user answers the recheck', () => {
    const startState = makeState({ pendingConfirmation: true, timerSeconds: 0 });
    const next = reducer(startState, {
      type: 'CONFIRM_COMMAND',
      payload: { newUserState: baseUser, engineOutput: baseEngine },
    });
    expect(next.pendingConfirmation).toBe(false);
  });

  it('CONFIRM_COMMAND resets the recheck timer from the new engine output', () => {
    const newEngine = makeEngine({
      riskTimer: { minutes: 12, seconds: 0, urgency: 'low' },
    });
    const next = reducer(makeState({ pendingConfirmation: true, timerSeconds: 0 }), {
      type: 'CONFIRM_COMMAND',
      payload: { newUserState: baseUser, engineOutput: newEngine },
    });
    expect(next.timerSeconds).toBe(12 * 60);
    expect(next.engineOutput).toBe(newEngine);
  });

  it('DISMISS_SUCCESS lets the voice overlay close cleanly without leaving stale data', () => {
    const startState = makeState({
      showCycleSuccess: false,
      lastCycleResult: makeCycleResult(),
    });
    const next = reducer(startState, { type: 'DISMISS_SUCCESS' });
    expect(next.lastCycleResult).toBeNull();
    expect(next.showCycleSuccess).toBe(false);
  });
});
