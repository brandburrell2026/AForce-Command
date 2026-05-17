/**
 * Social slice — covers Social Mode user-state replacement and the
 * propagation of the engineOutput.social rollup through SET_USER_STATE
 * / REFRESH_ENGINE.
 */

import { describe, it, expect } from 'vitest';

import { reducer } from '../appStoreReducer';
import type { ScoreEngineOutput, UserState } from '../../types';
import {
  baseEngine,
  baseUser,
  FIXED_NOW,
  makeEngine,
  makeState,
  makeUserState,
} from './_fixtures';

function makeSocialUser(overrides: Partial<NonNullable<UserState['socialMode']>> = {}): UserState {
  const social = {
    active: true,
    sex: 'male',
    ateRecently: true,
    startedAt: new Date(FIXED_NOW),
    drinks: [],
    ...overrides,
  } as unknown as UserState['socialMode'];
  return makeUserState({ socialMode: social });
}

function makeSocialRollup(): NonNullable<ScoreEngineOutput['social']> {
  return {
    active: true,
    inRecoveryWindow: false,
    drinkCount: 2,
    hangoverRisk: { level: 'LOW', score: 0, reasons: [] } as never,
    alcoholMultiplier: 1.2,
    bac: { value: 0.04, range: [0.03, 0.05], trend: 'rising', confidence: 'med' } as never,
    impairment: { level: 'ELEVATED', label: 'Elevated', color: '#FFA01E' } as never,
    transportation: { show: false, title: '', body: '' } as never,
    recoveryCapacity: {
      score: 72,
      band: 'stable',
      meta: { band: 'stable', id: 'stable', label: 'Stable', color: '#3D7BFF', min: 60, max: 84 },
      contributions: { autoPilot: 45, hydrationCompliance: 15, environmental: 12 },
    } as never,
    cruiseActive: false,
    voyageShieldActive: false,
    windowMs: 8 * 60 * 60 * 1000,
  };
}

describe('store · social slice', () => {
  it('SET_USER_STATE adopts a socialMode payload onto userState', () => {
    const newUser = makeSocialUser();
    const next = reducer(makeState(), {
      type: 'SET_USER_STATE',
      payload: { newUserState: newUser, engineOutput: baseEngine },
    });
    expect(next.userState.socialMode?.active).toBe(true);
    expect(next.userState.socialMode?.sex).toBe('male');
  });

  it('clears socialMode when the server returns userState without it', () => {
    const cleared = reducer(makeState({ userState: makeSocialUser() }), {
      type: 'SET_USER_STATE',
      payload: { newUserState: baseUser, engineOutput: baseEngine },
    });
    expect(cleared.userState.socialMode).toBeUndefined();
  });

  it('REFRESH_ENGINE picks up a social rollup without disturbing userState', () => {
    const newEngine = makeEngine({ social: makeSocialRollup() });
    const next = reducer(makeState({ userState: makeSocialUser() }), {
      type: 'REFRESH_ENGINE',
      payload: { engineOutput: newEngine },
    });
    expect(next.engineOutput.social?.active).toBe(true);
    expect(next.engineOutput.social?.drinkCount).toBe(2);
    expect(next.userState.socialMode?.active).toBe(true);
  });

  it('REFRESH_ENGINE can clear the social rollup (recovery window expired)', () => {
    const startState = makeState({ engineOutput: makeEngine({ social: makeSocialRollup() }) });
    const next = reducer(startState, {
      type: 'REFRESH_ENGINE',
      payload: { engineOutput: makeEngine({ social: null }) },
    });
    expect(next.engineOutput.social).toBeNull();
  });

  it('SET_USER_STATE updates BAC context (sex / ateRecently) when the user changes it', () => {
    const female = makeSocialUser({
      sex: 'female',
      ateRecently: false,
    } as never);
    const next = reducer(makeState({ userState: makeSocialUser() }), {
      type: 'SET_USER_STATE',
      payload: { newUserState: female, engineOutput: baseEngine },
    });
    expect(next.userState.socialMode?.sex).toBe('female');
    expect(next.userState.socialMode?.ateRecently).toBe(false);
  });

  it('SET_USER_STATE preserves the rest of userState when only socialMode changes', () => {
    const startState = makeState({ userState: makeSocialUser() });
    const newUser = makeSocialUser({ drinks: [{ id: 'd1' } as never] });
    const next = reducer(startState, {
      type: 'SET_USER_STATE',
      payload: { newUserState: newUser, engineOutput: baseEngine },
    });
    expect(next.userState.socialMode?.drinks).toHaveLength(1);
    expect(next.userState.bodyWeightLbs).toBe(180);
  });
});
