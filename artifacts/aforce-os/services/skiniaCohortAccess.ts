/**
 * Client-side half of the SkinIA controlled TestFlight gate (DR-015).
 *
 * The client is intentionally fail-closed: until the authenticated server
 * decision is received, the route remains unavailable. This module does not
 * acquire, process, retain, or transmit images.
 */
import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@clerk/expo';
import { API_BASE } from '@/lib/apiBase';
import { SKINIA_ACCESS_CHECKING, type SkinIACohortAccess } from './skiniaCohortGate';
import { fetchSkinIACohortAccess } from './skiniaAccessRequest';

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

export function useSkinIACohortAccess(enabled: boolean, retryKey = 0): SkinIACohortAccess {
  const { isLoaded, isSignedIn, getToken, userId } = useAuth();
  const [access, setAccess] = useState<SkinIACohortAccess>(SKINIA_ACCESS_CHECKING);
  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;

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
    void fetchSkinIACohortAccess(() => getTokenRef.current(), `${API_BASE}/skinia/access`).then((next) => {
      if (live) setAccess(next);
    });
    return () => { live = false; };
  }, [enabled, isLoaded, isSignedIn, userId, retryKey]);

  return access;
}
