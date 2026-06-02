import { describe, expect, it } from 'vitest';

import {
  evaluateReminderPolicy,
  computeHeatIndexC,
  REMINDER_LEVELS,
  GUARDRAIL_MIN_GAP_FLOOR,
  GUARDRAIL_MAX_PER_DAY_CEIL,
  DEFAULT_SLEEP_START_MIN,
  DEFAULT_SLEEP_END_MIN,
  type ReminderContext,
  type ReminderLevel,
} from '../reminders/adaptivePolicy';

/** A neutral midday context that allows reminders by default. */
function ctx(overrides: Partial<ReminderContext> = {}): ReminderContext {
  return {
    level: 'standard',
    nowMinuteOfDay: 12 * 60, // noon — outside default sleep window
    responseRate: null,
    remindersShown: 0,
    workoutMinutesToday: 0,
    heatIndexC: null,
    goalProgress: 0,
    remindersSentToday: 0,
    minutesSinceLastReminder: null,
    ...overrides,
  };
}

describe('computeHeatIndexC', () => {
  it('returns null when temperature is unknown', () => {
    expect(computeHeatIndexC(null, 80)).toBeNull();
  });

  it('returns raw temp when humidity unknown or weather is cool', () => {
    expect(computeHeatIndexC(30, null)).toBe(30);
    expect(computeHeatIndexC(20, 90)).toBe(20);
  });

  it('raises apparent temperature in warm, humid conditions', () => {
    const felt = computeHeatIndexC(32, 90)!;
    expect(felt).toBeGreaterThan(32);
  });
});

describe('evaluateReminderPolicy — levels', () => {
  it('uses each level baseline when context is neutral', () => {
    (['minimal', 'standard', 'aggressive'] as ReminderLevel[]).forEach((level) => {
      const d = evaluateReminderPolicy(ctx({ level }));
      expect(d.allow).toBe(true);
      expect(d.reason).toBe('allowed');
      expect(d.intensity).toBeCloseTo(REMINDER_LEVELS[level].baseIntensity, 5);
    });
  });

  it('aggressive allows more per day and shorter gaps than minimal', () => {
    const min = evaluateReminderPolicy(ctx({ level: 'minimal' }));
    const agg = evaluateReminderPolicy(ctx({ level: 'aggressive' }));
    expect(agg.effectiveMaxPerDay).toBeGreaterThan(min.effectiveMaxPerDay);
    expect(agg.minGapMinutes).toBeLessThan(min.minGapMinutes);
  });
});

describe('evaluateReminderPolicy — sleep suppression', () => {
  it('suppresses inside the default quiet hours', () => {
    const d = evaluateReminderPolicy(ctx({ nowMinuteOfDay: 23 * 60 }));
    expect(d.allow).toBe(false);
    expect(d.reason).toBe('sleep');
  });

  it('handles the midnight wraparound (03:00 is still asleep)', () => {
    const d = evaluateReminderPolicy(ctx({ nowMinuteOfDay: 3 * 60 }));
    expect(d.allow).toBe(false);
    expect(d.reason).toBe('sleep');
  });

  it('allows just after the wake boundary', () => {
    const d = evaluateReminderPolicy(ctx({ nowMinuteOfDay: 8 * 60 }));
    expect(d.allow).toBe(true);
  });

  it('sleep beats every other signal, even active workout + heat', () => {
    const d = evaluateReminderPolicy(
      ctx({
        nowMinuteOfDay: DEFAULT_SLEEP_START_MIN + 30,
        workoutMinutesToday: 60,
        heatIndexC: 40,
      }),
    );
    expect(d.reason).toBe('sleep');
  });
});

describe('evaluateReminderPolicy — goal complete', () => {
  it('suppresses once the goal is met and no risk is present', () => {
    const d = evaluateReminderPolicy(ctx({ goalProgress: 1 }));
    expect(d.allow).toBe(false);
    expect(d.reason).toBe('goal_complete');
  });

  it('workout overrides goal-complete suppression (dehydration risk)', () => {
    const d = evaluateReminderPolicy(
      ctx({ goalProgress: 1.2, workoutMinutesToday: 45 }),
    );
    expect(d.allow).toBe(true);
  });

  it('heat overrides goal-complete suppression', () => {
    const d = evaluateReminderPolicy(
      ctx({ goalProgress: 1.5, heatIndexC: 33 }),
    );
    expect(d.allow).toBe(true);
  });
});

describe('evaluateReminderPolicy — guardrails', () => {
  it('suppresses when the daily cap is reached', () => {
    const base = evaluateReminderPolicy(ctx());
    const d = evaluateReminderPolicy(
      ctx({ remindersSentToday: base.effectiveMaxPerDay }),
    );
    expect(d.allow).toBe(false);
    expect(d.reason).toBe('daily_cap');
  });

  it('suppresses when the last reminder was too recent', () => {
    const base = evaluateReminderPolicy(ctx());
    const d = evaluateReminderPolicy(
      ctx({ minutesSinceLastReminder: base.minGapMinutes - 1 }),
    );
    expect(d.allow).toBe(false);
    expect(d.reason).toBe('min_gap');
  });

  it('allows once the gap has elapsed', () => {
    const base = evaluateReminderPolicy(ctx());
    const d = evaluateReminderPolicy(
      ctx({ minutesSinceLastReminder: base.minGapMinutes }),
    );
    expect(d.allow).toBe(true);
  });

  it('never drops below the min-gap floor or above the per-day ceiling', () => {
    const d = evaluateReminderPolicy(
      ctx({
        level: 'aggressive',
        workoutMinutesToday: 90,
        heatIndexC: 40,
      }),
    );
    expect(d.minGapMinutes).toBeGreaterThanOrEqual(GUARDRAIL_MIN_GAP_FLOOR);
    expect(d.effectiveMaxPerDay).toBeLessThanOrEqual(GUARDRAIL_MAX_PER_DAY_CEIL);
  });
});

describe('evaluateReminderPolicy — adaptation', () => {
  it('reduces the budget when reminders are repeatedly ignored', () => {
    const normal = evaluateReminderPolicy(ctx());
    const ignored = evaluateReminderPolicy(
      ctx({ responseRate: 0.1, remindersShown: 5 }),
    );
    expect(ignored.intensity).toBeLessThan(normal.intensity);
    expect(ignored.effectiveMaxPerDay).toBeLessThanOrEqual(
      normal.effectiveMaxPerDay,
    );
    expect(ignored.minGapMinutes).toBeGreaterThanOrEqual(normal.minGapMinutes);
  });

  it('does not treat a tiny sample as ignored', () => {
    const normal = evaluateReminderPolicy(ctx());
    const tinySample = evaluateReminderPolicy(
      ctx({ responseRate: 0, remindersShown: 1 }),
    );
    expect(tinySample.intensity).toBeCloseTo(normal.intensity, 5);
  });

  it('raises intensity after a workout', () => {
    const normal = evaluateReminderPolicy(ctx());
    const afterWorkout = evaluateReminderPolicy(
      ctx({ workoutMinutesToday: 30 }),
    );
    expect(afterWorkout.intensity).toBeGreaterThan(normal.intensity);
  });

  it('raises intensity during heat', () => {
    const normal = evaluateReminderPolicy(ctx());
    const hot = evaluateReminderPolicy(ctx({ heatIndexC: 35 }));
    expect(hot.intensity).toBeGreaterThan(normal.intensity);
  });
});

describe('evaluateReminderPolicy — boundary conditions', () => {
  const baseIntensity = REMINDER_LEVELS.standard.baseIntensity;

  it('counts the workout boundary (exactly 20 min) as a workout', () => {
    const at = evaluateReminderPolicy(ctx({ workoutMinutesToday: 20 }));
    const below = evaluateReminderPolicy(ctx({ workoutMinutesToday: 19 }));
    expect(at.intensity).toBeGreaterThan(baseIntensity);
    expect(below.intensity).toBeCloseTo(baseIntensity, 5);
  });

  it('counts the heat boundary (exactly 30°C) as heat', () => {
    const at = evaluateReminderPolicy(ctx({ heatIndexC: 30 }));
    const below = evaluateReminderPolicy(ctx({ heatIndexC: 29.9 }));
    expect(at.intensity).toBeGreaterThan(baseIntensity);
    expect(below.intensity).toBeCloseTo(baseIntensity, 5);
  });

  it('treats the sleep start minute as asleep and the end minute as awake', () => {
    const atStart = evaluateReminderPolicy(
      ctx({ nowMinuteOfDay: DEFAULT_SLEEP_START_MIN }),
    );
    const atEnd = evaluateReminderPolicy(
      ctx({ nowMinuteOfDay: DEFAULT_SLEEP_END_MIN }),
    );
    expect(atStart.allow).toBe(false);
    expect(atStart.reason).toBe('sleep');
    expect(atEnd.allow).toBe(true);
  });
});
