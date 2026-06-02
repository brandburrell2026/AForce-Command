/**
 * Drinks slice — covers the intake (CYCLE) flow that fans out from a
 * single drink log: starting a cycle, applying the result, history
 * cap, burst timestamp, silent (voice-driven) variant, and dismissal.
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
  makeUserState,
} from './_fixtures';

describe('store · drinks slice', () => {
  it('CYCLE_START flips isCompletingCycle without touching engine output', () => {
    const next = reducer(makeState(), { type: 'CYCLE_START' });
    expect(next.isCompletingCycle).toBe(true);
    expect(next.engineOutput).toBe(baseEngine);
    expect(next.userState).toBe(baseUser);
  });

  it('CYCLE_SUCCESS prepends the new history entry and shows the hero overlay', () => {
    const entry = makeHistoryEntry('h-new');
    const next = reducer(makeState(), {
      type: 'CYCLE_SUCCESS',
      payload: {
        result: makeCycleResult(85),
        newUserState: makeUserState({ unitsConsumedToday: 5 }),
        engineOutput: makeEngine({ score: 85 }),
        historyEntry: entry,
      },
    });
    expect(next.history[0]).toBe(entry);
    expect(next.showCycleSuccess).toBe(true);
    expect(next.isCompletingCycle).toBe(false);
  });

  it('CYCLE_SUCCESS with silent=true suppresses the hero overlay (voice-driven log)', () => {
    const next = reducer(makeState(), {
      type: 'CYCLE_SUCCESS',
      payload: {
        result: makeCycleResult(),
        newUserState: baseUser,
        engineOutput: baseEngine,
        historyEntry: makeHistoryEntry(),
        silent: true,
      },
    });
    expect(next.showCycleSuccess).toBe(false);
    expect(next.lastCycleResult).not.toBeNull();
  });

  it('CYCLE_SUCCESS caps history to 30 entries (FIFO drop)', () => {
    const longHistory = Array.from({ length: 30 }, (_, i) => makeHistoryEntry(`h-${i}`));
    const next = reducer(makeState({ history: longHistory }), {
      type: 'CYCLE_SUCCESS',
      payload: {
        result: makeCycleResult(),
        newUserState: baseUser,
        engineOutput: baseEngine,
        historyEntry: makeHistoryEntry('h-new'),
      },
    });
    expect(next.history).toHaveLength(30);
    expect(next.history[0].id).toBe('h-new');
    expect(next.history.find((h) => h.id === 'h-29')).toBeUndefined();
  });

  it('CYCLE_SUCCESS records the burst timestamp so the orb pulse can react', () => {
    const before = Date.now();
    const next = reducer(makeState(), {
      type: 'CYCLE_SUCCESS',
      payload: {
        result: makeCycleResult(),
        newUserState: baseUser,
        engineOutput: baseEngine,
        historyEntry: makeHistoryEntry(),
      },
    });
    expect(next.lastIntakeBurstAt).toBeGreaterThanOrEqual(before);
  });

  it('DISMISS_SUCCESS clears the overlay flag and the cached result payload', () => {
    const open = makeState({
      showCycleSuccess: true,
      lastCycleResult: makeCycleResult(),
    });
    const next = reducer(open, { type: 'DISMISS_SUCCESS' });
    expect(next.showCycleSuccess).toBe(false);
    expect(next.lastCycleResult).toBeNull();
  });

  it('CYCLE_SUCCESS resets the recheck timer from the new engine output', () => {
    const newEngine = makeEngine({
      riskTimer: { minutes: 18, seconds: 0, urgency: 'medium' },
    });
    const next = reducer(makeState({ timerSeconds: 5 }), {
      type: 'CYCLE_SUCCESS',
      payload: {
        result: makeCycleResult(),
        newUserState: baseUser,
        engineOutput: newEngine,
        historyEntry: makeHistoryEntry(),
      },
    });
    expect(next.timerSeconds).toBe(18 * 60);
    expect(next.pendingConfirmation).toBe(false);
  });
});
