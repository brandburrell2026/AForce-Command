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
 *      canonical path honestly returns null past the §53 freshness contract's
 *      stale/expiry boundary (sleepHours, hrvMs/hrvMethod, workoutMinutes all
 *      covered), unlike the ungated legacy selectors. This closes the W3.5
 *      REQUEST-CHANGES governance finding: `canonicalReadinessSignals`
 *      previously gated only on `.available`, and because `sleep` has no
 *      `expireAfterMs` (config/hydroStateModel.ts §53), `available` never
 *      flips false for sleep — a months-old sleep snapshot scored as fresh.
 *      The fix reuses `readinessSignals.ts`'s exported `EMITTING_FRESHNESS`
 *      policy (fresh|aging) here — one constant, one policy;
 *   5. a non-finite (NaN) `durationMin` is skipped rather than propagating
 *      NaN through the workout-minutes sum (Should-fix, same review).
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
    // Apple-only fixture: HRV is true SDNN, so it projects (with method surfaced).
    expect(projected).toEqual({ sleepHours: 7.2, hrvMs: 42, hrvMethod: 'sdnn', workoutMinutes: 35 });
  });

  it('projects an unavailable signal to null (never a fabricated 0 or placeholder)', () => {
    const signals = healthSignalsFromStore({ biometrics: undefined, nowMs: FIXED_NOW });
    expect(canonicalReadinessSignals(signals)).toEqual({
      sleepHours: null,
      hrvMs: null,
      hrvMethod: null,
      workoutMinutes: null,
    });
  });

  it('BLOCKER regression: RMSSD is NEVER projected onto the SDNN-anchored readiness curve', () => {
    // WHOOP HRV is RMSSD — the canonical resolver reports it method-true.
    const signals = healthSignalsFromStore({
      biometrics: {
        whoop: { providerId: 'whoop', hrvSdnn: 58, sleepHoursLastNight: 7.0, fetchedAt: FIXED_NOW - 60_000 },
      },
      nowMs: FIXED_NOW,
    });
    expect(signals.hrv.available && signals.hrv.value.method).toBe('rmssd');
    const projected = canonicalReadinessSignals(signals);
    expect(projected.hrvMs).toBeNull();          // never scored on the SDNN curve
    expect(projected.hrvMethod).toBe('rmssd');   // but the method is surfaced honestly
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
  // (only a 36h staleAfterMs), so `resolveHealthSignals` reports it
  // available-but-stale, not unavailable — an intentional, documented
  // asymmetry in the frozen §53 contract, NOT a bug in `resolveHealthSignals`
  // itself. The bug this suite now guards against lived one layer up: before
  // this fix, `canonicalReadinessSignals` gated only on `.available`, so a
  // sleep reading of ANY age (months old — `available` never flips false for
  // sleep) flowed through as if current. `canonicalReadinessSignals` now
  // reuses `readinessSignals.ts`'s `EMITTING_FRESHNESS` policy (fresh|aging
  // only), so stale sleep nulls out here exactly like stale hrv/workouts do.
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

  it('sleep (no expiry window) stays available-but-stale at the resolveHealthSignals layer, but the wired projection now excludes it too', () => {
    const signals = healthSignalsFromStore({ biometrics: EXPIRED_BIOMETRICS, nowMs: FIXED_NOW });
    expect(signals.sleepDuration.available).toBe(true);
    if (signals.sleepDuration.available) {
      expect(signals.sleepDuration.freshness).toBe('stale');
    }

    // GOVERNANCE FIX (W3.5 REQUEST-CHANGES): this is the exact regression a
    // 180-day-old sleep snapshot exposed — `available` alone never gates
    // sleep to false, so without a freshness gate here this would have
    // returned 7.2 (stale data scoring as current). It must now be null.
    expect(canonicalReadinessSignals(signals).sleepHours).toBeNull();
  });

  it('a >36h-old sleep snapshot (past staleAfterMs, §53) yields sleepHours: null through the wired projection', () => {
    // 40h old: past the 36h staleAfterMs boundary but nowhere near an
    // "expired" reading — proves the gate fires on ordinary staleness, not
    // only on extreme age like the 100h fixture above.
    const STALE_SLEEP_ONLY: ProviderBiometrics = {
      apple_health: {
        providerId: 'apple_health',
        fetchedAt: FIXED_NOW - 40 * HOUR,
        sleepHoursLastNight: 6.5,
      },
    };
    const signals = healthSignalsFromStore({ biometrics: STALE_SLEEP_ONLY, nowMs: FIXED_NOW });
    expect(signals.sleepDuration.available).toBe(true);
    if (signals.sleepDuration.available) {
      expect(signals.sleepDuration.freshness).toBe('stale');
    }
    expect(canonicalReadinessSignals(signals).sleepHours).toBeNull();
  });

  it('a fresh (<12h) sleep snapshot still projects normally — the gate excludes stale data, not all data', () => {
    const FRESH_SLEEP_ONLY: ProviderBiometrics = {
      apple_health: {
        providerId: 'apple_health',
        fetchedAt: FIXED_NOW - 2 * HOUR,
        sleepHoursLastNight: 8.1,
      },
    };
    const signals = healthSignalsFromStore({ biometrics: FRESH_SLEEP_ONLY, nowMs: FIXED_NOW });
    expect(signals.sleepDuration.available).toBe(true);
    if (signals.sleepDuration.available) {
      expect(signals.sleepDuration.freshness).toBe('fresh');
    }
    expect(canonicalReadinessSignals(signals).sleepHours).toBe(8.1);
  });
});

describe('workoutMinutes NaN guard (Should-fix, W3.5 REQUEST-CHANGES condition 3)', () => {
  it('skips a non-finite durationMin instead of propagating NaN through the sum', () => {
    // Hand-built HealthSignals, same pattern as the "sums within one winning
    // source" test above — isolates the projection from the resolver.
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
            durationMin: Number.NaN,
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
            observedAtMs: FIXED_NOW - 2 * HOUR,
          },
        ],
        unit: 'entries',
        source: 'whoop',
        observedAtMs: FIXED_NOW - 1 * HOUR,
        freshness: 'fresh',
        confidence: 'high',
      },
    };
    // Before the fix: NaN + 45 = NaN. After: the NaN entry is skipped, 45 survives.
    expect(canonicalReadinessSignals(signals).workoutMinutes).toBe(45);
  });
});
