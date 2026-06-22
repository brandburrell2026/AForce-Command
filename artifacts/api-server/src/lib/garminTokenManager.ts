/**
 * Server-side Garmin Connect OAuth2 token manager.
 *
 * Faithful port of `whoopTokenManager.ts`. Pure orchestration around an
 * injected `GarminTokenStore` (per-user on the server — see
 * `lib/db/garminTokenStore.ts`) plus the Garmin token endpoint.
 *
 * Behavior (identical to WHOOP):
 *   - `getValidAccessToken()` returns the cached access token when it
 *     has >`refreshSkewMs` (default 60s) of life left, else refreshes
 *     synchronously, persists, and returns the fresh token. On refresh
 *     failure it returns `null` so callers (the fetch worker) can skip
 *     the user without throwing.
 *   - `refresh()` exposes the same refresh path but rethrows on failure.
 *   - `setTokens()` persists a freshly-exchanged bundle.
 *   - `signOut()` clears the store.
 *   - `peek()` is read-through to the store for debug surfaces.
 *
 * Architecture lock: DORMANT / hidden-infra. No public route invokes
 * this module unless GARMIN_* env vars are configured and the OAuth
 * router is mounted.
 *
 * NOTE ON ENDPOINT: `GARMIN_TOKEN_ENDPOINT` is the documented Garmin
 * Health API OAuth2 token endpoint; confirm against the official Garmin
 * Developer Program portal when credentials are provisioned.
 */

import type { GarminTokens, GarminTokenStore } from "@workspace/db";
import type { GarminRefreshCoordinator } from "./garminRefreshRegistry";

export const GARMIN_TOKEN_ENDPOINT =
  "https://diauth.garmin.com/di-oauth2-service/oauth/token";

/** Wire shape returned by the Garmin token endpoint. */
export interface GarminTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type?: string;
  scope?: string;
}

export interface GarminOAuthConfig {
  clientId: string;
  clientSecret: string;
}

export interface GarminTokenManagerOptions {
  store: GarminTokenStore;
  config: GarminOAuthConfig;
  /** Override for tests. */
  fetchImpl?: typeof fetch;
  /** Override for tests; defaults to `Date.now`. */
  nowMs?: () => number;
  /** Refresh proactively when this many ms remain. Default 60_000. */
  refreshSkewMs?: number;
  /** Optional process-level refresh coordinator (singleflight across
   *  manager instances for the same user). Default: per-manager. */
  refreshCoordinator?: GarminRefreshCoordinator;
}

export interface GarminTokenManager {
  getValidAccessToken(): Promise<string | null>;
  refresh(): Promise<GarminTokens>;
  setTokens(tokens: GarminTokens): Promise<void>;
  signOut(): Promise<void>;
  peek(): Promise<GarminTokens | null>;
}

/**
 * Read Garmin OAuth config from env. Fails loudly with a clear message
 * so the OAuth callback route doesn't 500 opaquely. Dormant-friendly:
 * the missing vars don't block server boot — they only block managers
 * that try to refresh, and the router isn't mounted without them anyway.
 */
export function getGarminOAuthConfigFromEnv(): GarminOAuthConfig {
  const clientId = process.env["GARMIN_CLIENT_ID"];
  const clientSecret = process.env["GARMIN_CLIENT_SECRET"];
  if (!clientId || !clientSecret) {
    throw new Error(
      "Garmin OAuth config missing: set GARMIN_CLIENT_ID and GARMIN_CLIENT_SECRET",
    );
  }
  return { clientId, clientSecret };
}

export interface ExchangeAuthorizationCodeArgs {
  code: string;
  codeVerifier: string;
  redirectUri: string;
  config: GarminOAuthConfig;
  fetchImpl?: typeof fetch;
  nowMs?: () => number;
}

/**
 * Exchange a Garmin authorization code for a token bundle. Standalone
 * (not on the per-user manager) because at callback time we don't yet
 * have a manager bound — we recover the userId from the auth-state
 * record, run this exchange, then persist via the user's token store.
 *
 * Throws on HTTP non-2xx or malformed payload. The caller (callback
 * route) converts to a 502 and never bubbles the underlying error
 * message, which can contain the code.
 */
export async function exchangeAuthorizationCode(
  args: ExchangeAuthorizationCodeArgs,
): Promise<GarminTokens> {
  const fetchImpl = args.fetchImpl ?? fetch;
  const now = args.nowMs ?? ((): number => Date.now());
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code: args.code,
    redirect_uri: args.redirectUri,
    client_id: args.config.clientId,
    client_secret: args.config.clientSecret,
    code_verifier: args.codeVerifier,
  });
  const res = await fetchImpl(GARMIN_TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  if (!res.ok) {
    throw new Error(`Garmin code exchange failed: HTTP ${res.status}`);
  }
  const json = (await res.json()) as GarminTokenResponse;
  if (
    typeof json.access_token !== "string" ||
    typeof json.refresh_token !== "string" ||
    typeof json.expires_in !== "number" ||
    !Number.isFinite(json.expires_in)
  ) {
    throw new Error("Garmin code exchange failed: malformed payload");
  }
  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token,
    expiresAt: now() + json.expires_in * 1000,
    scope: json.scope ?? null,
  };
}

export function createGarminTokenManager(
  opts: GarminTokenManagerOptions,
): GarminTokenManager {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const now = opts.nowMs ?? ((): number => Date.now());
  const skew = opts.refreshSkewMs ?? 60_000;

  // Singleflight — collapse concurrent refreshes for this manager into
  // one network call. Garmin (like WHOOP) rotates refresh tokens, so
  // two concurrent refreshes would race and invalidate each other.
  let inflight: Promise<GarminTokens> | null = null;
  const defaultCoordinator: GarminRefreshCoordinator = (impl) => {
    if (inflight) return inflight;
    const p = impl().finally(() => {
      if (inflight === p) inflight = null;
    });
    inflight = p;
    return p;
  };
  const coordinate: GarminRefreshCoordinator =
    opts.refreshCoordinator ?? defaultCoordinator;

  async function refreshImpl(): Promise<GarminTokens> {
    const current = await opts.store.read();
    if (!current?.refreshToken) {
      throw new Error("Garmin refresh failed: no refresh token stored");
    }
    const body = new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: current.refreshToken,
      client_id: opts.config.clientId,
      client_secret: opts.config.clientSecret,
    });
    const res = await fetchImpl(GARMIN_TOKEN_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });
    if (!res.ok) {
      throw new Error(`Garmin refresh failed: HTTP ${res.status}`);
    }
    const json = (await res.json()) as GarminTokenResponse;
    if (
      typeof json.access_token !== "string" ||
      typeof json.expires_in !== "number" ||
      !Number.isFinite(json.expires_in)
    ) {
      throw new Error("Garmin refresh failed: malformed payload");
    }
    const next: GarminTokens = {
      accessToken: json.access_token,
      // Garmin rotates refresh tokens; keep the previous one when the
      // response omits a new one (defensive).
      refreshToken: json.refresh_token ?? current.refreshToken,
      expiresAt: now() + json.expires_in * 1000,
      scope: json.scope ?? current.scope ?? null,
    };
    await opts.store.write(next);
    return next;
  }

  function refresh(): Promise<GarminTokens> {
    return coordinate(refreshImpl);
  }

  return {
    async getValidAccessToken() {
      const current = await opts.store.read();
      if (!current) return null;
      if (current.expiresAt - now() > skew) return current.accessToken;
      try {
        const next = await refresh();
        return next.accessToken;
      } catch {
        return null;
      }
    },
    refresh,
    async setTokens(tokens) {
      await opts.store.write(tokens);
    },
    async signOut() {
      await opts.store.clear();
    },
    peek() {
      return opts.store.read();
    },
  };
}
