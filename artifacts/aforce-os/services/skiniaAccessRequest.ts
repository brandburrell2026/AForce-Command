import type { SkinIACohortAccess } from './skiniaCohortGate';

// A stalled token refresh or network request must never leave the controlled
// route on its camera-free checking screen indefinitely.
export const SKINIA_ACCESS_TIMEOUT_MS = 10_000;

export async function fetchSkinIACohortAccess(
  getToken: () => Promise<string | null>,
  url: string,
  fetchImpl: typeof fetch = fetch,
  timeoutMs = SKINIA_ACCESS_TIMEOUT_MS,
): Promise<SkinIACohortAccess> {
  const controller = new AbortController();
  let expired = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<SkinIACohortAccess>((resolve) => {
    timer = setTimeout(() => {
      expired = true;
      controller.abort();
      resolve({ status: 'DENIED', reason: 'ACCESS_TIMED_OUT' });
    }, timeoutMs);
  });

  const request = async (): Promise<SkinIACohortAccess> => {
    try {
      const token = await getToken();
      // A late token must not start a request after the timeout has fired.
      if (expired) return { status: 'DENIED', reason: 'ACCESS_TIMED_OUT' };
      if (!token) return { status: 'DENIED', reason: 'UNAUTHENTICATED' };
      const response = await fetchImpl(url, {
        headers: { Authorization: `Bearer ${token}` },
        signal: controller.signal,
      });
      if (expired) return { status: 'DENIED', reason: 'ACCESS_TIMED_OUT' };
      if (!response.ok) return { status: 'DENIED', reason: 'ACCESS_UNAVAILABLE' };
      const body = (await response.json()) as { authorized?: boolean; reason?: string };
      if (expired) return { status: 'DENIED', reason: 'ACCESS_TIMED_OUT' };
      return body.authorized === true && body.reason === 'CONTROLLED_TESTFLIGHT_COHORT'
        ? { status: 'GRANTED', reason: 'CONTROLLED_TESTFLIGHT_COHORT' }
        : { status: 'DENIED', reason: body.reason ?? 'MEMBER_NOT_ENTITLED' };
    } catch {
      return { status: 'DENIED', reason: expired ? 'ACCESS_TIMED_OUT' : 'ACCESS_UNAVAILABLE' };
    }
  };

  try {
    return await Promise.race([request(), timeout]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}
