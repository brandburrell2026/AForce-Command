/**
 * artifacts/aforce-os/services/health/healthConnect/permissions.ts
 *
 * Permission-string builder for our CanonicalHealthMetricType set, plus
 * partial-grant resolution.
 *
 * HONESTY DIFFERENCE FROM THE APPLE LANE: Health Connect grants are
 * EXPLICIT and individually queryable (`getGrantedPermissions()` returns
 * exactly what's authorized) — ONCE the app has actually asked. That's a
 * different ambiguity than HealthKit's: HealthKit can never observe read
 * grant/deny for ANY request, ever (its `indeterminate` bucket, see
 * appleHealthRecords.ts, is permanent and per-API). Health Connect has no
 * such permanent unobservable case — but it has a temporal one: a metric
 * type this app has never sent through `requestPermission()` yet (fresh
 * install, connect flow not run) is absent from `getGrantedPermissions()`
 * for exactly the same reason a truly-denied one would be. Treating that
 * absence as `denied` would falsely claim the user refused something they
 * were never asked about. `resolvePermissionGrant` takes an explicit
 * `hasRequested` flag from the caller (did we actually call
 * `requestPermission()` for this set, ever) so a never-asked permission
 * lands in `notRequested`, not `denied`. Once `hasRequested` is true, every
 * requested permission is definitively `granted` or `denied` — Health
 * Connect's grant set really is authoritative at that point, so
 * `notRequested` is provably empty on that path, asserted in tests.
 */

import type { CanonicalHealthMetricType } from '@workspace/health-core';
import type { HealthConnectPermissionString } from './types';

/**
 * CanonicalHealthMetricType → Health Connect READ permission string.
 * 'provider_score' has no Health Connect equivalent (Health Connect has no
 * concept of a provider-attributed wellness score) — it is intentionally
 * absent, not mapped to a guess.
 */
export const HEALTH_CONNECT_READ_PERMISSION_BY_METRIC: Partial<
  Record<CanonicalHealthMetricType, HealthConnectPermissionString>
> = {
  sleep_session: 'android.permission.health.READ_SLEEP',
  resting_heart_rate: 'android.permission.health.READ_RESTING_HEART_RATE',
  hrv: 'android.permission.health.READ_HEART_RATE_VARIABILITY',
  heart_rate_summary: 'android.permission.health.READ_HEART_RATE',
  workout: 'android.permission.health.READ_EXERCISE',
  steps: 'android.permission.health.READ_STEPS',
  active_energy: 'android.permission.health.READ_ACTIVE_CALORIES_BURNED',
  respiratory_rate: 'android.permission.health.READ_RESPIRATORY_RATE',
};

export interface BuildPermissionsResult {
  permissions: HealthConnectPermissionString[];
  /** Requested metric types with no Health Connect permission mapping. */
  unsupported: CanonicalHealthMetricType[];
}

/**
 * Build the deduplicated, stably-ordered permission-string set for a
 * requested metric-type set. Unsupported metric types (currently just
 * 'provider_score') are reported back rather than silently dropped, so
 * callers can decide how to represent that to the user instead of the
 * request quietly asking for less than they think it is.
 */
export function buildHealthConnectPermissions(
  metricTypes: readonly CanonicalHealthMetricType[],
): BuildPermissionsResult {
  const permissions: HealthConnectPermissionString[] = [];
  const unsupported: CanonicalHealthMetricType[] = [];
  const seen = new Set<HealthConnectPermissionString>();

  for (const metricType of metricTypes) {
    const permission = HEALTH_CONNECT_READ_PERMISSION_BY_METRIC[metricType];
    if (!permission) {
      unsupported.push(metricType);
      continue;
    }
    if (!seen.has(permission)) {
      seen.add(permission);
      permissions.push(permission);
    }
  }

  return { permissions, unsupported };
}

// ─── Partial-grant resolution ─────────────────────────────────────────────────

export interface PermissionGrantResolution {
  granted: HealthConnectPermissionString[];
  denied: HealthConnectPermissionString[];
  /**
   * Requested permissions this app has never actually sent through
   * `requestPermission()` — see `hasRequested` below. Provably empty
   * whenever `hasRequested` is true (asserted in tests). This is NOT the
   * Apple lane's `indeterminate` — that's a permanent per-API
   * unobservability; this bucket empties the instant the request flow
   * actually runs.
   */
  notRequested: HealthConnectPermissionString[];
}

/**
 * Resolve what a permission request actually got.
 *
 * `hasRequested` is caller-supplied provenance: has this app EVER called
 * `requestPermission()` for this metric-type set? If not, none of these
 * permissions can honestly be called `denied` — the user was never asked,
 * so nothing was refused, and every entry lands in `notRequested`. Once
 * `hasRequested` is true, Health Connect's grant set is authoritative and
 * explicit, so every requested permission lands in exactly one of
 * `granted` / `denied` — never `notRequested`.
 */
export function resolvePermissionGrant(
  requested: readonly HealthConnectPermissionString[],
  granted: readonly HealthConnectPermissionString[],
  hasRequested: boolean,
): PermissionGrantResolution {
  if (!hasRequested) {
    return { granted: [], denied: [], notRequested: [...requested] };
  }

  const grantedSet = new Set(granted);
  const result: PermissionGrantResolution = { granted: [], denied: [], notRequested: [] };

  for (const permission of requested) {
    if (grantedSet.has(permission)) {
      result.granted.push(permission);
    } else {
      result.denied.push(permission);
    }
  }

  return result;
}
