import { describe, it, expect } from 'vitest';
import {
  CHECKPOINT_DAYS,
  CIRCLE_MAX,
  clampMembers,
  currentCheckpoint,
  deriveCheckpoints,
  isOverdue,
  nextCheckpoint,
  type RecoveryCircleMember,
} from '../recoveryCircle';

const START = '2026-01-01T00:00:00.000Z';
const startMs = Date.parse(START);
const MS_PER_DAY = 24 * 60 * 60 * 1000;

describe('recoveryCircle — spec constants', () => {
  it('caps the circle at three members', () => {
    expect(CIRCLE_MAX).toBe(3);
  });

  it('uses the exact spec cadence in spec order', () => {
    expect(CHECKPOINT_DAYS).toEqual([0, 1, 3, 7, 30]);
  });
});

describe('deriveCheckpoints', () => {
  it('returns one checkpoint per spec day with the right offsets', () => {
    const c = deriveCheckpoints(START);
    expect(c.map((x) => x.day)).toEqual([0, 1, 3, 7, 30]);
    expect(c.every((x) => x.completedAt === null)).toBe(true);
    expect(Date.parse(c[0]!.dueAt) - startMs).toBe(0);
    expect(Date.parse(c[1]!.dueAt) - startMs).toBe(1 * MS_PER_DAY);
    expect(Date.parse(c[2]!.dueAt) - startMs).toBe(3 * MS_PER_DAY);
    expect(Date.parse(c[3]!.dueAt) - startMs).toBe(7 * MS_PER_DAY);
    expect(Date.parse(c[4]!.dueAt) - startMs).toBe(30 * MS_PER_DAY);
  });

  it('tolerates an unparseable startAt without throwing', () => {
    const c = deriveCheckpoints('not-a-date');
    expect(c).toHaveLength(5);
    expect(c.map((x) => x.day)).toEqual([0, 1, 3, 7, 30]);
  });
});

describe('clampMembers', () => {
  it('truncates beyond CIRCLE_MAX, preserving earliest-added', () => {
    const members: RecoveryCircleMember[] = [
      { id: 'a', name: 'A' },
      { id: 'b', name: 'B' },
      { id: 'c', name: 'C' },
      { id: 'd', name: 'D' },
      { id: 'e', name: 'E' },
    ];
    const out = clampMembers(members);
    expect(out).toHaveLength(3);
    expect(out.map((m) => m.id)).toEqual(['a', 'b', 'c']);
  });

  it('passes through when under the cap', () => {
    const members: RecoveryCircleMember[] = [{ id: 'a', name: 'A' }];
    expect(clampMembers(members)).toEqual(members);
  });
});

describe('currentCheckpoint', () => {
  const checkpoints = deriveCheckpoints(START);

  it('returns the most recent due-and-incomplete checkpoint', () => {
    const now = startMs + 4 * MS_PER_DAY; // past day 0,1,3; before day 7
    expect(currentCheckpoint(checkpoints, now)?.day).toBe(3);
  });

  it('returns null when nothing has come due yet', () => {
    expect(currentCheckpoint(checkpoints, startMs - 1)).toBeNull();
  });

  it('skips completed checkpoints', () => {
    const partial = checkpoints.map((c) =>
      c.day === 3 ? { ...c, completedAt: START } : c,
    );
    // Day 3 done, Day 1 not done, now between day 3 and 7 → active is day 1
    const now = startMs + 4 * MS_PER_DAY;
    expect(currentCheckpoint(partial, now)?.day).toBe(1);
  });
});

describe('nextCheckpoint', () => {
  const checkpoints = deriveCheckpoints(START);

  it('returns the earliest strictly-future checkpoint', () => {
    const now = startMs + 4 * MS_PER_DAY;
    expect(nextCheckpoint(checkpoints, now)?.day).toBe(7);
  });

  it('returns Day 1 right at start', () => {
    expect(nextCheckpoint(checkpoints, startMs)?.day).toBe(1);
  });

  it('returns null after all checkpoints have passed', () => {
    expect(nextCheckpoint(checkpoints, startMs + 31 * MS_PER_DAY)).toBeNull();
  });
});

describe('isOverdue', () => {
  const [day0, day1] = deriveCheckpoints(START);

  it('returns false for completed checkpoints regardless of clock', () => {
    const done = { ...day1!, completedAt: START };
    expect(isOverdue(done, startMs + 999 * MS_PER_DAY)).toBe(false);
  });

  it('returns true when dueAt has strictly passed and not completed', () => {
    expect(isOverdue(day1!, startMs + 2 * MS_PER_DAY)).toBe(true);
  });

  it('returns false at exact dueAt boundary (strict less-than)', () => {
    expect(isOverdue(day0!, startMs)).toBe(false);
  });
});
