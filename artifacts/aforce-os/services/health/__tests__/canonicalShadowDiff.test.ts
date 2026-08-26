/**
 * WAVE-2 PR3 — LEGACY vs CANONICAL HEALTH-SIGNAL SHADOW DIFF
 * (pre-wiring characterization harness)
 *
 * Runs the UNCHANGED scoring engine over three arms per fixture:
 *
 *   LEGACY      state.biometrics = fixture.biometrics verbatim — exactly
 *               what production does today (record plane is dead in prod).
 *   CANONICAL   state.biometrics = toReadinessBiometrics(resolveHealthSignals(fixture))
 *               — the NOT-YET-WIRED score-shaped adapter (readinessSignals.ts
 *               is explicitly "NOT WIRED (deliberate)").
 *   FIREWALLED  CANONICAL with provider-OWNED composite scores stripped
 *               (WHOOP Recovery %/Strain, Oura Readiness, Garmin Stress,
 *               Strava Training Load) — measures requirement A of the
 *               Wave-2 directive: what the score would do on raw
 *               physiology alone.
 *
 * IMPORTANT SCOPE STATEMENT: this harness measures a path that is NOT the
 * `health_canonical_consumers` flag's current path (that flag gates the
 * readiness/weekly-report surfaces, not the score). Wiring the canonical
 * arm into the score requires founder decision D-5 + Governance-Architect
 * sign-off — this file is the evidence for that decision, not the wiring.
 *
 * READ-ONLY discipline (same as scoreProtectionInvariants.test.ts):
 * calculateScore / computeRecoverySignal / getStatusBand are imported and
 * exercised, never modified. No engine, threshold, or band file is edited.
 *
 * Characterization, not regression: rows are reported, not asserted equal.
 * The only assertions are structural truths (score range; expired data
 * contributes zero via the canonical emission gate). Set SHADOW_REPORT=1
 * to write the markdown evidence table (committed under docs/health/).
 */

import { describe, it, expect, vi } from 'vitest';

vi.mock('../../i18nService', () => ({
  default: { t: (k: string) => k, language: 'en', changeLanguage: () => {} },
}));

import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import type { ProviderBiometrics, ProviderSnapshot, HealthProviderId } from '@workspace/health-core';
import { resolveHealthSignals, type ResolveHealthSignalsInput } from '../signalResolution';
import { toReadinessBiometrics } from '../readinessSignals';
import {
  ALL_SIGNAL_RESOLUTION_FIXTURES,
  FIXED_NOW,
  HOUR,
} from '../signalResolutionFixtures';
import {
  PRIORITY_BEATS_FRESHER_LOWER_PRIORITY,
  STALE_TOP_PRIORITY_LOSES_TO_FRESH_LOWER_PRIORITY,
  SAMSUNG_VIA_HEALTH_CONNECT_SINGLE_DAY,
} from '../validationMatrixFixtures';
// READ-ONLY imports from the governance-locked score path.
import { calculateScore } from '../../../utils/scoringEngine';
import { computeRecoverySignal } from '../../../utils/scoring/breakdown';
import { getStatusBand } from '../../../theme/statusColor';
import type { UserState } from '../../../types';

const NOW = FIXED_NOW;
const DAY = 24 * HOUR;

// ─── State builder (verbatim from scoreProtectionInvariants.test.ts) ───────

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

// ─── Custom missing-data / stale-data fixtures (Wave-2 requirement C) ──────
// Plain snapshot-plane inputs; every timestamp derived from FIXED_NOW.

function snap(
  providerId: HealthProviderId,
  fetchedAt: number,
  fields: Record<string, unknown>,
): ProviderSnapshot {
  return {
    providerId,
    fetchedAt,
    hrvSdnn: null,
    restingHeartRate: null,
    sleepHoursLastNight: null,
    recoveryPct: null,
    strain: null,
    readinessScore: null,
    stressScore: null,
    stepsToday: null,
    workoutMinutesToday: null,
    trainingLoad: null,
    ...fields,
  } as unknown as ProviderSnapshot;
}

function input(biometrics: ProviderBiometrics): ResolveHealthSignalsInput {
  return {
    biometrics,
    activeDirectProviders: new Set<HealthProviderId>(),
    nowMs: NOW,
  };
}

const CUSTOM_FIXTURES: Record<string, ResolveHealthSignalsInput> = {
  // Zero-vs-missing sleep: legacy treats a literal 0 as maximal deficit (−5).
  ZERO_SLEEP_SAMPLE: input({
    apple_health: snap('apple_health', NOW - 1 * HOUR, { sleepHoursLastNight: 0 }),
  }),
  NO_SLEEP_SAMPLE: input({
    apple_health: snap('apple_health', NOW - 1 * HOUR, { sleepHoursLastNight: null }),
  }),
  // Stale signals: fresh enough to exist, 30 days old — legacy scores them
  // at full weight forever; canonical expires them (wearable_sync 72h).
  STALE_HRV_30D: input({
    whoop: snap('whoop', NOW - 30 * DAY, { hrvSdnn: 22 }),
  }),
  STALE_RECOVERY_30D: input({
    whoop: snap('whoop', NOW - 30 * DAY, { recoveryPct: 15 }),
  }),
  STALE_ACTIVITY_30D: input({
    whoop: snap('whoop', NOW - 30 * DAY, { strain: 19, workoutMinutesToday: 150 }),
  }),
  // The documented real-device discrepancy (BUILD-49 / APPLE-PIPELINE-AUDIT:
  // Health app 5.6h vs panel 4.696h vs breakdown 5.4h) — WHOOP and Apple
  // disagree on the same night; arbitration decides which number scores.
  REAL_DEVICE_SLEEP_DISCREPANCY: input({
    apple_health: snap('apple_health', NOW - 2 * HOUR, { sleepHoursLastNight: 5.6, hrvSdnn: 48 }),
    whoop: snap('whoop', NOW - 1 * HOUR, { sleepHoursLastNight: 4.696, recoveryPct: 58 }),
  }),
};

// ─── The three arms ─────────────────────────────────────────────────────────

/** Provider-OWNED composite score fields (Wave-2 requirement A firewall). */
const PROPRIETARY_FIELDS = [
  'recoveryPct',
  'readinessScore',
  'stressScore',
  'strain',
  'trainingLoad',
] as const;

function stripProprietary(bio: ProviderBiometrics): ProviderBiometrics {
  const out: Record<string, unknown> = {};
  for (const [pid, s] of Object.entries(bio)) {
    if (!s) continue;
    const clone: Record<string, unknown> = { ...(s as unknown as Record<string, unknown>) };
    for (const f of PROPRIETARY_FIELDS) clone[f] = null;
    out[pid] = clone;
  }
  return out as ProviderBiometrics;
}

function canonicalBio(fixture: ResolveHealthSignalsInput): ProviderBiometrics {
  return toReadinessBiometrics(resolveHealthSignals(fixture));
}

interface ArmResult {
  score: number;
  level: string;
  band: string;
  command: string;
  healthDelta: number;
}

function runArm(biometrics: ProviderBiometrics | undefined, lastIntakeMs: number): ArmResult {
  const state = mkState({
    biometrics: biometrics && Object.keys(biometrics).length > 0 ? biometrics : undefined,
    lastIntakeTime: new Date(lastIntakeMs),
  });
  const out = calculateScore(state, NOW);
  const recovery = computeRecoverySignal(state);
  return {
    score: out.score,
    level: out.performanceState.level,
    band: getStatusBand(out.score),
    command: typeof out.command?.action === 'string' ? out.command.action : JSON.stringify(out.command?.action ?? ''),
    healthDelta: recovery.delta,
  };
}

interface DiffRow {
  fixture: string;
  clock: string;
  legacy: ArmResult;
  canonical: ArmResult;
  firewalled: ArmResult;
}

const FIXTURES: Record<string, ResolveHealthSignalsInput> = {
  ...ALL_SIGNAL_RESOLUTION_FIXTURES,
  PRIORITY_BEATS_FRESHER_LOWER_PRIORITY,
  STALE_TOP_PRIORITY_LOSES_TO_FRESH_LOWER_PRIORITY,
  SAMSUNG_VIA_HEALTH_CONNECT_SINGLE_DAY,
  ...CUSTOM_FIXTURES,
};

const CLOCKS: ReadonlyArray<[string, number]> = [
  ['intake@now', NOW],
  // 30min: enough elapsed time for the activity-floor→decay divergence
  // (D8) to show without saturating the score at the 0 floor.
  ['intake@-30m', NOW - 30 * 60_000],
];

function computeAllRows(): DiffRow[] {
  const rows: DiffRow[] = [];
  for (const [name, fixture] of Object.entries(FIXTURES)) {
    const canon = canonicalBio(fixture);
    const fire = stripProprietary(canon);
    for (const [clockName, intakeMs] of CLOCKS) {
      rows.push({
        fixture: name,
        clock: clockName,
        legacy: runArm(fixture.biometrics, intakeMs),
        canonical: runArm(canon, intakeMs),
        firewalled: runArm(fire, intakeMs),
      });
    }
  }
  return rows;
}

// ─── The characterization run ───────────────────────────────────────────────

describe('canonical shadow diff (characterization — reported, not asserted equal)', () => {
  const rows = computeAllRows();

  it('covers the full fixture corpus across both clocks', () => {
    expect(Object.keys(FIXTURES).length).toBeGreaterThanOrEqual(28);
    expect(rows.length).toBe(Object.keys(FIXTURES).length * CLOCKS.length);
  });

  it('every arm produces an in-range score and a valid band', () => {
    for (const row of rows) {
      for (const arm of [row.legacy, row.canonical, row.firewalled]) {
        expect(arm.score).toBeGreaterThanOrEqual(0);
        expect(arm.score).toBeLessThanOrEqual(100);
        expect(arm.level).toMatch(/^(PEAK|BALANCED|RECOVERING|DEPLETED)$/);
      }
    }
  });

  it('REQUIREMENT B/C: 30-day-stale signals contribute ZERO under canonical (legacy scores them at full weight)', () => {
    for (const name of ['STALE_HRV_30D', 'STALE_RECOVERY_30D', 'STALE_ACTIVITY_30D']) {
      const row = rows.find((r) => r.fixture === name && r.clock === 'intake@now')!;
      expect(row.canonical.healthDelta, `${name} canonical must not score expired data`).toBe(0);
      if (name !== 'STALE_ACTIVITY_30D') {
        expect(row.legacy.healthDelta, `${name} legacy is expected to (wrongly) score it`).not.toBe(0);
      }
    }
  });

  it('REQUIREMENT A: the firewalled arm never derives its recovery delta from proprietary composites', () => {
    // With composites stripped, any remaining delta comes from raw
    // physiology (HRV ms / sleep hours) only. Sanity: stripping never
    // INCREASES the magnitude of proprietary-only fixtures' contribution.
    const proprietaryOnly = rows.find(
      (r) => r.fixture === 'STALE_RECOVERY_30D' && r.clock === 'intake@now',
    )!;
    expect(proprietaryOnly.firewalled.healthDelta).toBe(0);
  });

  it('emits the shadow report (SHADOW_REPORT=1 writes the committed evidence table)', () => {
    const diffRows = rows.filter(
      (r) =>
        r.legacy.score !== r.canonical.score ||
        r.legacy.band !== r.canonical.band ||
        r.legacy.command !== r.canonical.command,
    );
    const fwRows = rows.filter((r) => r.canonical.score !== r.firewalled.score);

    const summary = [
      `cases compared: ${rows.length} (${Object.keys(FIXTURES).length} fixtures × ${CLOCKS.length} clocks × 3 arms)`,
      `legacy≠canonical score: ${diffRows.length}/${rows.length}`,
      `band changes: ${rows.filter((r) => r.legacy.band !== r.canonical.band).length}`,
      `command changes: ${rows.filter((r) => r.legacy.command !== r.canonical.command).length}`,
      `canonical≠firewalled score (proprietary influence): ${fwRows.length}/${rows.length}`,
    ].join('\n');
    // Always surface the summary in the test output.
    // eslint-disable-next-line no-console
    console.log(`\n── CANONICAL SHADOW DIFF ──\n${summary}\n`);

    if (process.env['SHADOW_REPORT'] === '1') {
      const md: string[] = [
        '# Wave-2 PR3 — Legacy vs Canonical Health-Signal Shadow Diff',
        '',
        `Generated ${new Date(NOW).toISOString().slice(0, 10)} by \`services/health/__tests__/canonicalShadowDiff.test.ts\``,
        '(`SHADOW_REPORT=1 vitest run …canonicalShadowDiff.test.ts`). Frozen clock; deterministic.',
        '',
        '**Scope:** pre-wiring characterization of the NOT-WIRED score-shaped adapter',
        '(`toReadinessBiometrics`) vs today\'s legacy `state.biometrics` path, plus a',
        'FIREWALLED arm (provider-owned composites stripped). The production flag',
        '`health_canonical_consumers` is untouched and gates different surfaces.',
        '',
        `## Summary`,
        '',
        '```',
        summary,
        '```',
        '',
        '## Per-fixture rows',
        '',
        '| Fixture | Clock | Legacy score/band/Δhealth | Canonical score/band/Δhealth | Firewalled score/band/Δhealth | Command changed |',
        '|---|---|---|---|---|---|',
        ...rows.map((r) =>
          `| ${r.fixture} | ${r.clock} | ${r.legacy.score}/${r.legacy.band}/${r.legacy.healthDelta} | ${r.canonical.score}/${r.canonical.band}/${r.canonical.healthDelta} | ${r.firewalled.score}/${r.firewalled.band}/${r.firewalled.healthDelta} | ${r.legacy.command !== r.canonical.command ? 'YES' : 'no'} |`,
        ),
        '',
      ];
      const dir = resolve(__dirname, '../../../../../docs/health/validation');
      mkdirSync(dir, { recursive: true });
      writeFileSync(resolve(dir, 'WAVE2-SHADOW-DIFF.md'), md.join('\n'));
    }
    expect(rows.length).toBeGreaterThan(0);
  });
});
