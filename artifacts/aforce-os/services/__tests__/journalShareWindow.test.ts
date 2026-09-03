/**
 * `prepareJournalShare` — the ONE seam, proven as a seam.
 *
 * WHY THIS FILE EXISTS. `journalDenseRange.test.ts` proves the window
 * arithmetic is correct; `journalShareContext.test.ts` proves the context
 * derivation is correct. Neither proves the thing this function exists FOR:
 * that `context` is derived from the SAME dense `window` the screen publishes,
 * rather than from the raw sparse `rollups` it was called with. A mutation
 * that re-introduced `deriveJournalShareContext(rollups, ...)` — reaching past
 * the seam back to the raw array — passed every other law in this branch and
 * was only caught here.
 */
import { describe, it, expect } from 'vitest';
import { prepareJournalShare } from '../journalShareWindow';
import type { JournalRollup } from '@/types';

const V1 = 'hydrostate-v1.0';
const sparse = (date: string, score: number): JournalRollup => ({
  date, avgScore: score, minScore: score, maxScore: score, snapshotsCount: 4,
  endOzConsumed: 60, endAforceUnits: 0, endUnitsConsumed: 5, endSodiumDelivered: 0,
  endSodiumLost: 0, endDeficitPct: 0, pctTimePeak: 0, pctTimeBalanced: 100,
  pctTimeRecovering: 0, pctTimeDepleted: 0, intakeCount: 3, autopilotSessions: 0,
  socialSessions: 0, modelVersions: [V1],
});
const NOW = new Date('2026-09-02T14:30:00.000Z');
/** A `YYYY-MM-DD` calendar day N days after a UTC date — real date
 *  arithmetic, so it crosses a month boundary correctly (a naive
 *  string-padded day-of-month generator silently overflows past 31). */
const dayAfter = (startIso: string, n: number): string => {
  const d = new Date(`${startIso}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

describe('prepareJournalShare — window and context can never diverge', () => {
  it('densifies a sparse array into the dense effective window', () => {
    const rows = [sparse('2026-08-27', 90), sparse('2026-08-29', 90), sparse('2026-09-02', 90)];
    const { window } = prepareJournalShare(rows, { rangeDays: 7, historyStartAt: null, now: NOW });
    expect(window.length, 'dense, not the raw 3 sparse rows').toBe(7);
    expect(window.length).not.toBe(rows.length);
    expect(window.filter((r) => r.snapshotsCount === 0).map((r) => r.date)).toEqual([
      '2026-08-28', '2026-08-30', '2026-08-31', '2026-09-01',
    ]);
  });

  it('THE WIRING PROOF: context excludes a row the raw array still has, once it falls before the eligible start', () => {
    // `classifyStreakEligibility` measures the CALENDAR SPAN of whatever array
    // it is given, which makes it robust to plain compaction (dropping a row
    // changes the span too) — so a fixture that only removes a row is not
    // enough to catch `deriveJournalShareContext(rollups, ...)` reaching past
    // the seam. The row here is PRE-ELIGIBILITY: a correct dense window drops
    // it entirely (it is before `historyStartAt`), while a mutant reading the
    // raw array still has it and lets its low score and its 2-day gap corrupt
    // both the average and the streak.
    const rows = [
      sparse('2026-08-20', 40),   // BEFORE the eligible start — must not count
      sparse('2026-08-22', 90), sparse('2026-08-23', 90), sparse('2026-08-24', 90),
    ];
    const { window, context } = prepareJournalShare(rows, {
      rangeDays: 3,
      historyStartAt: new Date('2026-08-22T00:00:00.000Z'),
      now: new Date('2026-08-24T12:00:00.000Z'),
    });
    expect(window.map((r) => r.date)).toEqual(['2026-08-22', '2026-08-23', '2026-08-24']);
    expect(window.some((r) => r.date === '2026-08-20'), 'the pre-eligibility row is gone').toBe(false);
    // The mutant's answer (averaging/streaking over all 4 raw rows) would be
    // score < 90 and streakDays < 3 (the 08-20→08-22 gap breaks continuity at
    // the earliest point the walk reaches it). The correct answer is neither.
    expect(context.score).toBe(90);
    expect(context.streakDays).toBe(3);
  });

  it('a streak withheld in the window is withheld in the context — not recomputed from the raw rows', () => {
    // Raw sparse rows show two dates two calendar days apart with no row for
    // the day between (the sparse wire's silent omission). The dense window
    // materialises that day as an explicit gap, which must suppress the
    // streak; feeding `deriveJournalShareContext` the raw 2-element array
    // would (by coincidence) reach the same coverage verdict via span
    // measurement, so this fixture instead adds a pre-eligibility row to force
    // the two arrays to disagree on the RESULT, not just the verdict shape.
    const rows = [
      sparse('2026-08-20', 90),   // BEFORE the eligible start
      sparse('2026-08-27', 90), sparse('2026-08-29', 90),
    ];
    const { context } = prepareJournalShare(rows, {
      rangeDays: 3,
      historyStartAt: new Date('2026-08-27T00:00:00.000Z'),
      now: new Date('2026-08-29T12:00:00.000Z'),
    });
    expect(context.streakDays, 'the omitted 08-28 must suppress it').toBeUndefined();
    // A mutant reading the raw 3-row array would compute a DIFFERENT (wrong)
    // average by including the pre-eligibility 08-20 row.
    expect(context.score).not.toBeNull();
  });

  it('a stamped 12-day-old member gets a 12-row window feeding the context, not 30', () => {
    // ANTI-VACUITY (caught by this file itself): a naive
    // `` `2026-08-${22 + i}` `` generator overflows past August's 31 days for
    // i=9,10 and produces the malformed dates "2026-08-32"/"33" — two rows
    // that then match NOTHING in the dense window, silently turning a
    // "12 stamped days" fixture into 10 measured + 2 phantom gaps. `dayAfter`
    // does real UTC date arithmetic so the fixture crosses the Aug→Sep
    // boundary correctly.
    const rows = Array.from({ length: 12 }, (_, i) => sparse(dayAfter('2026-08-22', i), 90));
    const { window, context } = prepareJournalShare(rows, {
      rangeDays: 30, historyStartAt: new Date('2026-08-22T00:00:00.000Z'), now: NOW,
    });
    expect(window.length).toBe(12);
    expect(window.every((r) => r.snapshotsCount > 0), 'no phantom gaps').toBe(true);
    expect(context.score).toBe(90);
    expect(context.streakDays).toBe(12);
  });

  it('an unstamped legacy member keeps the full requested window', () => {
    const rows = [sparse('2026-08-31', 90), sparse('2026-09-02', 90)];
    const { window } = prepareJournalShare(rows, { rangeDays: 7, historyStartAt: null, now: NOW });
    expect(window.length).toBe(7);
  });
});
