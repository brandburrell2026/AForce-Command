/**
 * SCORE-PROTECTION INVARIANTS — W3.5 deliverable.
 *
 * Proves, BEFORE any wiring lands, that feeding canonical health signals
 * through the `readinessSignals` adapter into the EXISTING (untouched) score
 * path can never violate the governance locks:
 *
 *   1. Provider connection alone moves the Hydration Score ONLY within the
 *      documented ±10 recovery contribution.
 *   2. The recovery delta stays clamped to ±10 under extreme canonical inputs
 *      (all providers maxed, both directions).
 *   3. Stale/expired canonical signals produce NO readiness influence through
 *      the `toReadinessBiometrics` ADAPTER (this file) — it emits nothing.
 *      The separately-wired `canonicalReadinessSignals` projection
 *      (`healthSignalsFromStore.ts`, consumed by `useMetabolicReadiness` /
 *      `usePerformanceAge` behind `health_canonical_consumers`) is its own
 *      surface with the same freshness policy; its stale/expired coverage
 *      lives in `__tests__/healthSignalsFromStore.test.ts`, not here.
 *   4. Duplicated provider records do not amplify anything.
 *   5. Unavailable data fails safe (empty adapter output, score identical to
 *      no-biometrics).
 *   6. Provider scores stay provider-attributed in evidence surfaces
 *      (commandEvidence's biometrics item remains direction:'context'; the
 *      adapter never re-homes a provider score).
 *
 * READ-ONLY discipline: `calculateScore`, `buildBreakdown`,
 * `computeRecoverySignal`, and `deriveCommandEvidence` are imported and
 * exercised — NEVER modified. No file under utils/scoring/, no
 * utils/scoringEngine.ts, no config/hydroStateModel.ts, no utils/statusColor.ts
 * was edited for this PR. The flag-gated wiring of `readinessSignals` into the
 * store path is a FOLLOW-UP requiring Governance-Architect sign-off
 * (`health_canonical_consumers` stays OFF); this suite is the proof that must
 * already be green before that follow-up can be proposed.
 *
 * RN-free: the only react-native import in the calculateScore graph is
 * i18nService — mocked exactly as utils/__tests__/commandEvidence.test.ts does.
 */

import { describe, it, expect, vi } from 'vitest';

vi.mock('../../i18nService', () => ({
  default: { t: (k: string) => k, language: 'en', changeLanguage: () => {} },
}));

import {
  buildDeduplicationKey,
  HEALTH_RECORD_SCHEMA_VERSION,
  type CanonicalHealthMetricType,
  type CanonicalHealthRecord,
  type CanonicalHealthValue,
  type HealthProviderId,
  type HrvMethod,
  type ProviderBiometrics,
  type ProviderSnapshot,
  type ProvenanceHop,
} from '@workspace/health-core';
import { resolveHealthSignals, type HealthSignals } from '../signalResolution';
import { toReadinessBiometrics, READINESS_SIGNALS_SCORE_PROTECTION } from '../readinessSignals';
// READ-ONLY imports from the governance-locked score path — exercised, never edited.
import { calculateScore } from '../../../utils/scoringEngine';
import { buildBreakdown, computeRecoverySignal } from '../../../utils/scoring/breakdown';
import { deriveCommandEvidence } from '../../../utils/scoring/commandEvidence';
import type { UserState } from '../../../types';

const MIN = 60_000;
const HOUR = 60 * MIN;
const NOW = new Date('2026-08-03T12:00:00Z').getTime();
const USER_ID = 'user-1';

/** Documented recovery-contribution bound (breakdown.ts's own ±10 clamp). */
const RECOVERY_BOUND = 10;

// ─── Builders ───────────────────────────────────────────────────────────────

function iso(ms: number): string {
  return new Date(ms).toISOString();
}

function mkSnapshot(
  o: Partial<ProviderSnapshot> & { providerId: HealthProviderId; fetchedAt: number },
): ProviderSnapshot {
  return { ...o };
}

interface MkRecordOverrides {
  provider: HealthProviderId;
  metricType: CanonicalHealthMetricType;
  value: CanonicalHealthValue;
  observedAtMs: number;
  provenanceChain?: ProvenanceHop[];
  hrvMethod?: HrvMethod;
  externalId?: string;
  syncedAtMs?: number;
}

function mkRecord(o: MkRecordOverrides): CanonicalHealthRecord {
  const provenanceChain: ProvenanceHop[] = o.provenanceChain ?? [
    { provider: o.provider, transport: 'measured' },
  ];
  const origin = provenanceChain[0].provider;
  const observedAt = iso(o.observedAtMs);
  return {
    schemaVersion: HEALTH_RECORD_SCHEMA_VERSION,
    userId: USER_ID,
    provider: o.provider,
    externalId: o.externalId,
    metricType: o.metricType,
    value: o.value,
    observedAt,
    syncedAt: iso(o.syncedAtMs ?? o.observedAtMs),
    hrvMethod: o.hrvMethod,
    provenanceChain,
    deduplicationKey: buildDeduplicationKey({
      userId: USER_ID,
      metricType: o.metricType,
      origin,
      externalId: o.externalId,
      observedAt,
    }),
  };
}

/**
 * Full UserState fixture (field set mirrors the proven-safe builder in
 * utils/__tests__/commandEvidence.test.ts). `lastIntakeTime` is pinned to NOW
 * so elapsed-time decay is exactly ZERO — with the clock removed, the ONLY
 * path from biometrics into the score is the recovery contribution, which is
 * precisely what these invariants must isolate. (The activity floor only
 * feeds the decay rate, and 0 minutes × any rate = 0.)
 */
function mkState(over: Record<string, unknown> = {}): UserState {
  return {
    unitsConsumedToday: 0,
    ozConsumedToday: 48,
    aforceUnitsToday: 0,
    lastIntakeTime: new Date(NOW),
    lastIntakeType: 'water',
    symptomState: 'none',
    symptoms: [],
    urineSignal: 3,
    energyState: 'steady',
    heatLoad: 4,
    sweatRate: 3,
    activityLevel: 5,
    complianceStreak: 2,
    dailyTarget: 8,
    ozTarget: 96,
    isSnoozed: false,
    snoozeUntil: null,
    bodyWeightLbs: 180,
    isAwake: true,
    wakeTime: null,
    overnightLossOz: 0,
    hasSeenMorningCommand: false,
    weatherTempC: null,
    weatherHumidity: null,
    weatherCity: null,
    weatherFetchedAt: null,
    language: 'en',
    intakeEvents: [],
    clutchActive: false,
    ...over,
  } as unknown as UserState;
}

function deepFreeze<T>(o: T): T {
  if (o && typeof o === 'object' && !Object.isFrozen(o)) {
    Object.values(o as Record<string, unknown>).forEach((v) => deepFreeze(v));
    Object.freeze(o);
  }
  return o;
}

function resolveAndAdapt(
  biometrics: ProviderBiometrics | undefined,
  extra: Partial<Parameters<typeof resolveHealthSignals>[0]> = {},
): ProviderBiometrics {
  const signals = resolveHealthSignals({
    biometrics,
    activeDirectProviders: new Set<HealthProviderId>(),
    nowMs: NOW,
    ...extra,
  });
  // Freeze the adapter output before handing it to consumers — proves the
  // untouched score path treats it as read-only data.
  return deepFreeze(toReadinessBiometrics(signals));
}

const scoreOf = (state: UserState): number => calculateScore(state, NOW).score;

// A rich, fresh, single-provider connection (direct WHOOP, synced 1h ago).
const WHOOP_FRESH: ProviderBiometrics = {
  whoop: mkSnapshot({
    providerId: 'whoop',
    fetchedAt: NOW - 1 * HOUR,
    restingHeartRate: 48,
    hrvSdnn: 65, // legacy wire field — WHOOP populates it with RMSSD values
    sleepHoursLastNight: 8,
    recoveryPct: 95,
    strain: 5,
  }),
};

// ─── 1. Score unchanged by provider connection alone (±10 bound) ────────────

describe('invariant 1 — provider connection alone moves the score only within ±10', () => {
  it('with vs without a fresh provider, the score differs only by the recovery contribution', () => {
    const baseline = mkState();
    const bio = resolveAndAdapt(WHOOP_FRESH, { activeDirectProviders: new Set(['whoop']) });
    const connected = mkState({ biometrics: bio });

    const s0 = scoreOf(baseline);
    const s1 = scoreOf(connected);

    // Bounded by the documented ±10 recovery contribution — nothing else moves.
    expect(Math.abs(s1 - s0)).toBeLessThanOrEqual(RECOVERY_BOUND);

    // And the difference IS exactly the recovery contribution (read-only probes).
    const recovery = computeRecoverySignal(connected);
    expect(s1 - s0).toBe(recovery.delta);
    const contribution = buildBreakdown(connected, NOW).contributions.find(
      (c) => c.id === 'health_signals',
    );
    expect(contribution?.delta).toBe(recovery.delta);
    expect(contribution?.maxMagnitude).toBe(RECOVERY_BOUND);
  });

  it('every other contribution row is identical with and without the provider', () => {
    const without = buildBreakdown(mkState(), NOW).contributions;
    const bio = resolveAndAdapt(WHOOP_FRESH, { activeDirectProviders: new Set(['whoop']) });
    const withBio = buildBreakdown(mkState({ biometrics: bio }), NOW).contributions;
    for (const row of without) {
      if (row.id === 'health_signals') continue;
      expect(withBio.find((c) => c.id === row.id)?.delta).toBe(row.delta);
    }
  });
});

// ─── 2. Recovery delta clamped ±10 under extreme canonical inputs ───────────

const ALL_PROVIDERS_WORST: ProviderBiometrics = {
  whoop: mkSnapshot({
    providerId: 'whoop',
    fetchedAt: NOW - 1 * HOUR,
    hrvSdnn: 12,
    sleepHoursLastNight: 2.5,
    recoveryPct: 5,
    strain: 21,
    restingHeartRate: 80,
  }),
  oura: mkSnapshot({ providerId: 'oura', fetchedAt: NOW - 1 * HOUR, readinessScore: 10 }),
  garmin: mkSnapshot({ providerId: 'garmin', fetchedAt: NOW - 1 * HOUR, stressScore: 95 }),
  strava: mkSnapshot({ providerId: 'strava', fetchedAt: NOW - 1 * HOUR, trainingLoad: 200 }),
  apple_health: mkSnapshot({ providerId: 'apple_health', fetchedAt: NOW - 1 * HOUR, stepsToday: 30_000 }),
};

const ALL_PROVIDERS_BEST: ProviderBiometrics = {
  whoop: mkSnapshot({
    providerId: 'whoop',
    fetchedAt: NOW - 1 * HOUR,
    hrvSdnn: 80,
    sleepHoursLastNight: 8,
    recoveryPct: 95,
    strain: 21,
    restingHeartRate: 42,
  }),
  oura: mkSnapshot({ providerId: 'oura', fetchedAt: NOW - 1 * HOUR, readinessScore: 95 }),
  garmin: mkSnapshot({ providerId: 'garmin', fetchedAt: NOW - 1 * HOUR, stressScore: 5 }),
  strava: mkSnapshot({ providerId: 'strava', fetchedAt: NOW - 1 * HOUR, trainingLoad: 200 }),
  apple_health: mkSnapshot({ providerId: 'apple_health', fetchedAt: NOW - 1 * HOUR, stepsToday: 30_000 }),
};

describe('invariant 2 — recovery delta clamped to ±10 under extreme canonical inputs', () => {
  it.each([
    ['all providers worst-case', ALL_PROVIDERS_WORST, -RECOVERY_BOUND],
    ['all providers best-case', ALL_PROVIDERS_BEST, RECOVERY_BOUND],
  ])('%s → delta pinned at the clamp, score moves by exactly that', (_name, raw, expected) => {
    const bio = resolveAndAdapt(raw, {
      activeDirectProviders: new Set<HealthProviderId>(['whoop', 'oura', 'garmin', 'strava']),
    });
    const connected = mkState({ biometrics: bio });

    const recovery = computeRecoverySignal(connected);
    expect(recovery.delta).toBe(expected);
    expect(Math.abs(recovery.delta)).toBeLessThanOrEqual(RECOVERY_BOUND);

    const diff = scoreOf(connected) - scoreOf(mkState());
    expect(diff).toBe(expected);
  });
});

// ─── 3. Stale / expired signals → no readiness influence ────────────────────

describe('invariant 3 — stale/expired canonical signals produce no readiness influence', () => {
  it.each([
    // 40h: wearable_sync is STALE (24–72h) and sleep is STALE (>36h, never expires).
    ['stale (40h old)', 40 * HOUR],
    // 80h: wearable_sync is EXPIRED (>72h); sleep is stale.
    ['expired (80h old)', 80 * HOUR],
  ])('%s → adapter emits nothing and the score is untouched', (_name, ageMs) => {
    const aged: ProviderBiometrics = {
      whoop: mkSnapshot({
        providerId: 'whoop',
        fetchedAt: NOW - ageMs,
        restingHeartRate: 48,
        hrvSdnn: 65,
        sleepHoursLastNight: 8,
        recoveryPct: 95,
        strain: 5,
      }),
    };
    const bio = resolveAndAdapt(aged, { activeDirectProviders: new Set(['whoop']) });
    expect(Object.keys(bio)).toHaveLength(0);
    expect(scoreOf(mkState({ biometrics: bio }))).toBe(scoreOf(mkState()));
  });
});

// ─── 4. Duplicated provider records do not amplify ──────────────────────────

describe('invariant 4 — duplicated provider records do not amplify', () => {
  const steps1 = () =>
    mkRecord({ provider: 'whoop', metricType: 'steps', value: 3000, observedAtMs: NOW - 2 * HOUR, externalId: 's1' });
  const steps2 = () =>
    mkRecord({ provider: 'whoop', metricType: 'steps', value: 4000, observedAtMs: NOW - 1 * HOUR, externalId: 's2' });
  const hrv1 = () =>
    mkRecord({ provider: 'whoop', metricType: 'hrv', value: 55, observedAtMs: NOW - 1 * HOUR, hrvMethod: 'rmssd', externalId: 'h1' });
  /** Apple Health export of the SAME WHOOP measurement (aggregator copy). */
  const hrvAppleCopy = () =>
    mkRecord({
      provider: 'apple_health',
      metricType: 'hrv',
      value: 55,
      observedAtMs: NOW - 1 * HOUR,
      hrvMethod: 'rmssd',
      externalId: 'h1-apple',
      provenanceChain: [
        { provider: 'whoop', transport: 'measured' },
        { provider: 'apple_health', transport: 'aggregator_export' },
      ],
    });

  it('retry duplicates + aggregator copies yield an adapter output identical to the clean input', () => {
    const clean = [steps1(), steps2(), hrv1()];
    const raw = [steps1(), steps1(), steps2(), steps2(), hrv1(), hrv1(), hrvAppleCopy()];
    const direct = new Set<HealthProviderId>(['whoop']);

    const fromClean = resolveAndAdapt(undefined, { records: clean, activeDirectProviders: direct });
    const fromRaw = resolveAndAdapt(undefined, { records: raw, activeDirectProviders: direct });

    expect(fromRaw).toEqual(fromClean);
    // Within-provider sum is exactly the two distinct samples — never doubled.
    expect(fromRaw.whoop?.stepsToday).toBe(7000);
    expect(fromRaw.whoop?.hrvRmssdMs).toBe(55);
    // And the score consequently cannot be amplified either.
    expect(scoreOf(mkState({ biometrics: fromRaw }))).toBe(scoreOf(mkState({ biometrics: fromClean })));
  });
});

// ─── 5. Unavailable data fails safe ──────────────────────────────────────────

describe('invariant 5 — unavailable data fails safe', () => {
  it('nothing connected → empty adapter output → score identical to no-biometrics', () => {
    const bio = resolveAndAdapt(undefined);
    expect(bio).toEqual({});
    expect(scoreOf(mkState({ biometrics: bio }))).toBe(scoreOf(mkState()));
  });

  it('a connected provider with no usable data emits nothing (never a placeholder)', () => {
    const empty: ProviderBiometrics = {
      whoop: mkSnapshot({ providerId: 'whoop', fetchedAt: NOW - 1 * HOUR }),
    };
    const bio = resolveAndAdapt(empty, { activeDirectProviders: new Set(['whoop']) });
    expect(Object.keys(bio)).toHaveLength(0);
    expect(scoreOf(mkState({ biometrics: bio }))).toBe(scoreOf(mkState()));
  });
});

// ─── 6. Provider scores stay provider-attributed in evidence surfaces ───────

describe('invariant 6 — provider scores stay provider-attributed', () => {
  it('each provider score lands only on its own provider snapshot field', () => {
    const bio = resolveAndAdapt(ALL_PROVIDERS_WORST, {
      activeDirectProviders: new Set<HealthProviderId>(['whoop', 'oura', 'garmin', 'strava']),
    });
    expect(bio.whoop?.recoveryPct).toBe(5);
    expect(bio.whoop?.strain).toBe(21);
    expect(bio.oura?.readinessScore).toBe(10);
    expect(bio.garmin?.stressScore).toBe(95);
    expect(bio.strava?.trainingLoad).toBe(200);
    // No cross-provider leakage of any attributed score field.
    for (const [pid, snap] of Object.entries(bio) as [string, ProviderSnapshot][]) {
      if (pid !== 'whoop') {
        expect(snap.recoveryPct).toBeUndefined();
        expect(snap.strain).toBeUndefined();
      }
      if (pid !== 'oura') expect(snap.readinessScore).toBeUndefined();
      if (pid !== 'garmin') expect(snap.stressScore).toBeUndefined();
      if (pid !== 'strava') expect(snap.trainingLoad).toBeUndefined();
    }
  });

  it('a mis-attributed provider-score entry is dropped, never re-homed', () => {
    const unavailable = { available: false as const, reason: 'no_provider' as const };
    const forged: HealthSignals = {
      sleepDuration: unavailable,
      restingHeartRate: unavailable,
      hrv: unavailable,
      workouts: unavailable,
      steps: unavailable,
      providerScores: [
        {
          kind: 'whoop_recovery',
          provider: 'oura', // lies about ownership
          value: 99,
          unit: 'score',
          observedAtMs: NOW - 1 * HOUR,
          freshness: 'fresh',
          confidence: 'high',
        },
      ],
    };
    expect(toReadinessBiometrics(forged)).toEqual({});
  });

  it("commandEvidence's biometrics item remains a neutral direction:'context' signal", () => {
    const bio = resolveAndAdapt(WHOOP_FRESH, { activeDirectProviders: new Set(['whoop']) });
    const state = mkState({ biometrics: bio });
    // READ-ONLY: run the real engine + the real evidence builder.
    const output = calculateScore(state, NOW);
    const evidence = deriveCommandEvidence({
      command: output.command,
      state,
      engineOutput: output,
      now: NOW,
    });
    expect(evidence.integrity).toBe('matched');
    const item = evidence.items.find((i) => i.key === 'biometrics');
    expect(item).toBeDefined();
    expect(item?.direction).toBe('context');
    expect(item?.provenance).toBe('biometrics');
  });

  it('the score-protection lock statement is exported and intact', () => {
    expect(READINESS_SIGNALS_SCORE_PROTECTION).toMatch(/computes no score/i);
    expect(READINESS_SIGNALS_SCORE_PROTECTION).toMatch(/never re-attributes/i);
  });
});
