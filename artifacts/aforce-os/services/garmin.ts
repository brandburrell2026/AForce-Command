/**
 * Garmin Connect bridge for AForce OS (mobile).
 *
 * Unlike `services/whoop.ts` (which talks directly to WHOOP's cloud),
 * Garmin's OAuth flow is brokered entirely by our own api-server — the
 * client never holds Garmin client credentials. This service is a thin,
 * status-aware wrapper over the `/api/garmin/*` routes.
 *
 * DORMANT-AWARE: the server only mounts those routes when Garmin
 * credentials are configured. When they are not, every `/api/garmin/*`
 * path 404s. This service maps that 404 to a benign
 * `credentials_missing` state — NOT a failure — so the UI can show
 * "integration unavailable" instead of an error. We never fabricate a
 * connected state and never seed demo data here.
 *
 * Score-Protection: nothing in this module awards, mutates, or
 * fabricates a performance score. A sync only asks the server to fetch
 * + persist measured Garmin data.
 */

import {
  AforceApiError,
  getJsonAforceApi,
  postJsonAforceApi,
  deleteJsonAforceApi,
} from './aforceApiClient';

/** Injectable client seam so the 404/409 mapping is unit-testable
 *  without global-fetch mocking. The real (generic) api-client helpers
 *  are assignable to these `unknown`-returning shapes; the service casts
 *  each response to its typed wire shape internally. Defaults wire the
 *  real api client. */
export interface GarminServiceDeps {
  getJson?: (path: string) => Promise<unknown>;
  postJson?: (path: string, body: unknown) => Promise<unknown>;
  deleteJson?: (path: string) => Promise<unknown>;
}

/** Connection state for the Garmin integration. */
export type GarminConnectionState =
  /** Server route 404 — integration not configured on the backend. */
  | 'credentials_missing'
  /** Configured, but this user has no stored Garmin tokens. */
  | 'not_connected'
  /** Configured and this user has valid stored tokens. */
  | 'connected';

export interface GarminStatus {
  state: GarminConnectionState;
  /** Epoch ms the access token expires; null when not connected. */
  expiresAt: number | null;
}

interface GarminStatusWire {
  credentialsConfigured: boolean;
  connected: boolean;
  expiresAt: number | null;
}

export type GarminStartResult =
  | { status: 'ok'; authorizeUrl: string; state: string }
  | { status: 'credentials_missing' };

interface GarminStartWire {
  authorizeUrl: string;
  state: string;
}

export type GarminDisconnectResult =
  | { status: 'ok' }
  | { status: 'credentials_missing' };

export type GarminSyncResult =
  | { status: 'ok'; synced: boolean; fetchedAt: number | null }
  | { status: 'not_connected' }
  | { status: 'credentials_missing' };

interface GarminSyncWire {
  ok: boolean;
  synced: boolean;
  fetchedAt: number | null;
}

/** True only for a 404 — the dormant/unconfigured signal. */
function isCredentialsMissing(err: unknown): boolean {
  return err instanceof AforceApiError && err.status === 404;
}

/**
 * Fetch the current Garmin connection status. A 404 means the backend
 * integration is not configured (`credentials_missing`) — surfaced as a
 * state, not thrown. Any other error still propagates.
 */
export async function getGarminStatus(
  deps: GarminServiceDeps = {},
): Promise<GarminStatus> {
  const getJson = deps.getJson ?? getJsonAforceApi;
  try {
    const wire = (await getJson('/garmin/status')) as GarminStatusWire;
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
 * Begin the Garmin OAuth flow. Returns the authorize URL the client
 * should open. A 404 maps to `credentials_missing`.
 */
export async function startGarminConnect(
  deps: GarminServiceDeps = {},
): Promise<GarminStartResult> {
  const postJson = deps.postJson ?? postJsonAforceApi;
  try {
    const wire = (await postJson('/garmin/oauth/start', {})) as GarminStartWire;
    return { status: 'ok', authorizeUrl: wire.authorizeUrl, state: wire.state };
  } catch (err) {
    if (isCredentialsMissing(err)) {
      return { status: 'credentials_missing' };
    }
    throw err;
  }
}

/**
 * Disconnect Garmin (clears stored tokens server-side). Idempotent. A
 * 404 maps to `credentials_missing`.
 */
export async function disconnectGarmin(
  deps: GarminServiceDeps = {},
): Promise<GarminDisconnectResult> {
  const deleteJson = deps.deleteJson ?? deleteJsonAforceApi;
  try {
    await deleteJson('/garmin/disconnect');
    return { status: 'ok' };
  } catch (err) {
    if (isCredentialsMissing(err)) {
      return { status: 'credentials_missing' };
    }
    throw err;
  }
}

/**
 * Trigger a server-side biometrics sync for the signed-in user. A 404
 * maps to `credentials_missing`; a 409 (`not_connected`) means the user
 * has no stored tokens yet. Neither is treated as a hard failure.
 */
export async function syncGarminSnapshot(
  deps: GarminServiceDeps = {},
): Promise<GarminSyncResult> {
  const postJson = deps.postJson ?? postJsonAforceApi;
  try {
    const wire = (await postJson('/garmin/sync', {})) as GarminSyncWire;
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
