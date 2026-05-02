/**
 * Engine slice — covers the recheck timer countdown, engine refresh
 * vs full state replacement, feature flags, subscription entitlement,
 * onboarding flag, and the reducer's defensive default branch.
 */

import { describe, it, expect } from 'vitest';

import { reducer } from '../appStoreReducer';
import type { FeatureFlags } from '../../types';
import {
  baseEngine,
  baseFlags,
  baseSubscription,
  baseUser,
  makeEngine,
  makeState,
  makeUserState,
} from './_fixtures';

describe('store · engine slice', () => {
  it('TICK_TIMER decrements seconds without flipping confirmation mid-countdown', () => {
    const next = reducer(makeState({ timerSeconds: 5 }), { type: 'TICK_TIMER' });
    expect(next.timerSeconds).toBe(4);
    expect(next.pendingConfirmation).toBe(false);
  });

  it('TICK_TIMER hitting zero pins the timer at 0 and flips pendingConfirmation', () => {
    const next = reducer(makeState({ timerSeconds: 1 }), { type: 'TICK_TIMER' });
    expect(next.timerSeconds).toBe(0);
    expect(next.pendingConfirmation).toBe(true);
  });

  it('REFRESH_ENGINE swaps engine output but does NOT reset the recheck timer', () => {
    const newEngine = makeEngine({
      riskTimer: { minutes: 30, seconds: 0, urgency: 'low' },
      score: 99,
    });
    const next = reducer(makeState({ timerSeconds: 42 }), {
      type: 'REFRESH_ENGINE',
      payload: { engineOutput: newEngine },
    });
    expect(next.engineOutput).toBe(newEngine);
    expect(next.timerSeconds).toBe(42);
  });

  it('SET_USER_STATE replaces both userState and engine output AND resets the timer', () => {
    const newUser = makeUserState({ language: 'es' });
    const newEngine = makeEngine({
      riskTimer: { minutes: 7, seconds: 0, urgency: 'medium' },
    });
    const next = reducer(makeState({ timerSeconds: 1 }), {
      type: 'SET_USER_STATE',
      payload: { newUserState: newUser, engineOutput: newEngine },
    });
    // SET_USER_STATE returns a merged object (overlay-safe — preserves
    // current `biometrics`/`appleHealth` if payload omits them), so the
    // contract is structural equality rather than reference identity.
    expect(next.userState).toEqual(newUser);
    expect(next.engineOutput).toBe(newEngine);
    expect(next.timerSeconds).toBe(7 * 60);
  });

  it('SET_FLAGS replaces the feature flag map without touching other slices', () => {
    const newFlags: FeatureFlags = { ...baseFlags, clutch_access_enabled: true };
    const next = reducer(makeState(), { type: 'SET_FLAGS', payload: newFlags });
    expect(next.featureFlags).toBe(newFlags);
    expect(next.userState).toBe(baseUser);
    expect(next.engineOutput).toBe(baseEngine);
  });

  it('SET_SUBSCRIPTION swaps the entitlement payload', () => {
    const sub = { ...baseSubscription, planId: 'recovery_plus' as const };
    const next = reducer(makeState(), { type: 'SET_SUBSCRIPTION', payload: sub });
    expect(next.subscription.planId).toBe('recovery_plus');
  });

  it('COMPLETE_ONBOARDING flips hasSeenOnboarding once', () => {
    const next = reducer(makeState(), { type: 'COMPLETE_ONBOARDING' });
    expect(next.hasSeenOnboarding).toBe(true);
  });

  it('returns the same reference for unknown actions (defensive default branch)', () => {
    const state = makeState();
    // @ts-expect-error — intentional unknown action to exercise the default branch
    const next = reducer(state, { type: 'UNKNOWN_ACTION' });
    expect(next).toBe(state);
  });
});
