/**
 * artifacts/aforce-os/services/health/healthConnect/permissions.ts
 *
 * Permission-string builder for our CanonicalHealthMetricType set, plus
 * partial-grant resolution.
 *
 * HONESTY DIFFERENCE FROM THE APPLE LANE: Health Connect grants are
 * EXPLICIT and individually queryable (`getGrantedPermissions()` returns
 * exactly what's authorized). A requested permission that isn't in the
 * granted set is DEFINITIVELY denied — there is no ambiguous case the way
 * there is with HealthKit, where read authorization is intentionally
 * unobservable and a "denied" read looks identical to "no data yet"
 * (hence the Apple lane needing an honest `indeterminate` bucket). This
 * resolver keeps the same three-bucket shape for interface symmetry with
 * that lane, but `indeterminate` is provably always empty here — asserted
 * in tests, not just documented.
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
  /** Always empty for Health Connect — see file header. Kept for interface symmetry with the Apple lane. */
  indeterminate: HealthConnectPermissionString[];
}

/**
 * Resolve what a permission request actually got. Health Connect's grant
 * set is authoritative and explicit, so every requested permission lands
 * in exactly one of `granted` / `denied` — never `indeterminate`.
 */
export function resolvePermissionGrant(
  requested: readonly HealthConnectPermissionString[],
  granted: readonly HealthConnectPermissionString[],
): PermissionGrantResolution {
  const grantedSet = new Set(granted);
  const result: PermissionGrantResolution = { granted: [], denied: [], indeterminate: [] };

  for (const permission of requested) {
    if (grantedSet.has(permission)) {
      result.granted.push(permission);
    } else {
      result.denied.push(permission);
    }
  }

  return result;
}
