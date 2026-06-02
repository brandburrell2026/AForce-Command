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

type TokenGetter = () => Promise<string | null>;

let tokenGetter: TokenGetter | null = null;

export function setTokenGetter(getter: TokenGetter | null): void {
  tokenGetter = getter;
}

export async function getAuthToken(): Promise<string | null> {
  if (!tokenGetter) return null;
  try {
    return await tokenGetter();
  } catch {
    return null;
  }
}

export async function getAuthHeaders(): Promise<Record<string, string>> {
  const token = await getAuthToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}
