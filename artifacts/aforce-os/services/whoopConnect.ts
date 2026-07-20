/**
 * WHOOP connect bridge for AForce OS (mobile).
 *
 * WHOOP's OAuth flow is brokered entirely by our api-server — the client never
 * holds WHOOP client credentials (the backend does the PKCE code exchange and
 * stores the per-user token, encrypted). This service is a thin, status-aware
 * wrapper over the `/api/whoop/*` routes, mirroring `services/garmin.ts`.
 *
 * DORMANT-AWARE: the server only mounts those routes when the WHOOP_* env is
 * configured. When it is not, every `/api/whoop/*` path 404s — mapped here to a
 * benign `credentials_missing` state, NOT a failure. We never fabricate a
 * connected state and never seed demo data here.
 *
 * Score-Protection: nothing here awards, mutates, or fabricates a score. A sync
 * only asks the server to fetch + persist measured WHOOP data.
 */

import {
  AforceApiError,
  getJsonAforceApi,
  postJsonAforceApi,
  deleteJsonAforceApi,
} from './aforceApiClient';

/** Injectable client seam so the 404/409 mapping is unit-testable without
 *  global-fetch mocking. Defaults wire the real api client. */
export interface WhoopServiceDeps {
  getJson?: (path: string) => Promise<unknown>;
  postJson?: (path: string, body: unknown) => Promise<unknown>;
  deleteJson?: (path: string) => Promise<unknown>;
}

/** Connection state for the WHOOP integration. */
export type WhoopConnectionState =
  /** Server route 404 — integration not configured on the backend. */
  | 'credentials_missing'
  /** Configured, but this user has no stored WHOOP token. */
  | 'not_connected'
  /** Configured and this user has a stored token. */
  | 'connected';

export interface WhoopStatus {
  state: WhoopConnectionState;
  /** Epoch ms the access token expires; null when not connected. */
  expiresAt: number | null;
}

interface WhoopStatusWire {
  credentialsConfigured: boolean;
  connected: boolean;
  expiresAt: number | null;
}

export type WhoopStartResult =
  | { status: 'ok'; authorizeUrl: string; state: string }
  | { status: 'credentials_missing' };

interface WhoopStartWire {
  authorizeUrl: string;
  state: string;
}

export type WhoopDisconnectResult =
  | { status: 'ok' }
  | { status: 'credentials_missing' };

export type WhoopSyncResult =
  | { status: 'ok'; synced: boolean; fetchedAt: number | null }
  | { status: 'not_connected' }
  | { status: 'credentials_missing' };

interface WhoopSyncWire {
  ok: boolean;
  synced: boolean;
  fetchedAt: number | null;
}

/** True only for a 404 — the dormant/unconfigured signal. */
function isCredentialsMissing(err: unknown): boolean {
  return err instanceof AforceApiError && err.status === 404;
}

/**
 * Fetch the current WHOOP connection status from server truth. A 404 means the
 * backend integration is not configured (`credentials_missing`) — a state, not
 * an error. Drives the UI: `not_connected` → show Connect.
 */
export async function getWhoopStatus(
  deps: WhoopServiceDeps = {},
): Promise<WhoopStatus> {
  const getJson = deps.getJson ?? getJsonAforceApi;
  try {
    const wire = (await getJson('/whoop/status')) as WhoopStatusWire;
    return {
      state: wire.connected ? 'connected' : 'not_connected',
      expiresAt: wire.expiresAt ?? null,
    };
  } catch (err) {
    if (isCredentialsMissing(err)) {
      return { state: 'credentials_missing', expiresAt: null };
    }
    throw err;
  }
}

/**
 * Begin the WHOOP OAuth flow. Returns the authorize URL the client should open
 * in a browser. A 404 maps to `credentials_missing`.
 */
export async function startWhoopConnect(
  deps: WhoopServiceDeps = {},
): Promise<WhoopStartResult> {
  const postJson = deps.postJson ?? postJsonAforceApi;
  try {
    const wire = (await postJson('/whoop/oauth/start', {})) as WhoopStartWire;
    return { status: 'ok', authorizeUrl: wire.authorizeUrl, state: wire.state };
  } catch (err) {
    if (isCredentialsMissing(err)) {
      return { status: 'credentials_missing' };
    }
    throw err;
  }
}

/**
 * Disconnect WHOOP (clears the stored token server-side). Idempotent. A 404
 * maps to `credentials_missing`.
 */
export async function disconnectWhoop(
  deps: WhoopServiceDeps = {},
): Promise<WhoopDisconnectResult> {
  const deleteJson = deps.deleteJson ?? deleteJsonAforceApi;
  try {
    await deleteJson('/whoop/disconnect');
    return { status: 'ok' };
  } catch (err) {
    if (isCredentialsMissing(err)) {
      return { status: 'credentials_missing' };
    }
    throw err;
  }
}

/**
 * Trigger a server-side biometrics sync for the signed-in user. A 404 maps to
 * `credentials_missing`; a 409 (`not_connected`) means no stored token yet.
 * Neither is a hard failure.
 */
export async function syncWhoopSnapshot(
  deps: WhoopServiceDeps = {},
): Promise<WhoopSyncResult> {
  const postJson = deps.postJson ?? postJsonAforceApi;
  try {
    const wire = (await postJson('/whoop/sync', {})) as WhoopSyncWire;
    return {
      status: 'ok',
      synced: wire.synced === true,
      fetchedAt: wire.fetchedAt ?? null,
    };
  } catch (err) {
    if (isCredentialsMissing(err)) {
      return { status: 'credentials_missing' };
    }
    if (err instanceof AforceApiError && err.status === 409) {
      return { status: 'not_connected' };
    }
    throw err;
  }
}
