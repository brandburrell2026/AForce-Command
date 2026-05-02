/**
 * Regression tests for the SET_USER_STATE overlay-safe merge.
 *
 * Race scenario the architect flagged: a long-running async (e.g. the
 * 30s /state poll, weather refresh, or any postAndRecompute) starts
 * BEFORE the user connects a non-Apple provider. The response carries
 * a userState computed from the request-time snapshot — i.e. without
 * `biometrics`. If that response dispatches `SET_USER_STATE` after the
 * user has since connected WHOOP/Oura, a naive `userState: payload`
 * assignment would wipe the freshly-connected provider out of the
 * store and the engine would lose the recovery contribution.
 *
 * The reducer therefore preserves current `biometrics` / `appleHealth`
 * when the payload omits them. Explicit disconnect intent flows
 * through SET_PROVIDER_BIOMETRICS / SET_APPLE_HEALTH instead.
 */
import { describe, it, expect } from 'vitest';
import { reducer as appStoreReducer } from '../appStoreReducer';
import type { ProviderSnapshot, UserState } from '../../types';
import { makeState, makeUserState, makeEngine } from './_fixtures';

const ouraSnap: ProviderSnapshot = {
  providerId: 'oura',
  hrvSdnn: 58,
  sleepHoursLastNight: 7.4,
  readinessScore: 82,
  fetchedAt: 1_700_000_000_000,
};

const whoopSnap: ProviderSnapshot = {
  providerId: 'whoop',
  recoveryPct: 78,
  sleepHoursLastNight: 7.5,
  fetchedAt: 1_700_000_000_000,
};

const appleSnap = {
  restingHeartRate: 60,
  hrvSdnn: 65,
  sleepHoursLastNight: 7.5,
  stepsToday: 8000,
  fetchedAt: 1_700_000_000_000,
};

describe('SET_USER_STATE — overlay-safe merge', () => {
  it('preserves current biometrics when a late response omits them', () => {
    // User has WHOOP connected NOW. A late /state response from before
    // the connect arrives without biometrics.
    const state = makeState({
      userState: makeUserState({ biometrics: { whoop: whoopSnap } }),
    });
    const stalePayload = makeUserState({ biometrics: undefined });

    const next = appStoreReducer(state, {
      type: 'SET_USER_STATE',
      payload: { newUserState: stalePayload, engineOutput: makeEngine() },
    });

    expect(next.userState.biometrics).toEqual({ whoop: whoopSnap });
  });

  it('preserves current appleHealth when a late response omits it', () => {
    const state = makeState({
      userState: makeUserState({ appleHealth: appleSnap }),
    });
    const stalePayload = makeUserState({ appleHealth: undefined });

    const next = appStoreReducer(state, {
      type: 'SET_USER_STATE',
      payload: { newUserState: stalePayload, engineOutput: makeEngine() },
    });

    expect(next.userState.appleHealth).toEqual(appleSnap);
  });

  it('adopts a fresher biometrics payload over the current value', () => {
    // Server-merge path that round-trips through fetchHome WILL include
    // biometrics if the request had them. Reducer must accept it.
    const state = makeState({
      userState: makeUserState({ biometrics: { oura: ouraSnap } }),
    });
    const fresherWhoop: ProviderSnapshot = { ...whoopSnap, recoveryPct: 90 };
    const freshPayload = makeUserState({
      biometrics: { oura: ouraSnap, whoop: fresherWhoop },
    });

    const next = appStoreReducer(state, {
      type: 'SET_USER_STATE',
      payload: { newUserState: freshPayload, engineOutput: makeEngine() },
    });

    expect(next.userState.biometrics).toEqual({ oura: ouraSnap, whoop: fresherWhoop });
  });

  it('does NOT inject biometrics when neither current nor payload has any', () => {
    const state = makeState({ userState: makeUserState({ biometrics: undefined }) });
    const payload = makeUserState({ biometrics: undefined });

    const next = appStoreReducer(state, {
      type: 'SET_USER_STATE',
      payload: { newUserState: payload, engineOutput: makeEngine() },
    });

    expect(next.userState.biometrics).toBeUndefined();
  });

  it('explicit disconnect via SET_PROVIDER_BIOMETRICS still wipes the provider', () => {
    // Sanity check — the overlay-safe SET_USER_STATE merge must not
    // prevent users from actually disconnecting providers.
    const state = makeState({
      userState: makeUserState({ biometrics: { oura: ouraSnap, whoop: whoopSnap } }),
    });

    const next = appStoreReducer(state, {
      type: 'SET_PROVIDER_BIOMETRICS',
      payload: { providerId: 'whoop', snapshot: null, engineOutput: makeEngine() },
    });

    expect(next.userState.biometrics).toEqual({ oura: ouraSnap });
  });

  it('multi-provider current state survives a stale payload that has none', () => {
    const state = makeState({
      userState: makeUserState({
        biometrics: { oura: ouraSnap, whoop: whoopSnap },
        appleHealth: appleSnap,
      }),
    });
    const stalePayload = makeUserState({ biometrics: undefined, appleHealth: undefined });

    const next = appStoreReducer(state, {
      type: 'SET_USER_STATE',
      payload: { newUserState: stalePayload, engineOutput: makeEngine() },
    });

    expect(next.userState.biometrics).toEqual({ oura: ouraSnap, whoop: whoopSnap });
    expect(next.userState.appleHealth).toEqual(appleSnap);
  });
});
