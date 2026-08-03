import { describe, it, expect } from 'vitest';

import {
  isAppleHealthSupported,
  requestAppleHealthPermissions,
  fetchAppleHealthSnapshot,
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
    await expect(fetchAppleHealthSnapshot()).resolves.toEqual({
      restingHeartRate: null,
      hrvSdnn: null,
      stepsToday: null,
      sleepHoursLastNight: null,
    });
  });
});
