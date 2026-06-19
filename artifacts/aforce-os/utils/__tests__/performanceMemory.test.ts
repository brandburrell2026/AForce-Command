import { describe, it, expect } from 'vitest';
import {
  computePerformanceMemory,
  type PerformanceMemoryEntry,
} from '../performanceMemory';

/** Local day index for a Date, matching the helper's internal convention. */
function dayIndexOf(d: Date): number {
  return Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86_400_000);
}

const NOW = new Date(2026, 5, 19, 7, 0); // 2026-06-19 morning
const TODAY = dayIndexOf(NOW);

function entry(daysAgo: number, energy: number, stress = 3, goal = 'train'): PerformanceMemoryEntry {
  return { dayIndex: TODAY - daysAgo, energy, stress, goal };
}

describe('performanceMemory · empty', () => {
  it('returns a neutral first-check-in recap with no history', () => {
    const r = computePerformanceMemory([], NOW);
    expect(r.status).toBe('empty');
    expect(r.entriesLogged).toBe(0);
    expect(r.streak).toBe(0);
    expect(r.latest).toBeNull();
    expect(r.previous).toBeNull();
    expect(r.energyTrend).toBeNull();
    expect(r.recap).toMatch(/first check-in/i);
  });
});

describe('performanceMemory · single entry', () => {
  it('reports one entry, no trend, live streak of 1', () => {
    const r = computePerformanceMemory([entry(0, 4)], NOW);
    expect(r.status).toBe('ready');
    expect(r.entriesLogged).toBe(1);
    expect(r.streak).toBe(1);
    expect(r.latest).toEqual({ energy: 4, stress: 3, goal: 'train' });
    expect(r.previous).toBeNull();
    expect(r.energyTrend).toBeNull();
  });
});

describe('performanceMemory · streak + trend', () => {
  it('counts a consecutive-day streak ending today', () => {
    const r = computePerformanceMemory(
      [entry(2, 3), entry(1, 4), entry(0, 5)],
      NOW,
    );
    expect(r.entriesLogged).toBe(3);
    expect(r.streak).toBe(3);
    expect(r.energyTrend).toBe('rising'); // 4 → 5
  });

  it('a gap breaks the streak run at the latest entry', () => {
    // days: -5, -1, 0  → run ending today is just (-1, 0) = 2
    const r = computePerformanceMemory(
      [entry(5, 2), entry(1, 3), entry(0, 3)],
      NOW,
    );
    expect(r.streak).toBe(2);
    expect(r.energyTrend).toBe('steady'); // 3 → 3
  });

  it('declining energy reads as declining', () => {
    const r = computePerformanceMemory([entry(1, 5), entry(0, 2)], NOW);
    expect(r.energyTrend).toBe('declining');
    expect(r.recap.toLowerCase()).toContain('water');
  });

  it('streak is dead when the latest entry is older than yesterday', () => {
    const r = computePerformanceMemory([entry(4, 3), entry(3, 4)], NOW);
    expect(r.entriesLogged).toBe(2);
    expect(r.streak).toBe(0); // latest is 3 days ago → not live
  });
});

describe('performanceMemory · hygiene', () => {
  it('dedupes by day (latest wins) and ignores malformed entries', () => {
    const dirty: PerformanceMemoryEntry[] = [
      entry(0, 2),
      { ...entry(0, 5) }, // same day, should win
      { dayIndex: Number.NaN, energy: 3, stress: 3, goal: 'x' },
      { dayIndex: TODAY - 1, energy: Number.NaN, stress: 3, goal: 'x' },
    ];
    const r = computePerformanceMemory(dirty, NOW);
    expect(r.entriesLogged).toBe(1);
    expect(r.latest?.energy).toBe(5);
  });
});
