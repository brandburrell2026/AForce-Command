/**
 * Hydration slice — covers how hydration-related user state changes
 * (urine signal, ounces consumed, dailyTarget, snooze) propagate
 * through SET_USER_STATE / SNOOZE without touching unrelated slices.
 */

import { describe, it, expect } from 'vitest';

import { reducer } from '../appStoreReducer';
import {
  baseEngine,
  baseSubscription,
  baseUser,
  makeEngine,
  makeState,
  makeUserState,
} from './_fixtures';

describe('store · hydration slice', () => {
  it('SET_USER_STATE adopts a fresh urine signal reading from the server', () => {
    const newUser = makeUserState({ urineSignal: 6 });
    const next = reducer(makeState(), {
      type: 'SET_USER_STATE',
      payload: { newUserState: newUser, engineOutput: baseEngine },
    });
    expect(next.userState.urineSignal).toBe(6);
  });

  it('SET_USER_STATE picks up incremented ounces and unit counts after an intake', () => {
    const newUser = makeUserState({ unitsConsumedToday: 5, ozConsumedToday: 72 });
    const next = reducer(makeState(), {
      type: 'SET_USER_STATE',
      payload: { newUserState: newUser, engineOutput: baseEngine },
    });
    expect(next.userState.unitsConsumedToday).toBe(5);
    expect(next.userState.ozConsumedToday).toBe(72);
  });

  it('SET_USER_STATE replaces sweatRate / activityLevel when the engine recomputes', () => {
    const newUser = makeUserState({ sweatRate: 7, activityLevel: 9 });
    const next = reducer(makeState(), {
      type: 'SET_USER_STATE',
      payload: { newUserState: newUser, engineOutput: baseEngine },
    });
    expect(next.userState.sweatRate).toBe(7);
    expect(next.userState.activityLevel).toBe(9);
  });

  it('SNOOZE marks the user snoozed and pushes snoozeUntil ~20 minutes out', () => {
    const before = Date.now();
    const next = reducer(makeState(), { type: 'SNOOZE' });
    expect(next.userState.isSnoozed).toBe(true);
    const until = next.userState.snoozeUntil?.getTime() ?? 0;
    expect(until - before).toBeGreaterThanOrEqual(19 * 60 * 1000);
    expect(until - before).toBeLessThanOrEqual(21 * 60 * 1000);
  });

  it('SNOOZE leaves featureFlags / subscription / engineOutput untouched', () => {
    const next = reducer(makeState(), { type: 'SNOOZE' });
    expect(next.engineOutput).toBe(baseEngine);
    expect(next.subscription).toBe(baseSubscription);
  });

  it('SET_USER_STATE picks up dailyTarget changes when the user adjusts their goal', () => {
    const newUser = makeUserState({ dailyTarget: 10, ozTarget: 120 });
    const next = reducer(makeState(), {
      type: 'SET_USER_STATE',
      payload: { newUserState: newUser, engineOutput: baseEngine },
    });
    expect(next.userState.dailyTarget).toBe(10);
    expect(next.userState.ozTarget).toBe(120);
  });

  it('SET_USER_STATE resets the recheck timer based on the freshly-computed engine output', () => {
    const newEngine = makeEngine({
      riskTimer: { minutes: 8, seconds: 0, urgency: 'high' },
    });
    const next = reducer(makeState({ timerSeconds: 99 }), {
      type: 'SET_USER_STATE',
      payload: { newUserState: baseUser, engineOutput: newEngine },
    });
    expect(next.timerSeconds).toBe(8 * 60);
  });
});
