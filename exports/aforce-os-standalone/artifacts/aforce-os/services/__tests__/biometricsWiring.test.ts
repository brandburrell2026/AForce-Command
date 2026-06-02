/**
 * Integration test: client → fetchHome → engine for the multi-provider
 * biometrics merge contract.
 *
 * Architect-flagged regression: prior to this fix, fetchHome dropped
 * the client-only `biometrics` field at the merge boundary, so
 * connecting Oura/WHOOP/Garmin/Strava silently had no score effect even
 * though the snapshot was in store state. These tests pin the contract
 * by capturing the UserState that calculateScore receives — if
 * biometrics aren't on that object, the score engine cannot see them
 * and the regression is back.
 *
 * Mocks follow the same pattern as `realApi.intake.test.ts`.
 * scoringEngine cannot be loaded for real in vitest because it
 * transitively pulls i18next + expo-localization + the RN theme
 * palette (see comment at top of utils/depletionRate.ts), so the
 * unit-level math correctness is pinned by the 32 aggregator tests
 * and this file pins only the merge / wiring contract.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../../data/products', () => ({
  PRODUCTS: { water: { fluidType: 'water', ozPerServing: 12 } },
}));

vi.mock('../../data/mockData', () => ({
  defaultUserState: {
    unitsConsumedToday: 0, ozConsumedToday: 0, aforceUnitsToday: 0,
    lastIntakeTime: new Date(), lastIntakeType: 'water',
    symptomState: 'none', symptoms: [], urineSignal: 3, energyState: 'steady',
    heatLoad: 4, sweatRate: 3, activityLevel: 5, complianceStreak: 0,
    dailyTarget: 8, ozTarget: 96, isSnoozed: false, snoozeUntil: null,
    bodyWeightLbs: 180, isAwake: true, wakeTime: null, overnightLossOz: 0,
    hasSeenMorningCommand: false, weatherTempC: null, weatherHumidity: null,
    weatherCity: null, weatherFetchedAt: null, language: 'en',
    intakeEvents: [],
  },
}));

vi.mock('../authToken', () => ({
  getAuthHeaders: async () => ({}),
  getAuthToken: async () => null,
}));

// Capture every UserState that reaches the score engine. The biometrics
// preservation contract is "fetchHome must call calculateScore with a
// merged state that still contains the client's biometrics field" — so
// we inspect the captured input, not the output.
const calculateScoreSpy = vi.fn((state: { biometrics?: unknown }) => ({
  score: 75 + Object.keys(state.biometrics ?? {}).length, // any biometric → score nudge
  performanceState: { level: 'BALANCED', label: 'Balanced', score: 75 },
  riskTimer: { minutes: 30, seconds: 0, urgency: 'moderate' },
  contributions: [], reasons: [], command: null, decayPerMinute: 0.5,
  minutesSinceLastIntake: 0, prediction: null, recoverySignal: null,
  pulseConfig: { stateName: 'balanced', primary: '#fff', secondary: '#fff', waveBehavior: 'breathing', colorMode: 'static', durationMs: 4000 },
}));
vi.mock('../../utils/scoringEngine', () => ({
  calculateScore: (s: unknown) => calculateScoreSpy(s as { biometrics?: unknown }),
}));

import { fetchHome } from '../realApi';
import type { UserState, ProviderSnapshot } from '../../types';

function snap(providerId: ProviderSnapshot['providerId'], over: Partial<ProviderSnapshot> = {}): ProviderSnapshot {
  return { providerId, fetchedAt: 1_700_000_000_000, ...over } as ProviderSnapshot;
}

function freshUserState(over: Partial<UserState> = {}): UserState {
  return {
    unitsConsumedToday: 0, ozConsumedToday: 0, aforceUnitsToday: 0,
    lastIntakeTime: new Date(Date.now() - 60 * 60_000),
    lastIntakeType: 'water',
    symptomState: 'none', symptoms: [], urineSignal: 3, energyState: 'steady',
    heatLoad: 4, sweatRate: 3, activityLevel: 5, complianceStreak: 0,
    dailyTarget: 8, ozTarget: 96, isSnoozed: false, snoozeUntil: null,
    bodyWeightLbs: 180, isAwake: true, wakeTime: null, overnightLossOz: 0,
    hasSeenMorningCommand: false, weatherTempC: null, weatherHumidity: null,
    weatherCity: null, weatherFetchedAt: null, language: 'en',
    intakeEvents: [],
    ...over,
  } as UserState;
}

function serverRow(overrides: Record<string, unknown> = {}) {
  return {
    score: 75, status: 'BALANCED',
    unitsConsumedToday: 0, ozConsumedToday: 0, aforceUnitsToday: 0,
    sweatRate: 3, activityLevel: 5, complianceStreak: 0,
    dailyTarget: 8, ozTarget: 96, isAwake: true, bodyWeightLbs: 180,
    intakeEvents: [], socialMode: null,
    ...overrides,
  };
}

let originalFetch: typeof globalThis.fetch;
function mockFetchOk(body: unknown) {
  globalThis.fetch = vi.fn(async () => ({
    ok: true, status: 200, json: async () => body,
  })) as unknown as typeof globalThis.fetch;
}
function mockFetchFail() {
  globalThis.fetch = vi.fn(async () => { throw new Error('network down'); }) as unknown as typeof globalThis.fetch;
}

beforeEach(() => {
  originalFetch = globalThis.fetch;
  calculateScoreSpy.mockClear();
});
afterEach(() => { globalThis.fetch = originalFetch; });

describe('fetchHome — biometrics merge contract', () => {
  it('preserves client-only biometrics across a server round-trip', async () => {
    mockFetchOk({ userState: serverRow(), serverTime: new Date().toISOString() });

    const ouraSnap = snap('oura', { hrvSdnn: 58 });
    const stateWithOura = freshUserState({ biometrics: { oura: ouraSnap } });

    const result = await fetchHome(stateWithOura);
    expect(result.userState.biometrics).toEqual({ oura: ouraSnap });
  });

  it('passes the merged biometrics to calculateScore (the actual wiring fix)', async () => {
    mockFetchOk({ userState: serverRow(), serverTime: new Date().toISOString() });

    const whoopSnap = snap('whoop', { recoveryPct: 78 });
    await fetchHome(freshUserState({ biometrics: { whoop: whoopSnap } }));

    expect(calculateScoreSpy).toHaveBeenCalledTimes(1);
    const captured = calculateScoreSpy.mock.calls[0]![0] as { biometrics?: Record<string, unknown> };
    expect(captured.biometrics).toBeDefined();
    expect(captured.biometrics!.whoop).toEqual(whoopSnap);
  });

  it('multi-provider state — every connected provider reaches the engine', async () => {
    mockFetchOk({ userState: serverRow(), serverTime: new Date().toISOString() });

    const stateWithThree = freshUserState({
      biometrics: {
        oura: snap('oura', { hrvSdnn: 58 }),
        whoop: snap('whoop', { recoveryPct: 71 }),
        strava: snap('strava', { workoutMinutesToday: 60 }),
      },
    });

    const result = await fetchHome(stateWithThree);
    expect(Object.keys(result.userState.biometrics ?? {}).sort())
      .toEqual(['oura', 'strava', 'whoop']);

    const captured = calculateScoreSpy.mock.calls[0]![0] as { biometrics?: Record<string, unknown> };
    expect(Object.keys(captured.biometrics ?? {}).sort())
      .toEqual(['oura', 'strava', 'whoop']);
  });

  it('disconnect (biometrics undefined) does NOT inject a stale snapshot', async () => {
    mockFetchOk({ userState: serverRow(), serverTime: new Date().toISOString() });

    const result = await fetchHome(freshUserState());
    expect(result.userState.biometrics).toBeUndefined();

    const captured = calculateScoreSpy.mock.calls[0]![0] as { biometrics?: unknown };
    expect(captured.biometrics).toBeUndefined();
  });

  it('falls back to local recompute (preserving biometrics) when server is unreachable', async () => {
    mockFetchFail();

    const garminSnap = snap('garmin', { hrvSdnn: 50, stressScore: 30 });
    const result = await fetchHome(freshUserState({ biometrics: { garmin: garminSnap } }));
    expect(result.userState.biometrics).toEqual({ garmin: garminSnap });

    const captured = calculateScoreSpy.mock.calls[0]![0] as { biometrics?: Record<string, unknown> };
    expect(captured.biometrics?.garmin).toEqual(garminSnap);
  });
});

describe('Apple Health mirror — store-side path', () => {
  it('appleHealth + biometrics.apple_health both reach the engine when both are set', async () => {
    mockFetchOk({ userState: serverRow(), serverTime: new Date().toISOString() });

    const appleSnap = {
      restingHeartRate: 60, hrvSdnn: 65, sleepHoursLastNight: 7.5,
      stepsToday: 8000, fetchedAt: 1_700_000_000_000,
    };
    const state = freshUserState({
      appleHealth: appleSnap,
      biometrics: { apple_health: snap('apple_health', appleSnap) },
    });

    const result = await fetchHome(state);
    expect(result.userState.appleHealth).toEqual(appleSnap);
    expect(result.userState.biometrics?.apple_health).toBeDefined();

    const captured = calculateScoreSpy.mock.calls[0]![0] as {
      appleHealth?: unknown; biometrics?: Record<string, unknown>;
    };
    expect(captured.appleHealth).toEqual(appleSnap);
    expect(captured.biometrics?.apple_health).toBeDefined();
  });
});
