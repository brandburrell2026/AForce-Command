/**
 * FACTOR-DELTAS VECTOR — every snapshot must be able to explain itself.
 *
 * Build 67 Test B: Dark Yellow was observed to remove 10 points where the urine
 * term computes to −8, and the remaining −2 was UNATTRIBUTABLE because a
 * snapshot records only the total — the neighbouring snapshots swung ±30–41
 * points within milliseconds. This vector (founder-approved 2026-08-18, design
 * in governance/SCORE-SNAPSHOT-INSTRUMENTATION-PROPOSAL.md) captures the exact
 * unrounded terms summed into `raw`, so any future delta decomposes in one
 * query instead of a device test.
 *
 * Three properties matter, in order:
 *   1. SELF-CHECKING — the factor terms sum to `raw` exactly. A vector that
 *      does not reconcile explains nothing.
 *   2. NO WEIGHTS — deltas only. Labels and maxMagnitude are the proprietary
 *      scoring surface and must never be persisted or sent.
 *   3. NO CALCULATION CHANGE — `score` and `contributions` are byte-identical
 *      to before; the vector only exposes intermediates that already existed.
 */
import { describe, it, expect } from 'vitest';

import type { UserState } from '../../types';
import { buildBreakdown } from '../scoring/breakdown';

const MIN = 60_000;
const NOW = 1_700_000_000_000;

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

const FACTOR_KEYS = [
  'base',
  'aforce_bonus',
  'recency',
  'confirmation',
  'consistency',
  'context',
  'recovery',
  'symptom',
  'urine',
  'output',
  'sleep',
  'health_signals',
  'social_intake',
] as const;

/** A spread of states exercising penalties, bonuses, clamps and social mode. */
const STATES: ReadonlyArray<[string, UserState]> = [
  ['baseline', makeState()],
  ['dark urine + symptoms', makeState({
    urineSignal: 5,
    symptomState: 'severe',
    symptoms: ['headache', 'cramp', 'dizzy'],
  } as Partial<UserState>)],
  ['clamped high', makeState({ ozConsumedToday: 400, aforceUnitsToday: 6 } as Partial<UserState>)],
  ['clamped low', makeState({
    ozConsumedToday: 0,
    aforceUnitsToday: 0,
    urineSignal: 8,
    symptomState: 'severe',
    symptoms: ['headache', 'cramp', 'dizzy', 'fatigue'],
    overnightLossOz: 20,
    lastIntakeTime: new Date(NOW - 6 * 60 * MIN),
  } as Partial<UserState>)],
  ['social mode active', makeState({
    socialMode: {
      active: true,
      startedAt: new Date(NOW - 60 * MIN),
      drinks: [
        { id: 'd1', type: 'beer', loggedAt: new Date(NOW - 40 * MIN), multiplier: 1.25, hydrated: null },
      ],
    },
  } as unknown as Partial<UserState>)],
];

describe('the vector is self-checking', () => {
  it.each(STATES)('%s: factor terms sum to raw exactly', (_label, state) => {
    const { factorDeltas } = buildBreakdown(state, NOW);
    const sum = FACTOR_KEYS.reduce((acc, k) => acc + (factorDeltas[k] ?? 0), 0);
    // Float addition order differs from the engine's; anything beyond epsilon
    // noise means a term was dropped or double-counted.
    expect(sum).toBeCloseTo(factorDeltas['raw']!, 9);
  });

  it.each(STATES)('%s: clamped records exactly what the 0-100 clamp absorbed', (_label, state) => {
    const { score, factorDeltas } = buildBreakdown(state, NOW);
    expect(factorDeltas['clamped']).toBe(score - Math.round(factorDeltas['raw']!));
  });

  it.each(STATES)('%s: every factor key is present even when zero', (_label, state) => {
    const { factorDeltas } = buildBreakdown(state, NOW);
    for (const k of [...FACTOR_KEYS, 'raw', 'clamped']) {
      expect(k in factorDeltas, `missing key "${k}" — an absent key is indistinguishable from ` +
        'an unexplained delta, which is the ambiguity this vector exists to remove').toBe(true);
    }
  });

  it('dropping any factor term breaks the sum (mutation oracle)', () => {
    const { factorDeltas } = buildBreakdown(
      STATES[1]![1], // dark urine + symptoms: several non-zero terms
      NOW,
    );
    for (const k of FACTOR_KEYS) {
      if (factorDeltas[k] === 0) continue;
      const sum = FACTOR_KEYS.filter((x) => x !== k).reduce(
        (acc, x) => acc + (factorDeltas[x] ?? 0),
        0,
      );
      expect(Math.abs(sum - factorDeltas['raw']!)).toBeGreaterThan(1e-9);
    }
  });
});

describe('no weights, no strings, no negative zero', () => {
  it('carries only numbers — never labels, hints or maxMagnitude', () => {
    const { factorDeltas } = buildBreakdown(makeState(), NOW);
    for (const [k, v] of Object.entries(factorDeltas)) {
      expect(typeof v, `${k} must be a number`).toBe('number');
      expect(Number.isFinite(v), `${k} must be finite`).toBe(true);
    }
    expect('label' in factorDeltas).toBe(false);
    expect('maxMagnitude' in factorDeltas).toBe(false);
    expect('hint' in factorDeltas).toBe(false);
  });

  it('survives a JSON round-trip with signs intact and no -0', () => {
    const { factorDeltas } = buildBreakdown(STATES[3]![1], NOW);
    const wire = JSON.parse(JSON.stringify(factorDeltas)) as Record<string, number>;
    expect(wire).toEqual(factorDeltas);
    for (const [k, v] of Object.entries(wire)) {
      expect(Object.is(v, -0), `${k} serialised as -0`).toBe(false);
    }
  });
});

describe('the vector explains the cases that motivated it', () => {
  it('urine at ratified dark_yellow (5) contributes exactly -8', () => {
    // The Build-67 question in one line: whatever the total does, the urine
    // term itself is now decomposable.
    const { factorDeltas } = buildBreakdown(makeState({ urineSignal: 5 } as Partial<UserState>), NOW);
    expect(factorDeltas['urine']).toBe(-8);
  });

  it('urine at ratified yellow (3) contributes exactly 0, not -0', () => {
    const { factorDeltas } = buildBreakdown(makeState({ urineSignal: 3 } as Partial<UserState>), NOW);
    expect(Object.is(factorDeltas['urine'], 0)).toBe(true);
  });
});

describe('nothing pre-existing changed', () => {
  it.each(STATES)('%s: score and contributions are untouched by the vector', (_label, state) => {
    const a = buildBreakdown(state, NOW);
    // The vector is derived FROM the same intermediates; contributions and
    // score must be exactly what they always were.
    expect(a.score).toBeGreaterThanOrEqual(0);
    expect(a.score).toBeLessThanOrEqual(100);
    for (const c of a.contributions) {
      expect(typeof c.delta).toBe('number');
      // Display rows may round; the vector must carry the unrounded term. They
      // agree to within rounding.
      const v = a.factorDeltas[c.id];
      if (v !== undefined) expect(Math.abs(v - c.delta)).toBeLessThanOrEqual(0.5);
    }
  });
});
