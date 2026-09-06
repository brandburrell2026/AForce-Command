import { describe, it, expect } from 'vitest';
import {
  deriveCommandConfidence,
  commandConfidenceInputsFromState,
  deriveContextSnapshotFields,
  freshBiometricAnchorMs,
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
      // PR5: the canonical classifier tolerates CLOCK_SKEW_MS beyond the
      // window (drift never condemns a reading), so "stale" starts past both.
      const stale = NOW - WEATHER_FRESHNESS_MS - CLOCK_SKEW_MS - 1;
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

describe('freshBiometricAnchorMs', () => {
  it('returns null when no source has both signal and freshness', () => {
    expect(freshBiometricAnchorMs(mk(), NOW)).toBeNull();
    expect(freshBiometricAnchorMs(mk({ biometrics: {} }), NOW)).toBeNull();
    // signal but stale
    const stale = NOW - BIOMETRIC_FRESHNESS_MS - 1;
    expect(freshBiometricAnchorMs(mk({ appleHealth: { hrvSdnn: 65, fetchedAt: stale } }), NOW)).toBeNull();
  });

  it('returns the MAX fetchedAt among sources that are both fresh and have signal', () => {
    const older = NOW - 3 * 60 * 60 * 1000;
    const newer = NOW - 1 * 60 * 60 * 1000;
    const state = mk({
      appleHealth: { hrvSdnn: 65, fetchedAt: older },
      biometrics: { whoop: { providerId: 'whoop', recoveryPct: 72, fetchedAt: newer } },
    });
    expect(freshBiometricAnchorMs(state, NOW)).toBe(newer);
  });

  it('ignores a fresh-but-empty source when picking the anchor', () => {
    const fresh = NOW - 60 * 1000;
    // whoop is fresh but carries no signal → must NOT become the anchor.
    const state = mk({
      appleHealth: { hrvSdnn: 65, fetchedAt: NOW - 2 * 60 * 60 * 1000 },
      biometrics: { whoop: { providerId: 'whoop', fetchedAt: fresh } },
    });
    expect(freshBiometricAnchorMs(state, NOW)).toBe(NOW - 2 * 60 * 60 * 1000);
  });
});

describe('deriveContextSnapshotFields — fail-closed flag↔anchor binding', () => {
  it('emits no context when neither weather nor biometrics are fresh', () => {
    expect(deriveContextSnapshotFields(mk(), NOW)).toEqual({
      hasContext: false,
      weatherTempC: null,
      weatherFetchedAtMs: null,
      hasFreshBiometrics: false,
      biometricsFetchedAtMs: null,
    });
  });

  it('binds hasFreshBiometrics to a non-null anchor and weather to its fetch time', () => {
    const bioAt = NOW - 60 * 1000;
    const wxAt = NOW - 60 * 1000;
    const fields = deriveContextSnapshotFields(
      mk({
        weatherTempC: 30,
        weatherFetchedAt: wxAt,
        appleHealth: { hrvSdnn: 65, fetchedAt: bioAt },
      }),
      NOW,
    );
    expect(fields).toEqual({
      hasContext: true,
      weatherTempC: 30,
      weatherFetchedAtMs: wxAt,
      hasFreshBiometrics: true,
      biometricsFetchedAtMs: bioAt,
    });
  });

  it('drops weather (temp + anchor together) when only biometrics are fresh', () => {
    const bioAt = NOW - 60 * 1000;
    const fields = deriveContextSnapshotFields(
      mk({ weatherTempC: 30, weatherFetchedAt: NOW - WEATHER_FRESHNESS_MS - CLOCK_SKEW_MS - 1, appleHealth: { hrvSdnn: 65, fetchedAt: bioAt } }),
      NOW,
    );
    expect(fields.hasContext).toBe(true);
    expect(fields.weatherTempC).toBeNull();
    expect(fields.weatherFetchedAtMs).toBeNull();
    expect(fields.hasFreshBiometrics).toBe(true);
    expect(fields.biometricsFetchedAtMs).toBe(bioAt);
  });

  it('INVARIANT: hasFreshBiometrics is true iff biometricsFetchedAtMs is non-null', () => {
    // Walk a biometric source across its freshness boundary; the flag and the
    // anchor must flip together at the SAME instant (no flag-without-anchor and
    // no anchor-without-flag), which is what makes the wired snapshot fail-closed.
    const fetchedAt = NOW - BIOMETRIC_FRESHNESS_MS; // exactly on the edge
    for (const delta of [-2_000, -1, 0, 1, 60_000]) {
      const evalNow = fetchedAt + BIOMETRIC_FRESHNESS_MS + delta;
      const f = deriveContextSnapshotFields(mk({ appleHealth: { hrvSdnn: 65, fetchedAt } }), evalNow);
      expect(f.hasFreshBiometrics).toBe(f.biometricsFetchedAtMs != null);
    }
  });

  it('matches the live confidence derivation it mirrors (single clock)', () => {
    const state = mk({
      intakeEvents: [{}],
      weatherTempC: 30,
      weatherFetchedAt: NOW - 60 * 1000,
      appleHealth: { hrvSdnn: 65, fetchedAt: NOW - 60 * 1000 },
    });
    const live = commandConfidenceInputsFromState(state, NOW);
    const ctx = deriveContextSnapshotFields(state, NOW);
    expect(ctx.hasFreshBiometrics).toBe(live.hasFreshBiometrics);
    expect(ctx.weatherFetchedAtMs != null).toBe(live.hasWeather);
  });
});
