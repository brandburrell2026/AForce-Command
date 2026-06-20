import { describe, it, expect } from 'vitest';
import {
  deriveCommandConfidence,
  commandConfidenceInputsFromState,
  BIOMETRIC_FRESHNESS_MS,
  WEATHER_FRESHNESS_MS,
  CLOCK_SKEW_MS,
  type CommandConfidenceInputs,
} from '../scoring/commandConfidence';
import type { UserState } from '../../types';

const NONE: CommandConfidenceInputs = {
  hasTodayBehavior: false,
  hasFreshBiometrics: false,
  hasWeather: false,
};

const NOW = 1_700_000_000_000;
const mk = (over: Record<string, unknown> = {}): UserState =>
  ({ unitsConsumedToday: 5, bodyWeightLbs: 180, weatherTempC: null, ...over } as unknown as UserState);

describe('deriveCommandConfidence', () => {
  it('returns low when no real signals are present', () => {
    expect(deriveCommandConfidence(NONE)).toBe('low');
  });

  it('returns high only with behavior + at least one fresh context signal', () => {
    expect(deriveCommandConfidence({ ...NONE, hasTodayBehavior: true, hasWeather: true })).toBe('high');
    expect(deriveCommandConfidence({ ...NONE, hasTodayBehavior: true, hasFreshBiometrics: true })).toBe('high');
  });

  it('returns medium for partial data (behavior alone, or context without behavior)', () => {
    expect(deriveCommandConfidence({ ...NONE, hasTodayBehavior: true })).toBe('medium');
    expect(deriveCommandConfidence({ ...NONE, hasWeather: true })).toBe('medium');
    expect(deriveCommandConfidence({ ...NONE, hasFreshBiometrics: true })).toBe('medium');
  });
});

describe('commandConfidenceInputsFromState — no fabrication', () => {
  it('ignores the seeded unitsConsumedToday / bodyWeightLbs and stays low for a fresh/mock state', () => {
    // mk() mirrors the mock seed (units=5, weight=180) but no real logs/biometrics/weather.
    const inputs = commandConfidenceInputsFromState(mk(), NOW);
    expect(inputs).toEqual(NONE);
    expect(deriveCommandConfidence(inputs)).toBe('low');
  });

  it('counts behavior only from real logged intake events', () => {
    expect(commandConfidenceInputsFromState(mk({ intakeEvents: [{}] }), NOW).hasTodayBehavior).toBe(true);
    expect(commandConfidenceInputsFromState(mk({ intakeEvents: [] }), NOW).hasTodayBehavior).toBe(false);
  });

  describe('biometrics must be non-null AND fresh', () => {
    it('treats an empty {} or all-null Apple Health object as no signal', () => {
      expect(commandConfidenceInputsFromState(mk({ biometrics: {} }), NOW).hasFreshBiometrics).toBe(false);
      expect(
        commandConfidenceInputsFromState(
          mk({ appleHealth: { restingHeartRate: null, hrvSdnn: null, stepsToday: null, sleepHoursLastNight: null, fetchedAt: NOW } }),
          NOW,
        ).hasFreshBiometrics,
      ).toBe(false);
    });

    it('counts a fresh, non-null Apple Health snapshot', () => {
      expect(
        commandConfidenceInputsFromState(mk({ appleHealth: { hrvSdnn: 65, fetchedAt: NOW } }), NOW).hasFreshBiometrics,
      ).toBe(true);
    });

    it('rejects a stale snapshot (older than the freshness window)', () => {
      const stale = NOW - BIOMETRIC_FRESHNESS_MS - 1;
      expect(
        commandConfidenceInputsFromState(mk({ appleHealth: { hrvSdnn: 65, fetchedAt: stale } }), NOW).hasFreshBiometrics,
      ).toBe(false);
    });

    it('counts a fresh non-null provider snapshot in the biometrics map', () => {
      expect(
        commandConfidenceInputsFromState(mk({ biometrics: { whoop: { providerId: 'whoop', recoveryPct: 72, fetchedAt: NOW } } }), NOW)
          .hasFreshBiometrics,
      ).toBe(true);
    });
  });

  describe('weather must be present AND fresh', () => {
    it('rejects null temp or a missing/stale fetchedAt', () => {
      expect(commandConfidenceInputsFromState(mk({ weatherTempC: null, weatherFetchedAt: NOW }), NOW).hasWeather).toBe(false);
      expect(commandConfidenceInputsFromState(mk({ weatherTempC: 25 }), NOW).hasWeather).toBe(false);
      const stale = NOW - WEATHER_FRESHNESS_MS - 1;
      expect(commandConfidenceInputsFromState(mk({ weatherTempC: 25, weatherFetchedAt: stale }), NOW).hasWeather).toBe(false);
    });

    it('counts fresh weather', () => {
      expect(commandConfidenceInputsFromState(mk({ weatherTempC: 25, weatherFetchedAt: NOW }), NOW).hasWeather).toBe(true);
    });
  });

  describe('rejects invalid numeric values and future-dated timestamps', () => {
    it('treats NaN / Infinity weather temp as no weather signal', () => {
      expect(commandConfidenceInputsFromState(mk({ weatherTempC: NaN, weatherFetchedAt: NOW }), NOW).hasWeather).toBe(false);
      expect(commandConfidenceInputsFromState(mk({ weatherTempC: Infinity, weatherFetchedAt: NOW }), NOW).hasWeather).toBe(false);
    });

    it('treats NaN / Infinity biometric metrics as no biometrics signal', () => {
      expect(commandConfidenceInputsFromState(mk({ appleHealth: { hrvSdnn: NaN, fetchedAt: NOW } }), NOW).hasFreshBiometrics).toBe(false);
      expect(
        commandConfidenceInputsFromState(mk({ biometrics: { whoop: { providerId: 'whoop', recoveryPct: Infinity, fetchedAt: NOW } } }), NOW)
          .hasFreshBiometrics,
      ).toBe(false);
    });

    it('rejects Infinity / far-future fetchedAt timestamps', () => {
      expect(commandConfidenceInputsFromState(mk({ appleHealth: { hrvSdnn: 65, fetchedAt: Infinity } }), NOW).hasFreshBiometrics).toBe(false);
      const future = NOW + CLOCK_SKEW_MS + 60_000;
      expect(commandConfidenceInputsFromState(mk({ weatherTempC: 25, weatherFetchedAt: future }), NOW).hasWeather).toBe(false);
    });

    it('tolerates a tiny clock skew (timestamp slightly ahead of now)', () => {
      const slightlyAhead = NOW + CLOCK_SKEW_MS - 1_000;
      expect(commandConfidenceInputsFromState(mk({ weatherTempC: 25, weatherFetchedAt: slightlyAhead }), NOW).hasWeather).toBe(true);
    });
  });

  it('reaches high end-to-end with real logs + fresh weather', () => {
    const inputs = commandConfidenceInputsFromState(mk({ intakeEvents: [{}], weatherTempC: 30, weatherFetchedAt: NOW }), NOW);
    expect(deriveCommandConfidence(inputs)).toBe('high');
  });
});
