import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

import {
  deriveUnifiedPerformanceMemory,
  type UnifiedPerformanceMemoryInputs,
} from '../performanceMemoryUnified';
import {
  derivePerformanceIdentity,
  derivePerformanceIdentitySignals,
  PERFORMANCE_ARCHETYPES,
} from '../performanceIdentity';
import type { CommandEvent } from '../intelligence/commandEvents';
import type { PerformanceMemoryEntry } from '../performanceMemory';

const MS_PER_DAY = 86_400_000;
const NOW = 1_700_000_000_000;

function confirmation(dayOffset: number, followed: boolean, commandType?: string): CommandEvent {
  const occurredAtMs = NOW - dayOffset * MS_PER_DAY;
  return {
    kind: 'command_confirmation',
    occurredAtMs,
    localDayIndex: Math.floor(occurredAtMs / MS_PER_DAY),
    followed,
    ...(commandType ? { commandType } : {}),
  } as CommandEvent;
}

function checkIn(dayIndex: number): PerformanceMemoryEntry {
  return { dayIndex, energy: 4, stress: 2, goal: 'focus' };
}

/** A maximally "strong" performer across every stream the signals read. */
function strongInputs(): UnifiedPerformanceMemoryInputs {
  const baseDay = Math.floor(NOW / MS_PER_DAY);
  return {
    nowMs: NOW,
    hydrationHistory: Array.from({ length: 10 }, (_, i) => ({
      atMs: NOW - i * MS_PER_DAY,
      score: 88,
    })),
    checkIns: Array.from({ length: 10 }, (_, i) => checkIn(baseDay - i)),
    ledgerEvents: Array.from({ length: 12 }, (_, i) => confirmation(i, true, 'hydration')),
    recovery: { recovery: 90, pressure: 15, trend: 'rising' },
  };
}

describe('derivePerformanceIdentity — classifier is INERT', () => {
  it('empty memory ⇒ neutral signals and null archetype/confidence', () => {
    const memory = deriveUnifiedPerformanceMemory({});
    const identity = derivePerformanceIdentity(memory);

    expect(identity.archetype).toBeNull();
    expect(identity.confidence).toBeNull();
    expect(identity.lastUpdated).toBeNull();

    const s = identity.supportingSignals;
    expect(s.consistency.available).toBe(false);
    expect(s.consistency.hydrationDaysActive).toBe(0);
    expect(s.completionRate.available).toBe(false);
    expect(s.completionRate.allTimeRate).toBeNull();
    expect(s.recoveryBehavior.available).toBe(false);
    expect(s.recoveryBehavior.recovery).toBeNull();
    expect(s.streakBehavior.available).toBe(false);
    expect(s.adherence.available).toBe(false);
    expect(s.adherence.preferredCommandTypes).toEqual([]);
  });

  it('STRONG signals still produce a null archetype and null confidence', () => {
    const memory = deriveUnifiedPerformanceMemory(strongInputs());
    const identity = derivePerformanceIdentity(memory);

    // The signals must genuinely be strong, otherwise the assertion is hollow.
    expect(identity.supportingSignals.consistency.hydrationDaysActive).toBeGreaterThan(0);
    expect(identity.supportingSignals.completionRate.total).toBeGreaterThan(0);
    expect(identity.supportingSignals.completionRate.allTimeRate).toBeGreaterThan(0);
    expect(identity.supportingSignals.recoveryBehavior.recovery).toBeGreaterThan(0);

    // …yet the classifier assigns nothing.
    expect(identity.archetype).toBeNull();
    expect(identity.confidence).toBeNull();
  });

  it('stays null across many strong permutations (no hidden assignment path)', () => {
    const trends = ['rising', 'falling', 'steady'];
    for (let days = 0; days <= 14; days += 1) {
      for (const trend of trends) {
        const memory = deriveUnifiedPerformanceMemory({
          nowMs: NOW,
          ledgerEvents: Array.from({ length: days }, (_, i) =>
            confirmation(i, i % 2 === 0, 'recovery'),
          ),
          recovery: { recovery: days * 6, pressure: 100 - days * 6, trend },
        });
        const identity = derivePerformanceIdentity(memory);
        expect(identity.archetype, `days=${days} trend=${trend}`).toBeNull();
        expect(identity.confidence, `days=${days} trend=${trend}`).toBeNull();
      }
    }
  });
});

describe('derivePerformanceIdentitySignals — faithful read-through (no fabrication)', () => {
  it('projects every signal straight from the unified snapshot', () => {
    const memory = deriveUnifiedPerformanceMemory(strongInputs());
    const s = derivePerformanceIdentitySignals(memory);

    expect(s.consistency.hydrationDaysActive).toBe(memory.hydrationPatterns.daysActive);
    expect(s.consistency.hydrationLogs).toBe(memory.hydrationPatterns.totalLogs);
    expect(s.consistency.checkInStreak).toBe(memory.checkInHistory.streak);
    expect(s.consistency.checkInEntries).toBe(memory.checkInHistory.entriesLogged);

    expect(s.completionRate.followed).toBe(memory.completionHistory.followed);
    expect(s.completionRate.total).toBe(memory.completionHistory.total);
    expect(s.completionRate.allTimeRate).toBe(memory.completionHistory.followedRate);
    expect(s.completionRate.recentRate).toBe(memory.completionHistory.recentFollowedRate);

    expect(s.recoveryBehavior.recovery).toBe(memory.recoveryPatterns.recovery);
    expect(s.recoveryBehavior.pressure).toBe(memory.recoveryPatterns.pressure);
    expect(s.recoveryBehavior.trend).toBe(memory.recoveryPatterns.trend);

    expect(s.streakBehavior.executionStreak).toBe(memory.executionStreaks.executionStreak);
    expect(s.streakBehavior.executionTrend).toBe(memory.executionStreaks.trend);

    expect(s.adherence.recentFollowedRate).toBe(memory.completionHistory.recentFollowedRate);
    expect(s.adherence.preferredCommandTypes.map((p) => p.commandType)).toEqual(
      memory.preferredCommandTypes.map((p) => p.commandType),
    );
  });

  it('never invents a value for an absent source', () => {
    const memory = deriveUnifiedPerformanceMemory({ nowMs: NOW });
    const s = derivePerformanceIdentitySignals(memory);

    expect(s.completionRate.followed).toBe(0);
    expect(s.completionRate.total).toBe(0);
    expect(s.completionRate.allTimeRate).toBeNull();
    expect(s.completionRate.recentRate).toBeNull();
    expect(s.recoveryBehavior.recovery).toBeNull();
    expect(s.recoveryBehavior.trend).toBeNull();
    expect(s.adherence.recentFollowedRate).toBeNull();
  });

  it('mirrors the snapshot freshness (lastUpdated) exactly', () => {
    const memory = deriveUnifiedPerformanceMemory(strongInputs());
    expect(derivePerformanceIdentity(memory).lastUpdated).toBe(memory.lastUpdated);
  });
});

describe('Performance Identity — archetype vocabulary is inert', () => {
  it('declares the five archetypes as a stable, unused target vocabulary', () => {
    expect([...PERFORMANCE_ARCHETYPES]).toEqual([
      'Operator',
      'Warrior',
      'Optimizer',
      'Builder',
      'Recoverer',
    ]);
  });
});

describe('Performance Identity — Score-Protection structural invariant', () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const aforceRoot = resolve(here, '..', '..');
  const read = (rel: string) => readFileSync(resolve(aforceRoot, rel), 'utf8');

  it('the pure util imports neither the store, react-native, nor any engine', () => {
    const src = read('utils/performanceIdentity.ts');
    const re = /(?:import|export)[^'"]*?from\s+['"]([^'"]+)['"]/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(src)) !== null) {
      expect(m[1], `imports forbidden module "${m[1]}"`).not.toMatch(
        /react-native|(^|\/)store(\/|$)|engine|reducer/i,
      );
    }
  });

  it('never dispatches or mutates score (util + hook)', () => {
    for (const rel of ['utils/performanceIdentity.ts', 'hooks/usePerformanceIdentity.ts']) {
      const src = read(rel);
      expect(src, `${rel} must not call dispatch()`).not.toMatch(/\bdispatch\s*\(/);
      expect(src, `${rel} must not mutate score`).not.toMatch(
        /setScore|SET_SCORE|awardScore|applyScore|mutateScore|addPoints|setProviderBiometrics/i,
      );
    }
  });

  it('contains no archetype-assignment logic (no map onto the vocabulary)', () => {
    const src = read('utils/performanceIdentity.ts');
    // archetype is only ever set to null — never to a vocabulary member.
    expect(src).toMatch(/archetype:\s*null/);
    expect(src).not.toMatch(/archetype:\s*['"](Operator|Warrior|Optimizer|Builder|Recoverer)['"]/);
    // confidence is only ever null — no score is computed.
    expect(src).toMatch(/confidence:\s*null/);
  });
});
