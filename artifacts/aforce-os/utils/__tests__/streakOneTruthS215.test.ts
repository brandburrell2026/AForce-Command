/**
 * S2-15 — one streak, one truth.
 *
 * The S2-14 device pass caught Profile/Protocol showing "5 days" while
 * Weekly showed "3": Weekly recounted an analytics day-with-any-log
 * streak (retention.currentDayStreak) under the same member-facing word
 * the engine's complianceStreak owns everywhere else — two derivations,
 * different semantics, one label.
 *
 * Resolution locked here: when the canonical engine streak is supplied
 * via WeeklyReportInput.current.complianceStreak, it IS the report's
 * member-facing streak; the analytics recount survives only for internal
 * friction math. All three live callers supply it from userState.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { buildWeeklyReport, getWeeklyReportSection } from '../weeklyReport';
import type { AnalyticsEvent } from '../analytics/metrics';

const PKG = resolve(__dirname, '..', '..');
const read = (rel: string) =>
  readFileSync(resolve(PKG, rel), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/^\s*\/\/.*$/gm, '');

/** Three consecutive log days ending "today" → analytics recount of 3. */
function threeDayLogWindow(nowISO: string): AnalyticsEvent[] {
  const now = Date.parse(nowISO);
  const day = 24 * 60 * 60 * 1000;
  return [0, 1, 2].map((d) => ({
    name: 'intake_logged',
    ts: new Date(now - d * day).toISOString(),
  })) as unknown as AnalyticsEvent[];
}

describe('S2-15 — the canonical streak wins in the weekly report', () => {
  const nowISO = '2026-08-22T12:00:00.000Z';
  const base = {
    nowISO,
    weekStartISO: '2026-08-16T00:00:00.000Z',
    weekEndISO: '2026-08-22T23:59:59.999Z',
    analyticsEvents: threeDayLogWindow(nowISO),
  };

  it('supplied engine streak overrides the analytics recount', () => {
    const report = buildWeeklyReport({
      ...base,
      current: { complianceStreak: 5 },
    });
    const habit = getWeeklyReportSection(report, 'habitVelocity');
    expect((habit.params as { streak?: number }).streak).toBe(5);
  });

  it('legacy behavior survives when the canonical value is not supplied', () => {
    const report = buildWeeklyReport({ ...base });
    const habit = getWeeklyReportSection(report, 'habitVelocity');
    expect(typeof (habit.params as { streak?: number }).streak).toBe('number');
    expect((habit.params as { streak?: number }).streak).not.toBe(5);
  });
});

describe('S2-15 — every live caller supplies the engine streak', () => {
  it('the builder binds canonical-first', () => {
    expect(read('utils/weeklyReport.ts')).toMatch(
      /const streak = input\.current\?\.complianceStreak \?\? fullMetrics\.retention\.currentDayStreak;/,
    );
  });

  for (const [rel, marker] of [
    ['hooks/useWeeklyReportModel.ts', 'complianceStreak'],
    ['components/insights/weeklyV3Presentation.ts', 'complianceStreak: input.complianceStreak ?? null'],
    ['components/insights/WeeklyReportV3.tsx', 'complianceStreak,'],
    ['components/insights/ReadinessInsightsV2.tsx', 'complianceStreak: userState.complianceStreak'],
  ] as const) {
    it(`${rel} threads the canonical streak`, () => {
      expect(read(rel)).toContain(marker);
    });
  }
});
