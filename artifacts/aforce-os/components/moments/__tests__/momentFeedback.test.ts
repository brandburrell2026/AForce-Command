/**
 * momentFeedback — unit tests for the DR-012 safety gates: minimum samples,
 * strict majority, bounded step/clamp, rolling window, ask-selectivity
 * (completed + prepared + high importance + once per moment + daily cap),
 * and adaptive-planner integration where every DR-010 guardrail still
 * applies after adjustment.
 */
import { describe, it, expect } from 'vitest';

import type { Moment } from '@/types/moments';
import {
  deriveLeadAdjustments,
  shouldAskFeedback,
  type MomentFeedbackRecord,
} from '@/services/momentFeedback';
import { planMomentNotifications } from '@/services/momentNotifications';
import {
  MOMENT_FEEDBACK_MIN_SAMPLES,
  MOMENT_LEAD_ADJUST_MAX_MIN,
  MOMENT_LEAD_ADJUST_STEP_MIN,
  MOMENT_PREP_WINDOW_MIN,
} from '@/config/hydroStateModel';

const NOW = new Date(2026, 7, 12, 12, 0, 0).toISOString();

function fb(
  feedback: MomentFeedbackRecord['feedback'],
  i: number,
  type: MomentFeedbackRecord['momentType'] = 'work',
): MomentFeedbackRecord {
  return { momentId: `m${i}`, momentType: type, feedback, atIso: NOW };
}

describe('deriveLeadAdjustments — DR-012 gates', () => {
  it('returns nothing below the minimum sample count', () => {
    const few = Array.from({ length: MOMENT_FEEDBACK_MIN_SAMPLES - 1 }, (_, i) =>
      fb('too_late', i),
    );
    expect(deriveLeadAdjustments(few, NOW)).toEqual({});
  });

  it('requires a strict majority — just-right dominance means no change', () => {
    const mixed = [
      fb('just_right', 1), fb('just_right', 2), fb('just_right', 3),
      fb('too_late', 4), fb('too_early', 5),
    ];
    expect(deriveLeadAdjustments(mixed, NOW)).toEqual({});
  });

  it('too-late majority fires EARLIER (+); too-early fires LATER (−); both step-bounded', () => {
    const late = Array.from({ length: 5 }, (_, i) => fb('too_late', i));
    expect(deriveLeadAdjustments(late, NOW)).toEqual({ work: MOMENT_LEAD_ADJUST_STEP_MIN });
    const early = Array.from({ length: 5 }, (_, i) => fb('too_early', i));
    expect(deriveLeadAdjustments(early, NOW)).toEqual({ work: -MOMENT_LEAD_ADJUST_STEP_MIN });
  });

  it('clamps at ±MOMENT_LEAD_ADJUST_MAX_MIN no matter how lopsided', () => {
    const pile = Array.from({ length: 40 }, (_, i) => fb('too_late', i));
    const adj = deriveLeadAdjustments(pile, NOW);
    expect(adj.work).toBeLessThanOrEqual(MOMENT_LEAD_ADJUST_MAX_MIN);
  });

  it('ignores records outside the rolling window', () => {
    const stale = Array.from({ length: 8 }, (_, i) => ({
      ...fb('too_late', i),
      atIso: new Date(2026, 3, 1).toISOString(),
    }));
    expect(deriveLeadAdjustments(stale, NOW)).toEqual({});
  });
});

describe('shouldAskFeedback — DR-012 Ruling 2 selectivity', () => {
  const base = {
    momentId: 'm1',
    importance: 'high',
    prepared: true,
    momentStartIso: new Date(2026, 7, 12, 9, 0, 0).toISOString(), // completed
  };

  it('asks only on completed + prepared + high importance', () => {
    expect(shouldAskFeedback(base, [], NOW)).toBe(true);
    expect(shouldAskFeedback({ ...base, prepared: false }, [], NOW)).toBe(false);
    expect(shouldAskFeedback({ ...base, importance: 'moderate' }, [], NOW)).toBe(false);
    expect(
      shouldAskFeedback(
        { ...base, momentStartIso: new Date(2026, 7, 12, 18, 0, 0).toISOString() },
        [],
        NOW,
      ),
    ).toBe(false); // not completed yet
  });

  it('asks once per moment and at most once per day', () => {
    const answered = [fb('just_right', 1)]; // momentId m1, today
    expect(shouldAskFeedback(base, answered, NOW)).toBe(false); // same moment
    expect(shouldAskFeedback({ ...base, momentId: 'm2' }, answered, NOW)).toBe(false); // daily cap
  });
});

describe('adaptive planner integration — DR-010 budget survives adjustment', () => {
  function m(id: string, hoursFromNow: number): Moment {
    const start = new Date(2026, 7, 12, 12, 0, 0);
    start.setMinutes(start.getMinutes() + Math.round(hoursFromNow * 60));
    return {
      id, source: 'manual', title: 'Meeting', type: 'work', importance: 'high',
      startAtIso: start.toISOString(), createdAtIso: NOW,
    };
  }

  it('shifts the fire time by the adjustment when adaptive', () => {
    const plan = planMomentNotifications(
      [m('a', 3)],
      { mode: 'important', leadMin: null, adaptive: true },
      NOW,
      { work: 15 },
    );
    const expected =
      Date.parse(m('a', 3).startAtIso) -
      (MOMENT_PREP_WINDOW_MIN.work.startBefore + 15) * 60_000;
    expect(Date.parse(plan[0]!.fireAtIso)).toBe(expected);
  });

  it('a negative adjustment can never push the fire past the moment start or into the past', () => {
    // Window start is 60 min before; −30 shifts to 30 min before — still valid.
    const plan = planMomentNotifications(
      [m('a', 3)],
      { mode: 'important', leadMin: null, adaptive: true },
      NOW,
      { work: -30 },
    );
    expect(Date.parse(plan[0]!.fireAtIso)).toBeLessThan(Date.parse(m('a', 3).startAtIso));
    // Starts in 30 min: adjusted fire would be at start−30 = NOW → past-due guard drops it.
    expect(
      planMomentNotifications(
        [m('b', 0.5)],
        { mode: 'important', leadMin: null, adaptive: true },
        NOW,
        { work: -30 },
      ),
    ).toEqual([]);
  });

  it('quiet hours still drop adaptive fires', () => {
    // Starts 23:45 → window 22:45; +30 earlier = 22:15 — still quiet hours.
    expect(
      planMomentNotifications(
        [m('q', 11.75)],
        { mode: 'important', leadMin: null, adaptive: true },
        NOW,
        { work: 30 },
      ),
    ).toEqual([]);
  });
});
