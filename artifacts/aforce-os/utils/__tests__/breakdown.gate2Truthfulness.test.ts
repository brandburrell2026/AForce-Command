/**
 * Build-50 Gate 2 ("Home truthfulness locked") — locks for two
 * presentation-only fixes in `utils/scoring/breakdown.ts`. Neither changes
 * a score number, a band, or `computeDecayPerMinute`'s floor math — both
 * only correct what the breakdown sheet CLAIMS about data it already has.
 *
 * Item 2 — single-provider attribution: `computeRecoverySignal` used to
 * label EVERY single-connected-platform case as the generic
 * 'Health platform (HRV / sleep / strain)', so a user with only Apple
 * Health (or only WHOOP, only Oura, ...) connected could not find their
 * own platform's name anywhere in the breakdown sheet. Now attributes to
 * the actual provider via `data/healthProviders.ts`'s catalog names.
 *
 * Item 3 — activity-floor disclosure: `computeDecayPerMinute` floors the
 * manual `activityLevel` slider with any connected platform's inferred
 * activity (steps / workout minutes / strain) when it reads higher, but
 * nothing in the UI ever said so — the 'context' row shows only the raw
 * manual value, and `stepsToday` never appears in any row. The 'recency'
 * row's hint now discloses the floor when it actually fires.
 */
import { describe, it, expect } from 'vitest';
import { computeRecoverySignal, buildBreakdown } from '../scoring/breakdown';
import type { UserState } from '../../types';
import type { ProviderBiometrics } from '../../types/biometrics';

const NOW = 1_700_000_000_000;
const MIN = 60_000;

const mkRecoveryState = (biometrics: ProviderBiometrics | undefined): UserState =>
  ({ appleHealth: undefined, biometrics } as unknown as UserState);

describe('computeRecoverySignal — single-provider attribution (Build-50 Gate 2, item 2)', () => {
  it('attributes to "Apple Health" when Apple Health is the sole connected platform', () => {
    const r = computeRecoverySignal(
      mkRecoveryState({ apple_health: { providerId: 'apple_health', hrvSdnn: 65, fetchedAt: NOW } }),
    );
    expect(r.label).toBe('Apple Health');
  });

  it('attributes to "WHOOP" when WHOOP is the sole connected platform', () => {
    const r = computeRecoverySignal(
      mkRecoveryState({ whoop: { providerId: 'whoop', hrvSdnn: 65, fetchedAt: NOW } }),
    );
    expect(r.label).toBe('WHOOP');
  });

  it('attributes to "Oura Ring" when Oura is the sole connected platform', () => {
    const r = computeRecoverySignal(
      mkRecoveryState({ oura: { providerId: 'oura', hrvSdnn: 65, fetchedAt: NOW } }),
    );
    expect(r.label).toBe('Oura Ring');
  });

  it('never falls back to the old generic unfindable label for a single provider', () => {
    const r = computeRecoverySignal(
      mkRecoveryState({ garmin: { providerId: 'garmin', hrvSdnn: 65, fetchedAt: NOW } }),
    );
    expect(r.label).not.toBe('Health platform (HRV / sleep / strain)');
    expect(r.label).toBe('Garmin Connect');
  });

  it('keeps the connected-count label unchanged for multiple providers', () => {
    const r = computeRecoverySignal(
      mkRecoveryState({
        apple_health: { providerId: 'apple_health', hrvSdnn: 65, fetchedAt: NOW },
        whoop: { providerId: 'whoop', recoveryPct: 80, fetchedAt: NOW },
      }),
    );
    expect(r.label).toBe('Health platforms (2 connected)');
  });

  it('keeps the none-connected label unchanged', () => {
    const r = computeRecoverySignal(mkRecoveryState(undefined));
    expect(r.label).toBe('Health platforms (none connected)');
  });
});

describe('buildBreakdown — activity-floor disclosure (Build-50 Gate 2, item 3)', () => {
  /**
   * Minimal UserState covering only the fields the score-number path reads.
   * `activityLevel: 5` matches the default used by the sibling
   * `scoreClockDeterminism.test.ts` fixture — the 7,563-step boundary below
   * is computed against exactly this default.
   */
  function makeState(over: Partial<UserState> = {}): UserState {
    const base = {
      unitsConsumedToday: 0,
      ozConsumedToday: 48,
      aforceUnitsToday: 1,
      lastIntakeTime: new Date(NOW - 30 * MIN),
      lastIntakeType: 'water',
      symptomState: 'none',
      symptoms: [],
      urineSignal: 3,
      energyState: 'steady',
      heatLoad: 4,
      sweatRate: 3,
      activityLevel: 5,
      complianceStreak: 2,
      dailyTarget: 8,
      ozTarget: 96,
      isSnoozed: false,
      snoozeUntil: null,
      bodyWeightLbs: 180,
      isAwake: true,
      wakeTime: null,
      overnightLossOz: 0,
      hasSeenMorningCommand: false,
      weatherTempC: null,
      weatherHumidity: null,
      weatherCity: null,
      weatherFetchedAt: null,
      language: 'en',
      intakeEvents: [],
      clutchActive: false,
      biometrics: undefined,
    };
    return { ...base, ...over } as unknown as UserState;
  }

  function recencyHint(state: UserState): string {
    const { contributions } = buildBreakdown(state, NOW);
    const recency = contributions.find((c) => c.id === 'recency');
    if (!recency) throw new Error('recency contribution missing');
    return recency.hint;
  }

  it('discloses the floor when connected-platform steps push inferred activity above the manual slider (7,563-step boundary)', () => {
    const state = makeState({
      biometrics: {
        apple_health: { providerId: 'apple_health', stepsToday: 7563, fetchedAt: NOW },
      } as ProviderBiometrics,
    });
    const hint = recencyHint(state);
    expect(hint).toContain('Activity floor 5.1 (connected platform)');
  });

  it('does NOT disclose a floor one step below the boundary (5.0 rounds down, not > manual 5)', () => {
    const state = makeState({
      biometrics: {
        apple_health: { providerId: 'apple_health', stepsToday: 7562, fetchedAt: NOW },
      } as ProviderBiometrics,
    });
    const hint = recencyHint(state);
    expect(hint).not.toContain('Activity floor');
  });

  it('does NOT disclose a floor when no biometrics are connected at all', () => {
    const state = makeState();
    const hint = recencyHint(state);
    expect(hint).not.toContain('Activity floor');
  });

  it('does NOT disclose a floor when connected-platform activity reads at or below the manual slider', () => {
    const state = makeState({
      activityLevel: 8,
      biometrics: {
        apple_health: { providerId: 'apple_health', stepsToday: 5000, fetchedAt: NOW }, // activityFromSteps(5000) = 3
      } as ProviderBiometrics,
    });
    const hint = recencyHint(state);
    expect(hint).not.toContain('Activity floor');
  });

  it('decay still discloses the activity floor — and the "context" row it used to be paired with is gone', () => {
    // Under v0 this law guarded a two-row story: `context` showed the raw
    // manual slider while `recency` disclosed the inferred floor, so the two
    // rows stayed internally consistent. HydroState v1.0 folds `context` into
    // the decay model — heat, sweat and activity were being priced twice — so
    // only the disclosure half of the law survives, and the absence of the row
    // is now itself asserted rather than left to silently pass.
    const state = makeState({
      activityLevel: 5,
      biometrics: {
        apple_health: { providerId: 'apple_health', stepsToday: 15000, fetchedAt: NOW },
      } as ProviderBiometrics,
    });
    const { contributions } = buildBreakdown(state, NOW);
    expect(contributions.find((c) => c.id === 'context')).toBeUndefined();
    const recency = contributions.find((c) => c.id === 'recency');
    expect(recency?.hint).toContain('Activity floor 9.0 (connected platform)');
  });

  // Build-50 Gate 2 follow-up (independent verdict, S2): every test above
  // only checks the DISCLOSED string ("Activity floor N.N (connected
  // platform)"). None of them assert that the disclosed floor is the
  // number actually driving `decayPerMinute` — a disclosure is a claim
  // about behavior, not just a label, and that claim had zero lock. The
  // reviewer proved this by commenting the floor out of
  // `computeDecayPerMinute` (i.e. always using the raw manual
  // `activityLevel`, never `resolveEffectiveActivityLevel`'s floored
  // value): every test in this file — and all 2,485 tests in the suite —
  // stayed green, because none of them compare `decayPerMinute` against
  // what it would be without the floor. This test closes that gap: it
  // asserts the floored rate is (a) strictly higher than the same manual
  // slider with no biometrics connected, and (b) numerically identical to
  // what an unfloored user would get by manually setting the slider to
  // the same effective level — i.e. the floor reported in the hint is the
  // exact number driving the score, not a display-only string.
  it('the disclosed floor is the one actually driving the rate, not just displayed', () => {
    const manualOnly = makeState({ activityLevel: 5 });
    const floored = makeState({
      activityLevel: 5,
      biometrics: {
        apple_health: { providerId: 'apple_health', stepsToday: 15000, fetchedAt: NOW },
      } as ProviderBiometrics,
    });
    const equivalentManual = makeState({ activityLevel: 9 });

    expect(recencyHint(floored)).toContain('Activity floor 9.0 (connected platform)');
    expect(buildBreakdown(floored, NOW).decayPerMinute)
      .toBeGreaterThan(buildBreakdown(manualOnly, NOW).decayPerMinute);
    expect(buildBreakdown(floored, NOW).decayPerMinute)
      .toBeCloseTo(buildBreakdown(equivalentManual, NOW).decayPerMinute, 10);
  });
});
