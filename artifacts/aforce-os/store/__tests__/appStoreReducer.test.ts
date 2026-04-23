/**
 * Unit tests for the pure AForce app reducer.
 *
 * Self-contained: builds AppState from inline fixtures so the test file
 * never transitively pulls in react-native / expo-localization / i18next
 * (the scoringEngine + i18nService chain). Covers the major behavior
 * groups exercised by the home screen:
 *   - Cycle / intake (drinks + hydration scoring fanout)
 *   - Engine refresh + user state replacement
 *   - Recheck timer + confirmation flow
 *   - Snooze
 *   - Social Mode (via SET_USER_STATE with a social-mode UserState)
 *   - Subscription + feature flags + onboarding
 *   - Apple Health overlay (heat / recovery inputs)
 */

import { describe, it, expect } from 'vitest';

import { reducer } from '../appStoreReducer';
import type { AppState } from '../appStoreTypes';
import type {
  CycleResult,
  HistoryEntry,
  ScoreEngineOutput,
  UserState,
  AppleHealthInputs,
  FeatureFlags,
} from '../../types';
import type { UserSubscription } from '../../types/subscription';

// ─── Fixtures (no scoringEngine — keeps the suite RN-free) ──────────

const FIXED_NOW = new Date('2026-04-22T12:00:00Z').getTime();

function makeUserState(overrides: Partial<UserState> = {}): UserState {
  return {
    unitsConsumedToday: 4,
    aforceUnitsToday: 3,
    language: 'en',
    ozConsumedToday: 60,
    lastIntakeTime: new Date(FIXED_NOW - 38 * 60 * 1000),
    lastIntakeType: 'aforce_stick',
    symptomState: 'none',
    symptoms: [],
    urineSignal: 3,
    energyState: 'steady',
    heatLoad: 4,
    sweatRate: 3,
    activityLevel: 5,
    complianceStreak: 4,
    dailyTarget: 8,
    ozTarget: 96,
    isSnoozed: false,
    snoozeUntil: null,
    bodyWeightLbs: 180,
    isAwake: true,
    wakeTime: new Date(FIXED_NOW - 5 * 3600 * 1000),
    overnightLossOz: 14,
    hasSeenMorningCommand: false,
    ...overrides,
  };
}

function makeEngine(overrides: Partial<ScoreEngineOutput> = {}): ScoreEngineOutput {
  return {
    score: 72,
    performanceState: {
      level: 'BALANCED',
      score: 72,
      color: '#00E5C8',
      glowColor: '#00E5C880',
      urgency: 'moderate',
      pulseSpeed: 'medium',
      animationStyle: 'pulse',
    },
    pulseConfig: {
      pulseState: 'BALANCED',
      pulseIntensity: 0.6,
      pulseSpeed: 0.5,
      glowStrength: 0.5,
      waveBehavior: 'steady_outward',
      colorMode: 'teal',
      deltaMode: 'steady',
      animations: { burstOnIntake: true, flareOnPeak: false, collapseOnDepletion: false },
    },
    reasons: [],
    riskTimer: { minutes: 20, seconds: 0, urgency: 'medium' },
    command: {
      id: 'cmd-1',
      action: 'Drink 12oz water',
      explanation: 'Stay ahead of the curve',
      urgencyLevel: 'medium',
      estimatedImpact: '+8 score',
    },
    breakdown: [],
    prediction: { decayPerMinute: 0.4, minutesToDepleted: 80, label: 'Stable' },
    social: null,
    ...overrides,
  };
}

const baseEngine = makeEngine();
const baseUser = makeUserState();

const baseFlags: FeatureFlags = {
  clutch_access_enabled: false,
  clutch_heat_mode_enabled: false,
  clutch_inventory_enabled: false,
  guardian_intelligence_enabled: false,
  guardian_body_map_enabled: false,
  guardian_alerts_enabled: false,
  phantom_wearable_enabled: false,
  clutch_clip_enabled: false,
  kids_world_enabled: false,
  city_competition_enabled: false,
  state_competition_enabled: false,
  team_competition_enabled: false,
  global_leaderboard_enabled: false,
};

const baseSubscription: UserSubscription = {
  planId: 'core',
  status: 'active',
  cadence: 'monthly',
  startedAt: new Date(FIXED_NOW).toISOString(),
  unlockedFlags: [],
  billing: {
    provider: 'mock',
    customerId: 'cus_test',
  } as UserSubscription['billing'],
};

function makeState(overrides: Partial<AppState> = {}): AppState {
  return {
    userState: baseUser,
    engineOutput: baseEngine,
    history: [],
    lastCycleResult: null,
    isCompletingCycle: false,
    showCycleSuccess: false,
    timerSeconds: baseEngine.riskTimer.minutes * 60,
    pendingConfirmation: false,
    featureFlags: baseFlags,
    subscription: baseSubscription,
    lastIntakeBurstAt: 0,
    hasSeenOnboarding: false,
    ...overrides,
  };
}

function makeCycleResult(scoreAfter = 80): CycleResult {
  return {
    id: 'cyc-1',
    timestamp: new Date(FIXED_NOW),
    scoreBefore: 70,
    scoreAfter,
    gainDisplay: '+10',
    identityMessage: 'You are AForce.',
    nextCycleHint: 'Stay sharp.',
    state: 'PEAK',
  };
}

function makeHistoryEntry(id = 'h-1'): HistoryEntry {
  return {
    id,
    timestamp: new Date(FIXED_NOW),
    score: 80,
    state: 'PEAK',
    action: 'Logged AForce Stick (12 oz)',
    unitsTaken: 1,
    fluidType: 'aforce_stick',
  };
}

// ─── Cycle (drinks + hydration) ─────────────────────────────────────

describe('reducer · CYCLE_START / CYCLE_SUCCESS / DISMISS_SUCCESS', () => {
  it('CYCLE_START flips isCompletingCycle without touching engine state', () => {
    const next = reducer(makeState(), { type: 'CYCLE_START' });
    expect(next.isCompletingCycle).toBe(true);
    expect(next.engineOutput).toBe(baseEngine);
    expect(next.userState).toBe(baseUser);
  });

  it('CYCLE_SUCCESS replaces engine output, prepends history, shows hero overlay', () => {
    const start = reducer(makeState(), { type: 'CYCLE_START' });
    const result = makeCycleResult(85);
    const entry = makeHistoryEntry();
    const newEngine = makeEngine({ score: 85 });
    const next = reducer(start, {
      type: 'CYCLE_SUCCESS',
      payload: {
        result,
        newUserState: makeUserState({ unitsConsumedToday: 5 }),
        engineOutput: newEngine,
        historyEntry: entry,
      },
    });
    expect(next.isCompletingCycle).toBe(false);
    expect(next.showCycleSuccess).toBe(true);
    expect(next.lastCycleResult).toBe(result);
    expect(next.engineOutput.score).toBe(85);
    expect(next.userState.unitsConsumedToday).toBe(5);
    expect(next.history[0]).toBe(entry);
    expect(next.history.length).toBeLessThanOrEqual(30);
    expect(next.timerSeconds).toBe(newEngine.riskTimer.minutes * 60);
    expect(next.pendingConfirmation).toBe(false);
  });

  it('CYCLE_SUCCESS with silent=true suppresses the hero overlay (voice flow)', () => {
    const next = reducer(makeState(), {
      type: 'CYCLE_SUCCESS',
      payload: {
        result: makeCycleResult(),
        newUserState: baseUser,
        engineOutput: baseEngine,
        historyEntry: makeHistoryEntry(),
        silent: true,
      },
    });
    expect(next.showCycleSuccess).toBe(false);
    expect(next.lastCycleResult).not.toBeNull();
  });

  it('CYCLE_SUCCESS caps history to 30 entries (oldest dropped)', () => {
    const longHistory = Array.from({ length: 30 }, (_, i) => makeHistoryEntry(`h-${i}`));
    const next = reducer(makeState({ history: longHistory }), {
      type: 'CYCLE_SUCCESS',
      payload: {
        result: makeCycleResult(),
        newUserState: baseUser,
        engineOutput: baseEngine,
        historyEntry: makeHistoryEntry('h-new'),
      },
    });
    expect(next.history).toHaveLength(30);
    expect(next.history[0].id).toBe('h-new');
    expect(next.history.find((h) => h.id === 'h-29')).toBeUndefined();
  });

  it('CYCLE_SUCCESS records the burst timestamp so the orb pulse can react', () => {
    const before = Date.now();
    const next = reducer(makeState(), {
      type: 'CYCLE_SUCCESS',
      payload: {
        result: makeCycleResult(),
        newUserState: baseUser,
        engineOutput: baseEngine,
        historyEntry: makeHistoryEntry(),
      },
    });
    expect(next.lastIntakeBurstAt).toBeGreaterThanOrEqual(before);
  });

  it('DISMISS_SUCCESS clears the overlay flag and the result payload', () => {
    const open = makeState({
      showCycleSuccess: true,
      lastCycleResult: makeCycleResult(),
    });
    const next = reducer(open, { type: 'DISMISS_SUCCESS' });
    expect(next.showCycleSuccess).toBe(false);
    expect(next.lastCycleResult).toBeNull();
  });
});

// ─── Recheck timer + confirmation (engine) ──────────────────────────

describe('reducer · TICK_TIMER + CONFIRM_COMMAND', () => {
  it('TICK_TIMER decrements seconds without flipping the confirmation flag mid-countdown', () => {
    const next = reducer(makeState({ timerSeconds: 5 }), { type: 'TICK_TIMER' });
    expect(next.timerSeconds).toBe(4);
    expect(next.pendingConfirmation).toBe(false);
  });

  it('TICK_TIMER hitting zero pins the timer and flips pendingConfirmation', () => {
    const next = reducer(makeState({ timerSeconds: 1 }), { type: 'TICK_TIMER' });
    expect(next.timerSeconds).toBe(0);
    expect(next.pendingConfirmation).toBe(true);
  });

  it('CONFIRM_COMMAND resets the timer from the new engine output and clears the prompt', () => {
    const newEngine = makeEngine({
      riskTimer: { minutes: 12, seconds: 0, urgency: 'low' },
    });
    const next = reducer(makeState({ pendingConfirmation: true, timerSeconds: 0 }), {
      type: 'CONFIRM_COMMAND',
      payload: { newUserState: baseUser, engineOutput: newEngine },
    });
    expect(next.pendingConfirmation).toBe(false);
    expect(next.timerSeconds).toBe(12 * 60);
    expect(next.engineOutput).toBe(newEngine);
  });
});

// ─── Engine refresh + user state replacement ───────────────────────

describe('reducer · REFRESH_ENGINE / SET_USER_STATE', () => {
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

  it('SET_USER_STATE replaces both userState and engineOutput and DOES reset the timer', () => {
    const newUser = makeUserState({ language: 'es' });
    const newEngine = makeEngine({
      riskTimer: { minutes: 7, seconds: 0, urgency: 'medium' },
    });
    const next = reducer(makeState({ timerSeconds: 1 }), {
      type: 'SET_USER_STATE',
      payload: { newUserState: newUser, engineOutput: newEngine },
    });
    expect(next.userState).toBe(newUser);
    expect(next.engineOutput).toBe(newEngine);
    expect(next.timerSeconds).toBe(7 * 60);
  });
});

// ─── Snooze ─────────────────────────────────────────────────────────

describe('reducer · SNOOZE', () => {
  it('SNOOZE marks the user snoozed and pushes snoozeUntil ~20 minutes out', () => {
    const before = Date.now();
    const next = reducer(makeState(), { type: 'SNOOZE' });
    expect(next.userState.isSnoozed).toBe(true);
    const until = next.userState.snoozeUntil?.getTime() ?? 0;
    expect(until - before).toBeGreaterThanOrEqual(19 * 60 * 1000);
    expect(until - before).toBeLessThanOrEqual(21 * 60 * 1000);
  });
});

// ─── Social Mode (carried via SET_USER_STATE) ───────────────────────

describe('reducer · social mode user state replacement', () => {
  it('adopts a socialMode payload onto userState verbatim', () => {
    const social = {
      active: true,
      sex: 'male',
      ateRecently: true,
      startedAt: new Date(FIXED_NOW),
      drinks: [],
    } as unknown as UserState['socialMode'];
    const newUser = makeUserState({ socialMode: social });
    const next = reducer(makeState(), {
      type: 'SET_USER_STATE',
      payload: { newUserState: newUser, engineOutput: baseEngine },
    });
    expect(next.userState.socialMode).toBe(social);
    expect(next.userState.socialMode?.active).toBe(true);
  });

  it('clears social mode when the server returns userState without it', () => {
    const withSocial = makeUserState({
      socialMode: {
        active: true,
        drinks: [],
        startedAt: new Date(FIXED_NOW),
      } as unknown as UserState['socialMode'],
    });
    const cleared = reducer(makeState({ userState: withSocial }), {
      type: 'SET_USER_STATE',
      payload: { newUserState: baseUser, engineOutput: baseEngine },
    });
    expect(cleared.userState.socialMode).toBeUndefined();
  });
});

// ─── Subscription + flags + onboarding ──────────────────────────────

describe('reducer · SET_FLAGS / SET_SUBSCRIPTION / COMPLETE_ONBOARDING', () => {
  it('SET_FLAGS replaces the feature flag map without touching other slices', () => {
    const newFlags = { ...baseFlags, clutch_access_enabled: true } as FeatureFlags;
    const next = reducer(makeState(), { type: 'SET_FLAGS', payload: newFlags });
    expect(next.featureFlags).toBe(newFlags);
    expect(next.userState).toBe(baseUser);
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
});

// ─── Apple Health (heat / recovery overlay) ─────────────────────────

describe('reducer · SET_APPLE_HEALTH', () => {
  it('attaches an Apple Health snapshot onto userState and adopts the new engine output', () => {
    const snapshot = {
      restingHeartRate: 52,
      hrvSdnn: 65,
      stepsToday: 6500,
      sleepHoursLastNight: 7.5,
      fetchedAt: FIXED_NOW,
    } as AppleHealthInputs;
    const newEngine = makeEngine({ score: 88 });
    const next = reducer(makeState(), {
      type: 'SET_APPLE_HEALTH',
      payload: { snapshot, engineOutput: newEngine },
    });
    expect(next.userState.appleHealth).toEqual(snapshot);
    expect(next.engineOutput).toBe(newEngine);
  });

  it('passing snapshot=null removes appleHealth from userState', () => {
    const withHealth = makeUserState({
      appleHealth: {
        restingHeartRate: 60,
        hrvSdnn: 50,
        stepsToday: null,
        sleepHoursLastNight: null,
        fetchedAt: FIXED_NOW,
      } as AppleHealthInputs,
    });
    const next = reducer(makeState({ userState: withHealth }), {
      type: 'SET_APPLE_HEALTH',
      payload: { snapshot: null, engineOutput: baseEngine },
    });
    expect(next.userState.appleHealth).toBeUndefined();
  });
});

// ─── Edge cases / safety ────────────────────────────────────────────

describe('reducer · safety', () => {
  it('returns the same reference for unknown actions (defensive default branch)', () => {
    const state = makeState();
    // @ts-expect-error — intentional unknown action to exercise the default branch
    const next = reducer(state, { type: 'UNKNOWN_ACTION' });
    expect(next).toBe(state);
  });
});
