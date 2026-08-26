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
import { mergeBiometrics } from '../utils/biometricsMerge';
import { buildAppleHealthProviderSnapshot } from '../utils/biometricsAggregator';

/**
 * Canonical default body weight (lb). Matches `mockUserProfile.bodyWeightLbs`
 * so a user who clears their saved weight falls back to the same baseline
 * the engine starts with on a fresh install rather than carrying the stale
 * value forward in-session.
 */
const DEFAULT_BODY_WEIGHT_LBS = 180;

/**
 * Compute the next UserState for a profile-identity change that may
 * include a body-weight update. Three cases:
 *   - finite number → mirror it into userState
 *   - explicit `null`  → user cleared their weight, reset to default
 *   - key absent (`undefined`) → leave userState untouched
 *
 * Centralised so UPDATE_ and SET_ branches stay in sync. Object identity
 * is preserved when nothing changes so React-Query / context selectors
 * don't re-render unnecessarily.
 */
function mirrorBodyWeight(
  userState: UserState,
  payload: { bodyWeightLbs?: number | null },
): UserState {
  if (!('bodyWeightLbs' in payload)) return userState;
  const v = payload.bodyWeightLbs;
  if (typeof v === 'number' && Number.isFinite(v)) {
    if (userState.bodyWeightLbs === v) return userState;
    return { ...userState, bodyWeightLbs: v };
  }
  // Explicit null (cleared) — reset to canonical default.
  if (userState.bodyWeightLbs === DEFAULT_BODY_WEIGHT_LBS) return userState;
  return { ...userState, bodyWeightLbs: DEFAULT_BODY_WEIGHT_LBS };
}

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
      // INVARIANT (defense-in-depth): client-only overlays
      // (`biometrics`, `appleHealth`) are owned exclusively by the
      // device — server intake responses only echo what the request
      // sent, so we always restore current overlays. The companion
      // call site in `logIntake` recomputes engineOutput from the
      // merged state so the new score reflects actual overlays.
      const merged: UserState = {
        ...newUserState,
        biometrics: state.userState.biometrics,
        appleHealth: state.userState.appleHealth,
      };
      return {
        ...state,
        userState: merged,
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
    case 'CYCLE_FAILURE':
      // Pair with CYCLE_START so a failed intake (network error, 401,
      // server reject) clears the loading flag and re-enables every
      // intake-driven CTA (primary status button, Become AForce,
      // QuickActionInline, LogIntakeRow). Without this, a single
      // failure soft-locks the home screen until reload.
      return {
        ...state,
        isCompletingCycle: false,
        showCycleSuccess: false,
        lastCycleResult: null,
      };
    case 'SNOOZE': {
      const updated: UserState = {
        ...state.userState,
        isSnoozed: true,
        snoozeUntil: new Date(Date.now() + 20 * 60 * 1000),
      };
      return { ...state, userState: updated };
    }
    case 'TICK_TIMER': {
      // Already expired and awaiting the user's answer: the branch below
      // would return a value-identical new object every second, defeating
      // React's same-reference bail-out and re-rendering the whole
      // provider 60x/min for no change. Return the SAME reference instead.
      if (state.timerSeconds === 0 && state.pendingConfirmation) return state;
      const next = state.timerSeconds - 1;
      if (next <= 0) {
        return { ...state, timerSeconds: 0, pendingConfirmation: true };
      }
      return { ...state, timerSeconds: next };
    }
    case 'CONFIRM_COMMAND': {
      const { newUserState, engineOutput } = action.payload;
      // INVARIANT (defense-in-depth): protect client-only overlays
      // from server-echo replacement, identical to SET_USER_STATE /
      // CYCLE_SUCCESS. Companion call site in `confirmCommand`
      // recomputes engineOutput from the merged state.
      const merged: UserState = {
        ...newUserState,
        biometrics: state.userState.biometrics,
        appleHealth: state.userState.appleHealth,
      };
      return {
        ...state,
        userState: merged,
        engineOutput,
        pendingConfirmation: false,
        timerSeconds: engineOutput.riskTimer.minutes * 60,
      };
    }
    case 'SET_USER_STATE': {
      const { newUserState, engineOutput } = action.payload;
      // `appleHealth` is a pure on-device overlay that never originates
      // server-side, so it's always restored from the current store state.
      // `biometrics`, however, now legitimately comes from BOTH sides — the
      // backend fetches provider snapshots (WHOOP) that ride in on the
      // GET /state payload, while on-device (Apple Health) + demo snapshots are
      // client-owned. Reconcile freshest-wins per provider so real server data
      // lands without a stale local copy masking it, and an empty/echoed server
      // payload never wipes a client overlay. Explicit connect/disconnect still
      // flows through SET_PROVIDER_BIOMETRICS.
      const merged: UserState = {
        ...newUserState,
        biometrics: mergeBiometrics(newUserState.biometrics, state.userState.biometrics),
        appleHealth: state.userState.appleHealth,
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
            // RC-2 Founder Ruling C: carries the optional per-field
            // observation times through additively — see
            // `buildAppleHealthProviderSnapshot`'s header.
            apple_health: buildAppleHealthProviderSnapshot(snapshot),
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
    case 'SET_NOTIFICATION_SETTING': {
      const { key, value } = action.payload;
      return {
        ...state,
        notificationSettings: { ...state.notificationSettings, [key]: value },
      };
    }
    case 'SET_NOTIFICATION_SETTINGS':
      return { ...state, notificationSettings: action.payload };
    case 'SET_UNIT_PREFERENCE': {
      // Single-key merge — mirrors SET_NOTIFICATION_SETTING. The
      // discriminated payload keeps the value typed against the
      // matching key, so accidentally writing 'lbs' into 'temperature'
      // fails at compile time.
      const { key, value } = action.payload;
      return {
        ...state,
        unitPreferences: { ...state.unitPreferences, [key]: value },
      };
    }
    case 'SET_UNIT_PREFERENCES':
      // Full-record replace, used by the AsyncStorage hydration path
      // so a corrupt-payload fallback always lands on a complete,
      // sanitised UnitPreferences object.
      return { ...state, unitPreferences: action.payload };
    case 'UPDATE_PROFILE_IDENTITY': {
      // Partial merge — the edit modal submits only the fields that
      // actually changed (or all of them; either is fine). Empty
      // strings ARE valid (user clearing a chip), so we don't filter
      // them out. Reducer-only; persistence happens in the effect
      // that watches `state.profileIdentity`.
      const nextIdentity = { ...state.profileIdentity, ...action.payload };
      // Mirror body-model weight into UserState so the scoring engine,
      // depletion math, and personalization helper see the live value.
      // Three cases:
      //   - finite number → mirror it
      //   - explicit null → user cleared their weight, reset to the
      //     canonical default (matches mockUserProfile.bodyWeightLbs)
      //     so stale weight doesn't leak forward in-session
      //   - key absent → leave userState untouched
      const nextUserState = mirrorBodyWeight(state.userState, action.payload);
      return {
        ...state,
        profileIdentity: nextIdentity,
        userState: nextUserState,
      };
    }
    case 'SET_PROFILE_IDENTITY': {
      // Full-record replace, used by the AsyncStorage hydration path
      // so a corrupt-payload fallback always lands on a complete,
      // sanitised ProfileIdentity object. Mirror the body weight on
      // rehydrate too (or reset to default when the persisted value
      // is null), otherwise a restart would lose it.
      const nextUserState = mirrorBodyWeight(state.userState, action.payload);
      return {
        ...state,
        profileIdentity: action.payload,
        userState: nextUserState,
      };
    }
    case 'ADD_HISTORY_ENTRY': {
      // De-dupe by id so a re-seeded synthetic baseline never doubles up.
      const filtered = state.history.filter((h) => h.id !== action.payload.id);
      return { ...state, history: [action.payload, ...filtered].slice(0, 30) };
    }
    default:
      return state;
  }
}
