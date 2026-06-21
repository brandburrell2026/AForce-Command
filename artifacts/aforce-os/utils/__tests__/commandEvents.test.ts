import { describe, it, expect } from 'vitest';
import {
  normalizeCommandEvent,
  mergeCommandEvents,
  eventsInWindow,
  eventsOnDay,
  eventsByKind,
  latestByKind,
  MAX_LEDGER_EVENTS,
  type CommandEvent,
} from '../intelligence/commandEvents';

const T = 1_700_000_000_000;

const intake = (over: Record<string, unknown> = {}): Record<string, unknown> => ({
  id: 'intake:a',
  kind: 'intake',
  occurredAtMs: T,
  localDayIndex: 0,
  source: 'intake',
  intakeEventId: 'a',
  ...over,
});

const voice = (over: Record<string, unknown> = {}): Record<string, unknown> => ({
  id: 'voice:0',
  kind: 'voice_checkin',
  occurredAtMs: T,
  localDayIndex: 0,
  source: 'voice',
  energy: 4,
  stress: 2,
  ...over,
});

describe('normalizeCommandEvent — accepts valid events per kind', () => {
  it('intake (with optional fields)', () => {
    const e = normalizeCommandEvent(intake({ oz: 12, units: 1, fluidType: 'water' }));
    expect(e).not.toBeNull();
    expect(e!.kind).toBe('intake');
    expect((e as any).intakeEventId).toBe('a');
    expect((e as any).oz).toBe(12);
  });

  it('voice_checkin', () => {
    const e = normalizeCommandEvent(voice({ goal: 'focus' }));
    expect(e?.kind).toBe('voice_checkin');
    expect((e as any).energy).toBe(4);
    expect((e as any).goal).toBe('focus');
  });

  it('command_confirmation', () => {
    const e = normalizeCommandEvent({
      id: 'command:c1:1', kind: 'command_confirmation', occurredAtMs: T,
      localDayIndex: 0, source: 'command', followed: true, delta: 3, commandType: 'hydrate',
    });
    expect(e?.kind).toBe('command_confirmation');
    expect((e as any).followed).toBe(true);
  });

  it('performance_age_snapshot', () => {
    const e = normalizeCommandEvent({
      id: 'perf-age:0', kind: 'performance_age_snapshot', occurredAtMs: T,
      localDayIndex: 0, source: 'performance-age', performanceAge: 27.5,
    });
    expect((e as any).performanceAge).toBe(27.5);
  });

  it('context_snapshot allows explicit null weather (no reading)', () => {
    const e = normalizeCommandEvent({
      id: 'ctx:0', kind: 'context_snapshot', occurredAtMs: T,
      localDayIndex: 0, source: 'context', weatherTempC: null, hasFreshBiometrics: false,
    });
    expect(e?.kind).toBe('context_snapshot');
    expect((e as any).weatherTempC).toBeNull();
  });

  it('strips unknown properties', () => {
    const e = normalizeCommandEvent(intake({ hacker: 'pwn', score: 999 }));
    expect(e).not.toBeNull();
    expect((e as any).hacker).toBeUndefined();
    expect((e as any).score).toBeUndefined();
  });
});

describe('normalizeCommandEvent — rejects invalid / fabrication-prone input', () => {
  it('rejects non-objects and unknown kinds', () => {
    expect(normalizeCommandEvent(null)).toBeNull();
    expect(normalizeCommandEvent(42)).toBeNull();
    expect(normalizeCommandEvent(intake({ kind: 'mystery' }))).toBeNull();
  });

  it('rejects missing id / source', () => {
    expect(normalizeCommandEvent(intake({ id: '' }))).toBeNull();
    expect(normalizeCommandEvent(intake({ source: '' }))).toBeNull();
  });

  it('rejects NaN / Infinity / non-positive timestamps', () => {
    expect(normalizeCommandEvent(intake({ occurredAtMs: NaN }))).toBeNull();
    expect(normalizeCommandEvent(intake({ occurredAtMs: Infinity }))).toBeNull();
    expect(normalizeCommandEvent(intake({ occurredAtMs: 0 }))).toBeNull();
  });

  it('rejects non-integer localDayIndex', () => {
    expect(normalizeCommandEvent(intake({ localDayIndex: 1.5 }))).toBeNull();
    expect(normalizeCommandEvent(intake({ localDayIndex: NaN }))).toBeNull();
  });

  it('rejects kind-specific bad payloads instead of inventing values', () => {
    expect(normalizeCommandEvent(intake({ intakeEventId: '' }))).toBeNull();
    expect(normalizeCommandEvent(intake({ oz: NaN }))).toBeNull();
    expect(normalizeCommandEvent(voice({ energy: NaN }))).toBeNull();
    expect(normalizeCommandEvent(voice({ stress: Infinity }))).toBeNull();
    expect(
      normalizeCommandEvent({
        id: 'c', kind: 'command_confirmation', occurredAtMs: T, localDayIndex: 0,
        source: 's', followed: 'yes',
      }),
    ).toBeNull();
    expect(
      normalizeCommandEvent({
        id: 'p', kind: 'performance_age_snapshot', occurredAtMs: T, localDayIndex: 0,
        source: 's', performanceAge: NaN,
      }),
    ).toBeNull();
    expect(
      normalizeCommandEvent({
        id: 'ctx', kind: 'context_snapshot', occurredAtMs: T, localDayIndex: 0,
        source: 's', weatherTempC: Infinity,
      }),
    ).toBeNull();
  });
});

describe('mergeCommandEvents', () => {
  it('normalizes, dedupes by id (existing wins / idempotent re-derive), sorts ascending', () => {
    const existing = [intake({ id: 'x', occurredAtMs: T + 100 })];
    const incoming = [
      intake({ id: 'x', occurredAtMs: T + 999, oz: 5 }), // duplicate id → ignored
      voice({ id: 'y', occurredAtMs: T - 50 }),
      'garbage',
      intake({ id: 'z', occurredAtMs: NaN }), // invalid → dropped
    ];
    const merged = mergeCommandEvents(existing, incoming);
    expect(merged.map((e) => e.id)).toEqual(['y', 'x']); // sorted by time asc
    // existing 'x' kept its original payload (no oz), duplicate did not overwrite
    expect((merged.find((e) => e.id === 'x') as any).oz).toBeUndefined();
  });

  it('empty incoming returns normalized existing unchanged (never clobbers)', () => {
    const existing = [intake({ id: 'a' }), voice({ id: 'b', occurredAtMs: T + 1 })];
    const merged = mergeCommandEvents(existing, []);
    expect(merged.map((e) => e.id)).toEqual(['a', 'b']);
  });

  it('drops the OLDEST events past the cap', () => {
    const many = Array.from({ length: MAX_LEDGER_EVENTS + 5 }, (_, i) =>
      intake({ id: `i${i}`, occurredAtMs: T + i }),
    );
    const merged = mergeCommandEvents([], many);
    expect(merged.length).toBe(MAX_LEDGER_EVENTS);
    expect(merged[0].id).toBe('i5'); // first 5 (oldest) dropped
    expect(merged[merged.length - 1].id).toBe(`i${MAX_LEDGER_EVENTS + 4}`);
  });

  it('respects a custom cap', () => {
    const many = [intake({ id: 'a', occurredAtMs: T }), intake({ id: 'b', occurredAtMs: T + 1 }), intake({ id: 'c', occurredAtMs: T + 2 })];
    const merged = mergeCommandEvents([], many, { cap: 2 });
    expect(merged.map((e) => e.id)).toEqual(['b', 'c']);
  });

  it('no fabrication: an all-garbage merge yields an empty ledger', () => {
    expect(mergeCommandEvents(['nope', null, 7], [{ bad: true }])).toEqual([]);
  });

  it('dedupes ids that are duplicated WITHIN existing (first wins)', () => {
    const existing = [
      intake({ id: 'dup', occurredAtMs: T, oz: 1 }),
      intake({ id: 'dup', occurredAtMs: T + 500, oz: 2 }),
    ];
    const merged = mergeCommandEvents(existing, []);
    expect(merged.length).toBe(1);
    expect((merged[0] as any).oz).toBe(1); // first occurrence retained
  });

  it('rejects a non-string commandId during merge normalization', () => {
    const merged = mergeCommandEvents([], [intake({ id: 'good' }), intake({ id: 'bad', commandId: 42 })]);
    expect(merged.map((e) => e.id)).toEqual(['good']);
  });

  it('preserves input order for equal timestamps (stable sort)', () => {
    const merged = mergeCommandEvents([], [
      intake({ id: 'first', occurredAtMs: T }),
      voice({ id: 'second', occurredAtMs: T }),
      intake({ id: 'third', occurredAtMs: T }),
    ]);
    expect(merged.map((e) => e.id)).toEqual(['first', 'second', 'third']);
  });

  it('falls back to default cap for pathological caps (0 / negative / NaN) — never wipes the ledger', () => {
    const events = [intake({ id: 'a', occurredAtMs: T }), intake({ id: 'b', occurredAtMs: T + 1 })];
    expect(mergeCommandEvents([], events, { cap: 0 }).map((e) => e.id)).toEqual(['a', 'b']);
    expect(mergeCommandEvents([], events, { cap: -5 }).map((e) => e.id)).toEqual(['a', 'b']);
    expect(mergeCommandEvents([], events, { cap: NaN }).map((e) => e.id)).toEqual(['a', 'b']);
    expect(mergeCommandEvents([], events, { cap: 1.5 }).map((e) => e.id)).toEqual(['a', 'b']);
  });
});

describe('queries', () => {
  const events = mergeCommandEvents([], [
    intake({ id: 'd0', occurredAtMs: T, localDayIndex: 0 }),
    voice({ id: 'd1', occurredAtMs: T + 1000, localDayIndex: 1 }),
    intake({ id: 'd1b', occurredAtMs: T + 2000, localDayIndex: 1 }),
  ]) as CommandEvent[];

  it('eventsInWindow respects inclusive bounds and rejects inverted/NaN ranges', () => {
    expect(eventsInWindow(events, T, T + 1000).map((e) => e.id)).toEqual(['d0', 'd1']);
    expect(eventsInWindow(events, T + 1000, T).length).toBe(0);
    expect(eventsInWindow(events, NaN, T).length).toBe(0);
  });

  it('eventsOnDay filters by localDayIndex', () => {
    expect(eventsOnDay(events, 1).map((e) => e.id)).toEqual(['d1', 'd1b']);
    expect(eventsOnDay(events, 9).length).toBe(0);
    expect(eventsOnDay(events, 1.5).length).toBe(0);
  });

  it('eventsByKind narrows to a kind', () => {
    expect(eventsByKind(events, 'intake').map((e) => e.id)).toEqual(['d0', 'd1b']);
    expect(eventsByKind(events, 'voice_checkin').map((e) => e.id)).toEqual(['d1']);
  });

  it('latestByKind returns the most recent of a kind, or null', () => {
    expect(latestByKind(events, 'intake')?.id).toBe('d1b');
    expect(latestByKind(events, 'voice_checkin')?.id).toBe('d1');
    expect(latestByKind(events, 'command_confirmation')).toBeNull();
  });
});
