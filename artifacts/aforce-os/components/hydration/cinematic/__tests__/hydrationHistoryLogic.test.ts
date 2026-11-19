/** Hydration · History bars. */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { dayKey, historyBars, historyTargetLine } from '../hydrationHistoryLogic';

const days = [
  { date: '2026-11-12', oz: 98 },
  { date: '2026-11-13', oz: 102 },
  { date: '2026-11-14', oz: 60 },
  { date: '2026-11-15', oz: null },
  { date: '2026-11-16', oz: 96 },
  { date: '2026-11-17', oz: 0 },
  { date: '2026-11-18', oz: 10 },
];

describe('history bars', () => {
  const bars = historyBars(days, 96, '2026-11-18', 42, 'Week');

  it('draws one bar per day, oldest first, with weekday letters', () => {
    expect(bars.map((b) => b.label).join('')).toBe('TFSSMTW');
    expect(bars).toHaveLength(7);
  });

  it("today uses the live total, not the server's last snapshot", () => {
    expect(bars[6]).toMatchObject({ isToday: true, oz: 42 });
  });

  it('a day with nothing recorded has no bar and is not flagged', () => {
    expect(bars[3]).toMatchObject({ oz: null, height: 0, metTarget: false });
    expect(bars[5]).toMatchObject({ oz: null, height: 0 });
  });

  it('marks days that reached the starting target', () => {
    expect(bars.map((b) => b.metTarget)).toEqual([true, true, false, false, true, false, false]);
  });

  it('bars never exceed the chart, even far above the target', () => {
    const tall = historyBars([{ date: '2026-11-18', oz: 0 }], 96, '2026-11-18', 262, 'Week');
    expect(tall[0]!.height).toBeLessThanOrEqual(1);
    expect(historyTargetLine(tall, 96)).toBeLessThan(0.5);
  });

  it('month keeps the last 30 days and drops the letters', () => {
    const many = Array.from({ length: 40 }, (_, i) => ({ date: `2026-10-${String(i + 1).padStart(2, '0')}`, oz: 50 }));
    const m = historyBars(many, 96, 'x', 0, 'Month');
    expect(m).toHaveLength(30);
    expect(m.every((b) => b.label === '')).toBe(true);
  });

  it('writes the day key in local time', () => {
    expect(dayKey(new Date(2026, 10, 8))).toBe('2026-11-08');
  });
});

describe('the History section', () => {
  const src = readFileSync(join(__dirname, '..', 'HydrationHistory.tsx'), 'utf8');
  it('only reads, and is not drawn when the totals cannot be read', () => {
    expect(src).toContain('fetchJournalRollups(30)');
    expect(src).not.toMatch(/postJson|logIntake|putJson|deleteJson/);
    expect(src).toContain('if (!days || days.length === 0) return null;');
  });
  it('uses no red: missed days are not flagged', () => {
    expect(src).not.toMatch(/af\.red(Text)?\b/);
  });
});
