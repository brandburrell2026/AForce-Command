/**
 * AForce OS App Store
 * Lightweight Zustand-style store using React Context + useReducer.
 * Manages user state, score engine output, and cycle history.
 */

import React, { createContext, useContext, useReducer, useCallback, useEffect } from 'react';
import type { UserState, ScoreEngineOutput, CycleResult, HistoryEntry } from '../types';
import { calculateScore, generateCycleIdentityMessage, generateNextCycleHint } from '../utils/scoringEngine';
import { defaultUserState, mockHistory } from '../data/mockData';

// ─── State Shape ──────────────────────────────────────────────────────────────
interface AppState {
  userState: UserState;
  engineOutput: ScoreEngineOutput;
  history: HistoryEntry[];
  lastCycleResult: CycleResult | null;
  isCompletingCycle: boolean;
  showCycleSuccess: boolean;
  timerSeconds: number; // live countdown in seconds
}

// ─── Actions ──────────────────────────────────────────────────────────────────
type Action =
  | { type: 'COMPLETE_CYCLE' }
  | { type: 'CYCLE_SUCCESS'; payload: CycleResult }
  | { type: 'DISMISS_SUCCESS' }
  | { type: 'SNOOZE' }
  | { type: 'TICK_TIMER' }
  | { type: 'UPDATE_USER_STATE'; payload: Partial<UserState> };

function computeEngineOutput(state: UserState): ScoreEngineOutput {
  return calculateScore(state);
}

const initialEngineOutput = computeEngineOutput(defaultUserState);

const initialState: AppState = {
  userState: defaultUserState,
  engineOutput: initialEngineOutput,
  history: mockHistory,
  lastCycleResult: null,
  isCompletingCycle: false,
  showCycleSuccess: false,
  timerSeconds: initialEngineOutput.riskTimer.minutes * 60,
};

// ─── Reducer ──────────────────────────────────────────────────────────────────
function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'COMPLETE_CYCLE': {
      return { ...state, isCompletingCycle: true };
    }

    case 'CYCLE_SUCCESS': {
      const { payload } = action;
      const updatedUserState: UserState = {
        ...state.userState,
        unitsConsumedToday: state.userState.unitsConsumedToday + 1,
        lastIntakeTime: new Date(),
        isSnoozed: false,
        snoozeUntil: null,
      };
      const newOutput = computeEngineOutput(updatedUserState);
      const historyEntry: HistoryEntry = {
        id: Date.now().toString(),
        timestamp: new Date(),
        score: newOutput.score,
        state: newOutput.performanceState.level,
        action: newOutput.command.action,
        unitsTaken: 1,
      };
      return {
        ...state,
        userState: updatedUserState,
        engineOutput: newOutput,
        lastCycleResult: payload,
        isCompletingCycle: false,
        showCycleSuccess: true,
        history: [historyEntry, ...state.history].slice(0, 20),
        timerSeconds: newOutput.riskTimer.minutes * 60,
      };
    }

    case 'DISMISS_SUCCESS': {
      return { ...state, showCycleSuccess: false, lastCycleResult: null };
    }

    case 'SNOOZE': {
      const snoozeUntil = new Date(Date.now() + 20 * 60 * 1000);
      const updatedUserState: UserState = {
        ...state.userState,
        isSnoozed: true,
        snoozeUntil,
      };
      const newOutput = computeEngineOutput(updatedUserState);
      return {
        ...state,
        userState: updatedUserState,
        engineOutput: newOutput,
        timerSeconds: newOutput.riskTimer.minutes * 60,
      };
    }

    case 'TICK_TIMER': {
      const next = state.timerSeconds - 1;
      if (next <= 0) {
        // Recompute when timer hits 0
        const newOutput = computeEngineOutput(state.userState);
        return {
          ...state,
          engineOutput: newOutput,
          timerSeconds: newOutput.riskTimer.minutes * 60,
        };
      }
      return { ...state, timerSeconds: next };
    }

    case 'UPDATE_USER_STATE': {
      const updatedUserState = { ...state.userState, ...action.payload };
      const newOutput = computeEngineOutput(updatedUserState);
      return {
        ...state,
        userState: updatedUserState,
        engineOutput: newOutput,
        timerSeconds: newOutput.riskTimer.minutes * 60,
      };
    }

    default:
      return state;
  }
}

// ─── Context ──────────────────────────────────────────────────────────────────
interface AppContextValue {
  state: AppState;
  completeCycle: () => void;
  snooze: () => void;
  dismissSuccess: () => void;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  // Live countdown timer
  useEffect(() => {
    const interval = setInterval(() => {
      dispatch({ type: 'TICK_TIMER' });
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const completeCycle = useCallback(() => {
    dispatch({ type: 'COMPLETE_CYCLE' });

    // Simulate async cycle completion
    setTimeout(() => {
      const scoreBefore = state.engineOutput.score;
      const currentState = state.engineOutput.performanceState.level;
      const scoreAfter = Math.min(100, scoreBefore + (currentState === 'DEPLETED' ? 18 : currentState === 'RECOVERING' ? 10 : 6));
      const gain = scoreAfter - scoreBefore;

      const result: CycleResult = {
        id: Date.now().toString(),
        timestamp: new Date(),
        scoreBefore,
        scoreAfter,
        gainDisplay: `+${gain}`,
        identityMessage: generateCycleIdentityMessage(currentState),
        nextCycleHint: generateNextCycleHint(currentState),
        state: currentState,
      };

      dispatch({ type: 'CYCLE_SUCCESS', payload: result });

      // Auto-dismiss after 3 seconds
      setTimeout(() => {
        dispatch({ type: 'DISMISS_SUCCESS' });
      }, 3000);
    }, 600);
  }, [state.engineOutput]);

  const snooze = useCallback(() => {
    dispatch({ type: 'SNOOZE' });
  }, []);

  const dismissSuccess = useCallback(() => {
    dispatch({ type: 'DISMISS_SUCCESS' });
  }, []);

  return (
    <AppContext.Provider value={{ state, completeCycle, snooze, dismissSuccess }}>
      {children}
    </AppContext.Provider>
  );
}

export function useAppStore() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useAppStore must be used inside AppProvider');
  return ctx;
}
