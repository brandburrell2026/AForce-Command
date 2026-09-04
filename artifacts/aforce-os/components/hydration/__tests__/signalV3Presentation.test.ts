/**
 * signalV3Presentation — unit tests. The honest-data contract: rows render
 * only rollup-carried metrics, band mapping matches the shipped day-card
 * thresholds, and day labels are deterministic from the caller's clock.
 */
import { describe, it, expect } from 'vitest';

import type { JournalRollup } from '@/types';
import { af } from '@/theme';
import { RICH_MIN_RATIO, PARTIAL_MIN_RATIO } from '@/utils/profile/profileCompleteness';
import { completenessChip } from '@/utils/confidence/confidenceChip';
import {
  bandForScore,
  accentForScore,
  buildDayViews,
  buildBars,
  historyCompletenessLevel,
  weeklyChecks,
  weeklyInBandAvg,
  weeklyTotalOz,
  shiftIsoDay,
  isoWeekday,
} from '../signalV3Presentation';

/**
 * A day WITH a HydroState observation by default.
 *
 * This factory used to default `snapshotsCount: 0`, which — now that the wire
 * is dense and `buildDayViews` renders observed days only — described a day
 * that has no reading at all. Every fixture built on it was therefore asserting
 * scores and bands for days nothing was measured. Tests that specifically want
 * the unobserved case pass `snapshotsCount: 0` explicitly.
 */
function rollup(partial: Partial<JournalRollup> & { date: string; avgScore: number }): JournalRollup {
  return {
    snapshotsCount: 4,
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

describe('buildDayViews — unobserved days are not readings', () => {
  it('a day with no HydroState observation produces NO row', () => {
    // The dense wire always includes the day; it carries the server's
    // sentinel `avgScore: 0`. Rendering it would put a real DEPLETED row on
    // a day nothing was measured. This list has no calendar obligation (unlike
    // the weekly timeline), so the honest answer is simply no row.
    const days = buildDayViews(
      [
        rollup({ date: '2026-08-05', avgScore: 82, snapshotsCount: 4 }),
        rollup({ date: '2026-08-06', avgScore: 0, snapshotsCount: 0 }),
      ],
      '2026-08-07',
    );
    expect(days.map((d) => d.date)).toEqual(['2026-08-05']);
  });

  it('an all-unobserved window produces an empty list, not a week of zeros', () => {
    const days = buildDayViews(
      [
        rollup({ date: '2026-08-05', avgScore: 0, snapshotsCount: 0 }),
        rollup({ date: '2026-08-06', avgScore: 0, snapshotsCount: 0 }),
      ],
      '2026-08-07',
    );
    expect(days).toEqual([]);
  });

  it('an intake-only day (real activity, no snapshot) is still not a reading', () => {
    const days = buildDayViews(
      [rollup({ date: '2026-08-06', avgScore: 0, snapshotsCount: 0, intakeCount: 3, endOzConsumed: 40 })],
      '2026-08-07',
    );
    expect(days).toEqual([]);
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

describe('weeklyInBandAvg', () => {
  it('averages the days\' real in-band time, whole-%, 0 when empty', () => {
    const days = buildDayViews(
      [
        rollup({ date: '2026-08-06', avgScore: 80, pctTimePeak: 40, pctTimeBalanced: 40 }),
        rollup({ date: '2026-08-07', avgScore: 80, pctTimePeak: 10, pctTimeBalanced: 50 }),
      ],
      '2026-08-07',
    );
    expect(weeklyInBandAvg(days)).toBe(70); // (80 + 60) / 2
    expect(weeklyInBandAvg([])).toBe(0);
  });
});

describe('historyCompletenessLevel', () => {
  // Wave 5: the screen's 7-day average now wears the shipped ConfidenceChip, so
  // coverage has to land in §55's EXISTING vocabulary — no new metric, and no
  // new thresholds either. These assert against §55's own ratio constants so a
  // retune there moves this with it instead of silently diverging.
  it('reuses §55 ratio cuts rather than inventing day counts', () => {
    const window = 7;
    expect(historyCompletenessLevel(Math.ceil(RICH_MIN_RATIO * window), window)).toBe('rich');
    expect(historyCompletenessLevel(Math.ceil(PARTIAL_MIN_RATIO * window), window)).toBe('partial');
    expect(historyCompletenessLevel(Math.ceil(PARTIAL_MIN_RATIO * window) - 1, window)).toBe('sparse');
  });

  it('grades a 7-day window the way a member would read it', () => {
    expect(historyCompletenessLevel(7, 7)).toBe('rich');
    expect(historyCompletenessLevel(6, 7)).toBe('rich');
    expect(historyCompletenessLevel(5, 7)).toBe('partial');
    expect(historyCompletenessLevel(3, 7)).toBe('partial');
    expect(historyCompletenessLevel(2, 7)).toBe('sparse');
    expect(historyCompletenessLevel(0, 7)).toBe('sparse');
  });

  it('never divides by an empty window, and never reads above full coverage', () => {
    expect(historyCompletenessLevel(3, 0)).toBe('sparse');
    expect(historyCompletenessLevel(-2, 7)).toBe('sparse');
  });

  it('feeds the existing completenessChip — the chip is reused, not reimplemented', () => {
    expect(completenessChip(historyCompletenessLevel(7, 7)).label).toBe('RICH');
    expect(completenessChip(historyCompletenessLevel(4, 7)).label).toBe('PARTIAL');
    expect(completenessChip(historyCompletenessLevel(1, 7)).label).toBe('SPARSE');
  });
});

describe('weeklyTotalOz / weeklyChecks', () => {
  const days = buildDayViews(
    [
      rollup({ date: '2026-08-05', avgScore: 71, endOzConsumed: 96, snapshotsCount: 4 }),
      rollup({ date: '2026-08-06', avgScore: 82, endOzConsumed: 118, snapshotsCount: 5 }),
      rollup({ date: '2026-08-07', avgScore: 88, endOzConsumed: 124, snapshotsCount: 6 }),
    ],
    '2026-08-07',
  );

  it('sums the window instead of reporting the last day as the total', () => {
    // computeRecapStats.totalOunces is `last.endOzConsumed` — ONE day (124 here)
    // — which read as a weekly sum under the "Last 7 days" heading. The window
    // total is the sum of the days actually shown.
    expect(weeklyTotalOz(days)).toBe(96 + 118 + 124);
    expect(weeklyTotalOz(days)).not.toBe(124);
  });

  it('counts the engine checks the averages are interpolated across', () => {
    expect(weeklyChecks(days)).toBe(15);
  });

  it('is 0 for an empty window (no fabricated total)', () => {
    expect(weeklyTotalOz([])).toBe(0);
    expect(weeklyChecks([])).toBe(0);
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
