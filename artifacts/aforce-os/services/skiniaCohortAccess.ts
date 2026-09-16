/**
 * Client-side half of the SkinIA controlled TestFlight gate (DR-015).
 *
 * The client is intentionally fail-closed: until the authenticated server
 * decision is received, the route remains unavailable. This module does not
 * acquire, process, retain, or transmit images.
 */
import { useEffect, useState } from 'react';
import { useAuth } from '@clerk/expo';
import { API_BASE } from '@/lib/apiBase';
import { SKINIA_ACCESS_CHECKING, type SkinIACohortAccess } from './skiniaCohortGate';

/**
 * The decision itself lives in `skiniaCohortGate.ts`, which imports nothing.
 * Re-exported here so every existing import path keeps working unchanged —
 * the split is about what a TEST can import, not about moving the API.
 */
export {
  SKINIA_ACCESS_CHECKING,
  isSkinIAAccessAllowed,
  type SkinIACohortAccess,
} from './skiniaCohortGate';

async function fetchSkinIACohortAccess(
  getToken: () => Promise<string | null>,
): Promise<SkinIACohortAccess> {
  try {
    const token = await getToken();
    if (!token) return { status: 'DENIED', reason: 'UNAUTHENTICATED' };
    const headers = { Authorization: `Bearer ${token}` };
    const response = await fetch(`${API_BASE}/skinia/access`, { headers });
    if (!response.ok) return { status: 'DENIED', reason: 'ACCESS_UNAVAILABLE' };
    const body = (await response.json()) as { authorized?: boolean; reason?: string };
    return body.authorized === true && body.reason === 'CONTROLLED_TESTFLIGHT_COHORT'
      ? { status: 'GRANTED', reason: 'CONTROLLED_TESTFLIGHT_COHORT' }
      : { status: 'DENIED', reason: body.reason ?? 'MEMBER_NOT_ENTITLED' };
  } catch {
    return { status: 'DENIED', reason: 'ACCESS_UNAVAILABLE' };
  }
}

export function useSkinIACohortAccess(enabled: boolean): SkinIACohortAccess {
  const { isLoaded, isSignedIn, getToken, userId } = useAuth();
  const [access, setAccess] = useState<SkinIACohortAccess>(SKINIA_ACCESS_CHECKING);

  useEffect(() => {
    let live = true;
    if (!enabled) {
      setAccess({ status: 'DENIED', reason: 'PUBLIC_RELEASE_LOCKED' });
      return () => { live = false; };
    }
    // Do not make a one-shot, unauthenticated request while Clerk is still
    // restoring its native session. The Profile entry is intentionally
    // fail-closed, but must retry once the signed-in identity is available.
    if (!isLoaded) {
      setAccess(SKINIA_ACCESS_CHECKING);
      return () => { live = false; };
    }
    if (!isSignedIn || !userId) {
      setAccess({ status: 'DENIED', reason: 'UNAUTHENTICATED' });
      return () => { live = false; };
    }
    setAccess(SKINIA_ACCESS_CHECKING);
    void fetchSkinIACohortAccess(getToken).then((next) => {
      if (live) setAccess(next);
    });
    return () => { live = false; };
  }, [enabled, getToken, isLoaded, isSignedIn, userId]);

  return access;
}
