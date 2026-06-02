import type { HistoryEntry } from '../../types';

/**
 * Seed a synthetic baseline history entry when no real cycles exist yet.
 * Stamped to "yesterday" so day-1 users see a populated journal day card
 * instead of a stark empty state. Marked with `isSynthetic: true` so
 * downstream consumers (Insights, Streak Math) can opt out.
 */
export function buildSyntheticBaselineEntry(level: 'PEAK' | 'BALANCED' | 'RECOVERING' | 'DEPLETED', score: number): HistoryEntry {
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
  return {
    id: 'synthetic-baseline',
    timestamp: yesterday,
    score,
    state: level,
    action: 'Baseline reading — start logging to replace this synthetic snapshot.',
    unitsTaken: 0,
    isSynthetic: true,
  };
}
