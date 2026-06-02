/**
 * deriveJournalShareContext — locks in how the Hydration Journal screen
 * turns a window of rollups into a `/share` payload.
 *
 * Critical contracts:
 *  - Empty rollups never throw; they yield a safe zero-score share.
 *  - `score` is the integer-rounded mean of `avgScore` across the window.
 *  - `state` is the band label derived from that mean
 *    (Peak >= 90, Balanced >= 70, Recovering >= 50, else Depleted).
 *  - Streak counts consecutive *most-recent* days with avgScore >=
 *    BALANCED_THRESHOLD; non-recent streaks do not count.
 *  - When the streak is >= MIN_STREAK_FOR_HEADLINE the share leads with
 *    `type=streak`; otherwise it leads with `type=score`.
 *  - `toShareRouteParams` emits string values (Expo Router contract).
 */

import { describe, it, expect } from 'vitest';
import {
  deriveJournalShareContext,
  scoreToStateLabel,
  toShareRouteParams,
  BALANCED_THRESHOLD,
  MIN_STREAK_FOR_HEADLINE,
} from '../journalShareContext';
import type { JournalRollup } from '../../types';

function rollup(date: string, avgScore: number): JournalRollup {
  return {
    date,
    snapshotsCount: 1,
    avgScore,
    minScore: avgScore,
    maxScore: avgScore,
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
  } as JournalRollup;
}

describe('scoreToStateLabel', () => {
  it('maps the 4 score bands', () => {
    expect(scoreToStateLabel(95)).toBe('Peak');
    expect(scoreToStateLabel(90)).toBe('Peak');
    expect(scoreToStateLabel(75)).toBe('Balanced');
    expect(scoreToStateLabel(BALANCED_THRESHOLD)).toBe('Balanced');
    expect(scoreToStateLabel(60)).toBe('Recovering');
    expect(scoreToStateLabel(40)).toBe('Depleted');
  });
});

describe('deriveJournalShareContext', () => {
  it('handles empty rollups without throwing — safe zero-score share', () => {
    const ctx = deriveJournalShareContext([], 7);
    expect(ctx.type).toBe('score');
    expect(ctx.score).toBe(0);
    expect(ctx.state).toBe('Recovering');
    expect(ctx.streakDays).toBeUndefined();
    expect(ctx.rangeDays).toBe(7);
  });

  it('rounds the window average to an integer', () => {
    const r = [rollup('2026-04-25', 80), rollup('2026-04-26', 85), rollup('2026-04-27', 84)];
    const ctx = deriveJournalShareContext(r, 7);
    expect(ctx.score).toBe(83);
    expect(ctx.state).toBe('Balanced');
  });

  it(`leads with type=streak when the most-recent streak is >= ${MIN_STREAK_FOR_HEADLINE}`, () => {
    const r = [
      rollup('2026-04-25', 88),
      rollup('2026-04-26', 91),
      rollup('2026-04-27', 76),
    ];
    const ctx = deriveJournalShareContext(r, 7);
    expect(ctx.type).toBe('streak');
    expect(ctx.streakDays).toBe(3);
  });

  it('leads with type=score when streak is shorter than 3 days', () => {
    const r = [
      rollup('2026-04-25', 60),
      rollup('2026-04-26', 55),
      rollup('2026-04-27', 88),
      rollup('2026-04-28', 90),
    ];
    const ctx = deriveJournalShareContext(r, 7);
    expect(ctx.type).toBe('score');
    expect(ctx.streakDays).toBe(2);
  });

  it('breaks the streak across a missing-calendar-day gap (rollups can omit zero-data days)', () => {
    // Three "high score" rows but a one-day gap between 04-25 and 04-27 —
    // rolling up consecutive rows would lie about a 3-day streak. The
    // helper must require calendar-day adjacency.
    const r = [
      rollup('2026-04-25', 88),
      rollup('2026-04-27', 90),
      rollup('2026-04-28', 92),
    ];
    const ctx = deriveJournalShareContext(r, 7);
    expect(ctx.streakDays).toBe(2); // only 04-27 and 04-28 are adjacent
    expect(ctx.type).toBe('score'); // 2 < MIN_STREAK_FOR_HEADLINE
  });

  it('counts a true 7-day calendar streak as a streak headline', () => {
    const r = [
      rollup('2026-04-21', 75),
      rollup('2026-04-22', 80),
      rollup('2026-04-23', 78),
      rollup('2026-04-24', 82),
      rollup('2026-04-25', 88),
      rollup('2026-04-26', 90),
      rollup('2026-04-27', 91),
    ];
    const ctx = deriveJournalShareContext(r, 7);
    expect(ctx.streakDays).toBe(7);
    expect(ctx.type).toBe('streak');
  });

  it('refuses to count a malformed rollup date instead of overstating', () => {
    const r = [
      rollup('not-a-date', 95),
      rollup('2026-04-26', 88),
      rollup('2026-04-27', 91),
    ];
    const ctx = deriveJournalShareContext(r, 7);
    expect(ctx.streakDays).toBe(2); // 04-26 + 04-27 only; bad date breaks loop
  });

  it('non-recent streaks do not count — only consecutive most-recent days', () => {
    const r = [
      rollup('2026-04-20', 95),
      rollup('2026-04-21', 92),
      rollup('2026-04-22', 88),
      rollup('2026-04-23', 91),
      rollup('2026-04-24', 45), // breaks the streak
      rollup('2026-04-25', 60),
      rollup('2026-04-26', 55),
    ];
    const ctx = deriveJournalShareContext(r, 7);
    expect(ctx.streakDays).toBeUndefined();
    expect(ctx.type).toBe('score');
  });

  it('omits streakDays from the payload entirely when zero (no false 0-day claim)', () => {
    const r = [rollup('2026-04-25', 50), rollup('2026-04-26', 45)];
    const ctx = deriveJournalShareContext(r, 7);
    expect(ctx.streakDays).toBeUndefined();
    expect('streakDays' in ctx).toBe(false);
  });
});

describe('toShareRouteParams', () => {
  it('emits string values for Expo Router', () => {
    const r = [rollup('2026-04-25', 88), rollup('2026-04-26', 91), rollup('2026-04-27', 90)];
    const ctx = deriveJournalShareContext(r, 7);
    const params = toShareRouteParams(ctx);
    expect(params.type).toBe('streak');
    expect(params.score).toBe('90');
    expect(params.state).toBe('Peak');
    expect(params.streakDays).toBe('3');
    Object.values(params).forEach((v) => expect(typeof v).toBe('string'));
  });

  it('omits streakDays when the context has no streak', () => {
    const ctx = deriveJournalShareContext([], 7);
    const params = toShareRouteParams(ctx);
    expect(params.streakDays).toBeUndefined();
    expect('streakDays' in params).toBe(false);
  });
});
