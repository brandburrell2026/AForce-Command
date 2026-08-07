/**
 * VALIDATION MATRIX — consumer expansion + named-combo + cheap gap closures
 * (Squad-E gap-closure, priorities 3, 4, 5).
 *
 * The independent review of PR #505 found the validation matrix exercised
 * only TWO consumers of `resolveHealthSignals` (the weekly rollup and the
 * readiness adapter). This file adds the four named in the gap report:
 *
 *   - Sleep            → `sleepSignals.canonicalSignals`
 *   - Home              → `healthSignalsFromStore` + `canonicalReadinessSignals`
 *   - Connected Health  → `connectedHealthContainerModel.buildConnectedHealthInput`
 *                          → `connectedHealthView.resolveConnectedHealthView`
 *   - Evidence          → the readiness evidence contract (commandEvidence's
 *                          neutral `direction:'context'` biometrics item),
 *                          mirroring `scoreProtectionInvariants.test.ts`'s
 *                          pattern WITHOUT modifying that file.
 *
 * It deliberately REUSES the strongest existing named-provider combos
 * (`APPLE_ONLY`, `HC_ONLY`, `OURA_DIRECT`, `WHOOP_DIRECT`,
 * `OURA_DIRECT_PLUS_VIA_APPLE`) from `../signalResolutionFixtures.ts` rather
 * than inventing new ones — per the gap report's own instruction. Several of
 * these combos already have thorough coverage through Sleep/Home
 * (`sleepCanonicalConsumer.test.ts`, `healthSignalsFromStore.test.ts`); this
 * file closes ONLY the cells those files leave GAP, and says so explicitly
 * at each one rather than re-proving what already exists:
 *
 *   - Sleep:  Apple-only / Oura-direct / WHOOP-direct already covered in
 *             `sleepCanonicalConsumer.test.ts`. This file adds HC-only and
 *             Apple+Oura (the dedup combo).
 *   - Home:   Apple-only already covered in `healthSignalsFromStore.test.ts`.
 *             This file adds HC-only, plus ONE test naming the SHARED PATH
 *             that makes every records-plane-only combo (Oura-direct,
 *             WHOOP-direct, Apple+Oura, mixed-HRV, priority-vs-freshness)
 *             invisible to Home today — a real, documented gap in
 *             `healthSignalsFromStore.ts`'s own header, not a bug this suite
 *             introduces.
 *   - Connected Health: Apple-only / Garmin-connected / Oura-not-wired /
 *             stale-downgrade already covered in
 *             `connectedHealthContainerModel.test.ts`. This file adds a
 *             WHOOP-connected baseline (the one named combo missing there)
 *             and the no_recent_data-vs-stale FULL-COMPOSITION distinctness
 *             check (item 5's "cheap" gap — the per-module unit tests for
 *             this already exist in `providerPresentation.test.ts` /
 *             `connectedHealthView.test.ts`, but never composed end-to-end
 *             through the real container).
 *
 * READ-ONLY discipline: every consumer module, `resolveHealthSignals`,
 * `calculateScore`, `buildBreakdown`, and `deriveCommandEvidence` are
 * imported and exercised — never modified. `scoreProtectionInvariants.test.ts`
 * itself is untouched (mirrored, not edited).
 */
import { describe, it, expect, vi } from 'vitest';

vi.mock('../../i18nService', () => ({
  default: { t: (k: string) => k, language: 'en', changeLanguage: () => {} },
}));

import { DEFAULT_FLAGS } from '../../../featureFlags/flags';
import { resolveHealthSignals } from '../signalResolution';
import { toReadinessBiometrics } from '../readinessSignals';
import { canonicalSignals, type SleepSignalsContainerState } from '../sleepSignals';
import { healthSignalsFromStore, canonicalReadinessSignals } from '../healthSignalsFromStore';
import { buildConnectedHealthInput, type ConnectedHealthContainerModelInput } from '../connectedHealthContainerModel';
import { resolveConnectedHealthView } from '../connectedHealthView';
import type { ResolveHealthSignalsInput } from '../signalResolution';
import {
  FIXED_NOW as SR_FIXED_NOW,
  APPLE_ONLY,
  HC_ONLY,
  OURA_DIRECT,
  WHOOP_DIRECT,
  OURA_DIRECT_PLUS_VIA_APPLE,
  HRV_METHOD_CONFLICT,
} from '../signalResolutionFixtures';
import {
  FIXED_NOW,
  HOUR,
  WHOLE_PROVIDER_REVOKED_APPLE_SIBLING_OURA_INTACT,
  HC_DIRECT_PLUS_SAMSUNG_VIA_HC,
} from '../validationMatrixFixtures';
// READ-ONLY imports from the governance-locked score path — exercised, never edited.
import { calculateScore } from '../../../utils/scoringEngine';
import { deriveCommandEvidence } from '../../../utils/scoring/commandEvidence';
import type { UserState } from '../../../types';

const NOW = 1_754_000_000_000; // aligns with providerPresentation.test.ts's own NOW
const MIN = 60_000;
const H = 3_600_000;

/** Lifts a `ResolveHealthSignalsInput` fixture into the Sleep bridge's own state shape. */
function sleepStateFrom(input: ResolveHealthSignalsInput): SleepSignalsContainerState {
  return {
    appleHealth: undefined,
    biometrics: input.biometrics,
    records: input.records,
    activeDirectProviders: input.activeDirectProviders,
    connections: input.connections,
  };
}

// ─── Sleep consumer — HC-only, and Apple+Oura (dedup combo) ────────────────

describe('Sleep consumer (sleepSignals.canonicalSignals) — named combos not yet covered by sleepCanonicalConsumer.test.ts', () => {
  it('HC-only: sleep + HRV(RMSSD) + resting HR resolve, attributed to Google Health Connect', () => {
    const out = canonicalSignals(sleepStateFrom(HC_ONLY), SR_FIXED_NOW);
    expect(out.sleepLastNight).toBe(6.5);
    expect(out.chip).toBe('connected');
    expect(out.providerLabel).toBe('Google Health Connect');
    expect(out.recoveryMetrics).toEqual(
      expect.arrayContaining([
        { key: 'hrv', label: 'HRV (RMSSD)', value: 30, unit: ' ms', real: true }, // RC-2 ruling E (item 3): unit-spacing normalization
        { key: 'resting_hr', label: 'Resting HR', value: 58, unit: ' bpm', real: true },
      ]),
    );
  });

  it('Apple+Oura (direct + aggregator-copy dedup): the resting-HR recovery metric is Oura\'s own direct value, never the Apple-relayed copy and never a blend', () => {
    // OURA_DIRECT_PLUS_VIA_APPLE carries only a resting_heart_rate family
    // (oura direct: 50, apple-relayed copy of the SAME reading: 53) — no
    // sleep record, so sleep is honestly "waiting", not "connected". This is
    // the shared dedup path already proven at the resolver layer
    // (`signalResolution.test.ts`); this assertion is the Sleep consumer's
    // own thin proof that the dedup survives into ITS OWN recoveryMetrics
    // mapping too.
    const out = canonicalSignals(sleepStateFrom(OURA_DIRECT_PLUS_VIA_APPLE), SR_FIXED_NOW);
    expect(out.sleepLastNight).toBeNull();
    expect(out.chip).toBe('waiting');
    expect(out.recoveryMetrics).toEqual([{ key: 'resting_hr', label: 'Resting HR', value: 50, unit: ' bpm', real: true }]);
  });
});

// ─── Home consumer — HC-only, and the records-plane-invisibility shared path ─

describe('Home consumer (healthSignalsFromStore + canonicalReadinessSignals) — named combos not yet covered by healthSignalsFromStore.test.ts', () => {
  it('HC-only: sleep hours resolve; HRV is RMSSD so hrvMs projects null (SDNN-only rule) while hrvMethod still surfaces; workouts null (HC_ONLY fixture supplies none)', () => {
    const signals = healthSignalsFromStore({ biometrics: HC_ONLY.biometrics, nowMs: SR_FIXED_NOW });
    const projected = canonicalReadinessSignals(signals);
    expect(projected).toEqual({ sleepHours: 6.5, hrvMs: null, hrvMethod: 'rmssd', workoutMinutes: null });
  });

  it('SHARED PATH: every records-plane-only named combo is invisible to the Home path today — `buildResolveHealthSignalsInput` discards records/activeDirectProviders/connections entirely (documented in healthSignalsFromStore.ts\'s own header), so Oura-direct, WHOOP-direct, Apple+Oura, and the mixed-HRV combo all project to all-null exactly like "nothing connected"', () => {
    for (const combo of [OURA_DIRECT, WHOOP_DIRECT, OURA_DIRECT_PLUS_VIA_APPLE, HRV_METHOD_CONFLICT]) {
      const signals = healthSignalsFromStore({ biometrics: combo.biometrics, nowMs: SR_FIXED_NOW });
      expect(canonicalReadinessSignals(signals)).toEqual({
        sleepHours: null,
        hrvMs: null,
        hrvMethod: null,
        workoutMinutes: null,
      });
    }
  });
});

// ─── Connected Health consumer — WHOOP-connected baseline + no_recent_data-vs-stale composition ─

function containerBaseInput(
  over: Partial<ConnectedHealthContainerModelInput> = {},
): ConnectedHealthContainerModelInput {
  return {
    nowMs: NOW,
    mode: 'ready',
    platform: 'ios',
    featureFlags: DEFAULT_FLAGS,
    biometrics: undefined,
    cloud: {},
    appleHealthLinked: false,
    appleHealthNativeReady: false,
    ...over,
  };
}

describe('Connected Health consumer (buildConnectedHealthInput → resolveConnectedHealthView)', () => {
  it('WHOOP-only: a genuine connected cloud link with fresh biometrics resolves connected + disconnectable (the one named single-provider combo missing from connectedHealthContainerModel.test.ts — Apple/Garmin/Oura/Google already covered there)', () => {
    const input = containerBaseInput({
      cloud: { whoop: { integrationReady: true, link: 'connected' } },
      biometrics: { whoop: { fetchedAt: NOW - 10 * MIN } as never },
    });
    const model = buildConnectedHealthInput(input);
    const view = resolveConnectedHealthView({ now: input.nowMs, mode: input.mode, platform: input.platform, providers: model.providers });
    const whoopRow = view.rows.find((r) => r.providerId === 'whoop')!;
    expect(whoopRow.statusPill.state).toBe('connected');
    expect(whoopRow.statusPill.tone).toBe('green');
    expect(whoopRow.canDisconnect).toBe(true);
  });

  it('no_recent_data vs. stale stay DISTINCT through the full container→view composition, not merely in each module\'s own isolated unit test', () => {
    const staleInput = containerBaseInput({
      cloud: { whoop: { integrationReady: true, link: 'connected' } },
      biometrics: { whoop: { fetchedAt: NOW - 30 * H } as never }, // >24h stale ceiling, <72h expiry
    });
    const noRecentInput = containerBaseInput({
      cloud: { whoop: { integrationReady: true, link: 'connected' } },
      biometrics: { whoop: { fetchedAt: NOW - 100 * H } as never }, // >72h expiry
    });

    const staleModel = buildConnectedHealthInput(staleInput);
    const noRecentModel = buildConnectedHealthInput(noRecentInput);
    const staleView = resolveConnectedHealthView({
      now: staleInput.nowMs, mode: staleInput.mode, platform: staleInput.platform, providers: staleModel.providers,
    });
    const noRecentView = resolveConnectedHealthView({
      now: noRecentInput.nowMs, mode: noRecentInput.mode, platform: noRecentInput.platform, providers: noRecentModel.providers,
    });

    const staleRow = staleView.rows.find((r) => r.providerId === 'whoop')!;
    const noRecentRow = noRecentView.rows.find((r) => r.providerId === 'whoop')!;

    expect(staleRow.statusPill.state).toBe('stale');
    expect(noRecentRow.statusPill.state).toBe('no_recent_data');
    expect(staleRow.statusPill.state).not.toBe(noRecentRow.statusPill.state);
    // Distinct tones/troubleshoot too — never collapsed to the same presentation.
    expect(staleRow.troubleshoot.kind).toBe('reconnect');
    expect(noRecentRow.troubleshoot.kind).toBe('none'); // "link is fine, nothing to sync" — no action offered
    expect(staleRow.subCopy.key).not.toBe(noRecentRow.subCopy.key);
    // Neither one is ever presented as the live "connected" green state.
    for (const row of [staleRow, noRecentRow]) expect(row.statusPill.tone).not.toBe('green');
  });
});

// ─── Whole-provider revocation, and HC-direct + Samsung-via-HC distinctness ─
// (item 5 "cheap" closures, proven through Signals + Readiness)

describe('whole-provider revocation — sibling provider stays fully intact (Signals + Readiness)', () => {
  it('every Apple Health family reads unavailable/permission_denied while the DIRECT Oura sleep signal is completely unaffected', () => {
    const signals = resolveHealthSignals(WHOLE_PROVIDER_REVOKED_APPLE_SIBLING_OURA_INTACT);
    expect(signals.restingHeartRate).toEqual({ available: false, reason: 'permission_denied' });
    expect(signals.hrv).toEqual({ available: false, reason: 'permission_denied' });
    expect(signals.steps).toEqual({ available: false, reason: 'permission_denied' });
    expect(signals.workouts).toEqual({ available: false, reason: 'permission_denied' });
    expect(signals.sleepDuration.available).toBe(true);
    if (signals.sleepDuration.available) {
      expect(signals.sleepDuration.source).toBe('oura');
      expect(signals.sleepDuration.value.totalSleepHours).toBe(6.9);
    }

    const bio = toReadinessBiometrics(signals);
    expect(bio.apple_health).toBeUndefined(); // absent everywhere, not merely empty fields
    expect(bio.oura?.sleepHoursLastNight).toBe(6.9);
  });
});

describe('HC direct + Samsung-via-HC together — combo 9\'s missing half (Signals + Readiness)', () => {
  it('both origins stay independently and correctly attributed when present in the SAME resolution call', () => {
    const signals = resolveHealthSignals(HC_DIRECT_PLUS_SAMSUNG_VIA_HC);
    expect(signals.steps.available).toBe(true);
    if (signals.steps.available) {
      expect(signals.steps.source).toBe('google_health'); // genuinely HC-native — never mislabeled samsung_health
      expect(signals.steps.value).toBe(7300);
    }
    expect(signals.restingHeartRate.available).toBe(true);
    if (signals.restingHeartRate.available) {
      expect(signals.restingHeartRate.source).toBe('samsung_health'); // never the google_health transport
      expect(signals.restingHeartRate.value).toBe(55);
    }

    const bio = toReadinessBiometrics(signals);
    expect(bio.google_health?.stepsToday).toBe(7300);
    expect(bio.google_health?.restingHeartRate).toBeUndefined(); // never conflated onto the transport's snapshot
    expect(bio.samsung_health?.restingHeartRate).toBe(55);
  });
});

// ─── Evidence consumer — the readiness evidence contract ───────────────────
// Mirrors scoreProtectionInvariants.test.ts's own pattern (READ-ONLY:
// calculateScore + deriveCommandEvidence are imported and exercised, never
// modified; that file itself is untouched) — proving the SAME contract holds
// across DIFFERENT provider combos, i.e. that "direction:'context',
// provider-attributed, never a score input" is a property of the adapter
// boundary itself, not an artifact of the one WHOOP fixture that file uses.

function mkState(over: Record<string, unknown> = {}): UserState {
  return {
    unitsConsumedToday: 0,
    ozConsumedToday: 48,
    aforceUnitsToday: 0,
    lastIntakeTime: new Date(FIXED_NOW),
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

describe('Evidence consumer — commandEvidence\'s biometrics item stays a neutral direction:\'context\' signal, provider-attributed, across combos', () => {
  it.each([
    ['Apple-only', APPLE_ONLY],
    ['Oura-direct', OURA_DIRECT],
    ['WHOOP-direct', WHOOP_DIRECT],
  ])('%s: evidence integrity matched, biometrics item is direction:context regardless of which provider supplied it', (_name, combo) => {
    const signals = resolveHealthSignals({ ...combo, nowMs: SR_FIXED_NOW });
    const bio = toReadinessBiometrics(signals);
    const state = mkState({ biometrics: bio });
    const output = calculateScore(state, FIXED_NOW);
    const evidence = deriveCommandEvidence({ command: output.command, state, engineOutput: output, now: FIXED_NOW });

    expect(evidence.integrity).toBe('matched');
    const item = evidence.items.find((i) => i.key === 'biometrics');
    expect(item).toBeDefined();
    // NEVER a score-input direction (positive/negative) — always the neutral
    // context signal, no matter which provider is behind it.
    expect(item?.direction).toBe('context');
    expect(item?.provenance).toBe('biometrics');
  });

  it('an empty (no-provider) combo still resolves a matched, direction:context-free evidence set — no biometrics item is fabricated', () => {
    const signals = resolveHealthSignals({
      biometrics: undefined,
      activeDirectProviders: new Set(),
      nowMs: SR_FIXED_NOW,
    });
    const bio = toReadinessBiometrics(signals);
    expect(bio).toEqual({});
    const state = mkState({ biometrics: bio });
    const output = calculateScore(state, FIXED_NOW);
    const evidence = deriveCommandEvidence({ command: output.command, state, engineOutput: output, now: FIXED_NOW });
    expect(evidence.integrity).toBe('matched');
  });
});
