/**
 * Bridges Clerk's React-only `useAuth().getToken` into the imperative
 * `services/authToken.ts` registry so non-component code (realApi
 * fetchers, WebSocket subscriber) can attach Bearer tokens to its
 * outbound requests.
 *
 * Mounted once inside <ClerkProvider>. Renders nothing.
 */

import React from 'react';
import { useAuth } from '@clerk/expo';
import { setAuthTokenGetter } from '@workspace/api-client-react';
import { setTokenGetter } from '@/services/authToken';
import { useEntitlement } from '@/hooks/useEntitlement';

export function ClerkAuthBridge(): null {
  const { isLoaded, isSignedIn, getToken } = useAuth();

  React.useEffect(() => {
    if (!isLoaded) return;
    // When signed out, explicitly null the token getters so any
    // background request (WS reconnect, retry, etc.) cannot reuse
    // a stale bearer between log-out and the next log-in.
    if (!isSignedIn) {
      setTokenGetter(null);
      setAuthTokenGetter(null);
      return;
    }
    // Bridge into both the imperative realApi/WS registry and the
    // generated OpenAPI client so every outbound request carries the
    // current Clerk session token.
    const getter = () => getToken();
    setTokenGetter(getter);
    setAuthTokenGetter(getter);
    return () => {
      setTokenGetter(null);
      setAuthTokenGetter(null);
    };
  }, [isLoaded, isSignedIn, getToken]);

  // Pull server-authoritative subscription entitlement once we have a
  // session. Lives here (rather than in tab screens) so it runs once,
  // not once per tab mount.
  useEntitlement();

  return null;
}
