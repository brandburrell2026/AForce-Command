import { describe, it, expect } from 'vitest';
import { aggregateBiometrics } from '../biometricsAggregator';
import type { ProviderBiometrics } from '../../types/biometrics';

const t = 1_700_000_000_000;

describe('aggregateBiometrics — empty / undefined', () => {
  it('returns zeros for undefined input', () => {
    const r = aggregateBiometrics(undefined);
    expect(r.recoveryDelta).toBe(0);
    expect(r.inferredActivityLevel).toBe(0);
    expect(r.sources).toEqual([]);
    expect(r.hint).toMatch(/no platforms/i);
  });

  it('returns zeros for empty record', () => {
    const r = aggregateBiometrics({});
    expect(r.recoveryDelta).toBe(0);
    expect(r.inferredActivityLevel).toBe(0);
    expect(r.sources).toEqual([]);
  });

  it('skips providers with undefined snapshots', () => {
    const r = aggregateBiometrics({ oura: undefined } as ProviderBiometrics);
    expect(r.sources).toEqual([]);
    expect(r.recoveryDelta).toBe(0);
  });
});

describe('aggregateBiometrics — recovery delta per signal', () => {
  it('rewards high HRV (≥60ms) by +5', () => {
    const r = aggregateBiometrics({
      garmin: { providerId: 'garmin', hrvSdnn: 65, fetchedAt: t },
    });
    expect(r.recoveryDelta).toBe(5);
    expect(r.hint).toContain('HRV 65ms');
  });

  it('penalizes low HRV (<30ms) by -5', () => {
    const r = aggregateBiometrics({
      oura: { providerId: 'oura', hrvSdnn: 22, fetchedAt: t },
    });
    expect(r.recoveryDelta).toBe(-5);
    expect(r.hint).toContain('low');
  });

  it('mid HRV (40-59) gives +2', () => {
    const r = aggregateBiometrics({
      apple_health: { providerId: 'apple_health', hrvSdnn: 45, fetchedAt: t },
    });
    expect(r.recoveryDelta).toBe(2);
  });

  it('rewards 7–9h sleep with +5', () => {
    const r = aggregateBiometrics({
      whoop: { providerId: 'whoop', sleepHoursLastNight: 7.5, fetchedAt: t },
    });
    expect(r.recoveryDelta).toBe(5);
  });

  it('penalizes <4h sleep with -5', () => {
    const r = aggregateBiometrics({
      oura: { providerId: 'oura', sleepHoursLastNight: 3.5, fetchedAt: t },
    });
    expect(r.recoveryDelta).toBe(-5);
    expect(r.hint).toContain('deficit');
  });

  it('rewards Oura readiness ≥85 with +4', () => {
    const r = aggregateBiometrics({
      oura: { providerId: 'oura', readinessScore: 88, fetchedAt: t },
    });
    expect(r.recoveryDelta).toBe(4);
    expect(r.hint).toContain('Readiness 88');
  });

  it('penalizes Oura readiness <50 with -4', () => {
    const r = aggregateBiometrics({
      oura: { providerId: 'oura', readinessScore: 45, fetchedAt: t },
    });
    expect(r.recoveryDelta).toBe(-4);
  });

  it('rewards WHOOP recovery ≥75% with +4', () => {
    const r = aggregateBiometrics({
      whoop: { providerId: 'whoop', recoveryPct: 80, fetchedAt: t },
    });
    expect(r.recoveryDelta).toBe(4);
    expect(r.hint).toContain('Recovery 80%');
  });

  it('penalizes WHOOP recovery <33% (red zone) with -5', () => {
    const r = aggregateBiometrics({
      whoop: { providerId: 'whoop', recoveryPct: 25, fetchedAt: t },
    });
    expect(r.recoveryDelta).toBe(-5);
    expect(r.hint).toContain('red');
  });

  it('penalizes Garmin stress ≥76 with -4', () => {
    const r = aggregateBiometrics({
      garmin: { providerId: 'garmin', stressScore: 80, fetchedAt: t },
    });
    expect(r.recoveryDelta).toBe(-4);
    expect(r.hint).toContain('high');
  });

  it('rewards low Garmin stress (≤25) with +2', () => {
    const r = aggregateBiometrics({
      garmin: { providerId: 'garmin', stressScore: 18, fetchedAt: t },
    });
    expect(r.recoveryDelta).toBe(2);
    expect(r.hint).toContain('rest');
  });
});

describe('aggregateBiometrics — recovery clamping & multi-signal stacking', () => {
  it('clamps total recovery delta to +10 when many positive signals stack', () => {
    const r = aggregateBiometrics({
      apple_health: { providerId: 'apple_health', hrvSdnn: 70, sleepHoursLastNight: 8, fetchedAt: t },
      oura: { providerId: 'oura', readinessScore: 90, fetchedAt: t },
      whoop: { providerId: 'whoop', recoveryPct: 85, fetchedAt: t },
    });
    // Raw would be HRV +5, sleep +5, readiness +4, recovery +4 = +18, clamped to +10.
    expect(r.recoveryDelta).toBe(10);
  });

  it('clamps total recovery delta to -10 when many negative signals stack', () => {
    const r = aggregateBiometrics({
      apple_health: { providerId: 'apple_health', hrvSdnn: 20, sleepHoursLastNight: 3, fetchedAt: t },
      oura: { providerId: 'oura', readinessScore: 40, fetchedAt: t },
      whoop: { providerId: 'whoop', recoveryPct: 20, fetchedAt: t },
      garmin: { providerId: 'garmin', stressScore: 90, fetchedAt: t },
    });
    expect(r.recoveryDelta).toBe(-10);
  });

  it('does not double-count HRV when two providers report it — picks freshest', () => {
    const r = aggregateBiometrics({
      apple_health: { providerId: 'apple_health', hrvSdnn: 65, fetchedAt: t },
      garmin: { providerId: 'garmin', hrvSdnn: 25, fetchedAt: t + 1000 }, // newer
    });
    // Should use Garmin's 25ms (low) → -5, NOT 65 + 25 = stacked.
    expect(r.recoveryDelta).toBe(-5);
  });

  it('older provider loses to newer provider on the same metric', () => {
    const r = aggregateBiometrics({
      whoop: { providerId: 'whoop', sleepHoursLastNight: 4.5, fetchedAt: t },
      oura: { providerId: 'oura', sleepHoursLastNight: 8, fetchedAt: t + 5000 }, // newer
    });
    // Oura wins → +5 (good sleep), not WHOOP -3 (short sleep).
    expect(r.recoveryDelta).toBe(5);
  });
});

describe('aggregateBiometrics — activity inference', () => {
  it('infers ~7 activity from 10k steps (Google Health Connect)', () => {
    const r = aggregateBiometrics({
      google_health: { providerId: 'google_health', stepsToday: 10000, fetchedAt: t },
    });
    expect(r.inferredActivityLevel).toBeGreaterThanOrEqual(7);
    expect(r.inferredActivityLevel).toBeLessThanOrEqual(7.5);
  });

  it('infers ~5 activity from 7,500 steps', () => {
    const r = aggregateBiometrics({
      apple_health: { providerId: 'apple_health', stepsToday: 7500, fetchedAt: t },
    });
    expect(r.inferredActivityLevel).toBeCloseTo(5, 1);
  });

  it('infers high activity from WHOOP strain of 14 (≈ strenuous)', () => {
    const r = aggregateBiometrics({
      whoop: { providerId: 'whoop', strain: 14, fetchedAt: t },
    });
    expect(r.inferredActivityLevel).toBeGreaterThan(6);
  });

  it('infers high activity from a long Strava workout (60min)', () => {
    const r = aggregateBiometrics({
      strava: { providerId: 'strava', workoutMinutesToday: 60, fetchedAt: t },
    });
    expect(r.inferredActivityLevel).toBeGreaterThanOrEqual(7);
  });

  it('takes MAX activity across providers (Strava workout > Apple steps)', () => {
    const r = aggregateBiometrics({
      apple_health: { providerId: 'apple_health', stepsToday: 4000, fetchedAt: t }, // ≈ 2.5
      strava: { providerId: 'strava', workoutMinutesToday: 90, fetchedAt: t },     // ≈ 8.5
    });
    expect(r.inferredActivityLevel).toBeGreaterThanOrEqual(8);
  });

  it('takes MAX activity across signals on the same provider', () => {
    const r = aggregateBiometrics({
      apple_health: {
        providerId: 'apple_health',
        stepsToday: 1000,
        workoutMinutesToday: 60,
        fetchedAt: t,
      },
    });
    expect(r.inferredActivityLevel).toBeGreaterThanOrEqual(7);
  });

  it('Strava high training load nudges activity floor (half weight)', () => {
    const r = aggregateBiometrics({
      strava: { providerId: 'strava', trainingLoad: 100, fetchedAt: t },
    });
    expect(r.inferredActivityLevel).toBeGreaterThan(0);
    expect(r.inferredActivityLevel).toBeLessThanOrEqual(5);
  });

  it('clamps inferred activity to 10', () => {
    const r = aggregateBiometrics({
      whoop: { providerId: 'whoop', strain: 21, fetchedAt: t },
      strava: { providerId: 'strava', workoutMinutesToday: 240, fetchedAt: t },
      apple_health: { providerId: 'apple_health', stepsToday: 25000, fetchedAt: t },
    });
    expect(r.inferredActivityLevel).toBeLessThanOrEqual(10);
  });

  it('returns 0 activity when no activity-related signals are present', () => {
    const r = aggregateBiometrics({
      oura: { providerId: 'oura', hrvSdnn: 55, sleepHoursLastNight: 7, fetchedAt: t },
    });
    expect(r.inferredActivityLevel).toBe(0);
  });
});

describe('aggregateBiometrics — sources & hint', () => {
  it('lists all providers that contributed at least one snapshot', () => {
    const r = aggregateBiometrics({
      whoop: { providerId: 'whoop', recoveryPct: 70, fetchedAt: t },
      oura: { providerId: 'oura', readinessScore: 80, fetchedAt: t },
      garmin: { providerId: 'garmin', hrvSdnn: 50, fetchedAt: t },
    });
    expect(r.sources.sort()).toEqual(['garmin', 'oura', 'whoop']);
  });

  it('hint summarizes the contributing metrics', () => {
    const r = aggregateBiometrics({
      whoop: { providerId: 'whoop', recoveryPct: 78, sleepHoursLastNight: 7.5, fetchedAt: t },
    });
    expect(r.hint).toContain('Recovery 78%');
    expect(r.hint).toContain('Sleep 7.5h');
  });

  it('shows awaiting-data hint when provider connected but no metric values', () => {
    const r = aggregateBiometrics({
      strava: { providerId: 'strava', fetchedAt: t },
    });
    expect(r.hint).toMatch(/awaiting/i);
    expect(r.recoveryDelta).toBe(0);
  });
});

describe('aggregateBiometrics — realistic multi-provider scenarios', () => {
  it('AForce demo profile (Oura + WHOOP + Strava) — surfaces a coherent recovery boost', () => {
    const r = aggregateBiometrics({
      oura: {
        providerId: 'oura', hrvSdnn: 58, sleepHoursLastNight: 7.4,
        readinessScore: 82, fetchedAt: t,
      },
      whoop: {
        providerId: 'whoop', strain: 14.2, recoveryPct: 71,
        sleepHoursLastNight: 7.1, fetchedAt: t + 1000,
      },
      strava: {
        providerId: 'strava', workoutMinutesToday: 62, trainingLoad: 78, fetchedAt: t,
      },
    });
    expect(r.sources).toContain('oura');
    expect(r.sources).toContain('whoop');
    expect(r.sources).toContain('strava');
    // Strava 62-min workout → activity level ≥ 7 (well above sedentary).
    expect(r.inferredActivityLevel).toBeGreaterThanOrEqual(7);
    // Recovery should be net positive: HRV 58 (+2 mid), sleep 7.1h freshest (+5),
    // readiness 82 (+2), recovery 71 (+1) = +10 clamped.
    expect(r.recoveryDelta).toBeGreaterThan(0);
  });

  it('Bad-night scenario (poor sleep + low HRV across providers) — net negative', () => {
    const r = aggregateBiometrics({
      apple_health: {
        providerId: 'apple_health', hrvSdnn: 25, sleepHoursLastNight: 4.5, fetchedAt: t,
      },
      garmin: {
        providerId: 'garmin', stressScore: 78, fetchedAt: t,
      },
    });
    expect(r.recoveryDelta).toBeLessThan(0);
  });
});
