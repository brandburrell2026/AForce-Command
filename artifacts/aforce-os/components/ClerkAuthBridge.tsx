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
import { useFeatureFlags } from '@/store/useAppStore';
import { setIntakeOutboxUser } from '@/services/intakeOutbox';
import {
  mapClerkToScope,
  resolveScope,
  setScopeIsolationEnabled,
} from '@/services/userScope';
import { wireUserScopeCleanup } from '@/services/userScopeCleanup';

export function ClerkAuthBridge(): null {
  const { isLoaded, isSignedIn, userId, getToken } = useAuth();
  const flags = useFeatureFlags();
  const outboxEnabled = flags.offline_intake_outbox_enabled;
  const isolationEnabled = flags.per_user_storage_isolation_enabled;


  // The isolation flag gates only the NAMESPACE PROJECTION, never the state
  // machine. The identity state must stay accurate regardless of the flag, so
  // the failure presentation can show a member why the app is not progressing.
  React.useEffect(() => {
    setScopeIsolationEnabled(isolationEnabled);
  }, [isolationEnabled]);

  // Translate Clerk into the authoritative identity state. This is the ONLY
  // producer of scope transitions in the app.
  //
  // `!isLoaded` is SILENCE, not an answer: it leaves the machine UNRESOLVED
  // and lets the bounded watchdog decide. It must never be read as
  // "signed out" — a slow or failed identity lookup is not evidence that a
  // person is anonymous.
  React.useEffect(() => {
    wireUserScopeCleanup();
    // The rule itself lives in `mapClerkToScope`, which is pure and
    // exhaustively tested. `null` means Clerk has not answered — leave the
    // machine UNRESOLVED and let the bounded watchdog decide.
    const next = mapClerkToScope({ isLoaded, isSignedIn, userId });
    if (next !== null) resolveScope(next);
  }, [isLoaded, isSignedIn, userId]);

  React.useEffect(() => {
    if (!isLoaded) return;
    // When signed out, explicitly null the token getters so any
    // background request (WS reconnect, retry, etc.) cannot reuse
    // a stale bearer between log-out and the next log-in.
    if (!isSignedIn) {
      setTokenGetter(null);
      setAuthTokenGetter(null);
      // Offline Intake Outbox: drop the user scope so the in-memory queue resets
      // and no background flush can replay a prior account's intakes. The queue
      // is persisted under a per-user key, so the next user only ever reads their
      // own. Flag-gated so production (flag OFF) stays byte-identical (no I/O).
      if (outboxEnabled) setIntakeOutboxUser(null);
      // Per-user isolation is NOT handled here any more: identity transitions
      // have exactly one producer (the effect above), so there is one place
      // that decides who this device is acting as.
      return;
    }
    // Bridge into both the imperative realApi/WS registry and the
    // generated OpenAPI client so every outbound request carries the
    // current Clerk session token.
    const getter = () => getToken();
    setTokenGetter(getter);
    setAuthTokenGetter(getter);
    // Scope the outbox to this user so its durable queue can never be read or
    // replayed under a different account on a shared device. A `userId` change
    // re-runs this effect (it is in the deps) and re-scopes, resetting the
    // in-memory queue for the new account. Flag-gated → no-op when disabled.
    if (outboxEnabled) setIntakeOutboxUser(userId ?? null);
    return () => {
      setTokenGetter(null);
      setAuthTokenGetter(null);
    };
  }, [isLoaded, isSignedIn, userId, outboxEnabled, getToken]);

  // Pull server-authoritative subscription entitlement once we have a
  // session. Lives here (rather than in tab screens) so it runs once,
  // not once per tab mount.
  useEntitlement();

  return null;
}
