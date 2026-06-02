import { describe, it, expect } from 'vitest';
import {
  getRequiredBodyModel,
  getBodyModelOrDefaults,
  MissingProfileFieldError,
  BODY_MODEL_DEFAULTS,
  selectFreshestSleepHours,
  SLEEP_PROVIDERS,
} from '../profileBodyModel';
import { DEFAULT_PROFILE_IDENTITY } from '../../utils/profileIdentity';
import type { ProviderBiometrics } from '../../types/biometrics';

describe('profileSource — BODY MODEL accessor', () => {
  it('getRequiredBodyModel returns all fields when set', () => {
    const got = getRequiredBodyModel({
      ...DEFAULT_PROFILE_IDENTITY,
      bodyWeightLbs: 180,
      heightCm: 182,
      birthYear: 1992,
      biologicalSex: 'male',
    });
    expect(got).toEqual({
      bodyWeightLbs: 180,
      heightCm: 182,
      birthYear: 1992,
      biologicalSex: 'male',
    });
  });

  it('getRequiredBodyModel throws MissingProfileFieldError naming the first missing field', () => {
    expect(() =>
      getRequiredBodyModel({ ...DEFAULT_PROFILE_IDENTITY, bodyWeightLbs: null }),
    ).toThrowError(MissingProfileFieldError);
    try {
      getRequiredBodyModel({ ...DEFAULT_PROFILE_IDENTITY, bodyWeightLbs: null });
    } catch (e) {
      expect((e as MissingProfileFieldError).field).toBe('bodyWeightLbs');
    }
  });

  it('getRequiredBodyModel reports heightCm and birthYear individually', () => {
    try {
      getRequiredBodyModel({ ...DEFAULT_PROFILE_IDENTITY, bodyWeightLbs: 175, heightCm: null });
    } catch (e) {
      expect((e as MissingProfileFieldError).field).toBe('heightCm');
    }
    try {
      getRequiredBodyModel({
        ...DEFAULT_PROFILE_IDENTITY,
        bodyWeightLbs: 175,
        heightCm: 178,
        birthYear: null,
      });
    } catch (e) {
      expect((e as MissingProfileFieldError).field).toBe('birthYear');
    }
  });

  it('getBodyModelOrDefaults substitutes defaults for every missing field', () => {
    expect(getBodyModelOrDefaults(DEFAULT_PROFILE_IDENTITY)).toEqual(BODY_MODEL_DEFAULTS);
  });

  it('getBodyModelOrDefaults preserves user-set values', () => {
    const got = getBodyModelOrDefaults({
      ...DEFAULT_PROFILE_IDENTITY,
      bodyWeightLbs: 210,
      heightCm: 190,
      birthYear: 1985,
      biologicalSex: 'female',
    });
    expect(got).toEqual({
      bodyWeightLbs: 210,
      heightCm: 190,
      birthYear: 1985,
      biologicalSex: 'female',
    });
  });
});

describe('profileSource — selectFreshestSleepHours', () => {
  it('returns null when biometrics is undefined or empty', () => {
    expect(selectFreshestSleepHours(undefined)).toBeNull();
    expect(selectFreshestSleepHours({})).toBeNull();
  });

  it('returns null when no sleep-provider snapshot has sleepHoursLastNight', () => {
    const bio: ProviderBiometrics = {
      apple_health: { providerId: 'apple_health', fetchedAt: 100, sleepHoursLastNight: null },
      whoop: { providerId: 'whoop', fetchedAt: 200 },
    };
    expect(selectFreshestSleepHours(bio)).toBeNull();
  });

  it('picks the freshest non-null sleep reading across Apple/Samsung/WHOOP', () => {
    const bio: ProviderBiometrics = {
      apple_health: { providerId: 'apple_health', fetchedAt: 100, sleepHoursLastNight: 7.0 },
      samsung_health: { providerId: 'samsung_health', fetchedAt: 300, sleepHoursLastNight: 8.1 },
      whoop: { providerId: 'whoop', fetchedAt: 200, sleepHoursLastNight: 6.5 },
    };
    const got = selectFreshestSleepHours(bio);
    expect(got).toEqual({ hours: 8.1, source: 'samsung_health', fetchedAt: 300 });
  });

  it('ignores non-sleep providers even if fresher', () => {
    const bio: ProviderBiometrics = {
      apple_health: { providerId: 'apple_health', fetchedAt: 100, sleepHoursLastNight: 7.2 },
      // Oura would be fresher but is not in SLEEP_PROVIDERS for this selector.
      oura: { providerId: 'oura', fetchedAt: 999, sleepHoursLastNight: 9.0 },
    };
    const got = selectFreshestSleepHours(bio);
    expect(got?.source).toBe('apple_health');
    expect(got?.hours).toBe(7.2);
  });

  it('SLEEP_PROVIDERS is exactly Apple/Samsung/WHOOP', () => {
    expect([...SLEEP_PROVIDERS]).toEqual(['apple_health', 'samsung_health', 'whoop']);
  });
});
