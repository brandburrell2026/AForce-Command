/**
 * Server-side Strava OAuth2 token manager.
 *
 * Faithful port of `ouraTokenManager.ts` / `whoopTokenManager.ts` /
 * `garminTokenManager.ts`. Pure orchestration around an injected
 * `StravaTokenStore` (per-user on the server — see
 * `lib/db/stravaTokenStore.ts`) plus the Strava token endpoint.
 *
 * Behavior (identical to WHOOP/Garmin/Oura):
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
 * Endpoint + rotation contract — verified against Strava's official
 * OAuth2 docs (https://developers.strava.com/docs/authentication,
 * 2026-07):
 *   `POST https://www.strava.com/oauth/token`
 *   (NOTE: Strava's docs are internally inconsistent about this exact
 *   host path — prose on the same page says
 *   `https://www.strava.com/oauth/token` while the accompanying cURL
 *   examples show `https://www.strava.com/api/v3/oauth/token`. Both
 *   forms are documented; this module uses the prose form, which
 *   matches the endpoint used across Strava's own web OAuth walk-
 *   through and the widely-used community SDKs. Documented assumption
 *   — flag if a live integration test ever sees a 404 here.)
 *
 *   authorization_code grant body: grant_type=authorization_code,
 *   code, client_id, client_secret. Verified via Strava's own cURL
 *   example: `redirect_uri` is NOT part of this request (unlike
 *   WHOOP/Oura, which require it) — Strava's docs show only
 *   client_id/client_secret/code/grant_type.
 *
 *   refresh_token grant body: grant_type=refresh_token, refresh_token,
 *   client_id, client_secret. No `scope` param on the refresh grant.
 *
 *   Strava's refresh tokens rotate: "A refresh token is issued back to
 *   the application after all successful requests... Applications
 *   should persist the refresh token contained in the response, and
 *   always use the most recent refresh token." Mirrors Oura/WHOOP's
 *   rotation-safe handling: keep the previous refresh token if a
 *   response ever omits one (defensive; the documented contract always
 *   returns one).
 *
 *   Access tokens expire 6 hours (21,600s) after creation
 *   (`"expires_in": 21600`, verified in the docs' sample response).
 *
 * Architecture lock: hidden-infra. No public route invokes this
 * module unless STRAVA_* env vars are configured (the OAuth router is
 * only mounted then).
 */

import type { StravaTokens, StravaTokenStore } from "@workspace/db";
import type { StravaRefreshCoordinator } from "./stravaRefreshRegistry";

export const STRAVA_TOKEN_ENDPOINT = "https://www.strava.com/oauth/token";

/** Wire shape returned by the Strava token endpoint. Strava also
 *  returns an `athlete` object on the authorization_code grant, which
 *  this integration never reads (activity-only contributor — see
 *  `stravaSnapshot.ts`) and deliberately omits from this interface. */
export interface StravaTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  expires_at?: number;
  token_type?: string;
  scope?: string;
}

export interface StravaOAuthConfig {
  clientId: string;
  clientSecret: string;
}

export interface StravaTokenManagerOptions {
  store: StravaTokenStore;
  config: StravaOAuthConfig;
  /** Override for tests. */
  fetchImpl?: typeof fetch;
  /** Override for tests; defaults to `Date.now`. */
  nowMs?: () => number;
  /** Refresh proactively when this many ms remain. Default 60_000. */
  refreshSkewMs?: number;
  /** Optional process-level refresh coordinator (singleflight across
   *  manager instances for the same user). Default: per-manager. */
  refreshCoordinator?: StravaRefreshCoordinator;
}

export interface StravaTokenManager {
  getValidAccessToken(): Promise<string | null>;
  refresh(): Promise<StravaTokens>;
  setTokens(tokens: StravaTokens): Promise<void>;
  signOut(): Promise<void>;
  peek(): Promise<StravaTokens | null>;
}

/**
 * Read Strava OAuth config from env. Fails loudly with a clear message
 * so the OAuth callback route doesn't 500 opaquely. Hidden-infra
 * friendly: the missing vars don't block server boot — they only
 * block managers that try to refresh, and the router isn't mounted
 * without them anyway.
 */
export function getStravaOAuthConfigFromEnv(): StravaOAuthConfig {
  const clientId = process.env["STRAVA_CLIENT_ID"];
  const clientSecret = process.env["STRAVA_CLIENT_SECRET"];
  if (!clientId || !clientSecret) {
    throw new Error(
      "Strava OAuth config missing: set STRAVA_CLIENT_ID and STRAVA_CLIENT_SECRET",
    );
  }
  return { clientId, clientSecret };
}

export interface ExchangeAuthorizationCodeArgs {
  code: string;
  config: StravaOAuthConfig;
  fetchImpl?: typeof fetch;
  nowMs?: () => number;
}

/**
 * Exchange a Strava authorization code for a token bundle. Standalone
 * (not on the per-user manager) because at callback time we don't yet
 * have a manager bound — we recover the userId from the auth-state
 * record, run this exchange, then persist via the user's token store.
 *
 * Throws on HTTP non-2xx or malformed payload. The caller (callback
 * route) converts to a 502 and never bubbles the underlying error
 * message, which can contain the code.
 *
 * No `redirect_uri` and no `code_verifier` in this request body —
 * verified against Strava's documented cURL example, which lists only
 * `client_id`, `client_secret`, `code`, `grant_type`.
 */
export async function exchangeAuthorizationCode(
  args: ExchangeAuthorizationCodeArgs,
): Promise<StravaTokens> {
  const fetchImpl = args.fetchImpl ?? fetch;
  const now = args.nowMs ?? ((): number => Date.now());
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code: args.code,
    client_id: args.config.clientId,
    client_secret: args.config.clientSecret,
  });
  const res = await fetchImpl(STRAVA_TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  if (!res.ok) {
    throw new Error(`Strava code exchange failed: HTTP ${res.status}`);
  }
  const json = (await res.json()) as StravaTokenResponse;
  if (
    typeof json.access_token !== "string" ||
    typeof json.refresh_token !== "string" ||
    typeof json.expires_in !== "number" ||
    !Number.isFinite(json.expires_in)
  ) {
    throw new Error("Strava code exchange failed: malformed payload");
  }
  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token,
    expiresAt: now() + json.expires_in * 1000,
    scope: json.scope ?? null,
  };
}

export function createStravaTokenManager(
  opts: StravaTokenManagerOptions,
): StravaTokenManager {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const now = opts.nowMs ?? ((): number => Date.now());
  const skew = opts.refreshSkewMs ?? 60_000;

  // Singleflight — collapse concurrent refreshes for this manager into
  // one network call. Strava's refresh tokens rotate on every refresh,
  // so two concurrent refreshes would race and invalidate each other.
  let inflight: Promise<StravaTokens> | null = null;
  const defaultCoordinator: StravaRefreshCoordinator = (impl) => {
    if (inflight) return inflight;
    const p = impl().finally(() => {
      if (inflight === p) inflight = null;
    });
    inflight = p;
    return p;
  };
  const coordinate: StravaRefreshCoordinator =
    opts.refreshCoordinator ?? defaultCoordinator;

  async function refreshImpl(): Promise<StravaTokens> {
    const current = await opts.store.read();
    if (!current?.refreshToken) {
      throw new Error("Strava refresh failed: no refresh token stored");
    }
    const body = new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: current.refreshToken,
      client_id: opts.config.clientId,
      client_secret: opts.config.clientSecret,
    });
    const res = await fetchImpl(STRAVA_TOKEN_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });
    if (!res.ok) {
      throw new Error(`Strava refresh failed: HTTP ${res.status}`);
    }
    const json = (await res.json()) as StravaTokenResponse;
    if (
      typeof json.access_token !== "string" ||
      typeof json.expires_in !== "number" ||
      !Number.isFinite(json.expires_in)
    ) {
      throw new Error("Strava refresh failed: malformed payload");
    }
    const next: StravaTokens = {
      accessToken: json.access_token,
      // Strava rotates the refresh token on every successful refresh;
      // keep the previous one when the response omits a new one
      // (defensive — the documented contract always returns one).
      refreshToken: json.refresh_token ?? current.refreshToken,
      expiresAt: now() + json.expires_in * 1000,
      scope: json.scope ?? current.scope ?? null,
    };
    await opts.store.write(next);
    return next;
  }

  function refresh(): Promise<StravaTokens> {
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
