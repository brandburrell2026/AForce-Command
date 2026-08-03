/**
 * healthSignalsFromStore — adapter unit tests.
 *
 * Scope (W3.2): this file tests the MAPPING (store shape → the frozen
 * `ResolveHealthSignalsInput` contract → the legacy-shaped scalar
 * projection). It deliberately does NOT re-assert `resolveHealthSignals`'s
 * own resolution behavior — that is `__tests__/signalResolution.test.ts`'s
 * job. What it does assert:
 *   1. the store → input mapping is exactly what the file header promises
 *      (records undefined, activeDirectProviders empty, connections
 *      undefined — biometrics-only, honestly documented rather than guessed);
 *   2. `healthSignalsFromStore` really does delegate to the frozen resolver
 *      (spot-checked against the same numbers `signalResolutionFixtures`'s
 *      `APPLE_ONLY` fixture proves in `signalResolution.test.ts`);
 *   3. `canonicalReadinessSignals`'s scalar projection (available → value,
 *      unavailable → null, workout minutes summed within one winning
 *      source — never across providers);
 *   4. stale/expired data does NOT feed through as if it were live — the
 *      canonical path honestly returns null past the §53 freshness
 *      contract's expiry window, unlike the ungated legacy selectors.
 */
import { describe, it, expect } from 'vitest';
import type { ProviderBiometrics } from '@/types/biometrics';
import {
  selectFreshestHrvMs,
  selectMaxWorkoutMinutes,
} from '@/services/metabolicReadinessService';
import {
  buildResolveHealthSignalsInput,
  healthSignalsFromStore,
  canonicalReadinessSignals,
} from '../healthSignalsFromStore';
import type { HealthSignals } from '../signalResolution';
import { APPLE_ONLY, FIXED_NOW, HOUR } from '../signalResolutionFixtures';

describe('buildResolveHealthSignalsInput', () => {
  it('maps biometrics + nowMs verbatim and stays biometrics-only (records/connections undefined, empty direct-provider set)', () => {
    const input = buildResolveHealthSignalsInput({
      biometrics: APPLE_ONLY.biometrics,
      nowMs: FIXED_NOW,
    });
    expect(input.biometrics).toBe(APPLE_ONLY.biometrics);
    expect(input.nowMs).toBe(FIXED_NOW);
    expect(input.records).toBeUndefined();
    expect(input.connections).toBeUndefined();
    expect(input.activeDirectProviders.size).toBe(0);
  });

  it('passes undefined biometrics through untouched (no fabricated shape for "no data")', () => {
    const input = buildResolveHealthSignalsInput({ biometrics: undefined, nowMs: FIXED_NOW });
    expect(input.biometrics).toBeUndefined();
  });
});

describe('healthSignalsFromStore', () => {
  it('delegates to the frozen resolveHealthSignals contract (Apple-only snapshot plane)', () => {
    const out = healthSignalsFromStore({ biometrics: APPLE_ONLY.biometrics, nowMs: FIXED_NOW });
    expect(out.sleepDuration.available).toBe(true);
    if (out.sleepDuration.available) expect(out.sleepDuration.value.totalSleepHours).toBe(7.2);

    expect(out.hrv.available).toBe(true);
    if (out.hrv.available) expect(out.hrv.value).toEqual({ valueMs: 42, method: 'sdnn' });

    expect(out.workouts.available).toBe(true);
    if (out.workouts.available) {
      expect(out.workouts.value).toEqual([
        expect.objectContaining({ activityKind: 'unspecified', durationMin: 35, source: 'apple_health' }),
      ]);
    }
  });

  it('reports honest no_provider absence when nothing is connected', () => {
    const out = healthSignalsFromStore({ biometrics: undefined, nowMs: FIXED_NOW });
    expect(out.sleepDuration).toEqual({ available: false, reason: 'no_provider' });
    expect(out.hrv).toEqual({ available: false, reason: 'no_provider' });
    expect(out.workouts).toEqual({ available: false, reason: 'no_provider' });
  });
});

describe('canonicalReadinessSignals', () => {
  it('projects an available signal to its scalar value', () => {
    const signals = healthSignalsFromStore({ biometrics: APPLE_ONLY.biometrics, nowMs: FIXED_NOW });
    const projected = canonicalReadinessSignals(signals);
    expect(projected).toEqual({ sleepHours: 7.2, hrvMs: 42, workoutMinutes: 35 });
  });

  it('projects an unavailable signal to null (never a fabricated 0 or placeholder)', () => {
    const signals = healthSignalsFromStore({ biometrics: undefined, nowMs: FIXED_NOW });
    expect(canonicalReadinessSignals(signals)).toEqual({
      sleepHours: null,
      hrvMs: null,
      workoutMinutes: null,
    });
  });

  it('sums workout minutes WITHIN the one already-selected winning source, never across providers', () => {
    // Hand-built HealthSignals — this is testing the projection helper in
    // isolation from the resolver, so a same-origin multi-entry array
    // (the record-plane shape resolveWorkouts can return) is enough; no
    // second provider ever appears in one `workouts.value` array by
    // construction of resolveWorkouts (see signalResolution.ts).
    const signals: HealthSignals = {
      sleepDuration: { available: false, reason: 'no_provider' },
      restingHeartRate: { available: false, reason: 'no_provider' },
      hrv: { available: false, reason: 'no_provider' },
      steps: { available: false, reason: 'no_provider' },
      providerScores: [],
      workouts: {
        available: true,
        value: [
          {
            activityKind: 'run',
            durationMin: 30,
            activeEnergyKcal: null,
            avgHeartRateBpm: null,
            source: 'whoop',
            observedAtMs: FIXED_NOW - 1 * HOUR,
          },
          {
            activityKind: 'lift',
            durationMin: 45,
            activeEnergyKcal: null,
            avgHeartRateBpm: null,
            source: 'whoop',
            observedAtMs: FIXED_NOW - 5 * HOUR,
          },
        ],
        unit: 'entries',
        source: 'whoop',
        observedAtMs: FIXED_NOW - 1 * HOUR,
        freshness: 'fresh',
        confidence: 'high',
      },
    };
    expect(canonicalReadinessSignals(signals).workoutMinutes).toBe(75);
  });
});

describe('stale/expired honesty (freshness gating already lives in resolveHealthSignals)', () => {
  // Beyond the §53 wearable_sync 72h expiry window (config/hydroStateModel.ts) —
  // hrv + workout both key off 'wearable_sync'. Sleep has no expireAfterMs
  // (only a 36h staleAfterMs), so it stays available-but-stale, not unavailable
  // — an intentional, documented asymmetry in the frozen contract, not a bug
  // here.
  const EXPIRED_BIOMETRICS: ProviderBiometrics = {
    apple_health: {
      providerId: 'apple_health',
      fetchedAt: FIXED_NOW - 100 * HOUR,
      sleepHoursLastNight: 7.2,
      hrvSdnnMs: 42,
      // Legacy selectors (`selectFreshestHrvMs`) only ever read the
      // deprecated `hrvSdnn` field, never the canonical `hrvSdnnMs` — set
      // both so this fixture exercises each selector's real read path.
      hrvSdnn: 42,
      workoutMinutesToday: 35,
    },
  };

  it('canonical (flag ON path) excludes expired hrv/workout signals rather than feeding stale data as live', () => {
    const signals = healthSignalsFromStore({ biometrics: EXPIRED_BIOMETRICS, nowMs: FIXED_NOW });
    expect(signals.hrv).toEqual({ available: false, reason: 'stale_expired' });
    expect(signals.workouts).toEqual({ available: false, reason: 'stale_expired' });

    const projected = canonicalReadinessSignals(signals);
    expect(projected.hrvMs).toBeNull();
    expect(projected.workoutMinutes).toBeNull();
  });

  it('contrasts with the ungated legacy selectors, which have no expiry cutoff at all', () => {
    // Same expired snapshot: the pre-existing legacy selectors (flag OFF path,
    // unchanged by this PR) have no freshness gate and would happily surface
    // the 100h-old reading as if it were current.
    expect(selectFreshestHrvMs(EXPIRED_BIOMETRICS)).toBe(42);
    expect(selectMaxWorkoutMinutes(EXPIRED_BIOMETRICS)).toBe(35);
  });

  it('sleep (no expiry window) stays available but is honestly flagged stale, not silently treated as fresh', () => {
    const signals = healthSignalsFromStore({ biometrics: EXPIRED_BIOMETRICS, nowMs: FIXED_NOW });
    expect(signals.sleepDuration.available).toBe(true);
    if (signals.sleepDuration.available) {
      expect(signals.sleepDuration.freshness).toBe('stale');
    }
  });
});
