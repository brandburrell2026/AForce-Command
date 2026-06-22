import { describe, it, expect, beforeEach, vi } from 'vitest';

/**
 * Durability + dedup contract for the Territory engagement emitters.
 *
 * `emitTerritoryOpened` is the once-per-day "reach" signal: it must (a) emit
 * exactly one `territory_opened` per calendar day, (b) NOT burn its day key
 * when the event could not be durably queued (so the next mount retries and
 * the day's reach is never silently dropped), and (c) collapse same-tick
 * concurrent calls (StrictMode double-mount) into a single emit.
 *
 * `emitTerritoryEngaged` is per-action depth telemetry: one event per real
 * action, carrying the action in its payload, with no day gating.
 *
 * react-native / @/lib/api / privacy_manager / event_envelope are mocked so
 * the module loads in the node test env and consent/identity/storage are
 * driveable. Mirrors event_dispatcher.firstWin.test.ts.
 */
const TERRITORY_DAY_KEY = '@aforce/analytics-territory-day';
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

describe('emitTerritoryOpened · once-per-day reach', () => {
  beforeEach(() => {
    mem.clear();
    state.consent = true;
    state.analyticsId = 'anon_a_b';
    state.throwOnSet.clear();
  });

  it('emits one territory_opened and burns the day key on the first open', async () => {
    const d = await freshDispatcher();
    await d.emitTerritoryOpened();

    const events = outbox();
    expect(events).toHaveLength(1);
    expect(events[0]?.eventType).toBe('territory_opened');
    expect(mem.get(TERRITORY_DAY_KEY)).toBe(today());

    // A second open the same day must short-circuit on the day key.
    await d.emitTerritoryOpened();
    expect(outbox()).toHaveLength(1);
  });

  it('re-emits the next day once the day key rolls over', async () => {
    const d = await freshDispatcher();
    await d.emitTerritoryOpened();
    expect(outbox()).toHaveLength(1);

    // Simulate a stale key from a previous day.
    mem.set(TERRITORY_DAY_KEY, '2000-01-01');
    await d.emitTerritoryOpened();
    expect(outbox()).toHaveLength(2);
    expect(mem.get(TERRITORY_DAY_KEY)).toBe(today());
  });

  it('does NOT burn the day key when analyticsId is missing, then retries', async () => {
    state.analyticsId = null;
    const d = await freshDispatcher();
    await d.emitTerritoryOpened();

    expect(outbox()).toHaveLength(0);
    expect(mem.get(TERRITORY_DAY_KEY)).toBeUndefined();

    // Identity now available — the next open records + burns the key.
    state.analyticsId = 'anon_a_b';
    await d.emitTerritoryOpened();
    expect(outbox()).toHaveLength(1);
    expect(mem.get(TERRITORY_DAY_KEY)).toBe(today());
  });

  it('does NOT burn the day key when the outbox write fails, then retries', async () => {
    state.throwOnSet.add(OUTBOX_KEY);
    const d = await freshDispatcher();
    await d.emitTerritoryOpened();

    expect(outbox()).toHaveLength(0);
    expect(mem.get(TERRITORY_DAY_KEY)).toBeUndefined();

    // Storage recovers — the next open records and burns the key.
    state.throwOnSet.clear();
    await d.emitTerritoryOpened();
    expect(outbox()).toHaveLength(1);
    expect(mem.get(TERRITORY_DAY_KEY)).toBe(today());
  });

  it('collapses same-tick concurrent opens into a single emit', async () => {
    const d = await freshDispatcher();
    await Promise.all([d.emitTerritoryOpened(), d.emitTerritoryOpened()]);
    expect(outbox()).toHaveLength(1);
    expect(mem.get(TERRITORY_DAY_KEY)).toBe(today());
  });

  it('is a no-op without consent and leaves the day key unset', async () => {
    state.consent = false;
    const d = await freshDispatcher();
    await d.emitTerritoryOpened();
    expect(outbox()).toHaveLength(0);
    expect(mem.get(TERRITORY_DAY_KEY)).toBeUndefined();
  });
});

describe('emitTerritoryEngaged · per-action depth', () => {
  beforeEach(() => {
    mem.clear();
    state.consent = true;
    state.analyticsId = 'anon_a_b';
    state.throwOnSet.clear();
  });

  it('emits one territory_engaged per action carrying the action payload', async () => {
    const d = await freshDispatcher();
    await d.emitTerritoryEngaged('region_selected');
    await d.emitTerritoryEngaged('battle_supported');

    const events = outbox();
    expect(events).toHaveLength(2);
    expect(events.every((e) => e.eventType === 'territory_engaged')).toBe(true);
    expect(events.map((e) => e.payload.action)).toEqual([
      'region_selected',
      'battle_supported',
    ]);
  });

  it('is a no-op without consent', async () => {
    state.consent = false;
    const d = await freshDispatcher();
    await d.emitTerritoryEngaged('region_selected');
    expect(outbox()).toHaveLength(0);
  });
});
