/**
 * Server-side WHOOP OAuth2 token manager.
 *
 * Port of the mobile manager at
 * `artifacts/aforce-os/services/whoopAuth.ts`. Pure orchestration
 * around an injected `WhoopTokenStore` (which is per-user on the
 * server — see `lib/db/whoopTokenStore.ts`) plus the WHOOP token
 * endpoint. Identical surface to mobile so the two can stay in
 * lockstep if WHOOP changes its contract.
 *
 * Behavior:
 *   - `getValidAccessToken()` returns the cached access token when
 *     it has >`refreshSkewMs` (default 60s) of life left. Otherwise
 *     it refreshes synchronously, persists the new bundle, and
 *     returns the fresh access token. On refresh failure it returns
 *     `null` so callers (e.g. the biometrics fetch worker) can skip
 *     the user without throwing.
 *   - `refresh()` exposes the same refresh path but rethrows on
 *     failure for callers that need the failure mode.
 *   - `setTokens()` persists a freshly-exchanged bundle (used by
 *     the OAuth callback route once it lands).
 *   - `signOut()` clears the store.
 *   - `peek()` is read-through to the store for debug surfaces.
 *
 * Refresh contract (per WHOOP):
 *   `POST https://api.prod.whoop.com/oauth/oauth2/token`
 *   form body: grant_type=refresh_token, refresh_token, client_id,
 *   client_secret, scope=offline.
 *
 * Architecture lock: hidden-infra. No public route invokes this
 * module yet; the OAuth callback + biometrics fetch worker land in
 * follow-up PRs.
 */

import type { WhoopTokens, WhoopTokenStore } from "@workspace/db";

export const WHOOP_TOKEN_ENDPOINT =
  "https://api.prod.whoop.com/oauth/oauth2/token";

/** Wire shape returned by the WHOOP token endpoint. */
export interface WhoopTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type?: string;
  scope?: string;
}

export interface WhoopOAuthConfig {
  clientId: string;
  clientSecret: string;
}

export interface WhoopTokenManagerOptions {
  store: WhoopTokenStore;
  config: WhoopOAuthConfig;
  /** Override for tests. */
  fetchImpl?: typeof fetch;
  /** Override for tests; defaults to `Date.now`. */
  nowMs?: () => number;
  /** Refresh proactively when this many ms remain on the access token. Default 60_000. */
  refreshSkewMs?: number;
}

export interface WhoopTokenManager {
  /** Current valid access token, refreshing if needed. Null when no tokens stored or refresh failed. */
  getValidAccessToken(): Promise<string | null>;
  /** Force a refresh now. Throws on network / OAuth error. */
  refresh(): Promise<WhoopTokens>;
  /** Persist a fresh token bundle (e.g. after the initial OAuth code exchange). */
  setTokens(tokens: WhoopTokens): Promise<void>;
  /** Clear stored tokens (sign-out / revoke). */
  signOut(): Promise<void>;
  /** Inspect — never on the hot path, useful for /admin/whoop/peek. */
  peek(): Promise<WhoopTokens | null>;
}

/**
 * Read WHOOP OAuth config from env. Fails loudly with a clear
 * message so the OAuth callback route doesn't 500 with an opaque
 * "client_id missing" later. Hidden-infra friendly: the missing
 * vars don't block server boot, they only block managers that try
 * to refresh.
 */
export function getWhoopOAuthConfigFromEnv(): WhoopOAuthConfig {
  const clientId = process.env["WHOOP_CLIENT_ID"];
  const clientSecret = process.env["WHOOP_CLIENT_SECRET"];
  if (!clientId || !clientSecret) {
    throw new Error(
      "WHOOP OAuth config missing: set WHOOP_CLIENT_ID and WHOOP_CLIENT_SECRET",
    );
  }
  return { clientId, clientSecret };
}

export interface ExchangeAuthorizationCodeArgs {
  code: string;
  codeVerifier: string;
  redirectUri: string;
  config: WhoopOAuthConfig;
  fetchImpl?: typeof fetch;
  nowMs?: () => number;
}

/**
 * Exchange a WHOOP authorization code for a token bundle. Standalone
 * (not on the per-user manager) because at callback time we don't yet
 * have a manager bound — we recover the userId from the auth-state
 * record, run this exchange, then persist via the user's token store.
 *
 * Throws on:
 *   - HTTP non-2xx (WHOOP rejected the code or PKCE failed)
 *   - Malformed JSON payload (missing access_token / refresh_token /
 *     expires_in)
 * Caller (the callback route) converts to a 502 — never bubbles the
 * underlying error message, which can contain the code.
 */
export async function exchangeAuthorizationCode(
  args: ExchangeAuthorizationCodeArgs,
): Promise<WhoopTokens> {
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
  const res = await fetchImpl(WHOOP_TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  if (!res.ok) {
    throw new Error(`WHOOP code exchange failed: HTTP ${res.status}`);
  }
  const json = (await res.json()) as WhoopTokenResponse;
  if (
    typeof json.access_token !== "string" ||
    typeof json.refresh_token !== "string" ||
    typeof json.expires_in !== "number" ||
    !Number.isFinite(json.expires_in)
  ) {
    throw new Error("WHOOP code exchange failed: malformed payload");
  }
  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token,
    expiresAt: now() + json.expires_in * 1000,
    scope: json.scope ?? null,
  };
}

export function createWhoopTokenManager(
  opts: WhoopTokenManagerOptions,
): WhoopTokenManager {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const now = opts.nowMs ?? ((): number => Date.now());
  const skew = opts.refreshSkewMs ?? 60_000;

  // Singleflight: while a refresh is in-flight for this manager (which
  // is per-user), additional callers await the same promise instead of
  // each firing their own POST. WHOOP rotates refresh tokens, so two
  // concurrent refreshes would race — the first to land invalidates
  // the refresh token the second is still using, returning invalid_grant
  // for the loser. Singleflight collapses that into one network call;
  // every caller gets the same WhoopTokens (or the same rejection).
  // The promise is cleared on settle (resolve OR reject) so the next
  // call after a failure retries cleanly rather than caching the error.
  let inflight: Promise<WhoopTokens> | null = null;

  async function refreshImpl(): Promise<WhoopTokens> {
    const current = await opts.store.read();
    if (!current?.refreshToken) {
      throw new Error("WHOOP refresh failed: no refresh token stored");
    }
    const body = new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: current.refreshToken,
      client_id: opts.config.clientId,
      client_secret: opts.config.clientSecret,
      scope: "offline",
    });
    const res = await fetchImpl(WHOOP_TOKEN_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });
    if (!res.ok) {
      throw new Error(`WHOOP refresh failed: HTTP ${res.status}`);
    }
    const json = (await res.json()) as WhoopTokenResponse;
    if (
      typeof json.access_token !== "string" ||
      typeof json.expires_in !== "number" ||
      !Number.isFinite(json.expires_in)
    ) {
      throw new Error("WHOOP refresh failed: malformed payload");
    }
    const next: WhoopTokens = {
      accessToken: json.access_token,
      // WHOOP rotates refresh tokens; keep the previous one when the
      // response omits a new one (defensive — the contract today
      // always returns one).
      refreshToken: json.refresh_token ?? current.refreshToken,
      expiresAt: now() + json.expires_in * 1000,
      scope: json.scope ?? current.scope ?? null,
    };
    await opts.store.write(next);
    return next;
  }

  function refresh(): Promise<WhoopTokens> {
    if (inflight) return inflight;
    const p = refreshImpl().finally(() => {
      // Clear ONLY if we're still the owner — defensive in case
      // someone (e.g. setTokens) replaces inflight while ours is
      // still pending. Today nothing else writes inflight, but
      // pinning the owner makes the invariant explicit.
      if (inflight === p) inflight = null;
    });
    inflight = p;
    return p;
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
