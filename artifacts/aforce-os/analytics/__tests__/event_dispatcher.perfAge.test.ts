import { describe, it, expect, beforeEach, vi } from 'vitest';

/**
 * Durability + dedup contract for the Performance Age™ snapshot emitter.
 *
 * `emitPerformanceAgeSnapshot` is the once-per-UTC-day founder trend signal. It
 * must (a) emit exactly one `performance_age_snapshot` per day carrying ONLY the
 * privacy-safe delta + status (never an absolute age), (b) NOT burn its day key
 * when the event could not be durably queued (so the next mount retries and the
 * day is never silently dropped), (c) collapse same-tick concurrent calls
 * (two surfaces reading usePerformanceAge) into a single emit, and (d) reject a
 * non-finite delta outright.
 *
 * react-native / @/lib/api / privacy_manager / event_envelope are mocked so the
 * module loads in the node test env and consent/identity/storage are driveable.
 * Mirrors event_dispatcher.territory.test.ts.
 */
const PERF_AGE_DAY_KEY = '@aforce/analytics-perf-age-day';
const OUTBOX_KEY = '@aforce/analytics-outbox';

const { mem, state } = vi.hoisted(() => ({
  mem: new Map<string, string>(),
  state: {
    consent: true,
    analyticsId: 'anon_a_b' as string | null,
    throwOnSet: new Set<string>(),
  },
}));

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: async (k: string) => (mem.has(k) ? (mem.get(k) as string) : null),
    setItem: async (k: string, v: string) => {
      if (state.throwOnSet.has(k)) throw new Error('storage fail');
      mem.set(k, v);
    },
    removeItem: async (k: string) => {
      mem.delete(k);
    },
  },
}));

vi.mock('react-native', () => ({ Platform: { OS: 'ios' } }));

// Reject the flush so events stay in the outbox for deterministic assertions.
vi.mock('@/lib/api', () => ({
  postAnalyticsBatch: async () => {
    throw new Error('offline');
  },
}));

vi.mock('../privacy_manager', () => ({
  isConsentGranted: async () => state.consent,
  getAnalyticsId: async () => state.analyticsId,
}));

vi.mock('../event_envelope', () => ({
  createEnvelope: (
    eventType: string,
    analyticsId: string,
    payload?: Record<string, unknown>,
  ) => ({
    eventId: 'evt_' + Math.random().toString(36).slice(2),
    eventType,
    analytics_id: analyticsId,
    occurredAt: new Date().toISOString(),
    schemaVersion: 1,
    payload: payload ?? {},
  }),
}));

function outbox(): Array<{ eventType: string; payload: Record<string, unknown> }> {
  const raw = mem.get(OUTBOX_KEY);
  return raw ? (JSON.parse(raw) as never[]) : [];
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

async function freshDispatcher() {
  vi.resetModules();
  return import('../event_dispatcher');
}

describe('emitPerformanceAgeSnapshot · once-per-day trend signal', () => {
  beforeEach(() => {
    mem.clear();
    state.consent = true;
    state.analyticsId = 'anon_a_b';
    state.throwOnSet.clear();
  });

  it('emits one snapshot with ONLY delta + status and burns the day key', async () => {
    const d = await freshDispatcher();
    await d.emitPerformanceAgeSnapshot(-3, 'established');

    const events = outbox();
    expect(events).toHaveLength(1);
    expect(events[0]?.eventType).toBe('performance_age_snapshot');
    expect(events[0]?.payload).toEqual({ deltaYears: -3, status: 'established' });
    // Privacy: never carry an absolute age.
    expect(events[0]?.payload).not.toHaveProperty('age');
    expect(events[0]?.payload).not.toHaveProperty('performanceAge');
    expect(events[0]?.payload).not.toHaveProperty('actualAge');
    expect(mem.get(PERF_AGE_DAY_KEY)).toBe(today());

    // A second snapshot the same day must short-circuit on the day key.
    await d.emitPerformanceAgeSnapshot(2, 'provisional');
    expect(outbox()).toHaveLength(1);
  });

  it('emits a zero (on-par) delta — it is a real finite value', async () => {
    const d = await freshDispatcher();
    await d.emitPerformanceAgeSnapshot(0, 'established');
    const events = outbox();
    expect(events).toHaveLength(1);
    expect(events[0]?.payload).toEqual({ deltaYears: 0, status: 'established' });
  });

  it('rejects a non-finite delta outright', async () => {
    const d = await freshDispatcher();
    await d.emitPerformanceAgeSnapshot(Number.NaN, 'established');
    expect(outbox()).toHaveLength(0);
    expect(mem.get(PERF_AGE_DAY_KEY)).toBeUndefined();
  });

  it('re-emits the next day once the day key rolls over', async () => {
    const d = await freshDispatcher();
    await d.emitPerformanceAgeSnapshot(-1, 'provisional');
    expect(outbox()).toHaveLength(1);

    // Simulate a stale key from a previous day.
    mem.set(PERF_AGE_DAY_KEY, '2000-01-01');
    await d.emitPerformanceAgeSnapshot(-2, 'established');
    expect(outbox()).toHaveLength(2);
    expect(mem.get(PERF_AGE_DAY_KEY)).toBe(today());
  });

  it('does NOT burn the day key when analyticsId is missing, then retries', async () => {
    state.analyticsId = null;
    const d = await freshDispatcher();
    await d.emitPerformanceAgeSnapshot(-3, 'established');

    expect(outbox()).toHaveLength(0);
    expect(mem.get(PERF_AGE_DAY_KEY)).toBeUndefined();

    // Identity now available — the next snapshot records + burns the key.
    state.analyticsId = 'anon_a_b';
    await d.emitPerformanceAgeSnapshot(-3, 'established');
    expect(outbox()).toHaveLength(1);
    expect(mem.get(PERF_AGE_DAY_KEY)).toBe(today());
  });

  it('does NOT burn the day key when the outbox write fails, then retries', async () => {
    state.throwOnSet.add(OUTBOX_KEY);
    const d = await freshDispatcher();
    await d.emitPerformanceAgeSnapshot(-3, 'established');

    expect(outbox()).toHaveLength(0);
    expect(mem.get(PERF_AGE_DAY_KEY)).toBeUndefined();

    // Storage recovers — the next snapshot records and burns the key.
    state.throwOnSet.clear();
    await d.emitPerformanceAgeSnapshot(-3, 'established');
    expect(outbox()).toHaveLength(1);
    expect(mem.get(PERF_AGE_DAY_KEY)).toBe(today());
  });

  it('collapses same-tick concurrent snapshots into a single emit', async () => {
    const d = await freshDispatcher();
    await Promise.all([
      d.emitPerformanceAgeSnapshot(-3, 'established'),
      d.emitPerformanceAgeSnapshot(-3, 'established'),
    ]);
    expect(outbox()).toHaveLength(1);
    expect(mem.get(PERF_AGE_DAY_KEY)).toBe(today());
  });

  it('is a no-op without consent and leaves the day key unset', async () => {
    state.consent = false;
    const d = await freshDispatcher();
    await d.emitPerformanceAgeSnapshot(-3, 'established');
    expect(outbox()).toHaveLength(0);
    expect(mem.get(PERF_AGE_DAY_KEY)).toBeUndefined();
  });
});
