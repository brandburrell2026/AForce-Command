/**
 * PEAK eligibility on the CANONICAL PRODUCTION PATH.
 *
 * Every other v1.0 law tests `buildBreakdown` or the `hydroStateV1` helpers.
 * This one goes through `calculateScore` — the function the app, the store and
 * the api-server payload actually call — because that is where the rule was
 * silently absent: `scoringEngine.ts` re-derived the band from the score alone,
 * so a fully-evidenced eligibility verdict was computed, returned, and thrown
 * away one line later. The engine could label a contradicted member PEAK while
 * every unit test on the model passed.
 *
 * These laws therefore assert on `calculateScore(...).performanceState.level`,
 * the value that reaches the member's screen. The call site they protect is a
 * founder-authorized exception to the protected-file rule (2026-09-01), so the
 * cost of it silently regressing is higher than usual.
 */
import { describe, it, expect } from 'vitest';
import { calculateScore } from '../scoringEngine';
import { buildBreakdown } from '../scoring/breakdown';
import type { UserState, IntakeEvent, ProviderBiometrics } from '../../types';

const NOW = new Date('2026-09-01T12:00:00Z').getTime();
const MIN = 60_000;

function events(totalOz: number, lastMin: number): IntakeEvent[] {
  const n = Math.max(1, Math.round(totalOz / 16));
  return Array.from({ length: n }, (_, k) => {
    const oz = totalOz / n;
    return {
      id: `e${k}`, fluidType: 'water', oz,
      loggedAt: new Date(NOW - (lastMin + k * 45) * MIN),
      baseImpact: oz * 0.5, capAdjusted: oz * 0.5, immediate: oz * 0.3, delayed: oz * 0.2,
      delayedDurationMin: 12.5, heatGuardActiveAtLog: false, scoreBeforeAtLog: 50,
    } as IntakeEvent;
  });
}

/** A member comfortably past the PEAK score threshold on volume + evidence. */
function state(over: Partial<UserState> = {}): UserState {
  return {
    unitsConsumedToday: 0, ozConsumedToday: 110, aforceUnitsToday: 0, ozTarget: 96,
    intakeEvents: events(110, 5), lastIntakeTime: new Date(NOW - 5 * MIN),
    lastIntakeType: 'water', symptomState: 'none', symptoms: [], urineSignal: 3,
    energyState: 'steady', heatLoad: 0, sweatRate: 0, activityLevel: 0,
    complianceStreak: 0, dailyTarget: 8, isSnoozed: false, snoozeUntil: null,
    bodyWeightLbs: 180, isAwake: true, wakeTime: null, overnightLossOz: 0,
    hasSeenMorningCommand: true, ...over,
  } as UserState;
}

const GOOD_WEARABLE = {
  biometrics: {
    apple_health: {
      providerId: 'apple_health', hrvSdnn: 68, sleepHours: 8, fetchedAt: NOW,
    },
  } as unknown as ProviderBiometrics,
};

const level = (s: UserState) => calculateScore(s, NOW).performanceState.level;
const score = (s: UserState) => calculateScore(s, NOW).score;

describe('canonical engine — PEAK requires corroborated physiology', () => {
  it('≥90 + positive corroboration + no contradiction → PEAK', () => {
    const s = state({ urineSignal: 1 });          // score 97, no wearable
    expect(score(s)).toBeGreaterThanOrEqual(90);
    expect(level(s)).toBe('PEAK');
  });

  it('≥90 + a material contradiction → NOT PEAK', () => {
    // Measured fixture, chosen so the score stays ABOVE the threshold while the
    // contradiction is present — otherwise the law would pass for the wrong
    // reason, proving only that a low score is not PEAK. A clear reading and a
    // good wearable carry this member to 94; mild symptoms contradict it.
    const s = state({ urineSignal: 1, ...GOOD_WEARABLE, symptomState: 'mild', symptoms: ['headache'] });
    expect(score(s)).toBeGreaterThanOrEqual(90);   // ANTI-VACUITY: 94
    expect(level(s)).toBe('BALANCED');             // refused, not downgraded further

    // Concentrated urine contradicts the same way.
    const dark = state({ urineSignal: 5, ...GOOD_WEARABLE });
    expect(level(dark)).not.toBe('PEAK');
  });

  it('≥90 with NO positive corroboration is STRUCTURALLY unreachable', () => {
    // Stronger than the gate, and worth stating separately: the only positive
    // terms in v1.0 are volume, urine and biometrics. With neutral urine and no
    // wearable, the ceiling (89) is one point below the threshold (90), so no
    // amount of drinking can produce a PEAK-scoring member with nothing
    // corroborating it. The gate is the belt; this is the braces.
    for (const oz of [110, 200, 400, 1000, 5000]) {
      const s = state({ ozConsumedToday: oz, intakeEvents: events(oz, 5) });
      expect(score(s)).toBeLessThan(90);
      expect(level(s)).not.toBe('PEAK');
    }
    // And a present-but-neutral wearable is coverage, not corroboration: it
    // must not by itself unlock the band either.
    const neutralWearable = state({
      ozConsumedToday: 400, intakeEvents: events(400, 5),
      biometrics: { apple_health: { providerId: 'apple_health', hrvSdnn: 35, fetchedAt: NOW } } as unknown as ProviderBiometrics,
    });
    expect(level(neutralWearable)).not.toBe('PEAK');
  });

  it('favourable urine supports PEAK with NO wearable at all', () => {
    const s = state({ urineSignal: 1 });
    expect(s.biometrics).toBeUndefined();
    expect(s.appleHealth).toBeUndefined();
    expect(level(s)).toBe('PEAK');                 // no hardware paywall
  });

  it('a missing wearable does not reduce HydroState', () => {
    const without = state({ urineSignal: 1 });
    const withOne = state({ urineSignal: 1, ...GOOD_WEARABLE });
    // A wearable may ADD points when it reports something favourable; its
    // ABSENCE must never subtract. Same band either way.
    expect(score(without)).toBeLessThanOrEqual(score(withOne));
    expect(level(without)).toBe('PEAK');
    expect(level(withOne)).toBe('PEAK');
    // The no-wearable member is not pushed below anyone on account of hardware:
    // strip the device from an identical member and the score must not fall
    // below what their own physiology already earned.
    expect(score(without)).toBe(97);
    expect(score(withOne)).toBe(100);
  });

  it('the engine band never contradicts the breakdown verdict it came from', () => {
    for (const s of [
      state({ urineSignal: 1 }),
      state({ urineSignal: 1, ...GOOD_WEARABLE, symptomState: 'mild', symptoms: ['headache'] }),
      state({ urineSignal: 5, ...GOOD_WEARABLE }),
      state({ urineSignal: 3 }),
      state({ ozConsumedToday: 20, intakeEvents: events(20, 5) }),
    ]) {
      const out = calculateScore(s, NOW);
      const verdict = buildBreakdown(s, NOW);
      // The exact regression this file exists to catch: the engine deriving a
      // band from the score alone while the breakdown said otherwise.
      expect(out.performanceState.level).toBe(verdict.level);
      if (out.performanceState.level === 'PEAK') {
        expect(out.score).toBeGreaterThanOrEqual(90);
        expect(verdict.evidence.peakEligible).toBe(true);
        expect(verdict.evidence.materialContradiction).toBe(false);
      }
    }
  });
});
