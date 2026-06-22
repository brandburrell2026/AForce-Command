import { describe, it, expect, beforeEach, vi } from 'vitest';

/**
 * Idempotency contract for `emitFirstWinConfirmed` — the activation funnel's
 * once-EVER "First Win" milestone. The recorder fires it on every win, so the
 * dispatcher must (a) emit exactly once, (b) NOT burn its persistent flag when
 * the event could not be durably queued (so a later win retries), and
 * (c) collapse same-tick concurrent calls into a single emit.
 *
 * react-native / @/lib/api / privacy_manager / event_envelope are mocked so the
 * module loads in the node test env and consent/identity/storage are driveable.
 */
const FIRST_WIN_KEY = '@aforce/analytics-first-win';
const OUTBOX_KEY = '@aforce/analytics-outbox';

const { mem, state } = vi.hoisted(() => ({
  mem: new Map<string, string>(),
  state: {
    consent: true,
    analyticsId: 'anon_a_b' as string | null,
    // keys whose setItem should throw, to simulate a storage failure.
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

// Reject the flush so events stay in the outbox for deterministic assertions
// (a successful flush would async-drain the outbox out from under us).
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

async function freshDispatcher() {
  vi.resetModules();
  return import('../event_dispatcher');
}

describe('emitFirstWinConfirmed · once-ever idempotency', () => {
  beforeEach(() => {
    mem.clear();
    state.consent = true;
    state.analyticsId = 'anon_a_b';
    state.throwOnSet.clear();
  });

  it('emits exactly one first_win_confirmed and burns the flag on the first win', async () => {
    const d = await freshDispatcher();
    await d.emitFirstWinConfirmed('water_cycle');

    const events = outbox();
    expect(events).toHaveLength(1);
    expect(events[0]?.eventType).toBe('first_win_confirmed');
    expect(events[0]?.payload.winId).toBe('water_cycle');
    expect(mem.get(FIRST_WIN_KEY)).toBe('1');

    // A second win must short-circuit on the persistent flag — no new event.
    await d.emitFirstWinConfirmed('hydration_goal');
    expect(outbox()).toHaveLength(1);
  });

  it('does NOT burn the flag when analyticsId is missing, then retries on a later win', async () => {
    state.analyticsId = null;
    const d = await freshDispatcher();
    await d.emitFirstWinConfirmed('water_cycle');

    expect(outbox()).toHaveLength(0);
    expect(mem.get(FIRST_WIN_KEY)).toBeUndefined();

    // identity now available — the next win must successfully record + burn.
    state.analyticsId = 'anon_a_b';
    await d.emitFirstWinConfirmed('water_cycle');
    expect(outbox()).toHaveLength(1);
    expect(mem.get(FIRST_WIN_KEY)).toBe('1');
  });

  it('does NOT burn the flag when the outbox write fails', async () => {
    state.throwOnSet.add(OUTBOX_KEY);
    const d = await freshDispatcher();
    await d.emitFirstWinConfirmed('water_cycle');

    expect(outbox()).toHaveLength(0);
    expect(mem.get(FIRST_WIN_KEY)).toBeUndefined();

    // storage recovers — the next win records and burns the flag.
    state.throwOnSet.clear();
    await d.emitFirstWinConfirmed('water_cycle');
    expect(outbox()).toHaveLength(1);
    expect(mem.get(FIRST_WIN_KEY)).toBe('1');
  });

  it('collapses same-tick concurrent calls into a single emit', async () => {
    const d = await freshDispatcher();
    await Promise.all([
      d.emitFirstWinConfirmed('a'),
      d.emitFirstWinConfirmed('b'),
    ]);
    expect(outbox()).toHaveLength(1);
    expect(mem.get(FIRST_WIN_KEY)).toBe('1');
  });

  it('is a no-op without consent and leaves the flag unset', async () => {
    state.consent = false;
    const d = await freshDispatcher();
    await d.emitFirstWinConfirmed('water_cycle');
    expect(outbox()).toHaveLength(0);
    expect(mem.get(FIRST_WIN_KEY)).toBeUndefined();
  });
});
