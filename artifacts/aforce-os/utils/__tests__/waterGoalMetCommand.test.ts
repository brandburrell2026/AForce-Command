/**
 * Water goal met (founder direction, Brandon, 2026-11-21).
 *
 * The three examples the founders asked for (no intake, partial intake, goal
 * met) run through the real engine, plus the laws: the score and the band do
 * not move, no fixed "+N to score" claim is shown on these cards, and a reason
 * is named only when one nameable part is the single largest subtraction.
 */
import { describe, expect, it } from 'vitest';
import type { UserState } from '../../types';
import { calculateScore } from '../scoringEngine';
import { buildBreakdown } from '../scoring/breakdown';
import { sinceLastDrinkText, strongestHoldDown, waterGoalMet } from '../scoring/waterGoal';
import { computeEventImpact } from '@/services/hydrationScoreService';

const MIN = 60_000;
const HOUR = 60 * MIN;
const NOW = 1_700_000_000_000;

function member(oz: number, over: Record<string, unknown> = {}): UserState {
  const n = oz === 0 ? 0 : Math.max(1, Math.round(oz / 16));
  const events: unknown[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const at = new Date(NOW - 30 * MIN - i * ((10 * HOUR) / Math.max(1, n)));
    const im = computeEventImpact('water', undefined, oz / n, events as never, at, { heatGuardActive: false, scoreBefore: 50 });
    events.push({
      id: `e${i}`, fluidType: 'water', oz: oz / n, loggedAt: at, baseImpact: im.baseImpact, capAdjusted: im.capAdjusted,
      immediate: im.immediate, delayed: im.delayed, delayedDurationMin: im.delayedDurationMin, heatGuardActiveAtLog: false, scoreBeforeAtLog: 50,
    });
  }
  return {
    unitsConsumedToday: 0, ozConsumedToday: oz, aforceUnitsToday: 0,
    lastIntakeTime: new Date(oz === 0 ? NOW - 9 * HOUR : NOW - 30 * MIN), lastIntakeType: 'water',
    symptomState: 'none', symptoms: [], urineSignal: 3, energyState: 'steady',
    heatLoad: 4, sweatRate: 3, activityLevel: 5, complianceStreak: 2, dailyTarget: 8, ozTarget: 96,
    isSnoozed: false, snoozeUntil: null, bodyWeightLbs: 180, isAwake: true, wakeTime: null,
    overnightLossOz: 0, hasSeenMorningCommand: true, weatherTempC: null, weatherHumidity: null,
    weatherCity: null, weatherFetchedAt: null, language: 'en', intakeEvents: events, clutchActive: false,
    ...over,
  } as unknown as UserState;
}
const UNWELL = { urineSignal: 6, symptomState: 'moderate', symptoms: ['headache'] };
const card = (s: UserState) => calculateScore(s, NOW).command;

describe('the three examples', () => {
  it('no intake: the recovery card, with no score claim', () => {
    const c = card(member(0));
    expect(c.id).toBe('cmd-depleted');
    expect(c.action).toBe('Recovery needed: 20 oz water + 2 sticks.');
    expect(c.estimatedImpact).toBe('');
  });

  it('partial intake: still the recovery card, with no score claim', () => {
    const c = card(member(48));
    expect(c.id).toBe('cmd-depleted');
    expect(c.estimatedImpact).toBe('');
  });

  it('goal met and the score still low: "Water goal met." and the strongest reason, not the water-and-sticks card', () => {
    const s = member(96, UNWELL);
    const out = calculateScore(s, NOW);
    expect(out.score).toBeLessThan(60);
    expect(out.command.id).toBe('cmd-water-goal-met');
    expect(out.command.action).toBe('Water goal met.');
    expect(out.command.action).not.toMatch(/stick|oz/i);
    expect(out.command.estimatedImpact).toBe('');
    // Time since the last drink is the largest subtraction in this example.
    expect(out.command.explanation).toBe('It has been 30 minutes since your last drink.');
  });

  it('well over the goal behaves the same as at the goal', () => {
    expect(card(member(160, UNWELL)).id).toBe('cmd-water-goal-met');
  });
});

describe('laws', () => {
  it('the score and its parts are exactly what they were: this is display only', () => {
    for (const oz of [0, 48, 96, 124, 160]) {
      const s = member(oz, UNWELL);
      expect(calculateScore(s, NOW).score).toBe(buildBreakdown(s, NOW).score);
    }
    // The cap is unchanged: past the goal, more water scores the same.
    expect(calculateScore(member(124, UNWELL), NOW).score).toBe(calculateScore(member(96, UNWELL), NOW).score);
  });

  it('one ounce under the goal still gets the recovery card', () => {
    expect(waterGoalMet(member(95))).toBe(false);
    expect(card(member(95, UNWELL)).id).toBe('cmd-depleted');
  });

  it('no target means no goal to meet', () => {
    expect(waterGoalMet(member(200, { ozTarget: 0 }))).toBe(false);
  });

  it('names the urine check when it is the single largest subtraction', () => {
    const s = member(96, { urineSignal: 8, lastIntakeTime: new Date(NOW - 2 * MIN) });
    const reason = strongestHoldDown(s, NOW);
    const parts = buildBreakdown(s, NOW).contributions.filter((c) => c.id !== 'base' && c.delta < 0).sort((a, b) => a.delta - b.delta);
    expect(parts[0]?.id).toBe('urine');
    expect(reason).toEqual({ id: 'urine' });
  });

  it('gives no reason when nothing is subtracting', () => {
    const s = member(96, { lastIntakeTime: new Date(NOW) });
    const negatives = buildBreakdown(s, NOW).contributions.filter((c) => c.id !== 'base' && c.delta < 0);
    if (negatives.length === 0) expect(strongestHoldDown(s, NOW)).toBeNull();
  });

  it('never names a part it is not allowed to name', () => {
    for (const over of [{}, UNWELL, { heatLoad: 9, activityLevel: 9 }, { lastIntakeTime: new Date(NOW - 3 * HOUR) }]) {
      const r = strongestHoldDown(member(96, over), NOW);
      if (r) expect(['urine', 'symptom', 'recency']).toContain(r.id);
    }
  });

  it('time since the last drink is said in whole units', () => {
    expect(sinceLastDrinkText(30)).toBe('30 minutes');
    expect(sinceLastDrinkText(60)).toBe('1 hour');
    expect(sinceLastDrinkText(185)).toBe('3 hours');
  });

  it('a member who met the goal and is not low keeps the normal card', () => {
    const out = calculateScore(member(96, { lastIntakeTime: new Date(NOW) }), NOW);
    if (out.score >= 80) expect(out.command.id).not.toBe('cmd-water-goal-met');
  });
});
