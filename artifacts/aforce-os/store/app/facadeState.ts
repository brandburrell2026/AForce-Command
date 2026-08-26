import type { AppState } from '../appStoreTypes';

/**
 * What the monolithic `useAppStore()` facade exposes as `state`.
 *
 * `timerSeconds` is deliberately EXCLUDED (Wave-4 Part 6). It is the only
 * field that changes every second, and while it lived on the facade the
 * `value` useMemo's identity changed on every `TICK_TIMER` — so all ~90
 * `useAppStore()` call sites, including all six tab-route wrappers,
 * re-rendered once per second along with their entire screen subtrees.
 *
 * Per-second countdown consumers read `useTimerSlice()` instead, which is
 * memoized on `timerSeconds` alone, so the churn is scoped to the handful
 * of components that actually display a countdown.
 */
export type FacadeState = Omit<AppState, 'timerSeconds'>;

/**
 * Field-by-field (NOT a spread) on purpose: adding a field to `AppState`
 * then fails to compile here until it is explicitly forwarded or
 * deliberately withheld, and every field is a visible reference the
 * facade's dependency array can be checked against.
 */
export function pickFacadeState(state: AppState): FacadeState {
  return {
    userState: state.userState,
    engineOutput: state.engineOutput,
    history: state.history,
    lastCycleResult: state.lastCycleResult,
    isCompletingCycle: state.isCompletingCycle,
    showCycleSuccess: state.showCycleSuccess,
    pendingConfirmation: state.pendingConfirmation,
    featureFlags: state.featureFlags,
    subscription: state.subscription,
    lastIntakeBurstAt: state.lastIntakeBurstAt,
    hasSeenOnboarding: state.hasSeenOnboarding,
    sweatAutopilot: state.sweatAutopilot,
    sweatAutopilotSetAt: state.sweatAutopilotSetAt,
    notificationSettings: state.notificationSettings,
    unitPreferences: state.unitPreferences,
    profileIdentity: state.profileIdentity,
  };
}
