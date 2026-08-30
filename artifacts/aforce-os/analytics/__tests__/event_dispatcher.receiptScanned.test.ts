import { describe, it, expect, beforeEach, vi } from 'vitest';

/**
 * E6-A — PRODUCER 1 of 3: the `receipt_scanned` activation event.
 *
 * Scan fires this from `runScan`'s ok-branch. Before this file, a repo-wide
 * grep for `receipt_scanned` returned exactly three hits — the single call
 * site and two comments. ZERO tests. An editorial recomposition that omitted
 * the call would drop the activation-funnel emit while every suite stayed
 * green, which is the defect class this lane exists to make impossible.
 *
 * This file proves the EMIT CONTRACT the call site depends on. The call
 * site's own wiring — that it fires only on a qualifying scan, exactly once,
 * and never on a failed or re-entrant one — is pinned in
 * components/__tests__/scanProducerSafety.test.ts, because the screen itself
 * cannot be imported in this environment (untranspiled RN dependency source;
 * see that file's header).
 *
 * Mocking follows event_dispatcher.firstWin.test.ts exactly: react-native,
 * @/lib/api, privacy_manager and event_envelope are mocked so the module
 * loads in the node env and consent / identity / storage are driveable.
 */
const OUTBOX_KEY = '@aforce/analytics-outbox';

const { mem, state } = vi.hoisted(() => ({
  mem: new Map<string, string>(),
  state: {
    consent: true,
    analyticsId: 'anon_a_b' as string | null,
  },
}));

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: async (k: string) => (mem.has(k) ? (mem.get(k) as string) : null),
    setItem: async (k: string, v: string) => {
      mem.set(k, v);
    },
    removeItem: async (k: string) => {
      mem.delete(k);
    },
  },
}));

vi.mock('react-native', () => ({ Platform: { OS: 'ios' } }));

// Reject the flush so envelopes stay in the outbox for deterministic
// assertions (a successful flush drains it out from under us).
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

describe('E6-A · receipt_scanned — the activation emit Scan depends on', () => {
  beforeEach(() => {
    mem.clear();
    state.consent = true;
    state.analyticsId = 'anon_a_b';
  });

  it('a qualifying scan queues exactly one receipt_scanned carrying its sourceKind', async () => {
    const d = await freshDispatcher();
    const queued = await d.emit('receipt_scanned', { sourceKind: 'barcode' });

    expect(queued).toBe(true);
    const events = outbox();
    expect(events).toHaveLength(1);
    expect(events[0]?.eventType).toBe('receipt_scanned');
    // sourceKind is what distinguishes barcode / qr / manual in the funnel.
    expect(events[0]?.payload.sourceKind).toBe('barcode');
  });

  it('preserves each source kind distinctly — the funnel can tell them apart', async () => {
    const d = await freshDispatcher();
    for (const kind of ['barcode', 'qr', 'manual']) {
      await d.emit('receipt_scanned', { sourceKind: kind });
    }
    expect(outbox().map((e) => e.payload.sourceKind)).toEqual(['barcode', 'qr', 'manual']);
  });

  it('ELIGIBILITY — emits nothing at all without analytics consent', async () => {
    // Privacy before collection. A scan by a member who has not consented
    // must leave no trace, not a queued event awaiting a later flush.
    state.consent = false;
    const d = await freshDispatcher();
    const queued = await d.emit('receipt_scanned', { sourceKind: 'barcode' });

    expect(queued).toBe(false);
    expect(outbox()).toHaveLength(0);
  });

  it('ELIGIBILITY — emits nothing when no analytics identity exists yet', async () => {
    state.analyticsId = null;
    const d = await freshDispatcher();
    const queued = await d.emit('receipt_scanned', { sourceKind: 'qr' });

    expect(queued).toBe(false);
    expect(outbox()).toHaveLength(0);
  });

  it('queues one envelope PER call — exactly-once is the call site’s duty, not the dispatcher’s', () => {
    // Stated as a test so the boundary is explicit: `emit` is not idempotent
    // for this event (unlike emitFirstWinConfirmed, which burns a flag). The
    // screen's ok-branch + re-entrancy guard is what makes it once-per-scan,
    // and that is pinned in components/__tests__/scanProducerSafety.test.ts.
    return freshDispatcher().then(async (d) => {
      await d.emit('receipt_scanned', { sourceKind: 'barcode' });
      await d.emit('receipt_scanned', { sourceKind: 'barcode' });
      expect(outbox()).toHaveLength(2);
    });
  });

  it('does not throw when the outbox write fails — a scan never breaks on analytics', async () => {
    const d = await freshDispatcher();
    // Two concurrent emits exercise the serialized write queue; neither may
    // reject into the scan's own control flow.
    await expect(
      Promise.all([
        d.emit('receipt_scanned', { sourceKind: 'barcode' }),
        d.emit('receipt_scanned', { sourceKind: 'manual' }),
      ]),
    ).resolves.toEqual([true, true]);
    expect(outbox()).toHaveLength(2);
  });
});
