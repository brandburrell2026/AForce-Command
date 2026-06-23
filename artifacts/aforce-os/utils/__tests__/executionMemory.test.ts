import { describe, it, expect } from 'vitest';
import {
  computeExecutionMemory,
  EXECUTION_TREND_MIN_PER_HALF,
} from '../intelligence/executionMemory';
import { ADHERENCE_WINDOW_MS } from '../intelligence/commandEventAdapters';
import type {
  CommandConfirmationCommandEvent,
  CommandEvent,
  IntakeCommandEvent,
} from '../intelligence/commandEvents';

const MS_PER_DAY = 86_400_000;
// A fixed clock partway through a UTC day so day-of-time offsets are realistic.
const NOW_MS = 1_700_000_000_000;
const NOW_DAY = Math.floor(NOW_MS / MS_PER_DAY);

let seq = 0;
function conf(opts: {
  daysAgo?: number;
  atMs?: number;
  followed: boolean;
  commandType?: string;
}): CommandConfirmationCommandEvent {
  const occurredAtMs = opts.atMs ?? NOW_MS - (opts.daysAgo ?? 0) * MS_PER_DAY;
  seq += 1;
  return {
    id: `cc:${occurredAtMs}:${seq}`,
    kind: 'command_confirmation',
    occurredAtMs,
    localDayIndex: Math.floor(occurredAtMs / MS_PER_DAY),
    source: 'confirmationDelta',
    followed: opts.followed,
    ...(opts.commandType ? { commandType: opts.commandType } : {}),
  };
}

describe('executionMemory · empty', () => {
  it('returns a neutral first-command recap with no confirmations', () => {
    const r = computeExecutionMemory([], NOW_MS);
    expect(r.status).toBe('empty');
    expect(r.sampleSize).toBe(0);
    expect(r.followed).toBe(0);
    expect(r.followedRate).toBeNull();
    expect(r.executionStreak).toBe(0);
    expect(r.latestFollowedDayIndex).toBeNull();
    expect(r.trend).toBeNull();
    expect(r.topCommandType).toBeNull();
    expect(r.recap).toMatch(/first command/i);
  });

  it('ignores non-confirmation events entirely', () => {
    const intake: IntakeCommandEvent = {
      id: 'intake:1',
      kind: 'intake',
      occurredAtMs: NOW_MS,
      localDayIndex: NOW_DAY,
      source: 'intakeEvents',
      intakeEventId: '1',
    };
    const r = computeExecutionMemory([intake], NOW_MS);
    expect(r.status).toBe('empty');
  });
});

describe('executionMemory · insufficient', () => {
  it('reports honest counts but null rate/trend below the sample floor', () => {
    const r = computeExecutionMemory(
      [conf({ daysAgo: 0, followed: true }), conf({ daysAgo: 1, followed: false })],
      NOW_MS,
    );
    expect(r.status).toBe('insufficient');
    expect(r.sampleSize).toBe(2);
    expect(r.followed).toBe(1);
    expect(r.followedRate).toBeNull();
    expect(r.trend).toBeNull();
    // streak still computed honestly: only the followed (today) day counts.
    expect(r.executionStreak).toBe(1);
    expect(r.recap).toMatch(/building/i);
  });
});

describe('executionMemory · ready rate', () => {
  it('reports followedRate once at/above the sample floor', () => {
    const r = computeExecutionMemory(
      [
        conf({ daysAgo: 0, followed: true }),
        conf({ daysAgo: 1, followed: true }),
        conf({ daysAgo: 2, followed: false }),
      ],
      NOW_MS,
    );
    expect(r.status).toBe('ready');
    expect(r.sampleSize).toBe(3);
    expect(r.followed).toBe(2);
    expect(r.followedRate).toBeCloseTo(2 / 3, 6);
  });
});

describe('executionMemory · streak', () => {
  it('counts consecutive UTC days ending today as live', () => {
    const r = computeExecutionMemory(
      [
        conf({ daysAgo: 2, followed: true }),
        conf({ daysAgo: 1, followed: true }),
        conf({ daysAgo: 0, followed: true }),
      ],
      NOW_MS,
    );
    expect(r.executionStreak).toBe(3);
    expect(r.latestFollowedDayIndex).toBe(NOW_DAY);
  });

  it('is dead when the latest followed day is older than yesterday', () => {
    const r = computeExecutionMemory(
      [conf({ daysAgo: 4, followed: true }), conf({ daysAgo: 3, followed: true })],
      NOW_MS,
    );
    expect(r.executionStreak).toBe(0);
    expect(r.latestFollowedDayIndex).toBe(NOW_DAY - 3);
  });

  it('a gap breaks the streak run at the latest followed day', () => {
    const r = computeExecutionMemory(
      [
        conf({ daysAgo: 5, followed: true }),
        conf({ daysAgo: 1, followed: true }),
        conf({ daysAgo: 0, followed: true }),
      ],
      NOW_MS,
    );
    expect(r.executionStreak).toBe(2); // (-1, 0)
  });

  it('only followed confirmations extend the streak', () => {
    // yesterday was logged but NOT followed → today is an isolated live day.
    const r = computeExecutionMemory(
      [
        conf({ daysAgo: 1, followed: false }),
        conf({ daysAgo: 0, followed: true }),
        conf({ daysAgo: 0, followed: true }),
      ],
      NOW_MS,
    );
    expect(r.executionStreak).toBe(1);
  });

  it('dedupes multiple followed confirmations on one day', () => {
    const r = computeExecutionMemory(
      [
        conf({ daysAgo: 1, followed: true }),
        conf({ daysAgo: 1, followed: true }),
        conf({ daysAgo: 0, followed: true }),
      ],
      NOW_MS,
    );
    expect(r.executionStreak).toBe(2);
  });

  it('counts a UTC-day boundary pair (today 00:00 + yesterday 23:59) as a 2-day streak', () => {
    const todayStart = NOW_DAY * MS_PER_DAY;
    const r = computeExecutionMemory(
      [
        conf({ atMs: todayStart, followed: true }),
        conf({ atMs: todayStart - 1, followed: true }),
      ],
      NOW_MS,
    );
    expect(r.executionStreak).toBe(2);
    expect(r.latestFollowedDayIndex).toBe(NOW_DAY);
  });
});

describe('executionMemory · window', () => {
  it('excludes confirmations older than the window', () => {
    const r = computeExecutionMemory(
      [
        conf({ daysAgo: 20, followed: true }),
        conf({ daysAgo: 19, followed: true }),
        conf({ daysAgo: 18, followed: true }),
        conf({ daysAgo: 0, followed: true }),
      ],
      NOW_MS,
    );
    // only the in-window (today) confirmation survives → below the floor.
    expect(r.sampleSize).toBe(1);
    expect(r.status).toBe('insufficient');
  });
});

describe('executionMemory · trend', () => {
  it('reads improving when the newer half follows more than the older half', () => {
    const events: CommandEvent[] = [
      // older half (~8-12d ago): 1 of 3 followed
      conf({ daysAgo: 12, followed: false }),
      conf({ daysAgo: 11, followed: false }),
      conf({ daysAgo: 10, followed: true }),
      // newer half (~0-2d ago): 3 of 3 followed
      conf({ daysAgo: 2, followed: true }),
      conf({ daysAgo: 1, followed: true }),
      conf({ daysAgo: 0, followed: true }),
    ];
    const r = computeExecutionMemory(events, NOW_MS);
    expect(r.status).toBe('ready');
    expect(r.trend).toBe('improving');
  });

  it('reads declining when the newer half follows less', () => {
    const events: CommandEvent[] = [
      conf({ daysAgo: 12, followed: true }),
      conf({ daysAgo: 11, followed: true }),
      conf({ daysAgo: 10, followed: true }),
      conf({ daysAgo: 2, followed: false }),
      conf({ daysAgo: 1, followed: false }),
      conf({ daysAgo: 0, followed: true }),
    ];
    const r = computeExecutionMemory(events, NOW_MS);
    expect(r.trend).toBe('declining');
  });

  it('reads steady when both halves follow at the same rate', () => {
    const events: CommandEvent[] = [
      conf({ daysAgo: 12, followed: true }),
      conf({ daysAgo: 10, followed: false }),
      conf({ daysAgo: 2, followed: true }),
      conf({ daysAgo: 0, followed: false }),
    ];
    const r = computeExecutionMemory(events, NOW_MS);
    expect(r.trend).toBe('steady');
  });

  it('returns null trend when a half is below the per-half floor', () => {
    expect(EXECUTION_TREND_MIN_PER_HALF).toBe(2);
    const events: CommandEvent[] = [
      // older half: only 1 confirmation
      conf({ daysAgo: 10, followed: true }),
      // newer half: 3 confirmations
      conf({ daysAgo: 2, followed: true }),
      conf({ daysAgo: 1, followed: true }),
      conf({ daysAgo: 0, followed: false }),
    ];
    const r = computeExecutionMemory(events, NOW_MS);
    expect(r.status).toBe('ready'); // 4 total ≥ floor
    expect(r.trend).toBeNull(); // but older half too sparse
  });
});

describe('executionMemory · topCommandType', () => {
  it('reports the most-followed command type, breaking ties by recency', () => {
    const events: CommandEvent[] = [
      conf({ daysAgo: 5, followed: true, commandType: 'hydrate' }),
      conf({ daysAgo: 4, followed: true, commandType: 'hydrate' }),
      conf({ daysAgo: 3, followed: true, commandType: 'recover' }),
      conf({ daysAgo: 2, followed: true, commandType: 'recover' }),
      conf({ daysAgo: 0, followed: true, commandType: 'recover' }), // recover now leads
    ];
    const r = computeExecutionMemory(events, NOW_MS);
    expect(r.topCommandType).toBe('recover');
  });

  it('ignores command types on confirmations that were not followed', () => {
    const events: CommandEvent[] = [
      conf({ daysAgo: 2, followed: false, commandType: 'hydrate' }),
      conf({ daysAgo: 1, followed: false, commandType: 'hydrate' }),
      conf({ daysAgo: 0, followed: true, commandType: 'recover' }),
    ];
    const r = computeExecutionMemory(events, NOW_MS);
    expect(r.topCommandType).toBe('recover');
  });

  it('is null when no followed confirmation carried a command type', () => {
    const r = computeExecutionMemory(
      [
        conf({ daysAgo: 1, followed: true }),
        conf({ daysAgo: 0, followed: true }),
        conf({ daysAgo: 0, followed: true }),
      ],
      NOW_MS,
    );
    expect(r.topCommandType).toBeNull();
  });
});

describe('executionMemory · robustness', () => {
  it('falls back to the default window for a non-positive windowMs', () => {
    const r = computeExecutionMemory(
      [
        conf({ daysAgo: 0, followed: true }),
        conf({ daysAgo: 1, followed: true }),
        conf({ daysAgo: 2, followed: true }),
      ],
      NOW_MS,
      0,
    );
    expect(r.sampleSize).toBe(3);
    expect(ADHERENCE_WINDOW_MS).toBeGreaterThan(0);
  });
});
