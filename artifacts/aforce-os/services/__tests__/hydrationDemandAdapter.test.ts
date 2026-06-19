import { describe, it, expect } from 'vitest';
import { buildHydrationDemandInputs } from '../hydrationDemandAdapter';
import { computeHydrationDemand } from '../hydrationDemandEngine';
import { DEFAULT_PROFILE_IDENTITY } from '../../utils/profileIdentity';
import type { UserState, ProviderBiometrics } from '../../types';

function makeUser(overrides: Partial<UserState> = {}): UserState {
  return {
    activityLevel: 3,
    bodyWeightLbs: 0,
    heatLoad: 0,
    sweatRate: 0,
    isAwake: true,
    wakeTime: null,
    overnightLossOz: 0,
    hasSeenMorningCommand: false,
    energyState: 'steady',
    urineSignal: 3,
    symptomState: 'none',
    symptoms: [],
    lastIntakeTime: new Date(0),
    lastIntakeType: 'water',
    complianceStreak: 0,
    dailyTarget: 64,
    ozTarget: 64,
    isSnoozed: false,
    snoozeUntil: null,
    ...overrides,
  } as unknown as UserState;
}

describe('hydrationDemandAdapter', () => {
  it('pulls weight from ProfileIdentity when set; flags weightFromProfile=true', () => {
    const profile = { ...DEFAULT_PROFILE_IDENTITY, bodyWeightLbs: 200 };
    const { inputs, trace } = buildHydrationDemandInputs(makeUser(), profile);
    expect(inputs.weightLbs).toBe(200);
    expect(trace.weightFromProfile).toBe(true);
  });

  it('falls back to body-model defaults (175 lbs) when profile is empty; flags weightFromProfile=false', () => {
    const { inputs, trace } = buildHydrationDemandInputs(makeUser(), DEFAULT_PROFILE_IDENTITY);
    expect(inputs.weightLbs).toBe(175);
    expect(trace.weightFromProfile).toBe(false);
  });

  it('selects freshest sleep across Apple/Samsung/WHOOP and records the source', () => {
    const biometrics: ProviderBiometrics = {
      apple_health: { providerId: 'apple_health', fetchedAt: 100, sleepHoursLastNight: 6.5 },
      whoop: { providerId: 'whoop', fetchedAt: 500, sleepHoursLastNight: 8.0 },
      samsung_health: {
        providerId: 'samsung_health',
        fetchedAt: 300,
        sleepHoursLastNight: 7.2,
      },
    };
    const { inputs, trace } = buildHydrationDemandInputs(
      makeUser({ biometrics }),
      DEFAULT_PROFILE_IDENTITY,
    );
    expect(inputs.sleepHours).toBe(8.0);
    expect(trace.sleepSource?.source).toBe('whoop');
  });

  it('omits sleepHours entirely when no provider has data (engine applies its own default)', () => {
    const { inputs, trace } = buildHydrationDemandInputs(makeUser(), DEFAULT_PROFILE_IDENTITY);
    expect(inputs.sleepHours).toBeUndefined();
    expect(trace.sleepSource).toBeNull();
  });

  it('passes through weather temp + humidity only when numeric', () => {
    const a = buildHydrationDemandInputs(
      makeUser({ weatherTempC: 32, weatherHumidity: 70 }),
      DEFAULT_PROFILE_IDENTITY,
    );
    expect(a.inputs.heatC).toBe(32);
    expect(a.inputs.humidityPct).toBe(70);

    const b = buildHydrationDemandInputs(
      makeUser({ weatherTempC: null, weatherHumidity: null }),
      DEFAULT_PROFILE_IDENTITY,
    );
    expect(b.inputs.heatC).toBeUndefined();
    expect(b.inputs.humidityPct).toBeUndefined();
  });

  it('clamps activityLevel to 0..10 and zeroes invalid values', () => {
    expect(
      buildHydrationDemandInputs(makeUser({ activityLevel: 99 }), DEFAULT_PROFILE_IDENTITY).inputs
        .activityLevel,
    ).toBe(10);
    expect(
      buildHydrationDemandInputs(makeUser({ activityLevel: -5 }), DEFAULT_PROFILE_IDENTITY).inputs
        .activityLevel,
    ).toBe(0);
    expect(
      buildHydrationDemandInputs(
        makeUser({ activityLevel: NaN as unknown as number }),
        DEFAULT_PROFILE_IDENTITY,
      ).inputs.activityLevel,
    ).toBe(0);
  });

  it('passes overrides through verbatim and the engine consumes them end-to-end', () => {
    const profile = { ...DEFAULT_PROFILE_IDENTITY, bodyWeightLbs: 180 };
    const { inputs } = buildHydrationDemandInputs(makeUser({ activityLevel: 5 }), profile, {
      sweatProfile: 'high',
      environmentProfile: 'hot_climate',
      consumedOz: 24,
      completedCycles: 1,
      recoveryScore: 55,
    });
    expect(inputs.sweatProfile).toBe('high');
    expect(inputs.environmentProfile).toBe('hot_climate');
    expect(inputs.consumedOz).toBe(24);
    expect(inputs.completedCycles).toBe(1);
    expect(inputs.recoveryScore).toBe(55);

    const out = computeHydrationDemand(inputs);
    expect(out.targetOz).toBeGreaterThanOrEqual(40);
    expect(out.targetOz).toBeLessThanOrEqual(220);
    expect(out.remainingOz).toBeGreaterThanOrEqual(0);
    expect(typeof out.command).toBe('string');
    expect(out.command.length).toBeGreaterThan(0);
  });

  it('adapter → engine round-trip with sleep deficit produces a higher target than well-rested', () => {
    const profile = { ...DEFAULT_PROFILE_IDENTITY, bodyWeightLbs: 175 };
    const rested: ProviderBiometrics = {
      whoop: { providerId: 'whoop', fetchedAt: 1, sleepHoursLastNight: 8 },
    };
    const tired: ProviderBiometrics = {
      whoop: { providerId: 'whoop', fetchedAt: 1, sleepHoursLastNight: 4 },
    };
    const restedOut = computeHydrationDemand(
      buildHydrationDemandInputs(makeUser({ biometrics: rested }), profile).inputs,
    );
    const tiredOut = computeHydrationDemand(
      buildHydrationDemandInputs(makeUser({ biometrics: tired }), profile).inputs,
    );
    expect(tiredOut.targetOz).toBeGreaterThan(restedOut.targetOz);
  });
});

describe('hydrationDemandAdapter — lifestyle pass-through', () => {
  it('passes caffeine/occupation/traveler from ProfileIdentity into inputs', () => {
    const profile = {
      ...DEFAULT_PROFILE_IDENTITY,
      caffeineHabit: 'high' as const,
      occupationType: 'outdoor' as const,
      frequentTraveler: true,
    };
    const { inputs, trace } = buildHydrationDemandInputs(makeUser(), profile);
    expect(inputs.caffeineHabit).toBe('high');
    expect(inputs.occupationType).toBe('outdoor');
    expect(inputs.frequentTraveler).toBe(true);
    // 8 + 12 + 6 = 26 → capped to 18.
    expect(trace.lifestyleAdderOz).toBe(18);
  });

  it('carries the default profile through as a no-op (lifestyleAdderOz = 0)', () => {
    const { inputs, trace } = buildHydrationDemandInputs(makeUser(), DEFAULT_PROFILE_IDENTITY);
    expect(inputs.caffeineHabit).toBe('unspecified');
    expect(inputs.occupationType).toBe('unspecified');
    expect(inputs.frequentTraveler).toBe(false);
    expect(trace.lifestyleAdderOz).toBe(0);
  });

  it('raises the engine target when lifestyle fields are set', () => {
    const base = computeHydrationDemand(
      buildHydrationDemandInputs(makeUser(), DEFAULT_PROFILE_IDENTITY).inputs,
    );
    const loaded = computeHydrationDemand(
      buildHydrationDemandInputs(makeUser(), {
        ...DEFAULT_PROFILE_IDENTITY,
        caffeineHabit: 'high' as const,
      }).inputs,
    );
    expect(loaded.targetOz).toBe(base.targetOz + 8);
  });
});
