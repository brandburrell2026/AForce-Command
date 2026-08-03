import { describe, it, expect } from 'vitest';
import type { CanonicalHealthMetricType } from '@workspace/health-core';
import {
  buildHealthConnectPermissions,
  resolvePermissionGrant,
  HEALTH_CONNECT_READ_PERMISSION_BY_METRIC,
} from '../permissions';

describe('buildHealthConnectPermissions', () => {
  it('maps our full supported metric set to distinct Health Connect READ permissions', () => {
    const metricTypes: CanonicalHealthMetricType[] = [
      'sleep_session',
      'resting_heart_rate',
      'hrv',
      'heart_rate_summary',
      'workout',
      'steps',
      'active_energy',
      'respiratory_rate',
    ];
    const result = buildHealthConnectPermissions(metricTypes);
    expect(result.unsupported).toEqual([]);
    expect(result.permissions).toEqual([
      'android.permission.health.READ_SLEEP',
      'android.permission.health.READ_RESTING_HEART_RATE',
      'android.permission.health.READ_HEART_RATE_VARIABILITY',
      'android.permission.health.READ_HEART_RATE',
      'android.permission.health.READ_EXERCISE',
      'android.permission.health.READ_STEPS',
      'android.permission.health.READ_ACTIVE_CALORIES_BURNED',
      'android.permission.health.READ_RESPIRATORY_RATE',
    ]);
    // Every mapped permission is a real READ_ string, one per metric.
    expect(new Set(result.permissions).size).toBe(metricTypes.length);
  });

  it('reports provider_score as unsupported rather than guessing a permission', () => {
    const result = buildHealthConnectPermissions(['provider_score']);
    expect(result.permissions).toEqual([]);
    expect(result.unsupported).toEqual(['provider_score']);
  });

  it('dedupes repeated metric types into one permission string', () => {
    const result = buildHealthConnectPermissions(['steps', 'steps', 'active_energy']);
    expect(result.permissions).toEqual([
      'android.permission.health.READ_STEPS',
      'android.permission.health.READ_ACTIVE_CALORIES_BURNED',
    ]);
  });

  it('the permission map never includes provider_score', () => {
    expect(HEALTH_CONNECT_READ_PERMISSION_BY_METRIC.provider_score).toBeUndefined();
  });
});

describe('resolvePermissionGrant — Health Connect partial-grant honesty', () => {
  it('splits requested permissions into granted/denied with indeterminate always empty', () => {
    const requested = [
      'android.permission.health.READ_SLEEP',
      'android.permission.health.READ_STEPS',
      'android.permission.health.READ_HEART_RATE_VARIABILITY',
    ] as const;
    const granted = ['android.permission.health.READ_SLEEP'] as const;

    const result = resolvePermissionGrant(requested, granted);
    expect(result.granted).toEqual(['android.permission.health.READ_SLEEP']);
    expect(result.denied).toEqual([
      'android.permission.health.READ_STEPS',
      'android.permission.health.READ_HEART_RATE_VARIABILITY',
    ]);
    // The defining difference from the Apple/HealthKit lane: HC grants are
    // explicit, so nothing is ever ambiguous.
    expect(result.indeterminate).toEqual([]);
  });

  it('a full grant leaves denied empty; a full denial leaves granted empty — both still indeterminate: []', () => {
    const requested = ['android.permission.health.READ_STEPS'] as const;

    const fullGrant = resolvePermissionGrant(requested, requested);
    expect(fullGrant).toEqual({ granted: [...requested], denied: [], indeterminate: [] });

    const fullDenial = resolvePermissionGrant(requested, []);
    expect(fullDenial).toEqual({ granted: [], denied: [...requested], indeterminate: [] });
  });
});
