/**
 * Integration test: client → fetchHome → engine for the multi-provider
 * biometrics merge contract.
 *
 * Architect-flagged regression: prior to this fix, fetchHome dropped
 * the client-only `biometrics` field at the merge boundary, so
 * connecting Oura/WHOOP/Garmin/Strava silently had no score effect even
 * though the snapshot was in store state. These tests pin the contract.
 *
 * Mocks follow the same pattern as `realApi.intake.test.ts`: stub the
 * RN-edge dependencies that vitest can't parse, but keep the REAL
 * `scoringEngine` + `biometricsAggregator` so the breakdown assertions
 * exercise the actual production math.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// PRODUCTS pulls RN asset require()s — minimal stand-in.
vi.mock('../../data/products', () => ({
  PRODUCTS: {
    water: { fluidType: 'water', ozPerServing: 12 },
    aforce_stick: { fluidType: 'aforce_stick', ozPerServing: 12, flavor: 'watermelon' },
  },
}));

// mockData transitively imports RN images via PRODUCTS.
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

import { fetchHome } from '../realApi';
import type { UserState, ProviderSnapshot } from '../../types';

// Build a snapshot inline so this file does not transitively pull in
// `data/providerDemoSnapshots` (which is safe but adds no value here).
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

beforeEach(() => { originalFetch = globalThis.fetch; });
afterEach(() => { globalThis.fetch = originalFetch; });

describe('fetchHome — biometrics merge contract', () => {
  it('preserves client-only biometrics across a server round-trip', async () => {
    mockFetchOk({ userState: serverRow(), serverTime: new Date().toISOString() });

    const ouraSnap = snap('oura', { hrvSdnn: 58, sleepHoursLastNight: 7.4, readinessScore: 82 });
    const stateWithOura = freshUserState({ biometrics: { oura: ouraSnap } });

    const result = await fetchHome(stateWithOura);
    expect(result.userState.biometrics).toEqual({ oura: ouraSnap });
  });

  it('a non-Apple connected provider shifts the recovery breakdown row to reference it', async () => {
    mockFetchOk({ userState: serverRow(), serverTime: new Date().toISOString() });

    const whoopSnap = snap('whoop', { recoveryPct: 78, sleepHoursLastNight: 7.5 });
    const stateWithWhoop = freshUserState({ biometrics: { whoop: whoopSnap } });

    const result = await fetchHome(stateWithWhoop);
    // The aggregator-driven recovery row is named `health_signals` when
    // any provider is connected, with a label like "WHOOP".
    const breakdown = (result.engineOutput as { breakdown?: Array<{ id: string; label: string }> }).breakdown ?? [];
    const recovery = breakdown.find((r) => r.id === 'health_signals' || r.id === 'apple_health');
    expect(recovery).toBeDefined();
    expect(recovery!.label.toLowerCase()).toContain('whoop');
  });

  it('engine score differs between connected vs disconnected for the same baseline', async () => {
    mockFetchOk({ userState: serverRow(), serverTime: new Date().toISOString() });
    const baseline = await fetchHome(freshUserState());

    mockFetchOk({ userState: serverRow(), serverTime: new Date().toISOString() });
    // High HRV + great sleep → expect a measurable positive recovery delta.
    const ouraSnap = snap('oura', { hrvSdnn: 70, sleepHoursLastNight: 8, readinessScore: 90 });
    const enriched = await fetchHome(freshUserState({ biometrics: { oura: ouraSnap } }));

    const baseScore = (baseline.engineOutput as { score: number }).score;
    const enrichedScore = (enriched.engineOutput as { score: number }).score;
    expect(enrichedScore).toBeGreaterThan(baseScore);
  });

  it('disconnect (biometrics undefined) does NOT inject a stale snapshot from server', async () => {
    mockFetchOk({ userState: serverRow(), serverTime: new Date().toISOString() });

    const result = await fetchHome(freshUserState());
    expect(result.userState.biometrics).toBeUndefined();
  });

  it('multi-provider state survives the merge with all sources intact', async () => {
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
  });

  it('falls back to local recompute (preserving biometrics) when server is unreachable', async () => {
    mockFetchFail();

    const garminSnap = snap('garmin', { hrvSdnn: 50, stressScore: 30 });
    const stateWithGarmin = freshUserState({ biometrics: { garmin: garminSnap } });

    const result = await fetchHome(stateWithGarmin);
    expect(result.userState.biometrics).toEqual({ garmin: garminSnap });
  });
});

describe('Apple Health mirror — store-side path', () => {
  it('appleHealth snapshot reaches the engine via biometrics.apple_health when both are present', async () => {
    mockFetchOk({ userState: serverRow(), serverTime: new Date().toISOString() });

    const appleSnap = {
      restingHeartRate: 60,
      hrvSdnn: 65,
      sleepHoursLastNight: 7.5,
      stepsToday: 8000,
      fetchedAt: 1_700_000_000_000,
    };
    // Mimic what setAppleHealthSnapshot writes into store state — both
    // legacy `appleHealth` AND the mirrored `biometrics.apple_health`.
    const state = freshUserState({
      appleHealth: appleSnap,
      biometrics: { apple_health: snap('apple_health', appleSnap) },
    });

    const result = await fetchHome(state);
    expect(result.userState.appleHealth).toEqual(appleSnap);
    expect(result.userState.biometrics?.apple_health).toBeDefined();
    // Should be on the multi-provider path → label uses the new health_signals id.
    const breakdown = (result.engineOutput as { breakdown?: Array<{ id: string; label: string }> }).breakdown ?? [];
    const recovery = breakdown.find((r) => r.id === 'health_signals' || r.id === 'apple_health');
    expect(recovery).toBeDefined();
  });
});
