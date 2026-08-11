/**
 * signalV3Presentation — unit tests. The honest-data contract: rows render
 * only rollup-carried metrics, band mapping matches the shipped day-card
 * thresholds, and day labels are deterministic from the caller's clock.
 */
import { describe, it, expect } from 'vitest';

import type { JournalRollup } from '@/types';
import { af } from '@/theme';
import {
  bandForScore,
  accentForScore,
  buildDayViews,
  buildBars,
  shiftIsoDay,
  isoWeekday,
} from '../signalV3Presentation';

function rollup(partial: Partial<JournalRollup> & { date: string; avgScore: number }): JournalRollup {
  return {
    snapshotsCount: 0,
    minScore: 0,
    maxScore: 100,
    endOzConsumed: 0,
    endAforceUnits: 0,
    endUnitsConsumed: 0,
    endSodiumDelivered: 0,
    endSodiumLost: 0,
    endDeficitPct: 0,
    pctTimePeak: 0,
    pctTimeBalanced: 0,
    pctTimeRecovering: 0,
    pctTimeDepleted: 0,
    ...partial,
  } as JournalRollup;
}

describe('bandForScore / accentForScore', () => {
  it('uses the shipped day-card thresholds (≥85 / ≥65 / ≥40)', () => {
    expect(bandForScore(88)).toBe('PEAK');
    expect(bandForScore(85)).toBe('PEAK');
    expect(bandForScore(84)).toBe('BALANCED');
    expect(bandForScore(65)).toBe('BALANCED');
    expect(bandForScore(64)).toBe('RECOVERING');
    expect(bandForScore(40)).toBe('RECOVERING');
    expect(bandForScore(39)).toBe('DEPLETED');
  });
  it('tints with the same homePresentation accents Home/Protocol use', () => {
    expect(accentForScore(90)).toBe(af.green);
    expect(accentForScore(70)).toBe(af.cyan);
    expect(accentForScore(50)).toBe(af.amber);
    expect(accentForScore(20)).toBe(af.red);
  });
});

describe('buildDayViews', () => {
  const days = buildDayViews(
    [
      rollup({ date: '2026-08-05', avgScore: 71.4, endOzConsumed: 96.2, snapshotsCount: 4, pctTimePeak: 10, pctTimeBalanced: 64 }),
      rollup({ date: '2026-08-07', avgScore: 88, endOzConsumed: 124, snapshotsCount: 6, pctTimePeak: 60, pctTimeBalanced: 33 }),
      rollup({ date: '2026-08-06', avgScore: 82, endOzConsumed: 118, snapshotsCount: 5, pctTimePeak: 30, pctTimeBalanced: 58 }),
    ],
    '2026-08-07',
  );

  it('sorts newest first and labels Today/Yesterday/weekday deterministically', () => {
    expect(days.map((d) => d.date)).toEqual(['2026-08-07', '2026-08-06', '2026-08-05']);
    expect(days[0]!.dayLabel).toEqual({ kind: 'today' });
    expect(days[1]!.dayLabel).toEqual({ kind: 'yesterday' });
    // 2026-08-05 is a Wednesday
    expect(days[2]!.dayLabel).toEqual({ kind: 'weekday', weekday: 3 });
  });

  it('rounds rollup-carried metrics and clamps the in-band clock', () => {
    expect(days[0]).toMatchObject({ score: 88, bandKey: 'peak', oz: 124, inBandPct: 93, checks: 6 });
    expect(days[2]).toMatchObject({ score: 71, bandKey: 'balanced', oz: 96, inBandPct: 74, checks: 4 });
  });
});

describe('buildBars', () => {
  it('is oldest-first with clamped non-zero heights', () => {
    const days = buildDayViews(
      [rollup({ date: '2026-08-07', avgScore: 88 }), rollup({ date: '2026-08-06', avgScore: 2 })],
      '2026-08-07',
    );
    const bars = buildBars(days);
    expect(bars.map((b) => b.date)).toEqual(['2026-08-06', '2026-08-07']);
    expect(bars[0]!.height).toBe(0.08); // floor so a bad day still paints
    expect(bars[1]!.height).toBe(0.88);
  });
});

describe('date helpers', () => {
  it('shiftIsoDay is calendar-safe across month boundaries', () => {
    expect(shiftIsoDay('2026-08-01', -1)).toBe('2026-07-31');
    expect(shiftIsoDay('2026-12-31', 1)).toBe('2027-01-01');
  });
  it('isoWeekday matches the calendar', () => {
    expect(isoWeekday('2026-08-09')).toBe(0); // Sunday
    expect(isoWeekday('2026-08-11')).toBe(2); // Tuesday
  });
});
