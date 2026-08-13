/**
 * weeklyV3Presentation — unit tests. The contract under test: Performance Age
 * movement is honest (available only with a real ≥7-day baseline in the
 * ledger series), wins count only real 'win' events inside the completed
 * week, rollup-derived counts never invent days, and the recovery/top-command
 * sections keep their collecting/awaiting postures (no fabricated numbers).
 */
import { describe, it, expect } from 'vitest';

import type { JournalRollup } from '@/types';
import type { AnalyticsEvent } from '@/utils/analytics/metrics';
import {
  buildWeeklyV3Model,
  performanceAgeBarAxis,
  PA_BAR_MIN_DOMAIN_YEARS,
} from '../weeklyV3Presentation';
import { getWeeklyReportSection } from '@/utils/weeklyReport';

// 2026-08-11 is a Tuesday → last completed week = Sun Aug 2 … Sat Aug 8 (UTC).
const NOW_ISO = '2026-08-11T12:00:00.000Z';

function rollup(date: string, avgScore: number, units = 3): JournalRollup {
  return {
    date,
    snapshotsCount: 4,
    avgScore,
    minScore: avgScore - 10,
    maxScore: avgScore + 5,
    endOzConsumed: units * 12,
    endAforceUnits: 1,
    endUnitsConsumed: units,
    endSodiumDelivered: 0,
    endSodiumLost: 0,
    endDeficitPct: 0,
    pctTimePeak: 20,
    pctTimeBalanced: 50,
    pctTimeRecovering: 25,
    pctTimeDepleted: 5,
  } as JournalRollup;
}

const day = (iso: string) => Math.floor(Date.parse(iso) / 86_400_000);
const win = (at: string): AnalyticsEvent => ({ type: 'win', at });

const PA_RESULT = {
  status: 'established',
  hasEnoughData: true,
  provisional: false,
  performanceAge: 44,
} as never;

describe('buildWeeklyV3Model — Performance Age movement', () => {
  it('is available with a real ≥window baseline and derives previousAge from the delta', () => {
    const model = buildWeeklyV3Model({
      nowISO: NOW_ISO,
      analyticsEvents: [],
      rollups: [],
      paSnapshots: [
        { dayIndex: day('2026-08-03T00:00:00Z'), performanceAge: 47 },
        { dayIndex: day('2026-08-07T00:00:00Z'), performanceAge: 45 },
        { dayIndex: day('2026-08-10T00:00:00Z'), performanceAge: 44 },
      ],
      paResult: PA_RESULT,
    });
    expect(model.performanceAge.trend.available).toBe(true);
    expect(model.performanceAge.trend.deltaYears).toBe(-3);
    expect(model.performanceAge.trend.direction).toBe('younger');
    expect(model.performanceAge.previousAge).toBe(47); // 44 − (−3)
    expect(model.performanceAge.bars.map((b) => b.age)).toEqual([47, 45, 44]);
  });

  it('never claims movement without a baseline — sparse history stays unavailable', () => {
    const model = buildWeeklyV3Model({
      nowISO: NOW_ISO,
      analyticsEvents: [],
      rollups: [],
      paSnapshots: [
        { dayIndex: day('2026-08-09T00:00:00Z'), performanceAge: 45 },
        { dayIndex: day('2026-08-10T00:00:00Z'), performanceAge: 44 },
      ],
      paResult: PA_RESULT,
    });
    expect(model.performanceAge.trend.available).toBe(false);
    expect(model.performanceAge.previousAge).toBeNull();
  });
});

describe('buildWeeklyV3Model — weekly wins', () => {
  it('counts only win events inside the completed week window', () => {
    const model = buildWeeklyV3Model({
      nowISO: NOW_ISO,
      analyticsEvents: [
        win('2026-08-02T01:00:00.000Z'), // in week
        win('2026-08-08T23:00:00.000Z'), // in week (Saturday)
        win('2026-08-09T01:00:00.000Z'), // AFTER the completed week
        win('2026-08-01T12:00:00.000Z'), // before the week
        { type: 'session_open', at: '2026-08-03T09:00:00.000Z' },
      ],
      rollups: [],
      paSnapshots: [],
      paResult: null,
    });
    expect(model.weeklyWins).toBe(2);
  });
});

describe('buildWeeklyV3Model — rollup-derived counts and timeline', () => {
  const model = buildWeeklyV3Model({
    nowISO: NOW_ISO,
    analyticsEvents: [],
    rollups: [
      rollup('2026-08-05', 88, 4),
      rollup('2026-08-06', 71, 0), // tracked but no intake
      rollup('2026-08-07', 55, 2),
    ],
    paSnapshots: [],
    paResult: null,
  });

  it('hydration days count only days with intake; tracked counts all rollups', () => {
    expect(model.hydrationDays).toBe(2);
    expect(model.daysTracked).toBe(3);
  });

  it('timeline is chronological with the shared band accents', () => {
    expect(model.timeline.map((d) => d.date)).toEqual(['2026-08-05', '2026-08-06', '2026-08-07']);
    expect(model.timeline.map((d) => d.score)).toEqual([88, 71, 55]);
    // weekday sanity: 2026-08-05 is a Wednesday (3)
    expect(model.timeline[0]!.weekday).toBe(3);
  });
});

/**
 * The trust defect this replaced: the card ranged its bars to the series' own
 * min/max (`span = max(1, barMax - barMin)`, `frac = 0.25 + 0.75 * …`), so the
 * SMALLEST movement `computePerformanceAge` can express — one whole year, since
 * it rounds — rendered as the full height of the chart. Under a health-adjacent
 * number that read as a dramatic swing. The visual slope must track the real
 * magnitude; these tests pin that it now does, in both directions (small stays
 * small, large stays large).
 */
describe('performanceAgeBarAxis — the visual slope tracks the real magnitude', () => {
  const OLD_AUTO_RANGED_MAX = 1; // what the replaced formula produced for ANY series

  it('draws a one-year week as a small step, not a full-height swing', () => {
    const axis = performanceAgeBarAxis([{ age: 45 }, { age: 44 }])!;
    const [older, younger] = axis.fractions as [number, number];
    // Younger is still taller — the reading direction is unchanged.
    expect(younger).toBeGreaterThan(older);
    // …but by ~7% of the track, not the 75% the auto-ranged formula produced.
    expect(younger - older).toBeCloseTo(0.068, 2);
    expect(younger).toBeLessThan(OLD_AUTO_RANGED_MAX);
    expect(younger).toBeCloseTo(0.659, 3);
    expect(older).toBeCloseTo(0.591, 3);
  });

  it('draws a flat week flat, mid-track — never pinned to the floor', () => {
    const axis = performanceAgeBarAxis([{ age: 44 }, { age: 44 }, { age: 44 }])!;
    expect(axis.fractions).toEqual([0.625, 0.625, 0.625]);
  });

  it('still gives a genuinely large move the full sweep (this dampens noise, it does not flatten movement)', () => {
    const axis = performanceAgeBarAxis([{ age: 50 }, { age: 35 }])!;
    expect(axis.fractions).toEqual([0.25, 1]);
    // A series wider than the minimum domain is left exactly as it is.
    expect(axis.minAge).toBe(35);
    expect(axis.maxAge).toBe(50);
  });

  it('reports an axis that contains the series and never collapses below the minimum domain', () => {
    for (const ages of [[44], [45, 44], [47, 45, 44], [50, 35], [60, 30]]) {
      const axis = performanceAgeBarAxis(ages.map((age) => ({ age })))!;
      expect(axis.minAge).toBeLessThanOrEqual(Math.min(...ages));
      expect(axis.maxAge).toBeGreaterThanOrEqual(Math.max(...ages));
      expect(axis.maxAge - axis.minAge).toBeGreaterThanOrEqual(PA_BAR_MIN_DOMAIN_YEARS);
      // Whole-year padding keeps the axis exact enough to quote in the caption.
      expect(Number.isInteger(axis.minAge)).toBe(true);
      expect(Number.isInteger(axis.maxAge)).toBe(true);
      for (const f of axis.fractions) {
        expect(f).toBeGreaterThanOrEqual(0.25);
        expect(f).toBeLessThanOrEqual(1);
      }
    }
  });

  it('returns null for an empty series so the card keeps its collecting posture', () => {
    expect(performanceAgeBarAxis([])).toBeNull();
  });

  it('is fed by the model bars unchanged — ranging is presentation, it computes no new value', () => {
    const model = buildWeeklyV3Model({
      nowISO: NOW_ISO,
      analyticsEvents: [],
      rollups: [],
      paSnapshots: [
        { dayIndex: day('2026-08-03T00:00:00Z'), performanceAge: 47 },
        { dayIndex: day('2026-08-07T00:00:00Z'), performanceAge: 45 },
        { dayIndex: day('2026-08-10T00:00:00Z'), performanceAge: 44 },
      ],
      paResult: PA_RESULT,
    });
    expect(model.performanceAge.bars.map((b) => b.age)).toEqual([47, 45, 44]);
    const axis = performanceAgeBarAxis(model.performanceAge.bars)!;
    expect([axis.minAge, axis.maxAge]).toEqual([40, 51]);
    expect(axis.fractions.map((f) => Math.round(f * 100))).toEqual([52, 66, 73]);
  });
});

describe('buildWeeklyV3Model — honest postures preserved', () => {
  it('recovery stays collecting and top command stays awaiting (no fabricated numbers)', () => {
    const model = buildWeeklyV3Model({
      nowISO: NOW_ISO,
      analyticsEvents: [],
      rollups: [],
      paSnapshots: [],
      paResult: null,
    });
    expect(getWeeklyReportSection(model.report, 'recovery').status).toBe('collecting');
    expect(getWeeklyReportSection(model.report, 'topCommand').status).toBe('awaiting');
  });
});
