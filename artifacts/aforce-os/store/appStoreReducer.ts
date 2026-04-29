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
      return {
        ...state,
        userState: newUserState,
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
      const updated: UserState = snapshot
        ? { ...state.userState, appleHealth: snapshot }
        : (() => {
            const { appleHealth: _drop, ...rest } = state.userState;
            return rest as UserState;
          })();
      return { ...state, userState: updated, engineOutput };
    }
    default:
      return state;
  }
}
