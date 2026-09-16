/**
 * Client-side half of the SkinIA controlled TestFlight gate (DR-015).
 *
 * The client is intentionally fail-closed: until the authenticated server
 * decision is received, the route remains unavailable. This module does not
 * acquire, process, retain, or transmit images.
 */
import { useEffect, useState } from 'react';
import { API_BASE } from '@/lib/apiBase';
import { getAuthHeaders } from './authToken';

export type SkinIACohortAccess =
  | { status: 'CHECKING' }
  | { status: 'DENIED'; reason: string }
  | { status: 'GRANTED'; reason: 'CONTROLLED_TESTFLIGHT_COHORT' };

export const SKINIA_ACCESS_CHECKING: SkinIACohortAccess = Object.freeze({ status: 'CHECKING' });

export function isSkinIAAccessAllowed(input: {
  featureEnabled: boolean;
  internalTestflight: boolean;
  cohort: SkinIACohortAccess;
}): boolean {
  return input.featureEnabled
    && input.internalTestflight
    && input.cohort.status === 'GRANTED';
}

async function fetchSkinIACohortAccess(): Promise<SkinIACohortAccess> {
  try {
    const headers = await getAuthHeaders();
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
  const [access, setAccess] = useState<SkinIACohortAccess>(SKINIA_ACCESS_CHECKING);

  useEffect(() => {
    let live = true;
    if (!enabled) {
      setAccess({ status: 'DENIED', reason: 'PUBLIC_RELEASE_LOCKED' });
      return () => { live = false; };
    }
    setAccess(SKINIA_ACCESS_CHECKING);
    void fetchSkinIACohortAccess().then((next) => {
      if (live) setAccess(next);
    });
    return () => { live = false; };
  }, [enabled]);

  return access;
}
