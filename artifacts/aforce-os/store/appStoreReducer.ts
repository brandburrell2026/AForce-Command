/**
 * Pure reducer for the AForce app store.
 *
 * Extracted from useAppStore.tsx so it can be unit-tested in isolation
 * without pulling in React Native, AsyncStorage, or the i18n side
 * effects. Intentionally side-effect free: every branch returns a new
 * AppState derived from `state` + `action`.
 */

import type { UserState } from '../types';
import type { AppState, Action } from './appStoreTypes';

export function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'SET_SWEAT_AUTOPILOT': {
      const { autopilot, setAt } = action.payload;
      // When a sweat-driven autopilot window opens, also reset the
      // active recheck countdown to its cadence so the existing
      // RiskTimerDisplay (driven by `timerSeconds`) reflects the
      // autopilot interval instead of the stale engine.riskTimer value.
      // Clearing autopilot (null) leaves the timer untouched — the next
      // engine refresh / cycle will set it via its own branches.
      const nextTimerSeconds = autopilot
        ? autopilot.intervalMin * 60
        : state.timerSeconds;
      return {
        ...state,
        sweatAutopilot: autopilot,
        sweatAutopilotSetAt: setAt,
        timerSeconds: nextTimerSeconds,
        // A fresh autopilot window invalidates any pending "did you
        // follow the command?" prompt — the new cadence supersedes it.
        pendingConfirmation: autopilot ? false : state.pendingConfirmation,
      };
    }
    case 'CYCLE_START':
      return { ...state, isCompletingCycle: true };
    case 'CYCLE_SUCCESS': {
      const { result, newUserState, engineOutput, historyEntry, silent } = action.payload;
      return {
        ...state,
        userState: newUserState,
        engineOutput,
        history: [historyEntry, ...state.history].slice(0, 30),
        lastCycleResult: result,
        isCompletingCycle: false,
        // Voice flow shows its own response card — suppress the hero overlay
        // so we don't stack two modals (which RN-web cannot render together).
        showCycleSuccess: !silent,
        timerSeconds: engineOutput.riskTimer.minutes * 60,
        pendingConfirmation: false,
        lastIntakeBurstAt: Date.now(),
      };
    }
    case 'DISMISS_SUCCESS':
      return { ...state, showCycleSuccess: false, lastCycleResult: null };
    case 'SNOOZE': {
      const updated: UserState = {
        ...state.userState,
        isSnoozed: true,
        snoozeUntil: new Date(Date.now() + 20 * 60 * 1000),
      };
      return { ...state, userState: updated };
    }
    case 'TICK_TIMER': {
      const next = state.timerSeconds - 1;
      if (next <= 0) {
        return { ...state, timerSeconds: 0, pendingConfirmation: true };
      }
      return { ...state, timerSeconds: next };
    }
    case 'CONFIRM_COMMAND': {
      const { newUserState, engineOutput } = action.payload;
      return {
        ...state,
        userState: newUserState,
        engineOutput,
        pendingConfirmation: false,
        timerSeconds: engineOutput.riskTimer.minutes * 60,
      };
    }
    case 'SET_USER_STATE': {
      const { newUserState, engineOutput } = action.payload;
      // Overlay-safe merge: client-only fields (`biometrics`,
      // `appleHealth`) are NEVER server-authoritative. They live on
      // the device. If a late-arriving response was computed from a
      // request whose snapshot pre-dated a provider connect, its
      // payload may omit fields that the user has since added — so we
      // preserve the current overlays unless the payload explicitly
      // provides a fresher value. Explicit disconnect intent flows
      // through `SET_PROVIDER_BIOMETRICS` / `SET_APPLE_HEALTH`, not
      // through this reducer.
      const merged: UserState = {
        ...newUserState,
        ...(newUserState.biometrics === undefined && state.userState.biometrics
          ? { biometrics: state.userState.biometrics }
          : {}),
        ...(newUserState.appleHealth === undefined && state.userState.appleHealth
          ? { appleHealth: state.userState.appleHealth }
          : {}),
      };
      return {
        ...state,
        userState: merged,
        engineOutput,
        timerSeconds: engineOutput.riskTimer.minutes * 60,
      };
    }
    case 'REFRESH_ENGINE': {
      // Engine refresh from poll — do NOT reset countdown timer.
      return { ...state, engineOutput: action.payload.engineOutput };
    }
    case 'SET_FLAGS':
      return { ...state, featureFlags: action.payload };
    case 'SET_SUBSCRIPTION':
      return { ...state, subscription: action.payload };
    case 'COMPLETE_ONBOARDING':
      return { ...state, hasSeenOnboarding: true };
    case 'SET_APPLE_HEALTH': {
      const { snapshot, engineOutput } = action.payload;
      // Apple Health is mirrored into TWO places:
      //   - Legacy `appleHealth` field (kept for back-compat with the
      //     score engine fallback path and the existing `generateReasons`
      //     consumer).
      //   - The `biometrics.apple_health` slot of the multi-provider
      //     record so the cross-provider aggregator sees Apple Health
      //     alongside the other six platforms.
      const baseBio = state.userState.biometrics ?? {};
      let updated: UserState;
      if (snapshot) {
        updated = {
          ...state.userState,
          appleHealth: snapshot,
          biometrics: {
            ...baseBio,
            apple_health: {
              providerId: 'apple_health',
              restingHeartRate: snapshot.restingHeartRate,
              hrvSdnn: snapshot.hrvSdnn,
              sleepHoursLastNight: snapshot.sleepHoursLastNight,
              stepsToday: snapshot.stepsToday,
              fetchedAt: snapshot.fetchedAt,
            },
          },
        };
      } else {
        const { appleHealth: _drop, ...rest } = state.userState;
        const { apple_health: _dropBio, ...restBio } = baseBio;
        updated = { ...(rest as UserState), biometrics: restBio };
      }
      return { ...state, userState: updated, engineOutput };
    }
    case 'SET_PROVIDER_BIOMETRICS': {
      const { providerId, snapshot, engineOutput } = action.payload;
      const baseBio = state.userState.biometrics ?? {};
      let nextBio: typeof baseBio;
      if (snapshot) {
        nextBio = { ...baseBio, [providerId]: snapshot };
      } else {
        const { [providerId]: _drop, ...rest } = baseBio;
        nextBio = rest;
      }
      return {
        ...state,
        userState: { ...state.userState, biometrics: nextBio },
        engineOutput,
      };
    }
    default:
      return state;
  }
}
