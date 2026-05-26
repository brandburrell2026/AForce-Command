import { describe, it, expect } from 'vitest';

import {
  isSamsungHealthSupported,
  fetchSamsungHealthSnapshot,
  toProviderSnapshot,
} from '../samsungHealth';

describe('samsungHealth', () => {
  it('isSamsungHealthSupported is false on non-Android', () => {
    expect(isSamsungHealthSupported()).toBe(false);
  });

  it('fetchSamsungHealthSnapshot returns the all-null snapshot when SDK unavailable', async () => {
    const snap = await fetchSamsungHealthSnapshot();
    expect(snap).toEqual({
      restingHeartRate: null,
      stepsToday: null,
      workoutMinutesToday: null,
      sleepHoursLastNight: null,
    });
  });

  it('toProviderSnapshot tags with the samsung_health provider id', () => {
    const lifted = toProviderSnapshot(
      { restingHeartRate: 58, stepsToday: 8200, workoutMinutesToday: 45, sleepHoursLastNight: 7.6 },
      1700000000000,
    );
    expect(lifted).toEqual({
      providerId: 'samsung_health',
      restingHeartRate: 58,
      stepsToday: 8200,
      workoutMinutesToday: 45,
      sleepHoursLastNight: 7.6,
      fetchedAt: 1700000000000,
    });
  });
});
