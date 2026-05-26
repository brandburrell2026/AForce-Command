import { describe, it, expect, vi } from 'vitest';
import {
  createInMemoryWhoopTokenStore,
  createWhoopTokenManager,
  fetchManagedWhoopSnapshot,
  WHOOP_TOKEN_ENDPOINT,
  type WhoopTokens,
  type WhoopTokenResponse,
} from '../whoopAuth';

const CONFIG = { clientId: 'cid', clientSecret: 'csecret' };

type FetchFn = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

function mockTokenFetch(response: WhoopTokenResponse, status = 200) {
  return vi.fn<FetchFn>(
    async () =>
      new Response(JSON.stringify(response), {
        status,
        headers: { 'Content-Type': 'application/json' },
      }),
  );
}

describe('WHOOP OAuth token manager', () => {
  it('returns null when no tokens are stored', async () => {
    const m = createWhoopTokenManager({
      store: createInMemoryWhoopTokenStore(null),
      config: CONFIG,
      fetchImpl: vi.fn(),
    });
    expect(await m.getValidAccessToken()).toBeNull();
  });

  it('returns the cached access token when not near expiry', async () => {
    const seed: WhoopTokens = {
      accessToken: 'AAA',
      refreshToken: 'RRR',
      expiresAt: 10_000_000,
    };
    const fetchImpl = vi.fn();
    const m = createWhoopTokenManager({
      store: createInMemoryWhoopTokenStore(seed),
      config: CONFIG,
      fetchImpl,
      nowMs: () => 1_000_000,
    });
    expect(await m.getValidAccessToken()).toBe('AAA');
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('refreshes when the cached token is within the skew window', async () => {
    const seed: WhoopTokens = {
      accessToken: 'OLD',
      refreshToken: 'REFRESH-1',
      expiresAt: 1_000_000 + 10_000, // only 10s left, default skew=60s
    };
    const store = createInMemoryWhoopTokenStore(seed);
    const fetchImpl = mockTokenFetch({
      access_token: 'NEW',
      refresh_token: 'REFRESH-2',
      expires_in: 3600,
    });
    const m = createWhoopTokenManager({
      store,
      config: CONFIG,
      fetchImpl,
      nowMs: () => 1_000_000,
    });

    const token = await m.getValidAccessToken();
    expect(token).toBe('NEW');

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const firstCall = fetchImpl.mock.calls[0]!;
    expect(firstCall[0]).toBe(WHOOP_TOKEN_ENDPOINT);
    const init = firstCall[1]!;
    expect(init.method).toBe('POST');
    const body = String(init.body);
    expect(body).toContain('grant_type=refresh_token');
    expect(body).toContain('refresh_token=REFRESH-1');
    expect(body).toContain('client_id=cid');

    const persisted = await store.read();
    expect(persisted?.accessToken).toBe('NEW');
    expect(persisted?.refreshToken).toBe('REFRESH-2');
    expect(persisted?.expiresAt).toBe(1_000_000 + 3600 * 1000);
  });

  it('preserves prior refresh token when WHOOP omits it from the response', async () => {
    const seed: WhoopTokens = {
      accessToken: 'OLD',
      refreshToken: 'KEEP-ME',
      expiresAt: 1_000,
    };
    const store = createInMemoryWhoopTokenStore(seed);
    const fetchImpl = mockTokenFetch({
      access_token: 'NEW',
      refresh_token: undefined as unknown as string,
      expires_in: 100,
    });
    const m = createWhoopTokenManager({
      store,
      config: CONFIG,
      fetchImpl,
      nowMs: () => 0,
    });
    await m.getValidAccessToken();
    const persisted = await store.read();
    expect(persisted?.refreshToken).toBe('KEEP-ME');
  });

  it('returns null and does NOT throw when the refresh endpoint errors', async () => {
    const seed: WhoopTokens = {
      accessToken: 'OLD',
      refreshToken: 'R',
      expiresAt: 0,
    };
    const fetchImpl = vi.fn(async () => new Response('boom', { status: 500 }));
    const m = createWhoopTokenManager({
      store: createInMemoryWhoopTokenStore(seed),
      config: CONFIG,
      fetchImpl,
      nowMs: () => 1_000_000,
    });
    expect(await m.getValidAccessToken()).toBeNull();
  });

  it('refresh() throws explicitly when no refresh token is stored', async () => {
    const m = createWhoopTokenManager({
      store: createInMemoryWhoopTokenStore(null),
      config: CONFIG,
      fetchImpl: vi.fn(),
    });
    await expect(m.refresh()).rejects.toThrow(/no refresh token/i);
  });

  it('setTokens persists and signOut clears', async () => {
    const store = createInMemoryWhoopTokenStore(null);
    const m = createWhoopTokenManager({ store, config: CONFIG, fetchImpl: vi.fn() });
    await m.setTokens({ accessToken: 'A', refreshToken: 'R', expiresAt: 999 });
    expect(await m.peek()).toEqual({ accessToken: 'A', refreshToken: 'R', expiresAt: 999 });
    await m.signOut();
    expect(await m.peek()).toBeNull();
  });
});

describe('fetchManagedWhoopSnapshot', () => {
  it('returns null when there is no stored token (no API call)', async () => {
    const apiFetch = vi.fn();
    const m = createWhoopTokenManager({
      store: createInMemoryWhoopTokenStore(null),
      config: CONFIG,
      fetchImpl: vi.fn(),
    });
    const snap = await fetchManagedWhoopSnapshot(m, 12345, apiFetch);
    expect(snap).toBeNull();
    expect(apiFetch).not.toHaveBeenCalled();
  });

  it('forwards the managed access token to the WHOOP REST API', async () => {
    const seed: WhoopTokens = {
      accessToken: 'GOOD',
      refreshToken: 'R',
      expiresAt: 10_000_000,
    };
    const apiFetch = vi.fn<FetchFn>(
      async () => new Response(JSON.stringify({ records: [] }), { status: 200 }),
    );
    const m = createWhoopTokenManager({
      store: createInMemoryWhoopTokenStore(seed),
      config: CONFIG,
      fetchImpl: vi.fn(),
      nowMs: () => 1_000_000,
    });
    const snap = await fetchManagedWhoopSnapshot(m, 42, apiFetch as unknown as typeof fetch);
    expect(snap).not.toBeNull();
    expect(snap?.providerId).toBe('whoop');
    expect(snap?.fetchedAt).toBe(42);
    expect(apiFetch).toHaveBeenCalledTimes(3);
    for (const call of apiFetch.mock.calls) {
      const headers = (call[1]?.headers ?? {}) as Record<string, string>;
      expect(headers.Authorization).toBe('Bearer GOOD');
    }
  });
});
