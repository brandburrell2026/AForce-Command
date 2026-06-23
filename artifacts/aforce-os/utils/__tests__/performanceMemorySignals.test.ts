import { describe, it, expect } from 'vitest';

import {
  PERFORMANCE_MEMORY_RETENTION_DAYS,
  PERFORMANCE_MEMORY_RETENTION_MS,
  PERFORMANCE_MEMORY_MAX_PER_SOURCE,
  buildTravelSignal,
  buildCaffeineSignal,
  buildUserPrioritySignal,
  mergeSignals,
  sanitizeCaptureState,
  utcDayIndex,
  emptyCaptureState,
  type CaffeineSignal,
  type TravelSignal,
} from '../performanceMemorySignals';

const MS_PER_DAY = 86_400_000;
const NOW = 1_700_000_000_000; // fixed epoch ms

describe('performanceMemorySignals — builders', () => {
  it('travel signal is one-per-UTC-day (day-keyed, idempotent id)', () => {
    const s = buildTravelSignal(NOW);
    expect(s).not.toBeNull();
    expect(s?.kind).toBe('travel');
    expect(s?.id).toBe(`travel:${utcDayIndex(NOW)}`);
    // Two captures the same day produce the SAME id (dedupe target).
    const later = buildTravelSignal(NOW + 3_600_000);
    expect(later?.id).toBe(s?.id);
  });

  it('caffeine signal is keyed by intake event id and carries category', () => {
    const s = buildCaffeineSignal({ intakeEventId: 'evt-1', atMs: NOW, categoryId: 'coffee' });
    expect(s?.id).toBe('caffeine:evt-1');
    expect(s?.categoryId).toBe('coffee');
  });

  it('priority signal requires a non-empty goal (no fabrication)', () => {
    expect(buildUserPrioritySignal({ atMs: NOW, goal: '' })).toBeNull();
    expect(buildUserPrioritySignal({ atMs: NOW, goal: 'train' })).not.toBeNull();
  });

  it('builders reject non-finite / non-positive timestamps', () => {
    expect(buildTravelSignal(0)).toBeNull();
    expect(buildTravelSignal(Number.NaN)).toBeNull();
    expect(buildCaffeineSignal({ intakeEventId: 'x', atMs: -1 })).toBeNull();
    expect(buildCaffeineSignal({ intakeEventId: '', atMs: NOW })).toBeNull();
  });
});

describe('performanceMemorySignals — mergeSignals (dedupe / prune / cap)', () => {
  it('dedupes by id with EXISTING winning over incoming', () => {
    const existing: TravelSignal[] = [
      { id: 'travel:1', kind: 'travel', atMs: NOW, dayIndex: 1 },
    ];
    const incoming: TravelSignal[] = [
      { id: 'travel:1', kind: 'travel', atMs: NOW + 5000, dayIndex: 1 },
    ];
    const merged = mergeSignals(existing, incoming, NOW + 5000);
    expect(merged).toHaveLength(1);
    // Existing entry (original atMs) is preserved, not clobbered.
    expect(merged[0].atMs).toBe(NOW);
  });

  it('prunes entries older than the retention window', () => {
    const old: TravelSignal = {
      id: 'old',
      kind: 'travel',
      atMs: NOW - PERFORMANCE_MEMORY_RETENTION_MS - MS_PER_DAY,
      dayIndex: utcDayIndex(NOW - PERFORMANCE_MEMORY_RETENTION_MS - MS_PER_DAY),
    };
    const fresh: TravelSignal = {
      id: 'fresh',
      kind: 'travel',
      atMs: NOW - MS_PER_DAY,
      dayIndex: utcDayIndex(NOW - MS_PER_DAY),
    };
    const merged = mergeSignals([old, fresh], [], NOW);
    expect(merged.map((m) => m.id)).toEqual(['fresh']);
  });

  it('retention window is exactly 180 days', () => {
    expect(PERFORMANCE_MEMORY_RETENTION_DAYS).toBe(180);
    expect(PERFORMANCE_MEMORY_RETENTION_MS).toBe(180 * MS_PER_DAY);
  });

  it('caps to the most recent N entries, keeping the newest', () => {
    const many: CaffeineSignal[] = Array.from(
      { length: PERFORMANCE_MEMORY_MAX_PER_SOURCE + 50 },
      (_, i) => ({
        id: `c-${i}`,
        kind: 'caffeine' as const,
        atMs: NOW - (PERFORMANCE_MEMORY_MAX_PER_SOURCE + 50 - i) * 1000,
        dayIndex: utcDayIndex(NOW),
      }),
    );
    const merged = mergeSignals(many, [], NOW);
    expect(merged).toHaveLength(PERFORMANCE_MEMORY_MAX_PER_SOURCE);
    // Oldest dropped, newest kept, ascending order preserved.
    expect(merged[merged.length - 1].id).toBe(`c-${PERFORMANCE_MEMORY_MAX_PER_SOURCE + 49}`);
  });

  it('sorts ascending by atMs', () => {
    const a: TravelSignal = { id: 'a', kind: 'travel', atMs: NOW, dayIndex: 1 };
    const b: TravelSignal = { id: 'b', kind: 'travel', atMs: NOW - 10_000, dayIndex: 1 };
    const merged = mergeSignals([a, b], [], NOW);
    expect(merged.map((m) => m.id)).toEqual(['b', 'a']);
  });
});

describe('performanceMemorySignals — sanitizeCaptureState (untrusted JSON)', () => {
  it('drops malformed entries and never fabricates', () => {
    const raw = {
      travel: [
        { id: 'travel:1', atMs: NOW, dayIndex: 1 },
        { id: '', atMs: NOW }, // bad id
        { atMs: NOW }, // missing id
        null,
        42,
      ],
      caffeine: [{ id: 'c1', atMs: NOW, categoryId: 'coffee' }],
      priorities: [
        { id: 'p1', atMs: NOW, goal: 'train' },
        { id: 'p2', atMs: NOW }, // missing goal ⇒ dropped
      ],
    };
    const state = sanitizeCaptureState(raw, NOW);
    expect(state.travel).toHaveLength(1);
    expect(state.caffeine).toHaveLength(1);
    expect(state.caffeine[0].categoryId).toBe('coffee');
    expect(state.priorities).toHaveLength(1);
    expect(state.priorities[0].goal).toBe('train');
    // hydrated stays false — the caller flips it after merge.
    expect(state.hydrated).toBe(false);
  });

  it('returns an empty state for garbage input', () => {
    expect(sanitizeCaptureState(null, NOW)).toEqual(emptyCaptureState());
    expect(sanitizeCaptureState('nope', NOW)).toEqual(emptyCaptureState());
  });

  it('caps and prunes each stream INDEPENDENTLY (one stream cannot starve another)', () => {
    const caffeine = Array.from({ length: PERFORMANCE_MEMORY_MAX_PER_SOURCE + 25 }, (_, i) => ({
      id: `c-${i}`,
      atMs: NOW - i * 1000,
      dayIndex: utcDayIndex(NOW),
    }));
    const travel = [{ id: 'travel:1', atMs: NOW, dayIndex: 1 }];
    const state = sanitizeCaptureState({ caffeine, travel }, NOW);
    // Caffeine burst is capped, but travel survives untouched.
    expect(state.caffeine).toHaveLength(PERFORMANCE_MEMORY_MAX_PER_SOURCE);
    expect(state.travel).toHaveLength(1);
  });
});
