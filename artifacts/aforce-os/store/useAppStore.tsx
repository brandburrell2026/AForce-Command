/**
 * AForce OS App Store
 * React Context + useReducer state container backed by the mockApi service layer.
 *
 * Source of truth for: userState, engineOutput (score/state/pulseConfig/command),
 * cycle history, feature flags, and overlay UI state.
 */

import React, { createContext, useContext, useReducer, useCallback, useEffect, useMemo, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type {
  UserState,
  AppleHealthInputs,
  ScoreEngineOutput,
  CycleResult,
  HistoryEntry,
  FluidType,
  FeatureFlags,
} from '../types';
import type { UserSubscription } from '../types/subscription';
import { defaultSubscription } from '../services/subscriptionService';
import { generateCycleIdentityMessage, generateNextCycleHint } from '../utils/scoringEngine';
import { defaultUserState, mockHistory } from '../data/mockData';
import { DEFAULT_FLAGS } from '../featureFlags/flags';
import {
  fetchHome,
  postIntakeLog,
  postSignalsUpdate,
  postUrineSignalUpdate,
  postEnergyStateUpdate,
  postCheckin,
  postClutchFlag,
  postConfirmCommand,
  postLanguage,
  refreshWeather,
  subscribeToStateUpdates,
} from '../services/realApi';
import { setLanguage as setI18nLanguage, type SupportedLanguage } from '../services/i18nService';
import { PRODUCTS } from '../data/products';

// Service-only synchronous bootstrapping helper. The store NEVER calls
// the scoring engine directly — it always asks the mock API for engineOutput.
// (We use the synchronous helper from mockApi internals via fetchHome's
// promise resolution being immediate-after-microtask in tests; for the
// initial render, we accept a one-tick zero state and refresh on mount.)
import { calculateScore as _initialOnly } from '../utils/scoringEngine';

interface AppState {
  userState: UserState;
  engineOutput: ScoreEngineOutput;
  history: HistoryEntry[];
  lastCycleResult: CycleResult | null;
  isCompletingCycle: boolean;
  showCycleSuccess: boolean;
  timerSeconds: number;
  /** True when the recheck timer hit zero and we're awaiting the user's "Did you follow it?" answer. */
  pendingConfirmation: boolean;
  featureFlags: FeatureFlags;
  subscription: UserSubscription;
  lastIntakeBurstAt: number; // timestamp for pulse burst trigger
  hasSeenOnboarding: boolean;
}

type Action =
  | { type: 'CYCLE_START' }
  | { type: 'CYCLE_SUCCESS'; payload: { result: CycleResult; newUserState: UserState; engineOutput: ScoreEngineOutput; historyEntry: HistoryEntry; silent?: boolean } }
  | { type: 'DISMISS_SUCCESS' }
  | { type: 'SNOOZE' }
  | { type: 'TICK_TIMER' }
  | { type: 'SET_USER_STATE'; payload: { newUserState: UserState; engineOutput: ScoreEngineOutput } }
  | { type: 'REFRESH_ENGINE'; payload: { engineOutput: ScoreEngineOutput } }
  | { type: 'SET_FLAGS'; payload: FeatureFlags }
  | { type: 'SET_SUBSCRIPTION'; payload: UserSubscription }
  | { type: 'COMPLETE_ONBOARDING' }
  | { type: 'SET_APPLE_HEALTH'; payload: { snapshot: AppleHealthInputs | null; engineOutput: ScoreEngineOutput } }
  | { type: 'CONFIRM_COMMAND'; payload: { newUserState: UserState; engineOutput: ScoreEngineOutput } };

// Initial render only — engine output is then immediately refreshed via
// /v1/home from the service layer in an effect (see AppProvider mount).
const initialEngineOutput = _initialOnly(defaultUserState);

const initialState: AppState = {
  userState: defaultUserState,
  engineOutput: initialEngineOutput,
  history: mockHistory,
  lastCycleResult: null,
  isCompletingCycle: false,
  showCycleSuccess: false,
  timerSeconds: initialEngineOutput.riskTimer.minutes * 60,
  pendingConfirmation: false,
  featureFlags: DEFAULT_FLAGS,
  subscription: defaultSubscription(),
  lastIntakeBurstAt: 0,
  hasSeenOnboarding: false,
};

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
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
      // Snooze itself is local UI state. Score will be refreshed on next
      // /v1/home tick — do not invoke the scoring engine inline.
      return { ...state, userState: updated };
    }
    case 'TICK_TIMER': {
      const next = state.timerSeconds - 1;
      if (next <= 0) {
        // Timer expired — arm the "Did you follow the command?"
        // prompt (T2). The engine is still refreshed from /v1/home;
        // we only flip the local UI flag here.
        return { ...state, timerSeconds: 0, pendingConfirmation: true };
      }
      return { ...state, timerSeconds: next };
    }
    case 'CONFIRM_COMMAND': {
      const { newUserState, engineOutput } = action.payload;
      // Reset the recheck countdown so the user gets a fresh window
      // before the next prompt fires.
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
      return { ...state, userState: newUserState, engineOutput, timerSeconds: engineOutput.riskTimer.minutes * 60 };
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
        : (() => { const { appleHealth: _drop, ...rest } = state.userState; return rest as UserState; })();
      return { ...state, userState: updated, engineOutput };
    }
    default:
      return state;
  }
}

interface AppContextValue {
  state: AppState;
  logIntake: (
    fluidType: FluidType,
    opts?: { silent?: boolean; ozOverride?: number; flavorLabel?: string },
  ) => Promise<void>;
  completeCycle: () => Promise<void>;
  snooze: () => void;
  dismissSuccess: () => void;
  updateSymptoms: (symptoms: string[]) => Promise<void>;
  updateUrineSignal: (signal: number) => Promise<void>;
  updateEnergyState: (energy: UserState['energyState']) => Promise<void>;
  confirmStatus: () => Promise<void>;
  setFeatureFlags: (flags: FeatureFlags) => void;
  setSubscription: (sub: UserSubscription) => void;
  completeOnboarding: () => void;
  setAppleHealthSnapshot: (snapshot: AppleHealthInputs | null) => void;
  /**
   * Resolve the post-recheck "Did you follow the command?" prompt (T2).
   * Yes → +3 score. No → -3 score and (in Clutch mode, T3) a 10-min
   * +0.5 pts/min decay boost.
   */
  confirmCommand: (followed: boolean) => Promise<void>;
  /**
   * Persist the user's chosen UI language. Updates i18next immediately,
   * mirrors the choice into UserState so the orb / breakdown re-render,
   * and POSTs to the server so it survives reload.
   */
  setLanguage: (lang: SupportedLanguage) => Promise<void>;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  // Live countdown timer (drives recheck)
  useEffect(() => {
    const interval = setInterval(() => dispatch({ type: 'TICK_TIMER' }), 1000);
    return () => clearInterval(interval);
  }, []);

  // Periodic /state refresh — keeps the engine output current (decay
  // ticks, weather staleness, etc.) and rehydrates from server in case
  // a WS push was missed.
  useEffect(() => {
    let cancelled = false;
    const refresh = async () => {
      try {
        const { engineOutput, userState } = await fetchHome(state.userState);
        if (cancelled) return;
        // If server returned a newer state (e.g. from another device or
        // a fresh weather lookup), adopt it; otherwise just refresh the
        // engine. We compare a few fields rather than deep-equal to keep
        // this cheap.
        const drift =
          userState.weatherFetchedAt !== state.userState.weatherFetchedAt ||
          userState.unitsConsumedToday !== state.userState.unitsConsumedToday ||
          userState.urineSignal !== state.userState.urineSignal ||
          // Pick up a language change persisted from another device when
          // the WS push was missed — without this, the Profile picker on
          // device A would never reach device B until a stronger drift
          // (intake / weather refresh) triggered the swap.
          userState.language !== state.userState.language;
        if (drift) {
          dispatch({ type: 'SET_USER_STATE', payload: { newUserState: userState, engineOutput } });
        } else {
          dispatch({ type: 'REFRESH_ENGINE', payload: { engineOutput } });
        }
      } catch {
        // swallow — UI keeps last known engineOutput
      }
    };
    refresh();
    const interval = setInterval(refresh, 30 * 1000); // every 30s
    return () => { cancelled = true; clearInterval(interval); };
  }, [state.userState.lastIntakeTime, state.userState.urineSignal, state.userState.symptoms.length]);

  // Ref-backed latest snapshot of the client-only overlay so the WS
  // subscription (mounted once) always reads the *current* appleHealth
  // value rather than a stale closure over the initial render.
  const overlayRef = useRef<{ appleHealth?: AppleHealthInputs }>({});
  useEffect(() => {
    overlayRef.current = { appleHealth: state.userState.appleHealth };
  }, [state.userState.appleHealth]);

  // Live state pushes from the api-server. The server broadcasts after
  // every mutation, so this catches changes from other clients (or
  // server-initiated updates like the weather refresh) without waiting
  // for the 30s poll. Subscribe once per mount; the overlay getter
  // pulls from `overlayRef` so updates to appleHealth never get lost.
  useEffect(() => {
    const unsubscribe = subscribeToStateUpdates(
      (next) => dispatch({ type: 'SET_USER_STATE', payload: { newUserState: next, engineOutput: _initialOnly(next) } }),
      () => ({ appleHealth: overlayRef.current.appleHealth }),
    );
    return unsubscribe;
  }, []);

  // Weather: fetch once on mount, then every 15 min. Uses Denver as a
  // safe default (matches the existing climate strip) so we never block
  // the UI on a permission prompt; if expo-location grants real coords
  // later the next tick will use them.
  useEffect(() => {
    let cancelled = false;
    const DEFAULT_LAT = 39.7392;
    const DEFAULT_LON = -104.9903;
    const tick = async (lat: number, lon: number) => {
      try {
        const { newUserState, engineOutput } = await refreshWeather(state.userState, lat, lon);
        if (cancelled) return;
        dispatch({ type: 'SET_USER_STATE', payload: { newUserState, engineOutput } });
      } catch (err) {
        console.warn('[AForce] weather refresh failed', err);
      }
    };
    let lat = DEFAULT_LAT;
    let lon = DEFAULT_LON;
    // Best-effort geolocation — only on web/native where the API exists.
    // Failures fall through to the Denver default.
    (async () => {
      try {
        const Location = await import('expo-location');
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const pos = await Location.getCurrentPositionAsync({});
          lat = pos.coords.latitude;
          lon = pos.coords.longitude;
        }
      } catch {
        // fall back to Denver
      }
      if (!cancelled) tick(lat, lon);
    })();
    const interval = setInterval(() => tick(lat, lon), 15 * 60 * 1000);
    return () => { cancelled = true; clearInterval(interval); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const logIntake = useCallback(async (
    fluidType: FluidType,
    opts?: { silent?: boolean; ozOverride?: number; flavorLabel?: string },
  ) => {
    if (state.isCompletingCycle) return;
    dispatch({ type: 'CYCLE_START' });
    try {
      // Allow callers (e.g. the manual water amount picker) to override
      // the default per-serving oz so the score impact reflects what was
      // actually consumed (e.g. a 24 oz water bottle instead of 12 oz).
      const { log, newUserState, engineOutput } = await postIntakeLog(state.userState, {
        fluidType,
        ...(opts?.ozOverride != null ? { ozAmount: opts.ozOverride } : {}),
      });
      const product = PRODUCTS[fluidType];
      const result: CycleResult = {
        id: log.id,
        timestamp: log.loggedAt,
        scoreBefore: log.scoreBefore,
        scoreAfter: log.scoreAfter,
        gainDisplay: `${log.scoreAfter - log.scoreBefore >= 0 ? '+' : ''}${log.scoreAfter - log.scoreBefore}`,
        identityMessage: generateCycleIdentityMessage(engineOutput.performanceState.level),
        nextCycleHint: generateNextCycleHint(engineOutput.performanceState.level),
        state: engineOutput.performanceState.level,
      };
      // When a flavor was chosen (e.g. Berry Blast +Dulse), surface it
      // in the history label so users can recall exactly what they drank.
      const baseName = opts?.flavorLabel
        ? `${product.shortName} — ${opts.flavorLabel}`
        : product.shortName;
      const historyEntry: HistoryEntry = {
        id: log.id,
        timestamp: log.loggedAt,
        score: log.scoreAfter,
        state: engineOutput.performanceState.level,
        action: `Logged ${baseName} (${log.ozAmount} oz)`,
        unitsTaken: 1,
        fluidType,
      };
      dispatch({ type: 'CYCLE_SUCCESS', payload: { result, newUserState, engineOutput, historyEntry, silent: opts?.silent } });
      // Only schedule the auto-dismiss when the hero overlay was actually shown.
      if (!opts?.silent) setTimeout(() => dispatch({ type: 'DISMISS_SUCCESS' }), 2400);
    } catch (err) {
      // Fail-safe: clear loading flag so UI never soft-locks.
      console.warn('[AForce] logIntake failed', err);
      dispatch({ type: 'DISMISS_SUCCESS' });
    }
  }, [state.userState, state.isCompletingCycle]);

  // Generic "complete cycle" — defaults to AForce stick (primary intake)
  const completeCycle = useCallback(() => logIntake('aforce_stick'), [logIntake]);

  const snooze = useCallback(() => dispatch({ type: 'SNOOZE' }), []);
  const dismissSuccess = useCallback(() => dispatch({ type: 'DISMISS_SUCCESS' }), []);

  const updateSymptoms = useCallback(async (symptoms: string[]) => {
    const { newUserState, engineOutput } = await postSignalsUpdate(state.userState, symptoms);
    dispatch({ type: 'SET_USER_STATE', payload: { newUserState, engineOutput } });
  }, [state.userState]);

  const updateUrineSignal = useCallback(async (signal: number) => {
    const { newUserState, engineOutput } = await postUrineSignalUpdate(state.userState, signal);
    dispatch({ type: 'SET_USER_STATE', payload: { newUserState, engineOutput } });
  }, [state.userState]);

  const updateEnergyState = useCallback(async (energy: UserState['energyState']) => {
    const { newUserState, engineOutput } = await postEnergyStateUpdate(state.userState, energy);
    dispatch({ type: 'SET_USER_STATE', payload: { newUserState, engineOutput } });
  }, [state.userState]);

  const confirmStatus = useCallback(async () => {
    const { newUserState, engineOutput } = await postCheckin(state.userState);
    dispatch({ type: 'SET_USER_STATE', payload: { newUserState, engineOutput } });
  }, [state.userState]);

  const setFeatureFlags = useCallback((flags: FeatureFlags) => {
    dispatch({ type: 'SET_FLAGS', payload: flags });
    // Mirror clutch_access_enabled into UserState so the engine's decay
    // function picks up the ×1.3 multiplier (T3) without needing flags
    // drilled into its API.
    const clutchActive = !!flags.clutch_access_enabled;
    if ((state.userState.clutchActive ?? false) !== clutchActive) {
      // Persist the flag server-side so it survives reload and is
      // available to any other connected client.
      postClutchFlag(state.userState, clutchActive)
        .then(({ newUserState, engineOutput }) => {
          dispatch({ type: 'SET_USER_STATE', payload: { newUserState, engineOutput } });
        })
        .catch(() => {});
    }
  }, [state.userState]);

  const confirmCommand = useCallback(async (followed: boolean) => {
    try {
      // Server applies confirmationDelta + (in Clutch, on No)
      // clutchDecayBoostUntil. Compliance streak is intentionally NOT
      // mutated server-side — it already contributes to the score via
      // the `consistency` term, so a ±3 swing here would double-count.
      const { newUserState, engineOutput } = await postConfirmCommand(state.userState, followed);
      dispatch({ type: 'CONFIRM_COMMAND', payload: { newUserState, engineOutput } });
    } catch (err) {
      console.warn('[AForce] confirmCommand failed', err);
      // Local fallback so the UI doesn't soft-lock if the server is
      // unreachable; the next reconnect will re-sync state.
      const inClutch = !!state.userState.clutchActive;
      const merged: UserState = {
        ...state.userState,
        confirmationDelta: followed ? 3 : -3,
        confirmationDeltaSetAt: new Date(),
        clutchDecayBoostUntil: !followed && inClutch
          ? new Date(Date.now() + 10 * 60 * 1000)
          : state.userState.clutchDecayBoostUntil,
      };
      dispatch({ type: 'CONFIRM_COMMAND', payload: { newUserState: merged, engineOutput: state.engineOutput } });
    }
  }, [state.userState, state.engineOutput]);

  const setLanguage = useCallback(async (lang: SupportedLanguage) => {
    // Update i18n + local state instantly so the UI re-renders without
    // waiting for the server round-trip. The server POST is fire-and-forget;
    // a failed write just means the choice doesn't persist to other devices.
    await setI18nLanguage(lang);
    const optimistic: UserState = { ...state.userState, language: lang };
    dispatch({ type: 'SET_USER_STATE', payload: { newUserState: optimistic, engineOutput: state.engineOutput } });
    try {
      const { newUserState, engineOutput } = await postLanguage(state.userState, lang);
      dispatch({ type: 'SET_USER_STATE', payload: { newUserState, engineOutput } });
    } catch (err) {
      console.warn('[AForce] setLanguage persist failed', err);
    }
  }, [state.userState, state.engineOutput]);

  const setSubscription = useCallback((sub: UserSubscription) => {
    dispatch({ type: 'SET_SUBSCRIPTION', payload: sub });
    AsyncStorage.setItem('aforce.subscription', JSON.stringify(sub)).catch(() => {});
  }, []);

  // Hydrate persisted subscription on mount.
  useEffect(() => {
    AsyncStorage.getItem('aforce.subscription')
      .then((raw) => {
        if (!raw) return;
        try {
          const parsed = JSON.parse(raw) as UserSubscription;
          if (parsed && parsed.planId) {
            dispatch({ type: 'SET_SUBSCRIPTION', payload: parsed });
          }
        } catch {
          // Ignore malformed payloads.
        }
      })
      .catch(() => {});
  }, []);

  const completeOnboarding = useCallback(() => {
    dispatch({ type: 'COMPLETE_ONBOARDING' });
  }, []);

  // Push an Apple Health snapshot into the score. Pass null to clear
  // (e.g. on disconnect). The engine immediately recomputes so HRV /
  // sleep show up in the orb and breakdown without waiting for the
  // next /v1/home tick.
  const setAppleHealthSnapshot = useCallback((snapshot: AppleHealthInputs | null) => {
    const merged: UserState = snapshot
      ? { ...state.userState, appleHealth: snapshot }
      : (() => { const { appleHealth: _drop, ...rest } = state.userState; return rest as UserState; })();
    fetchHome(merged)
      .then(({ engineOutput }) => {
        dispatch({ type: 'SET_APPLE_HEALTH', payload: { snapshot, engineOutput } });
      })
      .catch((err) => {
        console.warn('[AForce] setAppleHealthSnapshot refresh failed', err);
      });
  }, [state.userState]);

  // Sync i18n with the language returned by the server on every userState
  // change. This lets a fresh app boot land on the user's saved language
  // without the picker having to be opened.
  useEffect(() => {
    const lang = state.userState.language;
    if (lang) {
      setI18nLanguage(lang).catch(() => { /* i18n init failure is non-fatal */ });
    }
  }, [state.userState.language]);

  const value = useMemo<AppContextValue>(() => ({
    state, logIntake, completeCycle, snooze, dismissSuccess,
    updateSymptoms, updateUrineSignal, updateEnergyState, confirmStatus, setFeatureFlags,
    setSubscription, completeOnboarding, setAppleHealthSnapshot, confirmCommand, setLanguage,
  }), [state, logIntake, completeCycle, snooze, dismissSuccess, updateSymptoms, updateUrineSignal, updateEnergyState, confirmStatus, setFeatureFlags, setSubscription, completeOnboarding, setAppleHealthSnapshot, confirmCommand, setLanguage]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useAppStore() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useAppStore must be used inside AppProvider');
  return ctx;
}
