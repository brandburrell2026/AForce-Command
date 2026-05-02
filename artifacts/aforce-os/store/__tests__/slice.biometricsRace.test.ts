/**
 * Regression tests for the SET_USER_STATE overlay invariant.
 *
 * INVARIANT: client-only overlays (`biometrics`, `appleHealth`) are
 * owned exclusively by the device. Service responses only ECHO what
 * the request sent — they never originate or authoritatively update
 * overlays. Therefore `SET_USER_STATE` always overrides the payload's
 * overlays with the current store state, regardless of what the
 * payload carries (undefined, empty, partial subset, stale superset).
 *
 * Explicit overlay mutations flow through SET_PROVIDER_BIOMETRICS /
 * SET_APPLE_HEALTH, never through SET_USER_STATE.
 *
 * The companion `applyServerUserState` helper in useAppStore enforces
 * the same invariant AND recomputes engineOutput from the merged
 * state so score/command/timer reflect actual overlays. Reducer-level
 * enforcement here is defense-in-depth.
 */
import { describe, it, expect } from 'vitest';
import { reducer as appStoreReducer } from '../appStoreReducer';
import type { ProviderBiometrics, ProviderSnapshot } from '../../types';
import type { HealthProviderId } from '../../data/healthProviders';
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

const stravaSnap: ProviderSnapshot = {
  providerId: 'strava',
  workoutMinutesToday: 60,
  fetchedAt: 1_700_000_000_000,
};

const appleSnap = {
  restingHeartRate: 60,
  hrvSdnn: 65,
  sleepHoursLastNight: 7.5,
  stepsToday: 8000,
  fetchedAt: 1_700_000_000_000,
};

describe('SET_USER_STATE — client-owns-overlays invariant', () => {
  it('preserves current biometrics when a late response omits them', () => {
    // User connected WHOOP; a late /state response from before the
    // connect arrives without biometrics.
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

  it('preserves current biometrics when payload carries empty {} from a no-provider request', () => {
    const state = makeState({
      userState: makeUserState({ biometrics: { whoop: whoopSnap } }),
    });
    const stalePayload = makeUserState({ biometrics: {} });

    const next = appStoreReducer(state, {
      type: 'SET_USER_STATE',
      payload: { newUserState: stalePayload, engineOutput: makeEngine() },
    });

    expect(next.userState.biometrics).toEqual({ whoop: whoopSnap });
  });

  it('preserves current SUPERSET when payload echoes a stale partial subset', () => {
    // Architect-flagged race: at request time client had {whoop}; user
    // connected oura mid-flight (current is now {whoop, oura}); the
    // response echoes {whoop}. Naive replacement would drop oura.
    const state = makeState({
      userState: makeUserState({ biometrics: { whoop: whoopSnap, oura: ouraSnap } }),
    });
    const stalePayload = makeUserState({ biometrics: { whoop: whoopSnap } });

    const next = appStoreReducer(state, {
      type: 'SET_USER_STATE',
      payload: { newUserState: stalePayload, engineOutput: makeEngine() },
    });

    expect(next.userState.biometrics).toEqual({ whoop: whoopSnap, oura: ouraSnap });
  });

  it('honors current DISCONNECT when payload echoes a stale superset', () => {
    // Reverse race: at request time client had {whoop, oura}; user
    // disconnected oura mid-flight (current is {whoop}); the response
    // echoes {whoop, oura}. Naive replacement would re-inject oura.
    const state = makeState({
      userState: makeUserState({ biometrics: { whoop: whoopSnap } }),
    });
    const stalePayload = makeUserState({ biometrics: { whoop: whoopSnap, oura: ouraSnap } });

    const next = appStoreReducer(state, {
      type: 'SET_USER_STATE',
      payload: { newUserState: stalePayload, engineOutput: makeEngine() },
    });

    expect(next.userState.biometrics).toEqual({ whoop: whoopSnap });
  });

  it('honors current full disconnect (undefined) over stale payload echoing providers', () => {
    const state = makeState({ userState: makeUserState({ biometrics: undefined }) });
    const stalePayload = makeUserState({ biometrics: { whoop: whoopSnap } });

    const next = appStoreReducer(state, {
      type: 'SET_USER_STATE',
      payload: { newUserState: stalePayload, engineOutput: makeEngine() },
    });

    expect(next.userState.biometrics).toBeUndefined();
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
    // Sanity check — overlay invariant must not prevent explicit
    // disconnects.
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
        biometrics: { oura: ouraSnap, whoop: whoopSnap, strava: stravaSnap },
        appleHealth: appleSnap,
      }),
    });
    const stalePayload = makeUserState({ biometrics: undefined, appleHealth: undefined });

    const next = appStoreReducer(state, {
      type: 'SET_USER_STATE',
      payload: { newUserState: stalePayload, engineOutput: makeEngine() },
    });

    expect(next.userState.biometrics).toEqual({
      oura: ouraSnap, whoop: whoopSnap, strava: stravaSnap,
    });
    expect(next.userState.appleHealth).toEqual(appleSnap);
  });

  it('CYCLE_SUCCESS preserves current overlays across server intake response', () => {
    // Architect-flagged: logIntake's CYCLE_SUCCESS dispatch was
    // bypassing the overlay-ownership invariant. Mid-flight provider
    // connects must survive a concurrent intake log.
    const state = makeState({
      userState: makeUserState({
        biometrics: { whoop: whoopSnap, oura: ouraSnap },
        appleHealth: appleSnap,
      }),
    });
    const stalePayload = makeUserState({ biometrics: undefined, appleHealth: undefined });

    const next = appStoreReducer(state, {
      type: 'CYCLE_SUCCESS',
      payload: {
        result: {
          id: 'log_1', timestamp: new Date(), scoreBefore: 70, scoreAfter: 78,
          gainDisplay: '+8', identityMessage: 'Locked in.', nextCycleHint: 'Next at 12:00',
          state: 'PEAK',
        },
        newUserState: stalePayload,
        engineOutput: makeEngine(),
        historyEntry: {
          id: 'log_1', timestamp: new Date(), score: 78, state: 'PEAK',
          action: 'Logged AForce stick (12 oz)', unitsTaken: 1, fluidType: 'aforce_stick',
        },
        silent: true,
      },
    });

    expect(next.userState.biometrics).toEqual({ whoop: whoopSnap, oura: ouraSnap });
    expect(next.userState.appleHealth).toEqual(appleSnap);
  });

  it('CONFIRM_COMMAND preserves current overlays across server confirm response', () => {
    const state = makeState({
      userState: makeUserState({
        biometrics: { strava: stravaSnap, oura: ouraSnap },
        appleHealth: appleSnap,
      }),
    });
    const stalePayload = makeUserState({ biometrics: { strava: stravaSnap }, appleHealth: undefined });

    const next = appStoreReducer(state, {
      type: 'CONFIRM_COMMAND',
      payload: { newUserState: stalePayload, engineOutput: makeEngine() },
    });

    expect(next.userState.biometrics).toEqual({ strava: stravaSnap, oura: ouraSnap });
    expect(next.userState.appleHealth).toEqual(appleSnap);
  });

  it('overlay invariant generalizes across all 7 health platforms', () => {
    // Provider-agnostic regression — every supported HealthProviderId
    // is preserved through SET_USER_STATE, CYCLE_SUCCESS, and
    // CONFIRM_COMMAND races.
    // Compile-time exhaustiveness — adding a new HealthProviderId
    // without a snapshot here will fail typecheck, guaranteeing the
    // race-safety contract stays in lockstep with the supported
    // provider set.
    const fullBiometrics: Required<ProviderBiometrics> = {
      apple_health: { providerId: 'apple_health', restingHeartRate: 60, fetchedAt: 1 },
      oura: ouraSnap,
      samsung_health: { providerId: 'samsung_health', stepsToday: 7000, fetchedAt: 1 },
      google_health: { providerId: 'google_health', sleepHoursLastNight: 7, fetchedAt: 1 },
      garmin: { providerId: 'garmin', hrvSdnn: 55, fetchedAt: 1 },
      whoop: whoopSnap,
      strava: stravaSnap,
    };
    // Belt-and-suspenders runtime check — every HealthProviderId
    // (sourced from the production registry) is represented.
    const allProviderIds: HealthProviderId[] = [
      'apple_health', 'oura', 'samsung_health', 'google_health', 'garmin', 'whoop', 'strava',
    ];
    for (const id of allProviderIds) {
      expect(fullBiometrics[id]).toBeDefined();
    }
    const state = makeState({
      userState: makeUserState({ biometrics: fullBiometrics, appleHealth: appleSnap }),
    });
    const stalePayload = makeUserState({ biometrics: undefined, appleHealth: undefined });

    const afterSetUserState = appStoreReducer(state, {
      type: 'SET_USER_STATE',
      payload: { newUserState: stalePayload, engineOutput: makeEngine() },
    });
    expect(afterSetUserState.userState.biometrics).toEqual(fullBiometrics);
    expect(afterSetUserState.userState.appleHealth).toEqual(appleSnap);

    const afterConfirm = appStoreReducer(state, {
      type: 'CONFIRM_COMMAND',
      payload: { newUserState: stalePayload, engineOutput: makeEngine() },
    });
    expect(afterConfirm.userState.biometrics).toEqual(fullBiometrics);
    expect(afterConfirm.userState.appleHealth).toEqual(appleSnap);
  });

  it('non-overlay fields from the payload ARE adopted (only overlays are protected)', () => {
    // Regression — make sure the invariant only protects overlays,
    // not legitimate server-authoritative fields like score-relevant
    // counters or weather data.
    const state = makeState({
      userState: makeUserState({
        biometrics: { whoop: whoopSnap },
        unitsConsumedToday: 4,
        ozConsumedToday: 60,
      }),
    });
    const payload = makeUserState({
      biometrics: undefined,
      unitsConsumedToday: 9,
      ozConsumedToday: 120,
      weatherCity: 'Phoenix',
      weatherTempC: 38,
    });

    const next = appStoreReducer(state, {
      type: 'SET_USER_STATE',
      payload: { newUserState: payload, engineOutput: makeEngine() },
    });

    expect(next.userState.biometrics).toEqual({ whoop: whoopSnap });
    expect(next.userState.unitsConsumedToday).toBe(9);
    expect(next.userState.ozConsumedToday).toBe(120);
    expect(next.userState.weatherCity).toBe('Phoenix');
    expect(next.userState.weatherTempC).toBe(38);
  });
});
