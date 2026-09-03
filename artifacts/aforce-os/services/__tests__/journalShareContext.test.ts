/**
 * deriveJournalShareContext — locks in how the Hydration Journal screen
 * turns a window of rollups into a `/share` payload.
 *
 * Critical contracts:
 *  - Empty rollups never throw and publish NOTHING (no fabricated zero).
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
import { classifyStreakEligibility } from '../../utils/scoring/boundarySeries';
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
  it('empty rollups publish NOTHING — a zero is a claim, not a safe default', () => {
    // SUPERSEDED (founder ruling 2026-09-02). This used to assert
    // `score: 0, state: 'Recovering'` and called it "safe". It is not safe: it
    // is a fabricated public claim manufactured out of having no data, in the
    // payload that leaves the app for social media. Nothing measured, nothing
    // published — `/share` then falls back to the member's LIVE score, which
    // is a true present-tense statement.
    const ctx = deriveJournalShareContext([], 7);
    expect(ctx.type).toBe('score');
    expect(ctx.score, 'never a fabricated zero').toBeNull();
    expect(ctx.state, 'never a fabricated band').toBeNull();
    expect(ctx.streakDays).toBeUndefined();
    expect(ctx.rangeDays).toBe(7);
    // ...and the wire params omit them entirely rather than stringifying null.
    const params = toShareRouteParams(ctx);
    expect(params.score).toBeUndefined();
    expect(params.state).toBeUndefined();
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

  it('a missing calendar day makes the streak UNAVAILABLE, not shortened', () => {
    // SUPERSEDED (founder ruling 2026-09-02). This used to assert
    // `streakDays === 2` — the run "broken" at the gap. That is one of the
    // three forbidden answers: a day HydroState never observed may not be
    // scored 0, may not break the run (which asserts a failure the member did
    // not have), and may not be skipped (which asserts qualification nobody
    // observed). It is unknowable, so nothing is published.
    const r = [
      rollup('2026-04-25', 88),
      rollup('2026-04-27', 90),
      rollup('2026-04-28', 92),
    ];
    // ANTI-VACUITY: the gap is real and the old answer is genuinely reachable.
    expect(classifyStreakEligibility(r)).toEqual({
      kind: 'coverage_incomplete', measuredDays: 3, rangeDays: 4,
    });
    const ctx = deriveJournalShareContext(r, 7);
    expect(ctx.streakDays, 'no streak leaves the app').toBeUndefined();
    expect(ctx.type).toBe('score');
    // The member's AVERAGE is still publishable — only the streak is unknowable.
    expect(ctx.score).toBe(90);
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
