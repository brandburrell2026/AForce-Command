/**
 * Auth token registry — bridges Clerk's React-only `useAuth().getToken`
 * into the imperative `realApi.ts` fetch helpers (and WebSocket URLs)
 * that don't run inside a component.
 *
 * ClerkAuthBridge (mounted under <ClerkProvider> in `app/_layout.tsx`)
 * calls `setTokenGetter(getToken)` once Clerk is loaded; everything else
 * reads via `getAuthHeaders()` / `getAuthQueryString()`.
 *
 * When Clerk isn't configured, the getter stays null and we send no
 * Authorization header — the api-server's requireAuth middleware falls
 * back to DEFAULT_USER_ID in that case (see ../../api-server/src/middlewares/requireAuth.ts).
 */

import { buildClientIdentityHeader, CLIENT_HEADER_NAME } from './clientIdentity';

type TokenGetter = () => Promise<string | null>;
let tokenGetter: TokenGetter | null = null;
export function setTokenGetter(getter: TokenGetter | null): void {
  tokenGetter = getter;
}



export async function getAuthToken(): Promise<string | null> {
  if (!tokenGetter) {
    console.log('[TOK] no getter');
    return null;
  }
  try {
    const token = await tokenGetter();
    if (!token) {
      console.log('[TOK] got NULL');
      return null;
    }
    console.log('[TOK] got', token.slice(0, 12) + '…');
    return token;
  } catch (e) {
    console.log('[TOK] threw', String(e));
    return null;
  }
}

export const TIME_ZONE_HEADER_NAME = 'x-aforce-time-zone';

/** The device's IANA zone name, e.g. "America/New_York", or null when it cannot be read. */
export function deviceTimeZone(): string | null {
  try {
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return typeof zone === 'string' && /^[A-Za-z_]+(\/[A-Za-z0-9_+-]+){1,2}$|^UTC$/.test(zone) ? zone : null;
  } catch {
    return null;
  }
}

export async function getAuthHeaders(): Promise<Record<string, string>> {
  const token = await getAuthToken();
  const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
  // THE ONE PLACE EVERY AForce REQUEST GETS ITS HEADERS. `realApi`'s
  // getJson/postJson, `aforceApiClient`, `lib/api` and `useEntitlement` all
  // route through here, so the version rides on every call without a second
  // networking layer to build, keep in sync, or forget.
  //
  // Never throws and never blocks: an identity that cannot be determined sends
  // no header, and the server reads a missing header as `unknown`, which is
  // not grounds to refuse anyone.
  const client = buildClientIdentityHeader();
  if (client) headers[CLIENT_HEADER_NAME] = client;
  // The phone's time zone, so the server ends "today" at the member's own
  // midnight (it used midnight UTC, which is 7 PM Eastern). The zone name
  // only; it is not stored. If it cannot be read, nothing is sent and the
  // server keeps using UTC.
  const zone = deviceTimeZone();
  if (zone) headers[TIME_ZONE_HEADER_NAME] = zone;
  return headers;
}
