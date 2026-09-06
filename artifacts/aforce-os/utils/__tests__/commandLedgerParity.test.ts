/**
 * Command-Ledger PARITY tests (Step 4 — G4.5).
 *
 * These lock the contract that the engine read-path through the ledger is
 * FAITHFUL to the live derivation that ships today. They are the safety guard
 * behind the decision to keep the live engines on their existing inputs this
 * phase (no switch): if the ledger projection ever drifts from the live
 * computation, these fail loudly before any score integration is considered.
 *
 * Two surfaces are covered:
 *   1. Command Confidence inputs — `commandConfidenceInputsFromState` (live)
 *      vs `ledgerToCommandConfidenceInputs` over a ledger built from the same
 *      state the way `useCommandLedgerSync` builds it.
 *   2. Performance Memory entries — the canonical `computePerformanceMemory` mapping vs
 *      `ledgerToPerformanceMemoryEntries`, both fed through the consumed
 *      `computePerformanceMemory`.
 *
 * Score-Protection: nothing here awards, mutates, or fabricates score. The
 * test only compares pure projections.
 */
import { describe, it, expect } from 'vitest';

import type { UserState, IntakeEvent } from '../../types';
import type { AppleHealthInputs } from '../../types';
import type { VoiceCheckInRecord } from '../voiceCheckIn';
import { computePerformanceMemory, type PerformanceMemoryEntry } from '../performanceMemory';
import {
  commandConfidenceInputsFromState,
  deriveCommandConfidence,
  deriveContextSnapshotFields,
  WEATHER_FRESHNESS_MS,
  BIOMETRIC_FRESHNESS_MS,
  type CommandConfidenceInputs,
} from '../scoring/commandConfidence';
import {
  collectIntakeCommandEvents,
  collectVoiceCheckInCommandEvents,
  collectContextSnapshotCommandEvents,
  ledgerToCommandConfidenceInputs,
  ledgerToPerformanceMemoryEntries,
} from '../intelligence/commandEventAdapters';
import type { CommandEvent } from '../intelligence/commandEvents';

const NOW = 1_700_000_000_000;
const HOUR = 60 * 60 * 1000;
const MS_PER_DAY = 86_400_000;

function makeIntake(partial: Partial<IntakeEvent>): IntakeEvent {
  return {
    id: 'i1',
    fluidType: 'water',
    oz: 12,
    loggedAt: new Date(NOW),
    baseImpact: 0,
    capAdjusted: 0,
    immediate: 0,
    delayed: 0,
    delayedDurationMin: 0,
    heatGuardActiveAtLog: false,
    scoreBeforeAtLog: 0,
    ...partial,
  } as IntakeEvent;
}

function makeAppleHealth(partial: Partial<AppleHealthInputs>): AppleHealthInputs {
  return {
    restingHeartRate: null,
    hrvSdnn: null,
    stepsToday: null,
    sleepHoursLastNight: null,
    fetchedAt: NOW,
    ...partial,
  } as AppleHealthInputs;
}

function makeState(partial: Partial<UserState>): UserState {
  return {
    intakeEvents: [],
    ...partial,
  } as UserState;
}

function makeCheckIn(partial: Partial<VoiceCheckInRecord>): VoiceCheckInRecord {
  return {
    dayKey: '2023-11-14',
    dayIndex: 19675,
    completedAtMs: NOW,
    answers: { energy: 3, stress: 2, goal: 'focus' },
    ...partial,
  } as VoiceCheckInRecord;
}

/**
 * Build the ledger from a UserState exactly the way `useCommandLedgerSync`
 * does at runtime: intake events straight through, and ONE context snapshot
 * keyed at `now` whose weather/biometric fields come from the SAME live
 * derivation — weather only when live-fresh, otherwise null; no snapshot at
 * all when there is no real context to record. Mirrors the hook so the read
 * path is proven against what actually gets persisted.
 */
function ledgerFromState(state: UserState, syncNow: number): CommandEvent[] {
  // Mirror the hook EXACTLY by using the same shared, single-clock helper it
  // ships with — so the hook and this parity mirror can never drift apart and
  // this test genuinely proves the wired path.
  const ctx = deriveContextSnapshotFields(state, syncNow);
  const context = ctx.hasContext
    ? [
        {
          atMs: syncNow,
          weatherTempC: ctx.weatherTempC,
          hasFreshBiometrics: ctx.hasFreshBiometrics,
          ...(ctx.weatherFetchedAtMs != null
            ? { weatherFetchedAtMs: ctx.weatherFetchedAtMs }
            : {}),
          ...(ctx.biometricsFetchedAtMs != null
            ? { biometricsFetchedAtMs: ctx.biometricsFetchedAtMs }
            : {}),
        },
      ]
    : null;
  return [
    ...collectIntakeCommandEvents(state.intakeEvents),
    ...collectContextSnapshotCommandEvents(context),
  ];
}

describe('parity: command confidence inputs (live vs ledger)', () => {
  const scenarios: Array<{ name: string; state: UserState }> = [
    {
      name: 'no signals at all',
      state: makeState({ intakeEvents: [] }),
    },
    {
      name: 'behavior only (intake today, no context)',
      state: makeState({ intakeEvents: [makeIntake({ id: 'a', loggedAt: new Date(NOW - HOUR) })] }),
    },
    {
      name: 'behavior + fresh weather',
      state: makeState({
        intakeEvents: [makeIntake({ id: 'a', loggedAt: new Date(NOW - HOUR) })],
        weatherTempC: 28,
        weatherFetchedAt: NOW - HOUR,
      }),
    },
    {
      name: 'behavior + STALE weather (must read false both sides)',
      state: makeState({
        intakeEvents: [makeIntake({ id: 'a', loggedAt: new Date(NOW - HOUR) })],
        weatherTempC: 28,
        weatherFetchedAt: NOW - WEATHER_FRESHNESS_MS - HOUR,
      }),
    },
    {
      name: 'behavior + fresh biometrics (appleHealth)',
      state: makeState({
        intakeEvents: [makeIntake({ id: 'a', loggedAt: new Date(NOW - HOUR) })],
        appleHealth: makeAppleHealth({ restingHeartRate: 52, fetchedAt: NOW - HOUR }),
      }),
    },
    {
      name: 'behavior + STALE biometrics (must read false both sides)',
      state: makeState({
        intakeEvents: [makeIntake({ id: 'a', loggedAt: new Date(NOW - HOUR) })],
        appleHealth: makeAppleHealth({
          restingHeartRate: 52,
          fetchedAt: NOW - BIOMETRIC_FRESHNESS_MS - HOUR,
        }),
      }),
    },
    {
      name: 'weather + biometrics, no behavior',
      state: makeState({
        intakeEvents: [],
        weatherTempC: 30,
        weatherFetchedAt: NOW - HOUR,
        appleHealth: makeAppleHealth({ hrvSdnn: 65, fetchedAt: NOW - HOUR }),
      }),
    },
  ];

  for (const { name, state } of scenarios) {
    it(`matches for: ${name}`, () => {
      const live: CommandConfidenceInputs = commandConfidenceInputsFromState(state, NOW);
      const fromLedger = ledgerToCommandConfidenceInputs(ledgerFromState(state, NOW), NOW);
      expect(fromLedger).toEqual(live);
      // The CONSUMED confidence level must also agree — this is what ships.
      expect(deriveCommandConfidence(fromLedger)).toBe(deriveCommandConfidence(live));
    });
  }
});

describe('parity: holds AFTER source expiry (no late-observation freshness)', () => {
  // The critical drift case: a snapshot is OBSERVED later than its source was
  // fetched, then evaluated later still. Freshness must age out on the SOURCE
  // window, so live (which re-reads the original fetch time from state) and the
  // ledger projection agree at the later instant. Without per-signal source
  // timestamps the ledger would hold the signal fresh for a full window from
  // the (late) sync instant — a silent confidence upgrade. Intake is kept
  // fresh relative to the evaluation time so only context freshness is exercised.
  const T0 = NOW;

  function assertParity(state: UserState, syncNow: number, evalNow: number): CommandConfidenceInputs {
    const live = commandConfidenceInputsFromState(state, evalNow);
    const fromLedger = ledgerToCommandConfidenceInputs(ledgerFromState(state, syncNow), evalNow);
    expect(fromLedger).toEqual(live);
    expect(deriveCommandConfidence(fromLedger)).toBe(deriveCommandConfidence(live));
    return live;
  }

  it('weather fetched T0, observed T0+5h, evaluated T0+7h → both stale', () => {
    const evalNow = T0 + 7 * HOUR;
    const state = makeState({
      intakeEvents: [makeIntake({ id: 'a', loggedAt: new Date(evalNow - HOUR) })],
      weatherTempC: 28,
      weatherFetchedAt: T0, // > 6h before evalNow
    });
    const live = assertParity(state, T0 + 5 * HOUR, evalNow);
    expect(live.hasWeather).toBe(false);
  });

  it('weather inside the canonical window, late-observed → both still fresh', () => {
    // PR5: expressed against the policy-derived window rather than literal
    // hours, so this fixture can never quietly encode a private rule again.
    const evalNow = T0 + Math.floor(WEATHER_FRESHNESS_MS / 2);
    const state = makeState({
      intakeEvents: [makeIntake({ id: 'a', loggedAt: new Date(evalNow - HOUR) })],
      weatherTempC: 28,
      weatherFetchedAt: T0, // half the canonical window before evalNow
    });
    const live = assertParity(state, T0 + Math.floor(WEATHER_FRESHNESS_MS / 4), evalNow);
    expect(live.hasWeather).toBe(true);
  });

  it('biometrics fetched T0, observed T0+23h, evaluated T0+30h → both stale', () => {
    const evalNow = T0 + 30 * HOUR;
    const state = makeState({
      intakeEvents: [makeIntake({ id: 'a', loggedAt: new Date(evalNow - HOUR) })],
      appleHealth: makeAppleHealth({ restingHeartRate: 52, fetchedAt: T0 }), // > 24h before evalNow
    });
    const live = assertParity(state, T0 + 23 * HOUR, evalNow);
    expect(live.hasFreshBiometrics).toBe(false);
  });
});

describe('parity: performance memory entries (live vs ledger)', () => {
  // Mirrors the canonical computePerformanceMemory derivation that
  // ships today.
  function liveEntries(records: VoiceCheckInRecord[]): PerformanceMemoryEntry[] {
    return records.map((r) => ({
      dayIndex: r.dayIndex,
      energy: r.answers.energy,
      stress: r.answers.stress,
      goal: r.answers.goal,
    })) as PerformanceMemoryEntry[];
  }

  it('produces an identical recap when every check-in carries a goal', () => {
    const records = [
      makeCheckIn({ dayIndex: 19673, completedAtMs: NOW - 2 * MS_PER_DAY, answers: { energy: 2, stress: 4, goal: 'focus' } }),
      makeCheckIn({ dayIndex: 19674, completedAtMs: NOW - MS_PER_DAY, answers: { energy: 3, stress: 3, goal: 'recover' } }),
      makeCheckIn({ dayIndex: 19675, completedAtMs: NOW, answers: { energy: 4, stress: 2, goal: 'compete' } }),
    ];
    const fromLive = computePerformanceMemory(liveEntries(records), new Date(NOW));
    const fromLedger = computePerformanceMemory(
      ledgerToPerformanceMemoryEntries(collectVoiceCheckInCommandEvents(records)),
      new Date(NOW),
    );
    expect(fromLedger).toEqual(fromLive);
  });

  it('matches on energy/stress/streak/trend even when a check-in has no goal (ledger normalizes goal→"")', () => {
    const noGoal = (energy: number, stress: number) =>
      ({ energy, stress } as unknown as VoiceCheckInRecord['answers']);
    const records = [
      makeCheckIn({ dayIndex: 19674, completedAtMs: NOW - MS_PER_DAY, answers: noGoal(3, 3) }),
      makeCheckIn({ dayIndex: 19675, completedAtMs: NOW, answers: noGoal(5, 1) }),
    ];
    const fromLive = computePerformanceMemory(liveEntries(records), new Date(NOW));
    const fromLedger = computePerformanceMemory(
      ledgerToPerformanceMemoryEntries(collectVoiceCheckInCommandEvents(records)),
      new Date(NOW),
    );
    expect(fromLedger.status).toBe(fromLive.status);
    expect(fromLedger.entriesLogged).toBe(fromLive.entriesLogged);
    expect(fromLedger.streak).toBe(fromLive.streak);
    expect(fromLedger.energyTrend).toBe(fromLive.energyTrend);
    expect(fromLedger.latest?.energy).toBe(fromLive.latest?.energy);
    expect(fromLedger.latest?.stress).toBe(fromLive.latest?.stress);
    // The only intended divergence: absent goal is the honest empty string in
    // the ledger projection, never fabricated into a label.
    expect(fromLedger.latest?.goal).toBe('');
  });

  it('empty history → identical neutral recap', () => {
    const fromLive = computePerformanceMemory(liveEntries([]), new Date(NOW));
    const fromLedger = computePerformanceMemory(
      ledgerToPerformanceMemoryEntries(collectVoiceCheckInCommandEvents([])),
      new Date(NOW),
    );
    expect(fromLedger).toEqual(fromLive);
  });
});
