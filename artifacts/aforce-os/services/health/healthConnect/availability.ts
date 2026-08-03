/**
 * artifacts/aforce-os/services/health/healthConnect/availability.ts
 *
 * Pure resolver: Health Connect SDK status → user-facing availability +
 * required action. No native call, no I/O — H2's adapter calls the real
 * `getSdkStatus()` and passes the result straight through.
 *
 * Distribution model this encodes (Android Health Connect):
 *   - API 34+ (Android 14+): Health Connect is BUILT INTO the OS. There is
 *     nothing to install. `SDK_UNAVAILABLE` here means the OEM disabled or
 *     stripped it — unsupported_platform, not a fixable install prompt.
 *   - API 28–33 (Android 9–13): Health Connect ships as an updatable
 *     Play Store app. `SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED` and
 *     `SDK_UNAVAILABLE` both resolve to the same fixable action here — the
 *     SDK does not distinguish "never installed" from "needs an update" in
 *     a way this pure function can see; only a real package-manager check
 *     (H2's job) could split those two, and the user action is identical
 *     either way (open the install/update flow).
 *   - Below API 28: Health Connect does not exist on this OS at all.
 */

import type { HealthConnectAvailability, HealthConnectSdkStatus } from './types';

export type HealthConnectUserAction = 'install_update' | 'none' | 'unsupported_platform';

export interface HealthConnectAvailabilityResult {
  availability: HealthConnectAvailability;
  userAction: HealthConnectUserAction;
}

const HEALTH_CONNECT_MIN_API_LEVEL = 28; // Android 9
const HEALTH_CONNECT_BUILTIN_API_LEVEL = 34; // Android 14

export function resolveHealthConnectAvailability(
  sdkStatus: HealthConnectSdkStatus,
  platform: 'android' | 'ios',
  androidApiLevel?: number,
): HealthConnectAvailabilityResult {
  if (platform !== 'android') {
    return { availability: 'unavailable', userAction: 'unsupported_platform' };
  }

  if (androidApiLevel != null && androidApiLevel < HEALTH_CONNECT_MIN_API_LEVEL) {
    return { availability: 'unavailable', userAction: 'unsupported_platform' };
  }

  if (sdkStatus === 'SDK_AVAILABLE') {
    return { availability: 'available', userAction: 'none' };
  }

  if (sdkStatus === 'SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED') {
    return { availability: 'needs_update', userAction: 'install_update' };
  }

  // sdkStatus === 'SDK_UNAVAILABLE'
  if (androidApiLevel != null && androidApiLevel >= HEALTH_CONNECT_BUILTIN_API_LEVEL) {
    return { availability: 'unavailable', userAction: 'unsupported_platform' };
  }
  // API 28–33, or API level unknown (benefit of the doubt): the fixable case.
  return { availability: 'needs_update', userAction: 'install_update' };
}
