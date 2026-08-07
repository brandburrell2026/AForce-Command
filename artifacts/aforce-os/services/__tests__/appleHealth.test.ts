import { describe, it, expect } from 'vitest';

import {
  isAppleHealthSupported,
  requestAppleHealthPermissions,
  fetchAppleHealthSnapshot,
  toEpochMsOrNull,
} from '../appleHealth';

/**
 * Dormant-by-default coverage. `healthkit_native_enabled` defaults to false
 * (see featureFlags/flags.ts + featureFlags/__tests__/healthFlagsDefaultOff.test.ts),
 * so every exported function must stay side-effect-free and never attempt to
 * load @kingstinct/react-native-healthkit in this test run — activation
 * (native build + flag flip) is a separate, deliberately un-taken step.
 */
describe('appleHealth (dormant while healthkit_native_enabled is false)', () => {
  it('isAppleHealthSupported is false with the native flag off, regardless of platform', () => {
    expect(isAppleHealthSupported()).toBe(false);
  });

  it('requestAppleHealthPermissions resolves false without touching HealthKit', async () => {
    await expect(requestAppleHealthPermissions()).resolves.toBe(false);
  });

  it('fetchAppleHealthSnapshot resolves the all-null snapshot — never fabricates a value', async () => {
    // RC-2 Founder Ruling C regression lock: the new per-field
    // observedAt/latestObservedAtMs fields are OPTIONAL (undefined when
    // absent), which `toEqual` treats as equivalent to the key being
    // missing entirely — so this fixture intentionally stays 4 keys, not 9,
    // and still proves the dormant path fabricates nothing.
    await expect(fetchAppleHealthSnapshot()).resolves.toEqual({
      restingHeartRate: null,
      hrvSdnn: null,
      stepsToday: null,
      sleepHoursLastNight: null,
    });
  });
});

describe('toEpochMsOrNull', () => {
  it('parses an ISO date string to epoch ms', () => {
    expect(toEpochMsOrNull('2026-08-05T09:00:00.000Z')).toBe(Date.parse('2026-08-05T09:00:00.000Z'));
  });

  it('parses a Date object to epoch ms', () => {
    const d = new Date('2026-08-05T09:00:00.000Z');
    expect(toEpochMsOrNull(d)).toBe(d.getTime());
  });

  it('parses a raw epoch-ms number through unchanged', () => {
    expect(toEpochMsOrNull(1_700_000_000_000)).toBe(1_700_000_000_000);
  });

  it('returns null for null/undefined — never fabricates a timestamp', () => {
    expect(toEpochMsOrNull(null)).toBeNull();
    expect(toEpochMsOrNull(undefined)).toBeNull();
  });

  it('returns null for an unparseable value rather than throwing or returning NaN', () => {
    expect(toEpochMsOrNull('not a date')).toBeNull();
    expect(toEpochMsOrNull({})).toBeNull();
  });
});
