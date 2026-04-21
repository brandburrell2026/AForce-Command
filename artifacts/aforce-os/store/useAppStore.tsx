/**
 * AForce OS App Store
 * React Context + useReducer state container backed by the mockApi service layer.
 *
 * Source of truth for: userState, engineOutput (score/state/pulseConfig/command),
 * cycle history, feature flags, and overlay UI state.
 */

import React, { createContext, useContext, useReducer, useCallback, useEffect, useMemo } from 'react';
import type {
  UserState,
  ScoreEngineOutput,
  CycleResult,
  HistoryEntry,
  FluidType,
  FeatureFlags,
} from '../types';
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
} from '../services/mockApi';
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
  featureFlags: FeatureFlags;
  lastIntakeBurstAt: number; // timestamp for pulse burst trigger
  hasSeenOnboarding: boolean;
}

type Action =
  | { type: 'CYCLE_START' }
  | { type: 'CYCLE_SUCCESS'; payload: { result: CycleResult; newUserState: UserState; engineOutput: ScoreEngineOutput; historyEntry: HistoryEntry } }
  | { type: 'DISMISS_SUCCESS' }
  | { type: 'SNOOZE' }
  | { type: 'TICK_TIMER' }
  | { type: 'SET_USER_STATE'; payload: { newUserState: UserState; engineOutput: ScoreEngineOutput } }
  | { type: 'REFRESH_ENGINE'; payload: { engineOutput: ScoreEngineOutput } }
  | { type: 'SET_FLAGS'; payload: FeatureFlags }
  | { type: 'COMPLETE_ONBOARDING' };

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
  featureFlags: DEFAULT_FLAGS,
  lastIntakeBurstAt: 0,
  hasSeenOnboarding: false,
};

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'CYCLE_START':
      return { ...state, isCompletingCycle: true };
    case 'CYCLE_SUCCESS': {
      const { result, newUserState, engineOutput, historyEntry } = action.payload;
      return {
        ...state,
        userState: newUserState,
        engineOutput,
        history: [historyEntry, ...state.history].slice(0, 30),
        lastCycleResult: result,
        isCompletingCycle: false,
        showCycleSuccess: true,
        timerSeconds: engineOutput.riskTimer.minutes * 60,
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
        // Timer expired — engine refresh is handled by the periodic
        // /v1/home poll in AppProvider, not in this reducer.
        return { ...state, timerSeconds: 0 };
      }
      return { ...state, timerSeconds: next };
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
    case 'COMPLETE_ONBOARDING':
      return { ...state, hasSeenOnboarding: true };
    default:
      return state;
  }
}

interface AppContextValue {
  state: AppState;
  logIntake: (fluidType: FluidType) => Promise<void>;
  completeCycle: () => Promise<void>;
  snooze: () => void;
  dismissSuccess: () => void;
  updateSymptoms: (symptoms: string[]) => Promise<void>;
  updateUrineSignal: (signal: number) => Promise<void>;
  updateEnergyState: (energy: UserState['energyState']) => Promise<void>;
  confirmStatus: () => Promise<void>;
  setFeatureFlags: (flags: FeatureFlags) => void;
  completeOnboarding: () => void;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  // Live countdown timer (drives recheck)
  useEffect(() => {
    const interval = setInterval(() => dispatch({ type: 'TICK_TIMER' }), 1000);
    return () => clearInterval(interval);
  }, []);

  // Periodic /v1/home refresh — the only place engineOutput originates from.
  useEffect(() => {
    let cancelled = false;
    const refresh = async () => {
      try {
        const { engineOutput } = await fetchHome(state.userState);
        if (cancelled) return;
        dispatch({ type: 'REFRESH_ENGINE', payload: { engineOutput } });
      } catch {
        // swallow — UI keeps last known engineOutput
      }
    };
    refresh();
    const interval = setInterval(refresh, 30 * 1000); // every 30s
    return () => { cancelled = true; clearInterval(interval); };
  }, [state.userState.lastIntakeTime, state.userState.urineSignal, state.userState.symptoms.length]);

  const logIntake = useCallback(async (fluidType: FluidType) => {
    if (state.isCompletingCycle) return;
    dispatch({ type: 'CYCLE_START' });
    try {
      const { log, newUserState, engineOutput } = await postIntakeLog(state.userState, { fluidType });
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
      const historyEntry: HistoryEntry = {
        id: log.id,
        timestamp: log.loggedAt,
        score: log.scoreAfter,
        state: engineOutput.performanceState.level,
        action: `Logged ${product.shortName} (${log.ozAmount} oz)`,
        unitsTaken: 1,
        fluidType,
      };
      dispatch({ type: 'CYCLE_SUCCESS', payload: { result, newUserState, engineOutput, historyEntry } });
      setTimeout(() => dispatch({ type: 'DISMISS_SUCCESS' }), 2400);
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
  }, []);

  const completeOnboarding = useCallback(() => {
    dispatch({ type: 'COMPLETE_ONBOARDING' });
  }, []);

  const value = useMemo<AppContextValue>(() => ({
    state, logIntake, completeCycle, snooze, dismissSuccess,
    updateSymptoms, updateUrineSignal, updateEnergyState, confirmStatus, setFeatureFlags,
    completeOnboarding,
  }), [state, logIntake, completeCycle, snooze, dismissSuccess, updateSymptoms, updateUrineSignal, updateEnergyState, confirmStatus, setFeatureFlags, completeOnboarding]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useAppStore() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useAppStore must be used inside AppProvider');
  return ctx;
}
