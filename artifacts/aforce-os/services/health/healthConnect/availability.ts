/**
 * artifacts/aforce-os/services/health/healthConnect/availability.ts
 *
 * Pure resolver: Health Connect SDK status → user-facing availability +
 * required action. No native call, no I/O — H2's adapter calls the real
 * `getSdkStatus()` and passes the result straight through.
 *
 * Distribution model this encodes (Android Health Connect):
 *   - API 34+ (Android 14+): Health Connect ships as a Project Mainline
 *     (APEX) module BUILT INTO the OS — there is no separate app to install.
 *     `SDK_UNAVAILABLE` here means the OEM disabled or stripped it —
 *     unsupported_platform, not a fixable prompt. `SDK_UNAVAILABLE_PROVIDER_
 *     UPDATE_REQUIRED` on this tier means the on-device module is stale;
 *     the fix is a Google Play system update (Settings › System › System
 *     update), delivered the same way as any other mainline module — NOT
 *     a Play Store app page, which doesn't exist for this tier. That's
 *     `userAction: 'system_update'`, distinct from `'install_update'`.
 *   - API 28–33 (Android 9–13): Health Connect ships as an updatable
 *     Play Store app. `SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED` and
 *     `SDK_UNAVAILABLE` both resolve to the same fixable action here — the
 *     SDK does not distinguish "never installed" from "needs an update" in
 *     a way this pure function can see; only a real package-manager check
 *     (H2's job) could split those two, and the user action is identical
 *     either way (open the Play Store install/update flow ⇒
 *     `userAction: 'install_update'`).
 *   - Below API 28: Health Connect does not exist on this OS at all.
 */

import type { HealthConnectAvailability, HealthConnectSdkStatus } from './types';

export type HealthConnectUserAction =
  | 'install_update'
  | 'system_update'
  | 'none'
  | 'unsupported_platform'
  | 'retry';

/**
 * `'retry'` is never produced by `resolveHealthConnectAvailability` itself —
 * this function only ever sees an sdkStatus HC actually returned, which by
 * construction is always one of the three legitimate statuses handled below.
 * It exists for `sync.ts`'s `getSdkStatus()` call site: when that call
 * THROWS (native bridge crash, transport failure, process died mid-call),
 * that is NOT Health Connect telling us it's unavailable — it's us failing
 * to even ask. Reporting `'unsupported_platform'` there (the pre-fix
 * behavior) fabricated "this device doesn't support Health Connect," which
 * is a permanent, non-actionable claim the caller had no evidence for and
 * which would incorrectly steer a user away from a device that may support
 * Health Connect perfectly well. `'retry'` says only what's actually known:
 * the check itself failed and trying again is the honest next step — as
 * opposed to `'temporarily_unavailable'` (rejected: that phrasing implies a
 * confirmed state, whereas nothing was confirmed) or a fabricated permanent
 * status. See `sync.ts`'s `getSdkStatus()` catch block, the only call site
 * that ever emits this value.
 */

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

  // Builtin tier only applies when we KNOW the level is 34+; an unknown
  // level gets the benefit of the doubt and is treated as the installable
  // (pre-34) tier, same as the SDK_UNAVAILABLE branch below.
  const isBuiltinTier = androidApiLevel != null && androidApiLevel >= HEALTH_CONNECT_BUILTIN_API_LEVEL;

  if (sdkStatus === 'SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED') {
    return isBuiltinTier
      ? { availability: 'needs_update', userAction: 'system_update' }
      : { availability: 'needs_update', userAction: 'install_update' };
  }

  // sdkStatus === 'SDK_UNAVAILABLE'
  if (isBuiltinTier) {
    return { availability: 'unavailable', userAction: 'unsupported_platform' };
  }
  // API 28–33, or API level unknown (benefit of the doubt): the fixable case.
  return { availability: 'needs_update', userAction: 'install_update' };
}
