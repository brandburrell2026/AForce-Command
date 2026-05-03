import { describe, it, expect } from 'vitest';
import { computeRecapStats } from '../journalRecapStats';
import type { JournalRollup } from '../../types';

const r = (date: string, avgScore: number, extra: Partial<JournalRollup> = {}): JournalRollup => ({
  date,
  snapshotsCount: 6,
  avgScore,
  minScore: Math.max(0, avgScore - 10),
  maxScore: Math.min(100, avgScore + 10),
  endOzConsumed: 80,
  endAforceUnits: 2,
  endUnitsConsumed: 2,
  endSodiumDelivered: 800,
  endSodiumLost: 600,
  endDeficitPct: 5,
  pctTimePeak: 30,
  pctTimeBalanced: 50,
  pctTimeRecovering: 15,
  pctTimeDepleted: 5,
  intakeCount: 4,
  autopilotSessions: 0,
  socialSessions: 0,
  ...extra,
});

describe('computeRecapStats', () => {
  it('returns zeros when no rollups', () => {
    const s = computeRecapStats([]);
    expect(s).toEqual({
      avgScore: 0,
      peakScore: 0,
      daysTracked: 0,
      bestStreak: 0,
      totalOunces: 0,
      totalSticks: 0,
    });
  });

  it('averages and finds the peak across the window', () => {
    const s = computeRecapStats([r('2026-04-25', 60), r('2026-04-26', 80), r('2026-04-27', 100)]);
    expect(s.avgScore).toBe(80);
    expect(s.peakScore).toBe(100);
    expect(s.daysTracked).toBe(3);
  });

  it('uses the LAST rollup for cumulative ounces and sticks (snapshot-of-now semantics)', () => {
    const s = computeRecapStats([
      r('2026-04-25', 70, { endOzConsumed: 50, endAforceUnits: 1 }),
      r('2026-04-26', 70, { endOzConsumed: 120, endAforceUnits: 3 }),
    ]);
    expect(s.totalOunces).toBe(120);
    expect(s.totalSticks).toBe(3);
  });

  it('counts longest consecutive-calendar-day streak at avgScore >= threshold', () => {
    // 3 in a row, break, then 2 in a row → bestStreak = 3
    const s = computeRecapStats([
      r('2026-04-22', 80),
      r('2026-04-23', 90),
      r('2026-04-24', 75),
      r('2026-04-25', 50), // break (sub-threshold)
      r('2026-04-26', 80),
      r('2026-04-27', 80),
    ]);
    expect(s.bestStreak).toBe(3);
  });

  it('breaks the streak on a calendar gap, not just on a sub-threshold day', () => {
    // 4/22, 4/23, [gap on 4/24], 4/25, 4/26 — all >= threshold, but the
    // gap on 4/24 splits this into two streaks of 2 each.
    const s = computeRecapStats([
      r('2026-04-22', 80),
      r('2026-04-23', 80),
      r('2026-04-25', 80),
      r('2026-04-26', 80),
    ]);
    expect(s.bestStreak).toBe(2);
  });

  it('handles a single rollup', () => {
    const s = computeRecapStats([r('2026-04-25', 95, { endOzConsumed: 100, endAforceUnits: 4 })]);
    expect(s.avgScore).toBe(95);
    expect(s.peakScore).toBe(95);
    expect(s.daysTracked).toBe(1);
    expect(s.bestStreak).toBe(1);
    expect(s.totalOunces).toBe(100);
    expect(s.totalSticks).toBe(4);
  });

  it('rounds totalOunces to integer', () => {
    const s = computeRecapStats([r('2026-04-25', 80, { endOzConsumed: 123.7 })]);
    expect(s.totalOunces).toBe(124);
  });

  it('does not crash on a malformed date — treats it as a streak break', () => {
    const s = computeRecapStats([
      r('2026-04-22', 80),
      r('not-a-date', 80),
      r('2026-04-24', 80),
    ]);
    // Each surviving valid day stands alone since the malformed one
    // sits between them; bestStreak should be 1.
    expect(s.bestStreak).toBe(1);
  });
});
