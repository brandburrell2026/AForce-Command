/**
 * scoreClockDeterminism — Phase 1 guardrail for the score-integration work.
 *
 * The score-number path (`buildBreakdown` / `calculateBaseScore`) now takes an
 * injectable `now` (epoch ms) so the score is a PURE function of `(state, now)`.
 * That purity is the contract the upcoming ledger-hybrid input projection will
 * rely on: live-state and ledger-derived inputs must produce the identical
 * number under the same clock, or Score-Protection parity cannot be proven.
 *
 * These tests lock that contract WITHOUT changing behaviour:
 *  - determinism: same (state, now) → byte-identical breakdown;
 *  - path agreement: `calculateBaseScore` === `buildBreakdown().score`;
 *  - default clock: omitting `now` is exactly `now = Date.now()`;
 *  - decay monotonicity: advancing `now` (more time since intake) never RAISES
 *    the score — proving the clock actually flows through decay/recency;
 *  - a golden snapshot pinning the exact score + every contribution delta.
 *
 * RN-free: imports only the pure `utils/scoring/breakdown` module.
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import type { UserState } from '../../types';
import { buildBreakdown, calculateBaseScore, minutesSince } from '../scoring/breakdown';

const MIN = 60_000;
const HOUR = 60 * MIN;

/** A fixed wall clock so every assertion is reproducible. */
const NOW = 1_700_000_000_000;

/**
 * Minimal UserState covering only the fields the score-number path reads.
 * Cast through `unknown` because the full UserState carries many fields the
 * breakdown never touches; building all of them would be brittle noise.
 */
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

afterEach(() => {
  vi.useRealTimers();
});

describe('score clock — purity & determinism', () => {
  it('buildBreakdown is a pure function of (state, now)', () => {
    const s = makeState();
    expect(buildBreakdown(s, NOW)).toEqual(buildBreakdown(s, NOW));
  });

  it('calculateBaseScore agrees with buildBreakdown().score under the same clock', () => {
    for (const over of [
      {},
      { ozConsumedToday: 96, aforceUnitsToday: 3 },
      { heatLoad: 9, sweatRate: 7, activityLevel: 9 },
      { symptomState: 'severe' as const, symptoms: ['cramp', 'headache'], urineSignal: 7 },
      { lastIntakeTime: new Date(NOW - 6 * HOUR) },
    ]) {
      const s = makeState(over);
      expect(calculateBaseScore(s, NOW)).toBe(buildBreakdown(s, NOW).score);
    }
  });

  it('omitting `now` is identical to passing Date.now()', () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    const s = makeState({ confirmationDelta: undefined });
    expect(buildBreakdown(s)).toEqual(buildBreakdown(s, NOW));
    expect(calculateBaseScore(s)).toBe(calculateBaseScore(s, NOW));
    expect(minutesSince(s.lastIntakeTime)).toBe(minutesSince(s.lastIntakeTime, NOW));
  });

  it('advancing the clock never RAISES the score (decay flows through now)', () => {
    // Intake fixed in the past, no time-positive term to confound the trend.
    const s = makeState({ lastIntakeTime: new Date(NOW - 20 * MIN) });
    const t0 = buildBreakdown(s, NOW).score;
    const t1 = buildBreakdown(s, NOW + 1 * HOUR).score;
    const t2 = buildBreakdown(s, NOW + 4 * HOUR).score;
    expect(t1).toBeLessThanOrEqual(t0);
    expect(t2).toBeLessThanOrEqual(t1);
  });

  it('the confirmation ±delta no longer reaches the score at all (v1.0)', () => {
    // This law used to prove the confirmation bonus EXPIRED on the injected
    // clock. Under HydroState v1.0 it does not expire — it is not there.
    // Confirming that you obeyed the last command is conduct, not physiology,
    // and the founder ruling removed it from the score entirely. The law is
    // kept, inverted, so the term cannot quietly return.
    const withDelta = makeState({ confirmationDelta: 3, confirmationDeltaSetAt: new Date(NOW - 10 * MIN) });
    const without = makeState({});
    expect(buildBreakdown(withDelta, NOW).score).toBe(buildBreakdown(without, NOW).score);
    expect(buildBreakdown(withDelta, NOW).contributions.find((c) => c.id === 'confirmation')).toBeUndefined();
    // A maximal streak must be equally inert.
    const streaky = makeState({ complianceStreak: 30 });
    expect(buildBreakdown(streaky, NOW).score).toBe(buildBreakdown(without, NOW).score);
  });
});

describe('score clock — purity through the social-mode path', () => {
  // Regression guard: the social helpers (`socialIntakePoints`,
  // `activeDecayMultiplier`) default their own clock to Date.now(). The score
  // path must pass `now` into them, or a state with active drinks silently
  // becomes non-deterministic — which would break ledger parity later.
  const withDrink = (): UserState => {
    const s = makeState();
    (s as unknown as { socialMode: unknown }).socialMode = {
      active: true,
      drinks: [{ id: 'd1', type: 'beer', loggedAt: new Date(NOW - 15 * MIN), multiplier: 1.3, hydrated: null }],
    };
    return s;
  };

  it('the social penalty is pure in (state, now)', () => {
    const s = withDrink();
    expect(buildBreakdown(s, NOW)).toEqual(buildBreakdown(s, NOW));
  });

  it('omitting `now` matches Date.now() even with active drinks', () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    const s = withDrink();
    expect(buildBreakdown(s)).toEqual(buildBreakdown(s, NOW));
    expect(calculateBaseScore(s)).toBe(calculateBaseScore(s, NOW));
  });

  it('the social-mode penalty shrinks as the injected clock advances', () => {
    const s = withDrink();
    const c0 = buildBreakdown(s, NOW).contributions.find((c) => c.id === 'social_intake');
    const c1 = buildBreakdown(s, NOW + 90 * MIN).contributions.find((c) => c.id === 'social_intake');
    expect(c0?.delta ?? 0).toBeLessThan(0);
    expect(Math.abs(c1?.delta ?? 0)).toBeLessThanOrEqual(Math.abs(c0?.delta ?? 0));
  });
});

describe('score clock — golden breakdown (locks exact numbers)', () => {
  it('a representative state produces a stable score + contributions', () => {
    const golden = makeState({
      ozConsumedToday: 48,
      ozTarget: 96,
      aforceUnitsToday: 1,
      complianceStreak: 3,
      heatLoad: 6,
      sweatRate: 4,
      activityLevel: 5,
      urineSignal: 4,
      symptomState: 'mild',
      symptoms: ['headache'],
      overnightLossOz: 0,
      lastIntakeTime: new Date(NOW - 45 * MIN),
      bodyWeightLbs: 180,
      isAwake: true,
    });
    expect(buildBreakdown(golden, NOW)).toMatchInlineSnapshot(`
      {
        "contributions": [
          {
            "delta": 45,
            "hint": "48 of 96 ounces · 50% of target",
            "id": "base",
            "label": "Hydration (vs your target)",
            "maxMagnitude": 89,
          },
          {
            "delta": -37,
            "hint": "45 min · 0.82 pts/min",
            "id": "recency",
            "label": "Decay since last intake",
            "maxMagnitude": 35,
          },
          {
            "delta": -8,
            "hint": "1 active",
            "id": "symptom",
            "label": "Performance signals",
            "maxMagnitude": 30,
          },
          {
            "delta": -4,
            "hint": "Level 4/8",
            "id": "urine",
            "label": "Hydration signal (1-8)",
            "maxMagnitude": 20,
          },
          {
            "delta": 0,
            "hint": "Not connected",
            "id": "health_signals",
            "label": "Health platforms (none connected)",
            "maxMagnitude": 10,
          },
        ],
        "decayPerMinute": 0.8202472,
        "evidence": {
          "confidence": "low",
          "intakeRecent": true,
          "materialContradiction": true,
          "observedSources": 1,
          "peakEligible": false,
          "positiveCorroborations": 0,
        },
        "factorDeltas": {
          "base": 44.5,
          "clamped": 4,
          "health_signals": 0,
          "raw": -4.5,
          "recency": -37,
          "social_intake": 0,
          "symptom": -8,
          "urine": -4,
        },
        "level": "DEPLETED",
        "minutesSinceLast": 45,
        "score": 0,
      }
    `);
  });
});
