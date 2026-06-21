/**
 * scoreLedgerParity — Phase 3 proof for the score-integration seam (P2b).
 *
 * The ledger-hybrid projection (`projectScoreStateFromLedgerHybrid`) is meant
 * to become the authoritative INPUT SOURCE for the EXISTING hydration score
 * WITHOUT changing the score formula or its VALUES. Today it is a VERIFIED
 * NO-OP: every score family fails closed to live (no family is losslessly
 * ledger-derivable yet). These tests lock that contract two ways:
 *
 *  1. PARITY — across an adversarial matrix of UserStates (each exercising a
 *     different score code path) the projected state is score-EQUIVALENT to the
 *     live state under one fixed clock. Equivalence is checked by
 *     `compareScoreParity`, which is STRICTER than final-score equality: it also
 *     requires identical decayPerMinute, minutesSinceLast, and the full
 *     contribution vector (id, order, delta) — so 0/100 clamping cannot mask
 *     input drift.
 *  2. FAIL-CLOSED — `tryProjectIntakeEventsFromLedger` returns `lossless:false`
 *     even when the ledger carries in-window intake events, and the comparator
 *     actively CATCHES contribution drift that final-score clamping hides.
 *
 * RN-free: imports only pure `utils/` modules.
 */

import { describe, it, expect } from 'vitest';
import type { IntakeEvent, UserState } from '../../types';
import { buildBreakdown } from '../scoring/breakdown';
import {
  projectScoreStateFromLedgerHybrid,
  tryProjectIntakeEventsFromLedger,
  compareScoreParity,
  shadowCompareScoreFromLedger,
} from '../scoring/scoreLedgerProjection';
import type { CommandEvent } from '../intelligence/commandEvents';

const MIN = 60_000;
const HOUR = 60 * MIN;
const NOW = 1_700_000_000_000;
const DAY_INDEX = Math.floor(NOW / (24 * HOUR));

/** Minimal UserState covering only the fields the score path reads. */
function makeState(over: Partial<UserState> = {}): UserState {
  const base = {
    unitsConsumedToday: 0,
    ozConsumedToday: 48,
    aforceUnitsToday: 1,
    lastIntakeTime: new Date(NOW - 30 * MIN),
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
  };
  return { ...base, ...over } as unknown as UserState;
}

function makeIntakeEvent(over: Partial<IntakeEvent> = {}): IntakeEvent {
  const base: IntakeEvent = {
    id: 'evt-1',
    fluidType: 'water' as IntakeEvent['fluidType'],
    oz: 12,
    loggedAt: new Date(NOW - 10 * MIN),
    baseImpact: 6,
    capAdjusted: 6,
    immediate: 4,
    delayed: 2,
    delayedDurationMin: 20,
    heatGuardActiveAtLog: false,
    scoreBeforeAtLog: 80,
  };
  return { ...base, ...over };
}

function makeLedgerIntake(over: Partial<Extract<CommandEvent, { kind: 'intake' }>> = {}): CommandEvent {
  return {
    id: 'intake:evt-1',
    kind: 'intake',
    occurredAtMs: NOW - 10 * MIN,
    localDayIndex: DAY_INDEX,
    source: 'test',
    intakeEventId: 'evt-1',
    oz: 12,
    fluidType: 'water',
    ...over,
  } as CommandEvent;
}

function makeLedgerContext(
  over: Partial<Extract<CommandEvent, { kind: 'context_snapshot' }>> = {},
): CommandEvent {
  return {
    id: 'context:1',
    kind: 'context_snapshot',
    occurredAtMs: NOW - 5 * MIN,
    localDayIndex: DAY_INDEX,
    source: 'test',
    weatherTempC: 31,
    hasFreshBiometrics: true,
    weatherFetchedAtMs: NOW - 5 * MIN,
    ...over,
  } as CommandEvent;
}

// ─── Adversarial state matrix ────────────────────────────────────────────────────

interface MatrixCase {
  name: string;
  state: UserState;
  ledger: CommandEvent[];
}

const matrix: MatrixCase[] = [
  {
    name: 'empty state, empty ledger',
    state: makeState({ intakeEvents: [], ozConsumedToday: 0, aforceUnitsToday: 0 }),
    ledger: [],
  },
  {
    name: 'legacy state (no intakeEvents) with lossy in-window ledger intake',
    state: makeState({ intakeEvents: undefined }),
    ledger: [makeLedgerIntake(), makeLedgerContext()],
  },
  {
    name: 'active delayed-absorption intake',
    state: makeState({
      intakeEvents: [
        makeIntakeEvent({ id: 'a', loggedAt: new Date(NOW - 5 * MIN), delayed: 4, delayedDurationMin: 20 }),
        makeIntakeEvent({ id: 'b', loggedAt: new Date(NOW - 18 * MIN), delayed: 3, delayedDurationMin: 30 }),
      ],
      lastIntakeTime: new Date(NOW - 5 * MIN),
    }),
    ledger: [makeLedgerIntake({ id: 'intake:a', intakeEventId: 'a' })],
  },
  {
    name: 'AForce / stick intake (protocol bonus path)',
    state: makeState({
      aforceUnitsToday: 4,
      intakeEvents: [makeIntakeEvent({ id: 'stick', fluidType: 'aforce' as IntakeEvent['fluidType'], oz: 16 })],
    }),
    ledger: [makeLedgerIntake({ id: 'intake:stick', intakeEventId: 'stick', fluidType: 'aforce' })],
  },
  {
    name: 'stale context — hot weather, old fetch',
    state: makeState({
      heatLoad: 9,
      sweatRate: 8,
      weatherTempC: 34,
      weatherFetchedAt: NOW - 6 * HOUR,
    }),
    ledger: [makeLedgerContext({ weatherFetchedAtMs: NOW - 6 * HOUR })],
  },
  {
    name: 'future context — fetch timestamp ahead of now',
    state: makeState({ weatherTempC: 28, weatherFetchedAt: NOW + 2 * HOUR }),
    ledger: [makeLedgerContext({ occurredAtMs: NOW + 2 * HOUR, weatherFetchedAtMs: NOW + 2 * HOUR })],
  },
  {
    name: 'active social drinks (penalty + decay multiplier)',
    state: makeState({
      socialMode: {
        active: true,
        drinks: [
          { id: 'd1', type: 'beer', loggedAt: new Date(NOW - 15 * MIN), multiplier: 1, hydrated: null },
          { id: 'd2', type: 'wine', loggedAt: new Date(NOW - 40 * MIN), multiplier: 1, hydrated: null },
        ],
      },
    } as unknown as Partial<UserState>),
    ledger: [],
  },
  {
    name: 'expired social drinks (drinks aged out)',
    state: makeState({
      socialMode: {
        active: true,
        drinks: [{ id: 'd1', type: 'beer', loggedAt: new Date(NOW - 8 * HOUR), multiplier: 1, hydrated: null }],
      },
    } as unknown as Partial<UserState>),
    ledger: [],
  },
  {
    name: 'clutch boost overlap (active + future boost expiry)',
    state: makeState({
      clutchActive: true,
      clutchDecayBoostUntil: new Date(NOW + 20 * MIN),
    } as unknown as Partial<UserState>),
    ledger: [],
  },
  {
    name: 'fresh confirmation delta',
    state: makeState({
      confirmationDelta: 2,
      confirmationDeltaSetAt: new Date(NOW - 2 * MIN),
    } as unknown as Partial<UserState>),
    ledger: [],
  },
  {
    name: 'stale confirmation delta (aged out of window)',
    state: makeState({
      confirmationDelta: 3,
      confirmationDeltaSetAt: new Date(NOW - 12 * HOUR),
    } as unknown as Partial<UserState>),
    ledger: [],
  },
  {
    name: 'biometrics populated (recovery / activity path)',
    state: makeState({
      biometrics: {
        appleHealth: {
          restingHeartRate: 52,
          hrv: 70,
          sleepHours: 7.5,
          steps: 9000,
          fetchedAt: new Date(NOW - 20 * MIN),
        },
      },
    } as unknown as Partial<UserState>),
    ledger: [makeLedgerContext({ hasFreshBiometrics: true, biometricsFetchedAtMs: NOW - 20 * MIN })],
  },
  {
    name: 'long-decay clamp-to-0 (24h since intake, nothing logged)',
    state: makeState({
      lastIntakeTime: new Date(NOW - 24 * HOUR),
      ozConsumedToday: 0,
      aforceUnitsToday: 0,
      intakeEvents: [],
      heatLoad: 10,
      sweatRate: 9,
      activityLevel: 9,
    }),
    ledger: [],
  },
  {
    name: 'high-intake clamp-to-100 (saturated boosts)',
    state: makeState({
      ozConsumedToday: 160,
      aforceUnitsToday: 6,
      complianceStreak: 30,
      lastIntakeTime: new Date(NOW - 1 * MIN),
      intakeEvents: [
        makeIntakeEvent({ id: 'x1', loggedAt: new Date(NOW - 1 * MIN), immediate: 8, delayed: 4 }),
        makeIntakeEvent({ id: 'x2', loggedAt: new Date(NOW - 3 * MIN), immediate: 8, delayed: 4 }),
      ],
    }),
    ledger: [],
  },
];

describe('scoreLedgerParity — projection is a score-equivalent no-op', () => {
  for (const { name, state, ledger } of matrix) {
    it(`parity holds: ${name}`, () => {
      const { projection, parity } = shadowCompareScoreFromLedger(state, ledger, NOW);

      expect(parity.inParity).toBe(true);
      expect(parity.score.equal).toBe(true);
      expect(parity.decayPerMinute.equal).toBe(true);
      expect(parity.minutesSinceLast.equal).toBe(true);
      expect(parity.contributionDrift).toEqual([]);

      // Every family fails closed to live today (verified no-op).
      for (const r of projection.resolutions) {
        expect(r.source).toBe('live');
      }
      const families = projection.resolutions.map((r) => r.family);
      expect(families).toContain('intake');
      expect(families).toContain('context');
    });
  }

  it('does not mutate the live state passed in', () => {
    const live = makeState({ intakeEvents: [makeIntakeEvent({ id: 'keep' })] });
    const before = JSON.stringify(live);
    projectScoreStateFromLedgerHybrid(live, [makeLedgerIntake()], NOW);
    expect(JSON.stringify(live)).toBe(before);
  });
});

describe('scoreLedgerParity — intake fails closed (no fabrication)', () => {
  it('returns lossless:false even with an in-window ledger intake matching the live list', () => {
    const live = makeState({ intakeEvents: [makeIntakeEvent({ id: 'evt-1' })] });
    const result = tryProjectIntakeEventsFromLedger(live, [makeLedgerIntake({ intakeEventId: 'evt-1' })], NOW);

    expect(result.lossless).toBe(false);
    expect(result.events).toBeNull();
    // Diagnostic reason reports the honest window membership it computed.
    if (!result.lossless) {
      expect(result.reason).toMatch(/impact decomposition/);
      expect(result.reason).toMatch(/ledgerWindow=1/);
      expect(result.reason).toMatch(/live=1/);
    }
  });

  it('reports zero in-window ledger intake when the ledger is empty', () => {
    const live = makeState({ intakeEvents: [makeIntakeEvent()] });
    const result = tryProjectIntakeEventsFromLedger(live, [], NOW);
    expect(result.lossless).toBe(false);
    if (!result.lossless) expect(result.reason).toMatch(/ledgerWindow=0/);
  });
});

describe('scoreLedgerParity — comparator is stricter than final-score equality', () => {
  it('CATCHES contribution drift that 0/100 clamping hides', () => {
    // Two states that both clamp to the SAME final score (100) via different
    // inputs, so final-score equality would falsely pass. The comparator must
    // flag the contribution drift.
    const a = makeState({
      ozConsumedToday: 200,
      aforceUnitsToday: 8,
      complianceStreak: 40,
      lastIntakeTime: new Date(NOW - 1 * MIN),
    });
    const b = makeState({
      ozConsumedToday: 60,
      aforceUnitsToday: 1,
      complianceStreak: 1,
      lastIntakeTime: new Date(NOW - 1 * MIN),
      heatLoad: 0,
      sweatRate: 0,
    });

    const ba = buildBreakdown(a, NOW);
    const bb = buildBreakdown(b, NOW);
    const parity = compareScoreParity(a, b, NOW);

    if (ba.score === bb.score) {
      // Same headline score but different inputs ⇒ drift must be caught.
      expect(parity.score.equal).toBe(true);
      expect(parity.inParity).toBe(false);
      expect(parity.contributionDrift.length).toBeGreaterThan(0);
    } else {
      // If they didn't actually clamp-collide, the comparator still reports
      // the score difference honestly.
      expect(parity.score.equal).toBe(false);
      expect(parity.inParity).toBe(false);
    }
  });

  it('reports inParity for identical states (sanity floor)', () => {
    const s = makeState();
    expect(compareScoreParity(s, s, NOW).inParity).toBe(true);
  });
});
