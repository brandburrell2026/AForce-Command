import { describe, it, expect } from 'vitest';
import { derivePersonalizationSignals } from '../personalizationSignals';
import { DEFAULT_PROFILE_IDENTITY } from '../profileIdentity';
import type { ScoreEngineOutput, UserState } from '../../types';

function mkUser(overrides: Partial<UserState> = {}): UserState {
  return {
    bodyWeightLbs: 150,
    activityLevel: 0,
    heatLoad: 0,
    sweatRate: 0,
    complianceStreak: 0,
    weatherTempC: null,
    weatherHumidity: null,
    isAwake: true,
    clutchActive: false,
    ...(overrides as object),
  } as unknown as UserState;
}

function mkEngine(level: ScoreEngineOutput['performanceState']['level'] = 'BALANCED'): ScoreEngineOutput {
  return {
    score: 75,
    performanceState: { level, color: '#fff', score: 75 } as ScoreEngineOutput['performanceState'],
  } as unknown as ScoreEngineOutput;
}

describe('derivePersonalizationSignals', () => {
  it('returns empty reasons + neutral summary for the no-signal case', () => {
    const out = derivePersonalizationSignals({
      userState: mkUser(),
      engineOutput: mkEngine('BALANCED'),
    });
    expect(out.reasons).toEqual([]);
    expect(out.summary).toMatch(/Tuned to your body/i);
    expect(out.signals.bands.heat).toBe('normal');
    expect(out.signals.bands.recovery).toBe('normal');
  });

  it('flags HIGH heat above 32 °C as the first reason', () => {
    const out = derivePersonalizationSignals({
      userState: mkUser({ weatherTempC: 34 }),
      engineOutput: mkEngine('BALANCED'),
    });
    expect(out.reasons[0]).toMatchObject({ key: 'heat' });
    expect(out.reasons[0].label).toMatch(/Heat 34/);
  });

  it('uses heatLoad fallback when weatherTempC is missing', () => {
    const out = derivePersonalizationSignals({
      userState: mkUser({ weatherTempC: null, heatLoad: 10 }),
      engineOutput: mkEngine('BALANCED'),
    });
    // heatLoad 10 → 32 °C → HIGH band
    expect(out.reasons[0].key).toBe('heat');
    expect(out.signals.tempC).toBe(32);
  });

  it('orders heat, humidity, activity, recovery, alcohol, consistency, mass correctly', () => {
    const out = derivePersonalizationSignals({
      userState: mkUser({
        weatherTempC: 35,
        weatherHumidity: 85,
        activityLevel: 8,
        complianceStreak: 10,
        bodyWeightLbs: 220,
      }),
      engineOutput: mkEngine('DEPLETED'),
      socialAlcoholMultiplier: 1.4,
    });
    // Only top 3 surfaced.
    expect(out.reasons.length).toBe(3);
    expect(out.reasons.map((r) => r.key)).toEqual(['heat', 'humidity', 'activity']);
  });

  it('treats DEPLETED state as elevated recovery demand', () => {
    const out = derivePersonalizationSignals({
      userState: mkUser(),
      engineOutput: mkEngine('DEPLETED'),
    });
    expect(out.signals.bands.recovery).toBe('high');
    expect(out.reasons.some((r) => r.key === 'recovery')).toBe(true);
  });

  it('flags PEAK as a positive recovery signal (low demand)', () => {
    const out = derivePersonalizationSignals({
      userState: mkUser(),
      engineOutput: mkEngine('PEAK'),
    });
    expect(out.signals.bands.recovery).toBe('low');
    expect(out.reasons.find((r) => r.key === 'recovery')?.label).toMatch(/Peak/i);
  });

  it('surfaces alcohol when socialAlcoholMultiplier > 1', () => {
    const out = derivePersonalizationSignals({
      userState: mkUser(),
      engineOutput: mkEngine('BALANCED'),
      socialAlcoholMultiplier: 1.25,
    });
    expect(out.signals.alcoholActive).toBe(true);
    expect(out.reasons.find((r) => r.key === 'alcohol')).toBeTruthy();
  });

  it('does NOT surface alcohol when multiplier is 1 (or absent)', () => {
    const out = derivePersonalizationSignals({
      userState: mkUser(),
      engineOutput: mkEngine('BALANCED'),
    });
    expect(out.signals.alcoholActive).toBe(false);
    expect(out.reasons.find((r) => r.key === 'alcohol')).toBeUndefined();
  });

  it('surfaces a strong consistency streak (≥5 days)', () => {
    const out = derivePersonalizationSignals({
      userState: mkUser({ complianceStreak: 7 }),
      engineOutput: mkEngine('BALANCED'),
    });
    expect(out.reasons.find((r) => r.key === 'consistency')?.label).toMatch(/7-day streak/);
  });

  it('clamps absurd inputs without throwing or producing NaN labels', () => {
    const out = derivePersonalizationSignals({
      userState: mkUser({
        bodyWeightLbs: -5,
        activityLevel: 99,
        complianceStreak: -3,
        weatherTempC: Number.NaN,
        weatherHumidity: Number.NaN,
        heatLoad: Number.NaN,
      }),
      engineOutput: mkEngine('BALANCED'),
      socialAlcoholMultiplier: Number.NaN,
    });
    expect(out.signals.activity).toBe(10);
    expect(out.signals.bodyWeightLbs).toBeGreaterThanOrEqual(60);
    expect(out.signals.consistencyDays).toBe(0);
    expect(out.signals.tempC).toBeNull();
    expect(out.signals.alcoholActive).toBe(false);
    expect(out.reasons.every((r) => !/NaN/.test(r.label))).toBe(true);
  });

  it('treats NaN numeric fields as the safe default (not NaN-propagating)', () => {
    const out = derivePersonalizationSignals({
      userState: mkUser({
        bodyWeightLbs: Number.NaN,
        activityLevel: Number.NaN,
        complianceStreak: Number.NaN,
      }),
      engineOutput: mkEngine('BALANCED'),
    });
    expect(Number.isFinite(out.signals.activity)).toBe(true);
    expect(out.signals.activity).toBe(0);
    expect(Number.isFinite(out.signals.bodyWeightLbs)).toBe(true);
    expect(out.signals.bodyWeightLbs).toBe(150);
    expect(out.signals.consistencyDays).toBe(0);
  });

  it('auto-derives the alcohol multiplier from userState.socialMode when active', () => {
    const now = new Date();
    const out = derivePersonalizationSignals({
      userState: mkUser({
        socialMode: {
          active: true,
          startedAt: new Date(now.getTime() - 30 * 60 * 1000),
          drinks: [
            { id: 'd1', type: 'beer', loggedAt: new Date(now.getTime() - 5 * 60 * 1000), multiplier: 1.3, hydrated: null, abv: 5, oz: 12 },
            { id: 'd2', type: 'beer', loggedAt: new Date(now.getTime() - 2 * 60 * 1000), multiplier: 1.3, hydrated: null, abv: 5, oz: 12 },
          ],
        },
      } as Partial<UserState>),
      engineOutput: mkEngine('BALANCED'),
    });
    expect(out.signals.alcoholActive).toBe(true);
    expect(out.reasons.some((r) => r.key === 'alcohol')).toBe(true);
  });

  it('does NOT surface alcohol when socialMode exists but is inactive', () => {
    const now = new Date();
    const out = derivePersonalizationSignals({
      userState: mkUser({
        socialMode: {
          active: false,
          startedAt: new Date(now.getTime() - 30 * 60 * 1000),
          drinks: [
            { id: 'd1', type: 'beer', loggedAt: new Date(now.getTime() - 5 * 60 * 1000), multiplier: 1.3, hydrated: null, abv: 5, oz: 12 },
          ],
        },
      } as Partial<UserState>),
      engineOutput: mkEngine('BALANCED'),
    });
    expect(out.signals.alcoholActive).toBe(false);
  });

  it('tolerates a malformed socialMode without throwing', () => {
    expect(() =>
      derivePersonalizationSignals({
        userState: mkUser({
          // @ts-expect-error — intentionally malformed to prove resilience
          socialMode: { active: true, drinks: 'not-an-array' },
        }),
        engineOutput: mkEngine('BALANCED'),
      }),
    ).not.toThrow();
  });

  it('adds a BODY MODEL reason when 2+ body-model fields are filled in', () => {
    const out = derivePersonalizationSignals({
      userState: mkUser(),
      engineOutput: mkEngine('BALANCED'),
      profileIdentity: {
        displayName: '',
        nickname: '',
        avatarUri: '',
        city: '',
        country: '',
        teamCircle: '',
        territoryBadge: '',
        auraState: 'FLOW',
        recoveryGoal: 'BALANCE',
        bodyWeightLbs: 175,
        heightCm: 180,
        birthYear: 1990,
        biologicalSex: 'male',
        activityLevel: null,
        caffeineHabit: 'unspecified',
        occupationType: 'unspecified',
        frequentTraveler: false,
        trainingLevel: null,
        primaryGoal: null,
        sweatClassification: null,
        goalWeightLbs: null,
        typicalWorkoutDurationMin: null,
      },
    });
    const bodyModel = out.reasons.find((r) => r.key === 'bodyModel');
    expect(bodyModel).toBeDefined();
    expect(bodyModel!.label).toMatch(/180cm/);
    expect(bodyModel!.label).toMatch(/M/);
  });

  it('does NOT add a BODY MODEL reason when fewer than 2 body-model fields are set', () => {
    const out = derivePersonalizationSignals({
      userState: mkUser(),
      engineOutput: mkEngine('BALANCED'),
      profileIdentity: {
        displayName: '',
        nickname: '',
        avatarUri: '',
        city: '',
        country: '',
        teamCircle: '',
        territoryBadge: '',
        auraState: 'FLOW',
        recoveryGoal: 'BALANCE',
        bodyWeightLbs: null,
        heightCm: 180,
        birthYear: null,
        biologicalSex: 'unspecified',
        activityLevel: null,
        caffeineHabit: 'unspecified',
        occupationType: 'unspecified',
        frequentTraveler: false,
        trainingLevel: null,
        primaryGoal: null,
        sweatClassification: null,
        goalWeightLbs: null,
        typicalWorkoutDurationMin: null,
      },
    });
    expect(out.reasons.find((r) => r.key === 'bodyModel')).toBeUndefined();
  });

  it('omits the BODY MODEL reason when no profileIdentity is provided', () => {
    const out = derivePersonalizationSignals({
      userState: mkUser(),
      engineOutput: mkEngine('BALANCED'),
    });
    expect(out.reasons.find((r) => r.key === 'bodyModel')).toBeUndefined();
  });

  it('caps reasons to a maximum of 3', () => {
    const out = derivePersonalizationSignals({
      userState: mkUser({
        weatherTempC: 35,
        weatherHumidity: 90,
        activityLevel: 9,
        complianceStreak: 7,
        bodyWeightLbs: 220,
      }),
      engineOutput: mkEngine('DEPLETED'),
      socialAlcoholMultiplier: 1.3,
    });
    expect(out.reasons.length).toBe(3);
  });

  // ─── Acidic Load + Stimulant Load ────────────────────────────────
  // These regressions guarantee the elevated-load chips survive the
  // top-3 truncation even when every other personalization signal
  // is firing. Without this, the user never sees "Stimulant Load
  // Elevated" / "Acidic Load Elevated" — which is the entire point
  // of this slice.

  const NOW_LOAD = new Date('2026-05-19T12:00:00Z').getTime();
  const HOUR_MS = 60 * 60 * 1000;

  it('surfaces Stimulant Load Elevated even when 4+ other signals fire', () => {
    const out = derivePersonalizationSignals({
      userState: mkUser({
        weatherTempC: 35,
        weatherHumidity: 90,
        activityLevel: 9,
        complianceStreak: 7,
        bodyWeightLbs: 220,
      }),
      engineOutput: mkEngine('DEPLETED'),
      socialAlcoholMultiplier: 1.3,
      recentIntake: [
        { categoryId: 'coffee', oz: 12, loggedAt: NOW_LOAD - HOUR_MS },
        { categoryId: 'coffee', oz: 12, loggedAt: NOW_LOAD - 2 * HOUR_MS },
      ],
      nowMs: NOW_LOAD,
    });
    expect(out.reasons.length).toBe(3);
    expect(out.reasons.map((r) => r.key)).toContain('stimulantLoad');
    const stim = out.reasons.find((r) => r.key === 'stimulantLoad');
    expect(stim?.label).toBe('Stimulant Load Elevated');
  });

  it('surfaces Acidic Load Elevated alongside Stimulant Load when both fire', () => {
    const out = derivePersonalizationSignals({
      userState: mkUser({
        weatherTempC: 35,
        activityLevel: 9,
      }),
      engineOutput: mkEngine('DEPLETED'),
      recentIntake: [
        { categoryId: 'coffee', oz: 16, loggedAt: NOW_LOAD - HOUR_MS },
        { categoryId: 'coffee', oz: 12, loggedAt: NOW_LOAD - 2 * HOUR_MS },
        { categoryId: 'soda', oz: 20, loggedAt: NOW_LOAD - HOUR_MS },
      ],
      nowMs: NOW_LOAD,
    });
    const keys = out.reasons.map((r) => r.key);
    expect(keys).toContain('stimulantLoad');
    expect(keys).toContain('acidicLoad');
    expect(out.reasons.length).toBe(3);
  });

  it('moderate load only fills empty chip slots — never displaces other reasons', () => {
    const out = derivePersonalizationSignals({
      userState: mkUser({
        weatherTempC: 35,
        weatherHumidity: 90,
        activityLevel: 9,
      }),
      engineOutput: mkEngine('DEPLETED'),
      recentIntake: [
        { categoryId: 'coffee', oz: 12, loggedAt: NOW_LOAD - HOUR_MS },
      ],
      nowMs: NOW_LOAD,
    });
    // heat, humidity, activity already fill 3 slots → moderate
    // stimulant load must NOT be inserted (would push activity out).
    expect(out.reasons.length).toBe(3);
    expect(out.reasons.map((r) => r.key)).not.toContain('stimulantLoad');
  });

  it('moderate load DOES fill an open slot when fewer than 3 reasons exist', () => {
    const out = derivePersonalizationSignals({
      userState: mkUser({ weatherTempC: 35 }),
      engineOutput: mkEngine('BALANCED'),
      recentIntake: [
        { categoryId: 'coffee', oz: 12, loggedAt: NOW_LOAD - HOUR_MS },
      ],
      nowMs: NOW_LOAD,
    });
    expect(out.reasons.map((r) => r.key)).toContain('stimulantLoad');
    const stim = out.reasons.find((r) => r.key === 'stimulantLoad');
    expect(stim?.label).toBe('Stimulant Load Moderate');
  });

  it('omits load reasons entirely when recentIntake is not provided', () => {
    const out = derivePersonalizationSignals({
      userState: mkUser({ weatherTempC: 35 }),
      engineOutput: mkEngine('BALANCED'),
    });
    const keys = out.reasons.map((r) => r.key);
    expect(keys).not.toContain('stimulantLoad');
    expect(keys).not.toContain('acidicLoad');
  });
});

describe('derivePersonalizationSignals — lifestyle chips', () => {
  it('surfaces caffeine/occupation/travel chips for explicit profile fields', () => {
    const out = derivePersonalizationSignals({
      userState: mkUser(),
      engineOutput: mkEngine('BALANCED'),
      profileIdentity: {
        ...DEFAULT_PROFILE_IDENTITY,
        caffeineHabit: 'high',
        occupationType: 'outdoor',
        frequentTraveler: true,
      },
    });
    const keys = out.reasons.map((r) => r.key);
    expect(keys).toContain('caffeine');
    expect(keys).toContain('occupation');
    expect(keys).toContain('travel');
  });

  it('uses softer copy for moderate caffeine and active occupation', () => {
    const out = derivePersonalizationSignals({
      userState: mkUser(),
      engineOutput: mkEngine('BALANCED'),
      profileIdentity: {
        ...DEFAULT_PROFILE_IDENTITY,
        caffeineHabit: 'moderate',
        occupationType: 'active',
      },
    });
    expect(out.reasons.find((r) => r.key === 'caffeine')?.label).toBe('Caffeine load');
    expect(out.reasons.find((r) => r.key === 'occupation')?.label).toBe('Active-job demand');
  });

  it('omits lifestyle chips when fields are unspecified / false', () => {
    const out = derivePersonalizationSignals({
      userState: mkUser(),
      engineOutput: mkEngine('BALANCED'),
      profileIdentity: { ...DEFAULT_PROFILE_IDENTITY },
    });
    const keys = out.reasons.map((r) => r.key);
    expect(keys).not.toContain('caffeine');
    expect(keys).not.toContain('occupation');
    expect(keys).not.toContain('travel');
  });

  it('omits lifestyle chips when no profileIdentity is supplied', () => {
    const out = derivePersonalizationSignals({
      userState: mkUser(),
      engineOutput: mkEngine('BALANCED'),
    });
    const keys = out.reasons.map((r) => r.key);
    expect(keys).not.toContain('caffeine');
    expect(keys).not.toContain('occupation');
    expect(keys).not.toContain('travel');
  });
});
