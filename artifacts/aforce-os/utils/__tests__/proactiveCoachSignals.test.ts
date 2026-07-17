/**
 * Section 64 Step 3 — the `intakeLoggedToday` follow-signal selector.
 * Pure + Score-Protection: reads history only, mutates nothing.
 */
import { describe, it, expect } from 'vitest';
import { intakeLoggedToday } from '../intelligence/proactiveCoachSignals';
import type { HistoryEntry } from '../../types';

// Local-time anchors so localDayKey (which uses getFullYear/Month/Date) is stable.
const NOW = new Date(2026, 6, 16, 10, 0, 0); // 2026-07-16 10:00 local
const EARLIER_TODAY = new Date(2026, 6, 16, 6, 30, 0);
const LATE_TODAY = new Date(2026, 6, 16, 23, 59, 0);
const YESTERDAY = new Date(2026, 6, 15, 23, 0, 0);

function entry(over: Partial<HistoryEntry> = {}): HistoryEntry {
  return {
    id: Math.random().toString(36).slice(2),
    timestamp: EARLIER_TODAY,
    score: 70,
    state: 'BALANCED',
    action: 'Logged intake',
    unitsTaken: 1,
    ...over,
  } as HistoryEntry;
}

describe('Section 64 — intakeLoggedToday', () => {
  it('is false for empty history', () => {
    expect(intakeLoggedToday([], NOW)).toBe(false);
  });

  it('is true when a real intake was logged today', () => {
    expect(intakeLoggedToday([entry()], NOW)).toBe(true);
  });

  it('is true regardless of the time of day (same local day)', () => {
    expect(intakeLoggedToday([entry({ timestamp: LATE_TODAY })], NOW)).toBe(true);
  });

  it('ignores intakes from a previous day', () => {
    expect(intakeLoggedToday([entry({ timestamp: YESTERDAY })], NOW)).toBe(false);
  });

  it('ignores the synthetic baseline entry', () => {
    expect(intakeLoggedToday([entry({ isSynthetic: true })], NOW)).toBe(false);
  });

  it('ignores zero-unit rows (e.g. a status check, no intake)', () => {
    expect(intakeLoggedToday([entry({ unitsTaken: 0 })], NOW)).toBe(false);
  });

  it('is true when at least one real intake today is mixed with noise', () => {
    const history = [
      entry({ timestamp: YESTERDAY }),
      entry({ unitsTaken: 0 }),
      entry({ isSynthetic: true }),
      entry({ timestamp: EARLIER_TODAY, unitsTaken: 2 }),
    ];
    expect(intakeLoggedToday(history, NOW)).toBe(true);
  });
});
