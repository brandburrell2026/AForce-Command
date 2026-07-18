import { describe, it, expect } from 'vitest';
import {
  SLEEP_PRIORITY,
  HEART_RATE_PRIORITY,
  ACTIVITY_PRIORITY,
  HYDRATION_VERIFICATION_PRIORITY,
  SIGNAL_PRIORITY,
  resolveSignal,
  selectSleepByHierarchy,
  type SignalCandidate,
} from '../signalHierarchy';
import type { ProviderBiometrics } from '../../types/biometrics';

describe('signalHierarchy — priority tables match the spec verbatim', () => {
  it('sleep ladder is Phantom→WHOOP→Apple→Samsung→Garmin→Google→Voice→Manual', () => {
    expect([...SLEEP_PRIORITY]).toEqual([
      'phantom',
      'whoop',
      'apple_health',
      'samsung_health',
      'garmin',
      'google_health',
      'voice_checkin',
      'manual',
    ]);
  });

  it('Oura is NOT a sleep source (it enters via Apple Health)', () => {
    expect(SLEEP_PRIORITY).not.toContain('oura' as unknown as string);
  });

  it('heart-rate ladder is Phantom→WHOOP→AppleWatch→SamsungWatch→Garmin→Google→Manual', () => {
    // WHOOP sits at #2 (mirroring the sleep ladder) — a dedicated continuous-HR
    // recovery device, trusted for HR as it is for sleep.
    expect([...HEART_RATE_PRIORITY]).toEqual([
      'phantom',
      'whoop',
      'apple_watch',
      'samsung_watch',
      'garmin',
      'google_health',
      'manual',
    ]);
  });

  it('activity ladder is Phantom→Apple→Samsung→Garmin→Google→Manual', () => {
    expect([...ACTIVITY_PRIORITY]).toEqual([
      'phantom',
      'apple_health',
      'samsung_health',
      'garmin',
      'google_health',
      'manual',
    ]);
  });

  it('hydration-verification ladder is Urine→Logs→Voice', () => {
    expect([...HYDRATION_VERIFICATION_PRIORITY]).toEqual([
      'urine_intelligence',
      'hydration_logs',
      'voice_checkin',
    ]);
  });

  it('SIGNAL_PRIORITY indexes every ladder by kind', () => {
    expect(SIGNAL_PRIORITY.sleep).toBe(SLEEP_PRIORITY);
    expect(SIGNAL_PRIORITY.heart_rate).toBe(HEART_RATE_PRIORITY);
    expect(SIGNAL_PRIORITY.activity).toBe(ACTIVITY_PRIORITY);
    expect(SIGNAL_PRIORITY.hydration_verification).toBe(HYDRATION_VERIFICATION_PRIORITY);
  });
});

describe('resolveSignal — deterministic priority, never freshness', () => {
  it('higher-priority source wins even when a lower-priority one is fresher', () => {
    const candidates: SignalCandidate<number>[] = [
      { source: 'apple_health', value: 6, fetchedAt: 999 }, // fresher but lower priority
      { source: 'whoop', value: 8, fetchedAt: 1 }, // stale but higher priority
    ];
    const res = resolveSignal('sleep', candidates);
    expect(res?.source).toBe('whoop');
    expect(res?.value).toBe(8);
    expect(res?.rank).toBe(2); // whoop is rung #2 in the sleep ladder
  });

  it('resolves WHOOP heart-rate at rung #2, above the watches (task_c37a3c68)', () => {
    // WHOOP-only HR now resolves (previously produced no candidate → no HR row).
    const candidates: SignalCandidate<number>[] = [
      { source: 'whoop', value: 58, fetchedAt: 1 },
      { source: 'garmin', value: 61, fetchedAt: 999 }, // fresher, lower priority
    ];
    const res = resolveSignal('heart_rate', candidates);
    expect(res?.source).toBe('whoop');
    expect(res?.value).toBe(58);
    expect(res?.rank).toBe(2); // phantom is #1, whoop #2
  });

  it('falls back down the ladder when higher-priority sources have no value', () => {
    const candidates: SignalCandidate<number>[] = [
      { source: 'phantom', value: null },
      { source: 'whoop', value: undefined },
      { source: 'apple_health', value: 7.5 },
    ];
    const res = resolveSignal('sleep', candidates);
    expect(res?.source).toBe('apple_health');
    expect(res?.value).toBe(7.5);
    expect(res?.rank).toBe(3);
  });

  it('returns null when no candidate has a value', () => {
    expect(
      resolveSignal('sleep', [
        { source: 'whoop', value: null },
        { source: 'apple_health', value: undefined },
      ]),
    ).toBeNull();
    expect(resolveSignal('sleep', [])).toBeNull();
  });

  it('lists availableSources in ladder order, best → worst', () => {
    const candidates: SignalCandidate<number>[] = [
      { source: 'google_health', value: 6 },
      { source: 'whoop', value: 8 },
      { source: 'garmin', value: 7 },
    ];
    const res = resolveSignal('sleep', candidates);
    expect(res?.availableSources).toEqual(['whoop', 'garmin', 'google_health']);
  });

  it('ignores duplicate listings of the same source (first non-null wins)', () => {
    const candidates: SignalCandidate<number>[] = [
      { source: 'apple_health', value: null },
      { source: 'apple_health', value: 7 },
      { source: 'apple_health', value: 9 },
    ];
    const res = resolveSignal('sleep', candidates);
    expect(res?.source).toBe('apple_health');
    expect(res?.value).toBe(7);
  });

  it('heart rate: Apple Watch beats Garmin', () => {
    const res = resolveSignal('heart_rate', [
      { source: 'garmin', value: 58 },
      { source: 'apple_watch', value: 61 },
    ]);
    expect(res?.source).toBe('apple_watch');
    expect(res?.value).toBe(61);
  });

  it('activity: Apple Health beats Samsung Health', () => {
    const res = resolveSignal('activity', [
      { source: 'samsung_health', value: 4 },
      { source: 'apple_health', value: 6 },
    ]);
    expect(res?.source).toBe('apple_health');
  });

  it('hydration verification: Urine Intelligence beats Logs beats Voice', () => {
    const all = resolveSignal('hydration_verification', [
      { source: 'voice_checkin', value: 'ok' },
      { source: 'hydration_logs', value: 'behind' },
      { source: 'urine_intelligence', value: 'support' },
    ]);
    expect(all?.source).toBe('urine_intelligence');

    const noUrine = resolveSignal('hydration_verification', [
      { source: 'voice_checkin', value: 'ok' },
      { source: 'hydration_logs', value: 'behind' },
    ]);
    expect(noUrine?.source).toBe('hydration_logs');
  });
});

describe('selectSleepByHierarchy — ProviderBiometrics → priority winner', () => {
  it('picks WHOOP over a FRESHER Apple Health reading', () => {
    const biometrics: ProviderBiometrics = {
      apple_health: { providerId: 'apple_health', fetchedAt: 999, sleepHoursLastNight: 6 },
      whoop: { providerId: 'whoop', fetchedAt: 1, sleepHoursLastNight: 8 },
    };
    const res = selectSleepByHierarchy(biometrics);
    expect(res?.source).toBe('whoop');
    expect(res?.hours).toBe(8);
    expect(res?.fetchedAt).toBe(1);
  });

  it('falls back to Garmin when WHOOP/Apple/Samsung have no sleep', () => {
    const biometrics: ProviderBiometrics = {
      whoop: { providerId: 'whoop', fetchedAt: 5, sleepHoursLastNight: null },
      garmin: { providerId: 'garmin', fetchedAt: 2, sleepHoursLastNight: 7.1 },
    };
    const res = selectSleepByHierarchy(biometrics);
    expect(res?.source).toBe('garmin');
    expect(res?.hours).toBe(7.1);
  });

  it('returns null when no provider has a sleep reading', () => {
    expect(selectSleepByHierarchy(undefined)).toBeNull();
    expect(selectSleepByHierarchy({})).toBeNull();
    expect(
      selectSleepByHierarchy({
        apple_health: { providerId: 'apple_health', fetchedAt: 1, sleepHoursLastNight: null },
      }),
    ).toBeNull();
  });
});
