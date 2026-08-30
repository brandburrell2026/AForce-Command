import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

/**
 * E6-A — PRODUCER 2 of 3: the CLIENT half of the scan write.
 *
 * The server suites (scanRepo, scansRoute) test the endpoint in isolation and
 * stay green whether or not the client ever posts. Before this file, a
 * repo-wide grep for `usePostScan` / `postScanMut` returned ZERO test files —
 * so an editorial recomposition that dropped `postScanMut.mutate(...)` would
 * silently stop server scan persistence, and silently empty the recent-scans
 * band that reads it back, with every server test still passing.
 *
 * This file tests the CLIENT SEAM: the request `postScan` actually issues,
 * the payload shape it sends, the identity headers it attaches, and — the
 * part most likely to rot — that a failure stays a failure.
 *
 * `fetch` is stubbed; AsyncStorage, apiBase and authToken are mocked so the
 * module loads in the node env and identity is driveable. The screen's own
 * wiring (one call site, ok-branch only, re-entrancy guarded) is pinned in
 * components/__tests__/scanProducerSafety.test.ts.
 */

const { mem, state } = vi.hoisted(() => ({
  mem: new Map<string, string>(),
  state: {
    consent: true,
    analyticsId: 'anon_a_b' as string | null,
    auth: {} as Record<string, string>,
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
vi.mock('../apiBase', () => ({ API_BASE: 'https://api.test' }));
vi.mock('@/services/authToken', () => ({ getAuthHeaders: async () => state.auth }));
vi.mock('../../services/authToken', () => ({ getAuthHeaders: async () => state.auth }));
vi.mock('@/analytics/privacy_manager', () => ({
  isConsentGranted: async () => state.consent,
  getAnalyticsId: async () => state.analyticsId,
}));
vi.mock('../../analytics/privacy_manager', () => ({
  isConsentGranted: async () => state.consent,
  getAnalyticsId: async () => state.analyticsId,
}));

/** The exact payload HydrationScanScreenV2 builds in runScan's ok-branch. */
const CANONICAL_SCAN = {
  loggedAt: '2026-08-30T09:00:00.000Z',
  source: 'barcode' as const,
  rawValue: '850000000019',
  productId: 'af_berry_blast',
  productName: 'AForce Berry Blast',
  brand: 'AForce',
  isAForce: true,
  verdict: 'optimal',
  fitScore: 100,
  scoreBefore: 68,
  scoreAfter: 68,
  performanceState: 'RECOVERING',
  recommendedProductId: null,
};

let calls: Array<{ url: string; init: RequestInit }> = [];

function stubFetch(res: { ok: boolean; status?: number; body?: unknown; text?: string }) {
  const fn = vi.fn(async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    return {
      ok: res.ok,
      status: res.status ?? (res.ok ? 200 : 500),
      statusText: res.ok ? 'OK' : 'Server Error',
      json: async () => res.body,
      text: async () => res.text ?? '',
    } as unknown as Response;
  });
  vi.stubGlobal('fetch', fn);
  return fn;
}

async function freshApi() {
  vi.resetModules();
  return import('../api');
}

function lastBody(): Record<string, unknown> {
  const raw = calls[calls.length - 1]?.init.body;
  return JSON.parse(String(raw)) as Record<string, unknown>;
}
function lastHeaders(): Record<string, string> {
  return (calls[calls.length - 1]?.init.headers ?? {}) as Record<string, string>;
}

describe('E6-A · postScan — the client write seam', () => {
  beforeEach(() => {
    mem.clear();
    calls = [];
    state.consent = true;
    state.analyticsId = 'anon_a_b';
    state.auth = {};
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('a successful eligible scan reaches the server as a POST to /scans', async () => {
    stubFetch({ ok: true, body: { scan: { id: 'srv_1', ...CANONICAL_SCAN } } });
    const api = await freshApi();

    const out = await api.postScan(CANONICAL_SCAN);

    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toBe('https://api.test/scans');
    expect(calls[0]?.init.method).toBe('POST');
    // The write is only useful if the caller gets the persisted row back —
    // the recent-scans band reads this shape.
    expect(out.id).toBe('srv_1');
  });

  it('sends the CANONICAL payload — every field the screen composes, unaltered', async () => {
    stubFetch({ ok: true, body: { scan: { id: 'srv_1', ...CANONICAL_SCAN } } });
    const api = await freshApi();
    await api.postScan(CANONICAL_SCAN);

    const body = lastBody();
    // Named individually rather than deep-equalled so a DROPPED field fails
    // with the field's own name, and an added field does not fail the suite.
    for (const [key, value] of Object.entries(CANONICAL_SCAN)) {
      expect(body[key], `payload.${key}`).toEqual(value);
    }
    // The three that carry the most meaning downstream, restated explicitly:
    // isAForce drives the server-owned receipt_activated event, and the score
    // pair is what makes the row a before/after record rather than a snapshot.
    expect(body.isAForce).toBe(true);
    expect(body.scoreBefore).toBe(68);
    expect(body.scoreAfter).toBe(68);
  });

  it('identity travels in HEADERS, outside the UI’s control', async () => {
    state.auth = { authorization: 'Bearer tok_abc' };
    stubFetch({ ok: true, body: { scan: { id: 'srv_1', ...CANONICAL_SCAN } } });
    const api = await freshApi();
    await api.postScan(CANONICAL_SCAN);

    const h = lastHeaders();
    // Device identity and auth are attached by the client seam, never passed
    // in the payload — no screen can spoof or omit them by recomposing.
    expect(h['x-device-id']).toBeTruthy();
    expect(h['authorization']).toBe('Bearer tok_abc');
    expect(h['content-type']).toBe('application/json');
    expect(Object.keys(lastBody())).not.toContain('userId');
    expect(Object.keys(lastBody())).not.toContain('deviceId');
  });

  it('attaches the analytics id ONLY with consent — user isolation is not a UI decision', async () => {
    stubFetch({ ok: true, body: { scan: { id: 'srv_1', ...CANONICAL_SCAN } } });
    const api = await freshApi();
    await api.postScan(CANONICAL_SCAN);
    expect(lastHeaders()['x-aforce-analytics-id']).toBe('anon_a_b');

    // Same call, consent withdrawn: the header must disappear entirely.
    state.consent = false;
    calls = [];
    const api2 = await freshApi();
    await api2.postScan(CANONICAL_SCAN);
    expect(lastHeaders()['x-aforce-analytics-id']).toBeUndefined();
  });

  it('a FAILURE stays a failure — it is never converted into a fake success', async () => {
    // The single most valuable assertion here. The screen treats this write as
    // best-effort and does not await it; if the client ever swallowed a 500
    // and resolved, the member would see a persisted scan that does not exist.
    stubFetch({ ok: false, status: 500, text: 'boom' });
    const api = await freshApi();

    await expect(api.postScan(CANONICAL_SCAN)).rejects.toThrow();
  });

  it('a network rejection propagates rather than resolving empty', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('offline');
      }),
    );
    const api = await freshApi();

    await expect(api.postScan(CANONICAL_SCAN)).rejects.toThrow(/offline/);
  });

  it('issues exactly ONE request per call — the seam adds no retry of its own', async () => {
    // Duplicate-write protection is layered: the seam must not retry, and the
    // screen must not call twice. This pins the seam half; the screen half is
    // the re-entrancy guard pinned in scanProducerSafety.test.ts.
    stubFetch({ ok: true, body: { scan: { id: 'srv_1', ...CANONICAL_SCAN } } });
    const api = await freshApi();
    await api.postScan(CANONICAL_SCAN);

    expect(calls).toHaveLength(1);
  });
});
