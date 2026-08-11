/**
 * circleV3Presentation — unit tests. The contract under test: the "You" card
 * carries only real fields (fake rank movement dropped; flat trend → no
 * pill), the boards render only the real anonymous referral leaderboard with
 * honest loading/empty/offline postures, the live chip is true only with
 * real server rows, and the own-baseline hydration challenge never invents a
 * number without rollups.
 */
import { describe, it, expect } from 'vitest';

import type { JournalRollup } from '@/types';
import { af } from '@/theme';
import {
  buildCircleV3Model,
  initialsFor,
  CIRCLE_BOARD_MAX_ROWS,
  type CircleBoard,
  type CircleV3Inputs,
} from '../circleV3Presentation';

function rollup(date: string, units: number): JournalRollup {
  return {
    date,
    snapshotsCount: 3,
    avgScore: 80,
    minScore: 70,
    maxScore: 90,
    endOzConsumed: units * 12,
    endAforceUnits: 1,
    endUnitsConsumed: units,
    endSodiumDelivered: 0,
    endSodiumLost: 0,
    endDeficitPct: 0,
    pctTimePeak: 30,
    pctTimeBalanced: 50,
    pctTimeRecovering: 15,
    pctTimeDepleted: 5,
  } as JournalRollup;
}

function board(overrides: Partial<CircleBoard> = {}): CircleBoard {
  return {
    entries: [
      { handle: 'Operator 4821', tier: { label: 'Vanguard' }, claims: 14, rank: 1, isYou: false },
      { handle: 'Operator 0193', tier: { label: 'Scout' }, claims: 9, rank: 2, isYou: false },
      { handle: 'Operator 7745', tier: { label: 'Scout' }, claims: 4, rank: 3, isYou: true },
    ],
    yourRank: 3,
    yourClaims: 4,
    totalParticipants: 27,
    ...overrides,
  };
}

function inputs(overrides: Partial<CircleV3Inputs> = {}): CircleV3Inputs {
  return {
    score: 92.4,
    level: 'PEAK',
    trend: null,
    displayName: 'Brandon Burrell',
    city: 'Miami',
    complianceStreak: 10,
    rollups: [],
    board: null,
    boardFailed: false,
    ...overrides,
  };
}

describe('initialsFor', () => {
  it('takes first + last initials, uppercased, with honest fallbacks', () => {
    expect(initialsFor('Brandon Burrell')).toBe('BB');
    expect(initialsFor('cher')).toBe('C');
    expect(initialsFor('   ')).toBe('—');
  });
});

describe('buildCircleV3Model — You card', () => {
  it('carries only real fields: clamped score, band accent, streak, real trend', () => {
    const m = buildCircleV3Model(
      inputs({ trend: { direction: 'rising', delta: 4.6, ageSec: 60 } as never, board: board() }),
    );
    expect(m.you.score).toBe(92);
    expect(m.you.accent).toBe(af.green);
    expect(m.you.bandKey).toBe('peak');
    expect(m.you.streak).toBe(10);
    expect(m.you.trendPill).toEqual({ direction: 'rising', delta: 5 });
    expect(m.you.boardRank).toBe(3);
    expect(m.you.claims).toBe(4);
    expect(m.you.city).toBe('Miami');
  });

  it('drops the pill when flat and the rank when unranked — never a fake movement', () => {
    const m = buildCircleV3Model(
      inputs({
        trend: { direction: 'flat', delta: 0, ageSec: 60 } as never,
        city: '  ',
        board: board({ yourRank: 0, yourClaims: 0, entries: [] }),
      }),
    );
    expect(m.you.trendPill).toBeNull();
    expect(m.you.boardRank).toBeNull();
    expect(m.you.city).toBeNull();
  });
});

describe('buildCircleV3Model — boards', () => {
  it('is live only with real rows; caps rows and surfaces stats', () => {
    const many = Array.from({ length: 15 }, (_, i) => ({
      handle: `Operator ${1000 + i}`,
      tier: { label: i === 0 ? 'Vanguard' : 'Scout' },
      claims: 20 - i,
      rank: i + 1,
      isYou: false,
    }));
    const m = buildCircleV3Model(
      inputs({ board: board({ entries: many, yourRank: 14, yourClaims: 7 }) }),
    );
    expect(m.live).toBe(true);
    expect(m.boardStatus).toBe('live');
    expect(m.boardRows).toHaveLength(CIRCLE_BOARD_MAX_ROWS);
    // ranked but pushed off the visible rows → separate You row, real values
    expect(m.youRow).toMatchObject({ rank: 14, claims: 7, isYou: true });
    expect(m.stats).toEqual({ operators: 27, yourClaims: 7, topTier: 'Vanguard' });
  });

  it('renders honest postures: loading, offline, empty — and no live chip for any of them', () => {
    expect(buildCircleV3Model(inputs()).boardStatus).toBe('loading');
    expect(buildCircleV3Model(inputs({ boardFailed: true })).boardStatus).toBe('offline');
    const empty = buildCircleV3Model(inputs({ board: board({ entries: [], yourRank: 0 }) }));
    expect(empty.boardStatus).toBe('empty');
    expect(empty.live).toBe(false);
    expect(empty.stats).toBeNull();
  });
});

describe('buildCircleV3Model — own-baseline hydration challenge', () => {
  it('counts days with intake out of 7 from real rollups', () => {
    const m = buildCircleV3Model(
      inputs({
        rollups: [rollup('2026-08-05', 4), rollup('2026-08-06', 0), rollup('2026-08-07', 2)],
      }),
    );
    expect(m.challenge).toEqual({ hydrationDays: 2, windowDays: 7, fraction: 2 / 7 });
  });

  it('renders a posture, never a number, without rollups', () => {
    expect(buildCircleV3Model(inputs()).challenge).toBeNull();
  });
});
