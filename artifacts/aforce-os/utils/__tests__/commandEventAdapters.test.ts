import { describe, it, expect } from 'vitest';

import type { IntakeEvent } from '../../types';
import type { VoiceCheckInRecord } from '../voiceCheckIn';
import type { PerformanceAgeDailySnapshot } from '../performanceAge';
import { computePerformanceMemory } from '../performanceMemory';
import { computePerformanceAgeTrend } from '../performanceAge';
import { deriveCommandConfidence } from '../scoring/commandConfidence';
import {
  normalizeCommandEvent,
  mergeCommandEvents,
  type CommandEvent,
} from '../intelligence/commandEvents';
import {
  BEHAVIOR_FRESHNESS_MS,
  ADHERENCE_MIN_SAMPLES,
  intakeEventToCommandEvent,
  voiceCheckInToCommandEvent,
  performanceAgeSnapshotToCommandEvent,
  confirmationToCommandEvent,
  contextSnapshotToCommandEvent,
  collectIntakeCommandEvents,
  collectVoiceCheckInCommandEvents,
  collectPerformanceAgeSnapshotEvents,
  collectConfirmationCommandEvents,
  collectContextSnapshotCommandEvents,
  ledgerToCommandConfidenceInputs,
  ledgerToPerformanceMemoryEntries,
  ledgerToPerformanceAgeSnapshots,
  deriveLedgerAdherence,
} from '../intelligence/commandEventAdapters';

const NOW = 1_700_000_000_000; // fixed epoch ms for determinism
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

function makeCheckIn(partial: Partial<VoiceCheckInRecord>): VoiceCheckInRecord {
  return {
    dayKey: '2023-11-14',
    dayIndex: 19675,
    completedAtMs: NOW,
    answers: { energy: 3, stress: 2, goal: 'focus' },
    ...partial,
  } as VoiceCheckInRecord;
}

// ─── Population: intake ──────────────────────────────────────────────────────────

describe('intakeEventToCommandEvent', () => {
  it('maps a valid intake with a stable id and UTC day index', () => {
    const ev = intakeEventToCommandEvent(
      makeIntake({ id: 'abc', loggedAt: new Date(NOW), oz: 16, fluidType: 'water' }),
    );
    expect(ev).toEqual({
      id: 'intake:abc',
      kind: 'intake',
      occurredAtMs: NOW,
      localDayIndex: Math.floor(NOW / MS_PER_DAY),
      source: 'intakeEvents',
      intakeEventId: 'abc',
      oz: 16,
      fluidType: 'water',
    });
  });

  it('produces a ledger-valid event (survives normalizeCommandEvent unchanged)', () => {
    const ev = intakeEventToCommandEvent(makeIntake({ id: 'abc' }));
    expect(normalizeCommandEvent(ev)).toEqual(ev);
  });

  it('coerces an ISO-string loggedAt', () => {
    const iso = new Date(NOW).toISOString();
    const ev = intakeEventToCommandEvent(makeIntake({ id: 'x', loggedAt: iso as unknown as Date }));
    expect(ev?.occurredAtMs).toBe(NOW);
  });

  it('returns null for a missing id or unparseable timestamp', () => {
    expect(intakeEventToCommandEvent(makeIntake({ id: '' }))).toBeNull();
    expect(
      intakeEventToCommandEvent(makeIntake({ loggedAt: 'not-a-date' as unknown as Date })),
    ).toBeNull();
  });

  it('omits oz / fluidType when absent rather than inventing them', () => {
    const ev = intakeEventToCommandEvent(
      makeIntake({ id: 'x', oz: undefined as unknown as number, fluidType: '' as never }),
    );
    expect(ev).not.toHaveProperty('oz');
    expect(ev).not.toHaveProperty('fluidType');
  });
});

// ─── Population: voice check-in ───────────────────────────────────────────────────

describe('voiceCheckInToCommandEvent', () => {
  it('maps energy/stress/goal and preserves the record day index', () => {
    const ev = voiceCheckInToCommandEvent(
      makeCheckIn({ dayIndex: 19675, completedAtMs: NOW, answers: { energy: 4, stress: 1, goal: 'recover' } as never }),
    );
    expect(ev).toEqual({
      id: `voice_checkin:19675:${NOW}`,
      kind: 'voice_checkin',
      occurredAtMs: NOW,
      localDayIndex: 19675,
      source: 'voiceCheckIn',
      energy: 4,
      stress: 1,
      goal: 'recover',
    });
  });

  it('returns null for missing answers or non-finite energy/stress', () => {
    expect(voiceCheckInToCommandEvent(makeCheckIn({ answers: undefined as never }))).toBeNull();
    expect(
      voiceCheckInToCommandEvent(makeCheckIn({ answers: { energy: NaN, stress: 2, goal: 'x' } as never })),
    ).toBeNull();
  });

  it('returns null for a non-integer dayIndex', () => {
    expect(voiceCheckInToCommandEvent(makeCheckIn({ dayIndex: 1.5 }))).toBeNull();
  });
});

// ─── Population: performance age snapshot ─────────────────────────────────────────

describe('performanceAgeSnapshotToCommandEvent', () => {
  it('anchors the event at the start of its UTC day', () => {
    const ev = performanceAgeSnapshotToCommandEvent({ dayIndex: 19675, performanceAge: 41 });
    expect(ev).toEqual({
      id: 'performance_age_snapshot:19675',
      kind: 'performance_age_snapshot',
      occurredAtMs: 19675 * MS_PER_DAY,
      localDayIndex: 19675,
      source: 'performanceAgeSnapshot',
      performanceAge: 41,
    });
  });

  it('rejects non-integer day or non-finite age', () => {
    expect(performanceAgeSnapshotToCommandEvent({ dayIndex: 1.5, performanceAge: 40 })).toBeNull();
    expect(
      performanceAgeSnapshotToCommandEvent({ dayIndex: 100, performanceAge: Infinity }),
    ).toBeNull();
  });
});

// ─── Population: confirmation + context ───────────────────────────────────────────

describe('confirmationToCommandEvent', () => {
  it('records the explicit answer (never inferred from delta)', () => {
    const ev = confirmationToCommandEvent({ followed: true, setAtMs: NOW, delta: 3, commandType: 'hydrate' });
    expect(ev).toMatchObject({
      id: `command_confirmation:${NOW}`,
      kind: 'command_confirmation',
      followed: true,
      delta: 3,
      commandType: 'hydrate',
    });
  });

  it('returns null when followed is not a boolean or time is invalid', () => {
    expect(
      confirmationToCommandEvent({ followed: undefined as unknown as boolean, setAtMs: NOW }),
    ).toBeNull();
    expect(confirmationToCommandEvent({ followed: false, setAtMs: 0 })).toBeNull();
  });
});

describe('contextSnapshotToCommandEvent', () => {
  it('keeps an explicit null weather reading as provenance', () => {
    const ev = contextSnapshotToCommandEvent({ atMs: NOW, weatherTempC: null, hasFreshBiometrics: true });
    expect(ev).toEqual({
      id: `context_snapshot:${NOW}`,
      kind: 'context_snapshot',
      occurredAtMs: NOW,
      localDayIndex: Math.floor(NOW / MS_PER_DAY),
      source: 'contextSnapshot',
      weatherTempC: null,
      hasFreshBiometrics: true,
    });
    expect(normalizeCommandEvent(ev)).toEqual(ev);
  });

  it('drops an unusable weather reading but preserves valid biometrics', () => {
    const ev = contextSnapshotToCommandEvent({
      atMs: NOW,
      weatherTempC: NaN,
      hasFreshBiometrics: true,
    });
    expect(ev).not.toHaveProperty('weatherTempC');
    expect(ev).toMatchObject({ hasFreshBiometrics: true });
    // still a valid ledger event (not discarded by the merge)
    expect(normalizeCommandEvent(ev)).toEqual(ev);
  });

  it('carries valid per-signal source fetch timestamps', () => {
    const ev = contextSnapshotToCommandEvent({
      atMs: NOW,
      weatherTempC: 19,
      hasFreshBiometrics: true,
      weatherFetchedAtMs: NOW - 2 * HOUR,
      biometricsFetchedAtMs: NOW - 3 * HOUR,
    })!;
    expect(ev).toMatchObject({
      weatherFetchedAtMs: NOW - 2 * HOUR,
      biometricsFetchedAtMs: NOW - 3 * HOUR,
    });
    expect(normalizeCommandEvent(ev)).toEqual(ev);
  });

  it('drops invalid source fetch timestamps without discarding the snapshot', () => {
    const ev = contextSnapshotToCommandEvent({
      atMs: NOW,
      weatherTempC: 19,
      hasFreshBiometrics: true,
      weatherFetchedAtMs: -1,
      biometricsFetchedAtMs: Number.NaN,
    })!;
    expect(ev).not.toHaveProperty('weatherFetchedAtMs');
    expect(ev).not.toHaveProperty('biometricsFetchedAtMs');
    expect(ev).toMatchObject({ weatherTempC: 19, hasFreshBiometrics: true });
  });
});

// ─── Collectors ───────────────────────────────────────────────────────────────────

describe('collectors', () => {
  it('drop invalid entries and tolerate null/undefined input', () => {
    const intakes = collectIntakeCommandEvents([
      makeIntake({ id: 'a' }),
      makeIntake({ id: '' }), // dropped
    ]);
    expect(intakes).toHaveLength(1);
    expect(collectIntakeCommandEvents(undefined)).toEqual([]);
    expect(collectVoiceCheckInCommandEvents(null)).toEqual([]);
    expect(collectPerformanceAgeSnapshotEvents(undefined)).toEqual([]);
  });

  it('collectConfirmationCommandEvents drops invalid and tolerates null/undefined', () => {
    const out = collectConfirmationCommandEvents([
      { followed: true, setAtMs: NOW },
      { followed: false, setAtMs: NOW + 1, commandId: 'c2' },
      { followed: true, setAtMs: 0 }, // invalid timestamp → dropped
    ]);
    expect(out).toHaveLength(2);
    expect(out.every((e) => e.kind === 'command_confirmation')).toBe(true);
    expect(collectConfirmationCommandEvents(undefined)).toEqual([]);
    expect(collectConfirmationCommandEvents(null)).toEqual([]);
  });

  it('collectContextSnapshotCommandEvents drops invalid and tolerates null/undefined', () => {
    const out = collectContextSnapshotCommandEvents([
      { atMs: NOW, weatherTempC: 20, hasFreshBiometrics: true },
      { atMs: NOW + 1, weatherTempC: null },
      { atMs: -1 }, // invalid timestamp → dropped
    ]);
    expect(out).toHaveLength(2);
    expect(out.every((e) => e.kind === 'context_snapshot')).toBe(true);
    expect(collectContextSnapshotCommandEvents(undefined)).toEqual([]);
    expect(collectContextSnapshotCommandEvents(null)).toEqual([]);
  });
});

// ─── Read adapter: Command Confidence ─────────────────────────────────────────────

describe('ledgerToCommandConfidenceInputs', () => {
  it('all false on an empty ledger', () => {
    expect(ledgerToCommandConfidenceInputs([], NOW)).toEqual({
      hasTodayBehavior: false,
      hasFreshBiometrics: false,
      hasWeather: false,
    });
  });

  it('counts intake only inside the rolling behaviour window', () => {
    const fresh = [intakeEventToCommandEvent(makeIntake({ id: 'f', loggedAt: new Date(NOW - HOUR) }))!];
    const stale = [
      intakeEventToCommandEvent(
        makeIntake({ id: 's', loggedAt: new Date(NOW - BEHAVIOR_FRESHNESS_MS - HOUR) }),
      )!,
    ];
    expect(ledgerToCommandConfidenceInputs(fresh, NOW).hasTodayBehavior).toBe(true);
    expect(ledgerToCommandConfidenceInputs(stale, NOW).hasTodayBehavior).toBe(false);
  });

  it('requires biometrics to be both flagged fresh AND within the 24h window', () => {
    const flaggedFresh = [contextSnapshotToCommandEvent({ atMs: NOW - HOUR, hasFreshBiometrics: true })!];
    const flaggedStale = [
      contextSnapshotToCommandEvent({ atMs: NOW - 25 * HOUR, hasFreshBiometrics: true })!,
    ];
    const flaggedFalse = [contextSnapshotToCommandEvent({ atMs: NOW - HOUR, hasFreshBiometrics: false })!];
    expect(ledgerToCommandConfidenceInputs(flaggedFresh, NOW).hasFreshBiometrics).toBe(true);
    expect(ledgerToCommandConfidenceInputs(flaggedStale, NOW).hasFreshBiometrics).toBe(false);
    expect(ledgerToCommandConfidenceInputs(flaggedFalse, NOW).hasFreshBiometrics).toBe(false);
  });

  it('requires weather to be finite AND within the 6h window', () => {
    const fresh = [contextSnapshotToCommandEvent({ atMs: NOW - HOUR, weatherTempC: 22 })!];
    const stale = [contextSnapshotToCommandEvent({ atMs: NOW - 7 * HOUR, weatherTempC: 22 })!];
    const noReading = [contextSnapshotToCommandEvent({ atMs: NOW - HOUR, weatherTempC: null })!];
    expect(ledgerToCommandConfidenceInputs(fresh, NOW).hasWeather).toBe(true);
    expect(ledgerToCommandConfidenceInputs(stale, NOW).hasWeather).toBe(false);
    expect(ledgerToCommandConfidenceInputs(noReading, NOW).hasWeather).toBe(false);
  });

  it('evaluates each freshness window against its own snapshot', () => {
    // newest snapshot has only weather; an older (but <24h) one has biometrics.
    const events: CommandEvent[] = [
      contextSnapshotToCommandEvent({ atMs: NOW - HOUR, weatherTempC: 18, hasFreshBiometrics: false })!,
      contextSnapshotToCommandEvent({ atMs: NOW - 10 * HOUR, hasFreshBiometrics: true })!,
    ];
    const inputs = ledgerToCommandConfidenceInputs(events, NOW);
    expect(inputs.hasWeather).toBe(true); // from the 1h-old snapshot
    expect(inputs.hasFreshBiometrics).toBe(true); // from the 10h-old snapshot
    // sanity: this is a "high" command (behaviour + a fresh context signal)
    expect(deriveCommandConfidence({ ...inputs, hasTodayBehavior: true })).toBe('high');
  });

  it('anchors freshness to the SOURCE fetch time, not the observation time', () => {
    // Observed "now" (occurredAtMs fresh) but the underlying readings were
    // fetched long ago → must read STALE, exactly as the live engine would.
    // Without per-signal source timestamps this would falsely read fresh.
    const lateObserved: CommandEvent[] = [
      contextSnapshotToCommandEvent({
        atMs: NOW, // observed now
        weatherTempC: 22,
        hasFreshBiometrics: true,
        weatherFetchedAtMs: NOW - 7 * HOUR, // > 6h → stale weather
        biometricsFetchedAtMs: NOW - 25 * HOUR, // > 24h → stale biometrics
      })!,
    ];
    const inputs = ledgerToCommandConfidenceInputs(lateObserved, NOW);
    expect(inputs.hasWeather).toBe(false);
    expect(inputs.hasFreshBiometrics).toBe(false);
  });

  it('source fetch time keeps a late-observed but still-fresh signal fresh', () => {
    const ev: CommandEvent[] = [
      contextSnapshotToCommandEvent({
        atMs: NOW,
        weatherTempC: 22,
        hasFreshBiometrics: true,
        weatherFetchedAtMs: NOW - 3 * HOUR, // < 6h → fresh
        biometricsFetchedAtMs: NOW - 10 * HOUR, // < 24h → fresh
      })!,
    ];
    const inputs = ledgerToCommandConfidenceInputs(ev, NOW);
    expect(inputs.hasWeather).toBe(true);
    expect(inputs.hasFreshBiometrics).toBe(true);
  });
});

// ─── Read adapter: Performance Memory ─────────────────────────────────────────────

describe('ledgerToPerformanceMemoryEntries', () => {
  it('maps voice check-ins and feeds computePerformanceMemory', () => {
    const events = collectVoiceCheckInCommandEvents([
      makeCheckIn({ dayIndex: 100, completedAtMs: NOW - 2 * MS_PER_DAY, answers: { energy: 2, stress: 3, goal: 'a' } as never }),
      makeCheckIn({ dayIndex: 101, completedAtMs: NOW - 1 * MS_PER_DAY, answers: { energy: 4, stress: 2, goal: 'b' } as never }),
    ]);
    const entries = ledgerToPerformanceMemoryEntries(events);
    expect(entries).toEqual([
      { dayIndex: 100, energy: 2, stress: 3, goal: 'a' },
      { dayIndex: 101, energy: 4, stress: 2, goal: 'b' },
    ]);
    const recap = computePerformanceMemory(entries, new Date(NOW));
    expect(recap.entriesLogged).toBe(2);
    expect(recap.latest?.energy).toBe(4);
    expect(recap.energyTrend).toBe('rising');
  });

  it('defaults a missing goal to empty string', () => {
    const ev = voiceCheckInToCommandEvent(
      makeCheckIn({ answers: { energy: 3, stress: 3 } as never }),
    )!;
    expect(ledgerToPerformanceMemoryEntries([ev])[0].goal).toBe('');
  });
});

// ─── Read adapter: Performance Age snapshots ──────────────────────────────────────

describe('ledgerToPerformanceAgeSnapshots', () => {
  it('maps snapshots and feeds the trend helper', () => {
    const events = collectPerformanceAgeSnapshotEvents([
      { dayIndex: 100, performanceAge: 40 },
      { dayIndex: 130, performanceAge: 38 },
    ]);
    const snaps = ledgerToPerformanceAgeSnapshots(events);
    expect(snaps).toEqual([
      { dayIndex: 100, performanceAge: 40 },
      { dayIndex: 130, performanceAge: 38 },
    ]);
    const trend = computePerformanceAgeTrend(snaps, 30);
    expect(trend.available).toBe(true);
    expect(trend.deltaYears).toBe(-2);
    expect(trend.direction).toBe('younger');
  });
});

// ─── Adherence (learning primitive) ───────────────────────────────────────────────

describe('deriveLedgerAdherence', () => {
  it('is insufficient below the sample floor', () => {
    const events = Array.from({ length: ADHERENCE_MIN_SAMPLES - 1 }, (_, i) =>
      confirmationToCommandEvent({ followed: true, setAtMs: NOW - (i + 1) * HOUR })!,
    );
    const a = deriveLedgerAdherence(events, NOW);
    expect(a.status).toBe('insufficient');
    expect(a.followedRate).toBeNull();
    expect(a.sampleSize).toBe(ADHERENCE_MIN_SAMPLES - 1);
  });

  it('reports the followed rate once enough confirmations exist', () => {
    const events = [
      confirmationToCommandEvent({ followed: true, setAtMs: NOW - 1 * HOUR })!,
      confirmationToCommandEvent({ followed: true, setAtMs: NOW - 2 * HOUR })!,
      confirmationToCommandEvent({ followed: false, setAtMs: NOW - 3 * HOUR })!,
    ];
    const a = deriveLedgerAdherence(events, NOW);
    expect(a.status).toBe('ready');
    expect(a.sampleSize).toBe(3);
    expect(a.followed).toBe(2);
    expect(a.followedRate).toBeCloseTo(2 / 3, 10);
  });

  it('excludes confirmations outside the trailing window', () => {
    const events = [
      confirmationToCommandEvent({ followed: true, setAtMs: NOW - 1 * HOUR })!,
      confirmationToCommandEvent({ followed: true, setAtMs: NOW - 2 * HOUR })!,
      confirmationToCommandEvent({ followed: true, setAtMs: NOW - 40 * MS_PER_DAY })!, // old
    ];
    const a = deriveLedgerAdherence(events, NOW);
    expect(a.sampleSize).toBe(2);
    expect(a.status).toBe('insufficient');
  });
});

// ─── End-to-end: populate → merge → read ──────────────────────────────────────────

describe('populate → merge → read round-trip', () => {
  it('builds a ledger from sources and reads back consistent engine inputs', () => {
    const populated = [
      ...collectIntakeCommandEvents([makeIntake({ id: 'a', loggedAt: new Date(NOW - HOUR) })]),
      contextSnapshotToCommandEvent({ atMs: NOW - HOUR, weatherTempC: 21, hasFreshBiometrics: true })!,
    ];
    // merge twice to prove idempotency (stable ids => no double-count)
    const once = mergeCommandEvents([], populated);
    const twice = mergeCommandEvents(once, populated);
    expect(twice).toHaveLength(once.length);

    const inputs = ledgerToCommandConfidenceInputs(twice, NOW);
    expect(inputs).toEqual({ hasTodayBehavior: true, hasFreshBiometrics: true, hasWeather: true });
    expect(deriveCommandConfidence(inputs)).toBe('high');
  });
});
