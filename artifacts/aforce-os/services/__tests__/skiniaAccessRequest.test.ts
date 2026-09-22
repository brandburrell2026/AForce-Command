import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchSkinIACohortAccess } from '../skiniaAccessRequest';

const url = 'https://aforce.example/api/skinia/access';

afterEach(() => {
  vi.useRealTimers();
});

describe('SkinIA access request', () => {
  it('opens only for the exact authenticated cohort grant', async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ authorized: true, reason: 'CONTROLLED_TESTFLIGHT_COHORT' }), { status: 200 }));
    const result = await fetchSkinIACohortAccess(async () => 'token', url, fetchImpl as typeof fetch);
    expect(result).toEqual({ status: 'GRANTED', reason: 'CONTROLLED_TESTFLIGHT_COHORT' });
    expect(fetchImpl).toHaveBeenCalledWith(url, expect.objectContaining({ headers: { Authorization: 'Bearer token' } }));
  });

  it('fails closed if token retrieval never resolves and does not fetch later', async () => {
    vi.useFakeTimers();
    let resolveToken: ((token: string) => void) | undefined;
    const token = new Promise<string>((resolve) => { resolveToken = resolve; });
    const fetchImpl = vi.fn();
    const pending = fetchSkinIACohortAccess(() => token, url, fetchImpl as typeof fetch, 100);
    await vi.advanceTimersByTimeAsync(100);
    expect(await pending).toEqual({ status: 'DENIED', reason: 'ACCESS_TIMED_OUT' });
    resolveToken?.('late-token');
    await Promise.resolve();
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('aborts a stalled fetch and never turns its late response into a grant', async () => {
    vi.useFakeTimers();
    let signal: AbortSignal | undefined;
    const fetchImpl = vi.fn((_url: string, init?: RequestInit) => {
      signal = init?.signal ?? undefined;
      return new Promise<Response>(() => {});
    });
    const pending = fetchSkinIACohortAccess(async () => 'token', url, fetchImpl as typeof fetch, 100);
    await vi.advanceTimersByTimeAsync(100);
    expect(await pending).toEqual({ status: 'DENIED', reason: 'ACCESS_TIMED_OUT' });
    expect(signal?.aborted).toBe(true);
  });

  it('fails closed on missing token or an unapproved response', async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ authorized: true, reason: 'UNAPPROVED' }), { status: 200 }));
    expect(await fetchSkinIACohortAccess(async () => null, url, fetchImpl as typeof fetch)).toEqual({ status: 'DENIED', reason: 'UNAUTHENTICATED' });
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(await fetchSkinIACohortAccess(async () => 'token', url, fetchImpl as typeof fetch)).toEqual({ status: 'DENIED', reason: 'UNAPPROVED' });
  });
});
