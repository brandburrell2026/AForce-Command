/** Hydration · History bars. */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { dayKey, historyBars, historyDates, historyTargetLine } from '../hydrationHistoryLogic';

// Wednesday 18 Nov 2026; its calendar week is Sun 15 – Sat 21.
const today = new Date(2026, 10, 18, 19, 0);
const days = [
  { date: '2026-11-14', oz: 70 },
  { date: '2026-11-15', oz: 98 },
  { date: '2026-11-16', oz: 102 },
  { date: '2026-11-17', oz: 91 },
  { date: '2026-11-18', oz: 10 },
];

describe('history bars — week', () => {
  const bars = historyBars(days, 96, today, 42, 'Week', new Set(['2026-11-16', '2026-11-18', '2026-11-20']));

  it('is the calendar week, Sunday to Saturday, with the days still to come', () => {
    expect(bars.map((b) => b.label).join('')).toBe('SMTWTFS');
    expect(bars.map((b) => b.date)).toEqual(historyDates(today, 'Week').map(dayKey));
    expect(bars[0]!.date).toBe('2026-11-15');
    expect(bars[6]!.date).toBe('2026-11-21');
  });

  it("today uses the live total, not the server's last snapshot", () => {
    expect(bars[3]).toMatchObject({ isToday: true, oz: 42 });
  });

  it('days still to come are empty, never filled from data', () => {
    const future = historyBars([...days, { date: '2026-11-19', oz: 500 }], 96, today, 42, 'Week');
    expect(future.slice(4).every((b) => b.oz === null && b.height === 0)).toBe(true);
  });

  it('marks the days that reached the starting target', () => {
    expect(bars.map((b) => b.metTarget)).toEqual([true, true, false, false, false, false, false]);
  });

  it('marks the days that have a Moment, including ones still to come', () => {
    expect(bars.map((b) => b.hasMoment)).toEqual([false, true, false, true, false, true, false]);
  });

  it('still draws the whole week when past totals are unavailable', () => {
    const none = historyBars([], 96, today, 42, 'Week');
    expect(none).toHaveLength(7);
    expect(none[3]).toMatchObject({ isToday: true, oz: 42 });
    expect(none.filter((b) => b.oz !== null)).toHaveLength(1);
  });

  it('bars never exceed the chart, even far above the target', () => {
    const tall = historyBars([], 96, today, 262, 'Week');
    expect(tall[3]!.height).toBeLessThanOrEqual(1);
    expect(historyTargetLine(tall, 96)).toBeLessThan(0.5);
  });
});

describe('history bars — month', () => {
  it('is the last 30 days ending today, with no letters', () => {
    const m = historyBars(days, 96, today, 42, 'Month');
    expect(m).toHaveLength(30);
    expect(m[29]).toMatchObject({ date: '2026-11-18', isToday: true, oz: 42 });
    expect(m[25]).toMatchObject({ date: '2026-11-14', oz: 70 });
    expect(m.every((b) => b.label === '')).toBe(true);
  });
});

describe('the History section', () => {
  const src = readFileSync(join(__dirname, '..', 'HydrationHistory.tsx'), 'utf8');
  const screen = readFileSync(join(__dirname, '..', '..', 'HydrationScreenV2.tsx'), 'utf8');
  it('only reads, and never hides itself', () => {
    expect(src).toContain('fetchJournalRollups(30)');
    expect(src).not.toMatch(/postJson|logIntake|putJson|deleteJson/);
    expect(src).not.toContain('return null;');
  });
  it('is not switched off by any setting on the Hydration tab', () => {
    const block = screen.slice(screen.indexOf('{/* History, as in the approved prototype'), screen.indexOf('</AFScreen>'));
    expect(block).toContain('<HydrationHistory');
    expect(block).not.toMatch(/pauseStreakDisplay \?|\? \(\s*<HydrationHistory/);
  });
  it('red is used only for the Moment mark; missed days are not flagged', () => {
    expect(src.match(/af\.red\b/g) ?? []).toHaveLength(1);
    expect(src).toContain('momentMark');
    expect(src).not.toContain('af.redText');
  });
  it('carries the demo footnote', () => {
    expect(src).toContain("Red marks are Moments. Missed days aren't flagged.");
  });
});
