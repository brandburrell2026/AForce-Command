/**
 * Unit tests for the Performance Timeline derivations.
 */

import { describe, expect, it } from 'vitest';
import type { JournalRollup } from '@/types';
import {
  deriveSectionSummary,
  deriveWinMoments,
} from '../performanceTimeline';

/**
 * A rollup for a given calendar day.
 *
 * `day` is now a REQUIRED-in-practice override for any fixture that feeds
 * `deriveWinMoments`: every day-over-day moment is phrased as a claim about
 * "yesterday", so the two rows being compared must be calendar-adjacent. The
 * old default gave every row the SAME date — a shape the route cannot
 * produce (it keys by date, so dates are unique) and one that silently made
 * these fixtures non-adjacent once the adjacency precondition landed.
 */
function rollup(overrides: Partial<JournalRollup> = {}): JournalRollup {
  return {
    date: '2026-05-19',
    snapshotsCount: 10,
    avgScore: 70,
    minScore: 55,
    maxScore: 92,
    endOzConsumed: 64,
    endAforceUnits: 2,
    endUnitsConsumed: 2,
    endSodiumDelivered: 1500,
    endSodiumLost: 1400,
    endDeficitPct: 5,
    pctTimePeak: 30,
    pctTimeBalanced: 40,
    pctTimeRecovering: 20,
    pctTimeDepleted: 10,
    intakeCount: 4,
    autopilotSessions: 1,
    socialSessions: 0,
    ...overrides,
  };
}

describe('deriveSectionSummary', () => {
  it('returns 6 sections in the spec order even for empty input', () => {
    const out = deriveSectionSummary([], 0);
    expect(out.map((s) => s.key)).toEqual([
      'recovery',
      'heat',
      'hydration',
      'corrections',
      'territory',
      'streaks',
    ]);
  });

  it('aggregates totals across the window', () => {
    const out = deriveSectionSummary(
      [
        rollup({ endOzConsumed: 60, intakeCount: 3, autopilotSessions: 1, socialSessions: 0 }),
        rollup({ endOzConsumed: 70, intakeCount: 5, autopilotSessions: 1, socialSessions: 2 }),
      ],
      4,
    );
    const byKey = Object.fromEntries(out.map((s) => [s.key, s.value]));
    expect(byKey.hydration).toBe('130 oz');
    expect(byKey.corrections).toBe('8');
    expect(byKey.territory).toBe('4');
    expect(byKey.streaks).toBe('4d');
  });

  it('averages recovery % across the window', () => {
    const out = deriveSectionSummary(
      [
        rollup({ pctTimeBalanced: 40, pctTimePeak: 20 }), // 60
        rollup({ pctTimeBalanced: 60, pctTimePeak: 20 }), // 80
      ],
      0,
    );
    const recovery = out.find((s) => s.key === 'recovery')!;
    expect(recovery.value).toBe('70%');
  });

  it('formats large sodium loss totals in grams', () => {
    const out = deriveSectionSummary(
      [rollup({ endSodiumLost: 1200 }), rollup({ endSodiumLost: 900 })],
      0,
    );
    const heat = out.find((s) => s.key === 'heat')!;
    expect(heat.value).toBe('2.1g');
  });
});

describe('deriveWinMoments', () => {
  it('returns no moments for empty input', () => {
    expect(deriveWinMoments([], 0)).toEqual([]);
  });

  it('surfaces an active streak even with a single day', () => {
    const out = deriveWinMoments([rollup()], 4);
    expect(out[0]).toMatchObject({
      id: 'streak',
      text: '4-day streak active',
    });
  });

  it('does not surface a streak below 2 days', () => {
    const out = deriveWinMoments([rollup()], 1);
    expect(out.find((m) => m.id === 'streak')).toBeUndefined();
  });

  it('surfaces recovery-after-corrections when avg jumps ≥10 with ≥3 intakes', () => {
    const out = deriveWinMoments(
      [
        rollup({ date: '2026-05-19', avgScore: 55, intakeCount: 2 }),
        rollup({ date: '2026-05-20', avgScore: 70, intakeCount: 4 }),
      ],
      0,
    );
    const m = out.find((x) => x.id === 'recovery-restored');
    expect(m?.text).toBe('Recovery restored after 4 corrections');
  });

  it('surfaces heat recovery when sodium-in rose and losses held steady', () => {
    const out = deriveWinMoments(
      [
        rollup({ date: '2026-05-19', endSodiumDelivered: 800, endSodiumLost: 1000 }),
        rollup({ date: '2026-05-20', endSodiumDelivered: 1300, endSodiumLost: 1050 }),
      ],
      0,
    );
    expect(out.find((m) => m.id === 'heat-recovery')).toBeDefined();
  });

  it('surfaces territory momentum when sessions increased', () => {
    const out = deriveWinMoments(
      [
        rollup({ date: '2026-05-19', autopilotSessions: 0, socialSessions: 0 }),
        rollup({ date: '2026-05-20', autopilotSessions: 1, socialSessions: 1 }),
      ],
      0,
    );
    expect(out.find((m) => m.id === 'territory-momentum')).toBeDefined();
  });

  it('surfaces stabilized-faster when deficit shrank ≥5 points', () => {
    const out = deriveWinMoments(
      [
        rollup({ date: '2026-05-19', endDeficitPct: 15 }),
        rollup({ date: '2026-05-20', endDeficitPct: 8 }),
      ],
      0,
    );
    expect(out.find((m) => m.id === 'stabilized')).toBeDefined();
  });

  it('caps the moments list at 5 entries', () => {
    const out = deriveWinMoments(
      [
        rollup({
          date: '2026-05-19',
          avgScore: 50,
          intakeCount: 2,
          endSodiumDelivered: 500,
          endSodiumLost: 1000,
          autopilotSessions: 0,
          socialSessions: 0,
          endDeficitPct: 20,
        }),
        rollup({
          date: '2026-05-20',
          avgScore: 75, // +25 → recovery
          intakeCount: 4,
          endSodiumDelivered: 1200, // +700 → heat
          endSodiumLost: 1050,
          autopilotSessions: 2, // momentum
          socialSessions: 1,
          endDeficitPct: 5, // -15 → stabilized
        }),
      ],
      5, // streak
    );
    expect(out).toHaveLength(5);
  });
});
