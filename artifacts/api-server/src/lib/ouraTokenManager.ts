/**
 * Server-side Oura Ring OAuth2 token manager.
 *
 * Faithful port of `whoopTokenManager.ts` / `garminTokenManager.ts`.
 * Pure orchestration around an injected `OuraTokenStore` (per-user on
 * the server — see `lib/db/ouraTokenStore.ts`) plus the Oura token
 * endpoint.
 *
 * Behavior (identical to WHOOP/Garmin):
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
 * Endpoint + rotation contract — verified against Oura's official
 * OAuth2 docs (https://cloud.ouraring.com/docs/authentication,
 * 2026-07):
 *   `POST https://api.ouraring.com/oauth/token`
 *   form body: grant_type=refresh_token|authorization_code,
 *   refresh_token|code, client_id, client_secret.
 *   Oura's refresh tokens are SINGLE-USE — every successful refresh
 *   response includes a new refresh_token and the old one is
 *   invalidated. Unlike WHOOP, there is no `scope=offline` parameter
 *   in Oura's refresh grant (refresh capability is inherent to the
 *   Authorization Code grant, not scope-gated).
 *
 * Architecture lock: hidden-infra. No public route invokes this
 * module unless OURA_* env vars are configured (the OAuth router is
 * only mounted then).
 */

import type { OuraTokens, OuraTokenStore } from "@workspace/db";
import type { OuraRefreshCoordinator } from "./ouraRefreshRegistry";

export const OURA_TOKEN_ENDPOINT = "https://api.ouraring.com/oauth/token";

/** Wire shape returned by the Oura token endpoint. */
export interface OuraTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type?: string;
  scope?: string;
}

export interface OuraOAuthConfig {
  clientId: string;
  clientSecret: string;
}

export interface OuraTokenManagerOptions {
  store: OuraTokenStore;
  config: OuraOAuthConfig;
  /** Override for tests. */
  fetchImpl?: typeof fetch;
  /** Override for tests; defaults to `Date.now`. */
  nowMs?: () => number;
  /** Refresh proactively when this many ms remain. Default 60_000. */
  refreshSkewMs?: number;
  /** Optional process-level refresh coordinator (singleflight across
   *  manager instances for the same user). Default: per-manager. */
  refreshCoordinator?: OuraRefreshCoordinator;
}

export interface OuraTokenManager {
  getValidAccessToken(): Promise<string | null>;
  refresh(): Promise<OuraTokens>;
  setTokens(tokens: OuraTokens): Promise<void>;
  signOut(): Promise<void>;
  peek(): Promise<OuraTokens | null>;
}

/**
 * Read Oura OAuth config from env. Fails loudly with a clear message
 * so the OAuth callback route doesn't 500 opaquely. Hidden-infra
 * friendly: the missing vars don't block server boot — they only
 * block managers that try to refresh, and the router isn't mounted
 * without them anyway.
 */
export function getOuraOAuthConfigFromEnv(): OuraOAuthConfig {
  const clientId = process.env["OURA_CLIENT_ID"];
  const clientSecret = process.env["OURA_CLIENT_SECRET"];
  if (!clientId || !clientSecret) {
    throw new Error(
      "Oura OAuth config missing: set OURA_CLIENT_ID and OURA_CLIENT_SECRET",
    );
  }
  return { clientId, clientSecret };
}

export interface ExchangeAuthorizationCodeArgs {
  code: string;
  codeVerifier: string;
  redirectUri: string;
  config: OuraOAuthConfig;
  fetchImpl?: typeof fetch;
  nowMs?: () => number;
}

/**
 * Exchange an Oura authorization code for a token bundle. Standalone
 * (not on the per-user manager) because at callback time we don't yet
 * have a manager bound — we recover the userId from the auth-state
 * record, run this exchange, then persist via the user's token store.
 *
 * Throws on HTTP non-2xx or malformed payload. The caller (callback
 * route) converts to a 502 and never bubbles the underlying error
 * message, which can contain the code.
 *
 * `code_verifier` is included defensively (see `ouraPkce.ts` — Oura's
 * docs don't document PKCE support); Oura's own docs require
 * `client_secret` on this exchange regardless, which is why it runs
 * server-side exactly like WHOOP/Garmin.
 */
export async function exchangeAuthorizationCode(
  args: ExchangeAuthorizationCodeArgs,
): Promise<OuraTokens> {
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
  const res = await fetchImpl(OURA_TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  if (!res.ok) {
    throw new Error(`Oura code exchange failed: HTTP ${res.status}`);
  }
  const json = (await res.json()) as OuraTokenResponse;
  if (
    typeof json.access_token !== "string" ||
    typeof json.refresh_token !== "string" ||
    typeof json.expires_in !== "number" ||
    !Number.isFinite(json.expires_in)
  ) {
    throw new Error("Oura code exchange failed: malformed payload");
  }
  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token,
    expiresAt: now() + json.expires_in * 1000,
    scope: json.scope ?? null,
  };
}

export function createOuraTokenManager(
  opts: OuraTokenManagerOptions,
): OuraTokenManager {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const now = opts.nowMs ?? ((): number => Date.now());
  const skew = opts.refreshSkewMs ?? 60_000;

  // Singleflight — collapse concurrent refreshes for this manager into
  // one network call. Oura's refresh tokens are single-use, so two
  // concurrent refreshes would race and invalidate each other.
  let inflight: Promise<OuraTokens> | null = null;
  const defaultCoordinator: OuraRefreshCoordinator = (impl) => {
    if (inflight) return inflight;
    const p = impl().finally(() => {
      if (inflight === p) inflight = null;
    });
    inflight = p;
    return p;
  };
  const coordinate: OuraRefreshCoordinator =
    opts.refreshCoordinator ?? defaultCoordinator;

  async function refreshImpl(): Promise<OuraTokens> {
    const current = await opts.store.read();
    if (!current?.refreshToken) {
      throw new Error("Oura refresh failed: no refresh token stored");
    }
    const body = new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: current.refreshToken,
      client_id: opts.config.clientId,
      client_secret: opts.config.clientSecret,
    });
    const res = await fetchImpl(OURA_TOKEN_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });
    if (!res.ok) {
      throw new Error(`Oura refresh failed: HTTP ${res.status}`);
    }
    const json = (await res.json()) as OuraTokenResponse;
    if (
      typeof json.access_token !== "string" ||
      typeof json.expires_in !== "number" ||
      !Number.isFinite(json.expires_in)
    ) {
      throw new Error("Oura refresh failed: malformed payload");
    }
    const next: OuraTokens = {
      accessToken: json.access_token,
      // Oura refresh tokens are single-use and rotate on every refresh;
      // keep the previous one when the response omits a new one
      // (defensive — the documented contract always returns one).
      refreshToken: json.refresh_token ?? current.refreshToken,
      expiresAt: now() + json.expires_in * 1000,
      scope: json.scope ?? current.scope ?? null,
    };
    await opts.store.write(next);
    return next;
  }

  function refresh(): Promise<OuraTokens> {
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
