import { describe, it, expect } from 'vitest';

import {
  deriveUnifiedPerformanceMemory,
  type UnifiedPerformanceMemoryInputs,
} from '../performanceMemoryUnified';
import type { CommandEvent } from '../intelligence/commandEvents';
import type {
  TravelSignal,
  CaffeineSignal,
  UserPrioritySignal,
} from '../performanceMemorySignals';

const MS_PER_DAY = 86_400_000;
const NOW = 1_700_000_000_000;

function confirmation(
  dayIndex: number,
  followed: boolean,
  commandType?: string,
): CommandEvent {
  return {
    kind: 'command_confirmation',
    occurredAtMs: dayIndex * MS_PER_DAY,
    localDayIndex: dayIndex,
    followed,
    ...(commandType ? { commandType } : {}),
  } as CommandEvent;
}

describe('deriveUnifiedPerformanceMemory — empty / no-fabrication', () => {
  it('maps an empty input set to honest neutral values', () => {
    const m = deriveUnifiedPerformanceMemory({});

    expect(m.hydrationPatterns).toMatchObject({
      totalLogs: 0,
      daysActive: 0,
      avgScore: null,
      latestScore: null,
    });
    expect(m.hydrationPatterns.coverage.available).toBe(false);

    expect(m.caffeinePatterns).toMatchObject({ totalLogs: 0, daysWithCaffeine: 0 });
    expect(m.caffeinePatterns.byCategory).toEqual({});
    expect(m.travelPatterns.travelDays).toBe(0);

    expect(m.userPriorities).toMatchObject({ daysRecorded: 0, topGoal: null });
    expect(m.userPriorities.byGoal).toEqual({});

    expect(m.commandHistory.totalConfirmations).toBe(0);
    expect(m.completionHistory).toMatchObject({
      followed: 0,
      total: 0,
      followedRate: null,
    });
    expect(m.preferredCommandTypes).toEqual([]);
    expect(m.recoveryPatterns).toMatchObject({ available: false, recovery: null });
    expect(m.performanceAgeHistory.latest).toBeNull();
    expect(m.lastUpdated).toBeNull();
  });

  it('does not mutate the input arrays (pure)', () => {
    const travel: TravelSignal[] = [{ id: 'travel:1', kind: 'travel', atMs: NOW, dayIndex: 1 }];
    const inputs: UnifiedPerformanceMemoryInputs = { travel, nowMs: NOW };
    const before = JSON.stringify(travel);
    deriveUnifiedPerformanceMemory(inputs);
    expect(JSON.stringify(travel)).toBe(before);
  });
});

describe('deriveUnifiedPerformanceMemory — capture-stream projections', () => {
  it('aggregates hydration logs into day buckets, avg, and latest score', () => {
    const m = deriveUnifiedPerformanceMemory({
      nowMs: NOW,
      hydrationHistory: [
        { atMs: NOW - 2 * MS_PER_DAY, score: 70 },
        { atMs: NOW - MS_PER_DAY, score: 80 },
        { atMs: NOW, score: 90 },
      ],
    });
    expect(m.hydrationPatterns.totalLogs).toBe(3);
    expect(m.hydrationPatterns.daysActive).toBe(3);
    expect(m.hydrationPatterns.avgScore).toBeCloseTo(80);
    expect(m.hydrationPatterns.latestScore).toBe(90);
    expect(m.hydrationPatterns.coverage.available).toBe(true);
  });

  it('counts caffeine by category and distinct days', () => {
    const caffeine: CaffeineSignal[] = [
      { id: 'c1', kind: 'caffeine', atMs: NOW, dayIndex: 10, categoryId: 'coffee' },
      { id: 'c2', kind: 'caffeine', atMs: NOW + 1000, dayIndex: 10, categoryId: 'coffee' },
      { id: 'c3', kind: 'caffeine', atMs: NOW + 2 * MS_PER_DAY, dayIndex: 12, categoryId: 'tea' },
    ];
    const m = deriveUnifiedPerformanceMemory({ nowMs: NOW + 3 * MS_PER_DAY, caffeine });
    expect(m.caffeinePatterns.totalLogs).toBe(3);
    expect(m.caffeinePatterns.daysWithCaffeine).toBe(2);
    expect(m.caffeinePatterns.byCategory).toEqual({ coffee: 2, tea: 1 });
  });

  it('dedupes travel by distinct day', () => {
    const travel: TravelSignal[] = [
      { id: 'travel:5', kind: 'travel', atMs: NOW, dayIndex: 5 },
      { id: 'travel:6', kind: 'travel', atMs: NOW + MS_PER_DAY, dayIndex: 6 },
    ];
    const m = deriveUnifiedPerformanceMemory({ nowMs: NOW + 2 * MS_PER_DAY, travel });
    expect(m.travelPatterns.travelDays).toBe(2);
  });

  it('keeps the LATEST priority per day and surfaces the top goal', () => {
    const priorities: UserPrioritySignal[] = [
      { id: 'p1', kind: 'priority', atMs: NOW, dayIndex: 1, goal: 'recover' },
      // same day, later → wins over 'recover'
      { id: 'p2', kind: 'priority', atMs: NOW + 5000, dayIndex: 1, goal: 'train' },
      { id: 'p3', kind: 'priority', atMs: NOW + MS_PER_DAY, dayIndex: 2, goal: 'train' },
    ];
    const m = deriveUnifiedPerformanceMemory({ nowMs: NOW + 2 * MS_PER_DAY, priorities });
    expect(m.userPriorities.daysRecorded).toBe(2);
    expect(m.userPriorities.byGoal).toEqual({ train: 2 });
    expect(m.userPriorities.topGoal).toBe('train');
  });

  it('lastUpdated is the newest observed timestamp across all streams', () => {
    const m = deriveUnifiedPerformanceMemory({
      nowMs: NOW + 10 * MS_PER_DAY,
      hydrationHistory: [{ atMs: NOW, score: 50 }],
      caffeine: [{ id: 'c', kind: 'caffeine', atMs: NOW + 3 * MS_PER_DAY, dayIndex: 1 }],
      travel: [{ id: 't', kind: 'travel', atMs: NOW + MS_PER_DAY, dayIndex: 1 }],
    });
    expect(m.lastUpdated).toBe(NOW + 3 * MS_PER_DAY);
  });
});

describe('deriveUnifiedPerformanceMemory — ledger completion roll-up', () => {
  it('summarizes confirmations, follow-rate, and preferred command types', () => {
    const ledgerEvents: CommandEvent[] = [
      confirmation(1, true, 'hydrate'),
      confirmation(2, true, 'hydrate'),
      confirmation(3, false, 'recover'),
      confirmation(4, true, 'recover'),
    ];
    const m = deriveUnifiedPerformanceMemory({ nowMs: 5 * MS_PER_DAY, ledgerEvents });
    expect(m.commandHistory.totalConfirmations).toBe(4);
    expect(m.completionHistory.followed).toBe(3);
    expect(m.completionHistory.total).toBe(4);
    expect(m.completionHistory.followedRate).toBeCloseTo(0.75);
    // 'hydrate' followed twice ⇒ ranked first.
    expect(m.preferredCommandTypes[0]).toEqual({ commandType: 'hydrate', followedCount: 2 });
  });
});

describe('deriveUnifiedPerformanceMemory — recovery passthrough', () => {
  it('passes through a provided recovery snapshot', () => {
    const m = deriveUnifiedPerformanceMemory({
      nowMs: NOW,
      recovery: { recovery: 62, pressure: 18, trend: 'rising' },
    });
    expect(m.recoveryPatterns).toEqual({
      available: true,
      recovery: 62,
      pressure: 18,
      trend: 'rising',
    });
  });
});
