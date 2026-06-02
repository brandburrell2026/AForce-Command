/**
 * Heat slice — covers heat-load / Apple Health (HRV / sleep / RHR)
 * inputs that drive the heat-guard escalation and recovery overlays.
 * These flow into userState via SET_APPLE_HEALTH and SET_USER_STATE.
 */

import { describe, it, expect } from 'vitest';

import { reducer } from '../appStoreReducer';
import type { AppleHealthInputs } from '../../types';
import {
  baseEngine,
  baseUser,
  FIXED_NOW,
  makeEngine,
  makeState,
  makeUserState,
} from './_fixtures';

function makeSnapshot(overrides: Partial<AppleHealthInputs> = {}): AppleHealthInputs {
  return {
    restingHeartRate: 52,
    hrvSdnn: 65,
    stepsToday: 6500,
    sleepHoursLastNight: 7.5,
    fetchedAt: FIXED_NOW,
    ...overrides,
  };
}

describe('store · heat slice', () => {
  it('SET_APPLE_HEALTH attaches a snapshot onto userState and adopts the new engine output', () => {
    const snapshot = makeSnapshot();
    const newEngine = makeEngine({ score: 88 });
    const next = reducer(makeState(), {
      type: 'SET_APPLE_HEALTH',
      payload: { snapshot, engineOutput: newEngine },
    });
    expect(next.userState.appleHealth).toEqual(snapshot);
    expect(next.engineOutput).toBe(newEngine);
  });

  it('SET_APPLE_HEALTH with snapshot=null removes appleHealth from userState', () => {
    const startState = makeState({
      userState: makeUserState({ appleHealth: makeSnapshot() }),
    });
    const next = reducer(startState, {
      type: 'SET_APPLE_HEALTH',
      payload: { snapshot: null, engineOutput: baseEngine },
    });
    expect(next.userState.appleHealth).toBeUndefined();
  });

  it('SET_USER_STATE picks up a fresh heatLoad reading from the server', () => {
    const newUser = makeUserState({ heatLoad: 8 });
    const next = reducer(makeState(), {
      type: 'SET_USER_STATE',
      payload: { newUserState: newUser, engineOutput: baseEngine },
    });
    expect(next.userState.heatLoad).toBe(8);
  });

  it('SET_USER_STATE picks up new weather snapshot fields (temp / humidity)', () => {
    const newUser = makeUserState({
      weatherTempC: 34,
      weatherHumidity: 0.72,
      weatherFetchedAt: FIXED_NOW,
    });
    const next = reducer(makeState(), {
      type: 'SET_USER_STATE',
      payload: { newUserState: newUser, engineOutput: baseEngine },
    });
    expect(next.userState.weatherTempC).toBe(34);
    expect(next.userState.weatherHumidity).toBe(0.72);
  });

  it('SET_APPLE_HEALTH preserves the rest of userState (heatLoad, weather, etc.)', () => {
    const startState = makeState({
      userState: makeUserState({ heatLoad: 8, sweatRate: 6 }),
    });
    const next = reducer(startState, {
      type: 'SET_APPLE_HEALTH',
      payload: { snapshot: makeSnapshot(), engineOutput: baseEngine },
    });
    expect(next.userState.heatLoad).toBe(8);
    expect(next.userState.sweatRate).toBe(6);
    expect(next.userState.appleHealth?.hrvSdnn).toBe(65);
  });

  it('two SET_APPLE_HEALTH calls in sequence overwrite the prior snapshot', () => {
    const first = reducer(makeState(), {
      type: 'SET_APPLE_HEALTH',
      payload: { snapshot: makeSnapshot({ hrvSdnn: 40 }), engineOutput: baseEngine },
    });
    const second = reducer(first, {
      type: 'SET_APPLE_HEALTH',
      payload: { snapshot: makeSnapshot({ hrvSdnn: 80 }), engineOutput: baseEngine },
    });
    expect(second.userState.appleHealth?.hrvSdnn).toBe(80);
  });
});
