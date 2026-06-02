import { describe, it, expect } from 'vitest';

import {
  buildDailyWins,
  topDailyWin,
  type DailyWinInput,
} from '../dailyWins';

/** A neutral baseline that earns NO win — every test opts in explicitly. */
function base(overrides: Partial<DailyWinInput> = {}): DailyWinInput {
  return {
    complianceStreak: 0,
    unitsConsumedToday: 0,
    dailyTarget: 8,
    ozConsumedToday: 0,
    ozTarget: 64,
    correctionCompleted: false,
    recoveryTrend: 'stable',
    recovery: 50,
    ...overrides,
  };
}

describe('dailyWins — positive reinforcement only', () => {
  it('returns no win and null when nothing is earned (never a downer)', () => {
    expect(buildDailyWins(base())).toEqual([]);
    expect(topDailyWin(base())).toBeNull();
  });

  it('surfaces a 7-day streak above every other win', () => {
    const top = topDailyWin(
      base({
        complianceStreak: 7,
        unitsConsumedToday: 8,
        recoveryTrend: 'rising',
        recovery: 90,
      }),
    );
    expect(top?.id).toBe('seven_day_streak');
  });

  it('surfaces a 3-day streak between 3 and 6 days', () => {
    expect(topDailyWin(base({ complianceStreak: 3 }))?.id).toBe('three_day_streak');
    expect(topDailyWin(base({ complianceStreak: 6 }))?.id).toBe('three_day_streak');
  });

  it('treats an early 1-2 day streak as building consistency', () => {
    expect(buildDailyWins(base({ complianceStreak: 1 })).map((w) => w.id)).toContain(
      'hydration_consistency',
    );
    expect(buildDailyWins(base({ complianceStreak: 2 })).map((w) => w.id)).toContain(
      'hydration_consistency',
    );
  });

  it('streak tiers are mutually exclusive', () => {
    const ids = buildDailyWins(
      base({ complianceStreak: 7, unitsConsumedToday: 8 }),
    ).map((w) => w.id);
    expect(ids).toContain('seven_day_streak');
    expect(ids).not.toContain('three_day_streak');
    expect(ids).not.toContain('hydration_consistency');
  });

  it('celebrates hitting the daily goal (units >= target)', () => {
    const ids = buildDailyWins(
      base({ unitsConsumedToday: 8, dailyTarget: 8 }),
    ).map((w) => w.id);
    expect(ids).toContain('daily_goal');
  });

  it('does not claim the daily goal when the target is zero', () => {
    const ids = buildDailyWins(
      base({ unitsConsumedToday: 0, dailyTarget: 0 }),
    ).map((w) => w.id);
    expect(ids).not.toContain('daily_goal');
  });

  it('rewards a single completed water cycle (small, frequent win)', () => {
    expect(topDailyWin(base({ unitsConsumedToday: 1 }))?.id).toBe('water_cycle');
  });

  it('rising recovery while still climbing reads as a trend win', () => {
    expect(
      topDailyWin(base({ recoveryTrend: 'rising', recovery: 60 }))?.id,
    ).toBe('recovery_trend');
  });

  it('rising recovery already high reads as stabilized faster', () => {
    expect(
      topDailyWin(base({ recoveryTrend: 'rising', recovery: 85 }))?.id,
    ).toBe('stabilized_faster');
  });

  it('does not emit recovery wins when the trend is flat or declining', () => {
    for (const trend of ['stable', 'declining'] as const) {
      const ids = buildDailyWins(base({ recoveryTrend: trend, recovery: 90 })).map(
        (w) => w.id,
      );
      expect(ids).not.toContain('recovery_trend');
      expect(ids).not.toContain('stabilized_faster');
    }
  });

  it('celebrates a completed correction', () => {
    const ids = buildDailyWins(base({ correctionCompleted: true })).map((w) => w.id);
    expect(ids).toContain('first_correction');
  });

  it('returns wins sorted by descending priority', () => {
    const wins = buildDailyWins(
      base({
        complianceStreak: 3,
        unitsConsumedToday: 8,
        dailyTarget: 8,
        correctionCompleted: true,
      }),
    );
    const priorities = wins.map((w) => w.priority);
    expect(priorities).toEqual([...priorities].sort((a, b) => b - a));
  });

  it('topDailyWin is exactly the highest-priority win when several coexist', () => {
    const input = base({
      complianceStreak: 3,
      unitsConsumedToday: 8,
      dailyTarget: 8,
      correctionCompleted: true,
      recoveryTrend: 'rising',
      recovery: 60,
    });
    const wins = buildDailyWins(input);
    expect(wins.length).toBeGreaterThan(1);
    expect(topDailyWin(input)).toEqual(wins[0]);
    expect(wins[0].priority).toBe(Math.max(...wins.map((w) => w.priority)));
  });

  it('every win line is short, single-line, and free of penalty language', () => {
    const wins = buildDailyWins(
      base({
        complianceStreak: 7,
        unitsConsumedToday: 8,
        dailyTarget: 8,
        correctionCompleted: true,
        recoveryTrend: 'rising',
        recovery: 90,
      }),
    );
    expect(wins.length).toBeGreaterThan(0);
    const banned = /(fail|missed|behind|penalty|guilt|shame|bad|don.t|stop|warning)/i;
    for (const w of wins) {
      expect(w.text.length).toBeGreaterThan(0);
      expect(w.text).not.toMatch(/\n/);
      expect(w.text.length).toBeLessThanOrEqual(48);
      expect(w.text).not.toMatch(banned);
    }
  });
});
