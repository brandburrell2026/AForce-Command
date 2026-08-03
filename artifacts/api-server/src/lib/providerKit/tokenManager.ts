/**
 * providerKit — server-side OAuth2 token manager, parameterized by
 * provider.
 *
 * Pure extraction from `whoopTokenManager.ts` (the pattern) generalized
 * so `ouraTokenManager.ts` can become a thin wrapper. WHOOP's file is
 * frozen (production) and is NOT rewritten onto this — only Oura is
 * migrated in this lane.
 *
 * Behavior (identical across every provider migrated onto this kit):
 *   - `getValidAccessToken()` returns the cached access token when it
 *     has >`refreshSkewMs` (default 60s) of life left. Otherwise it
 *     refreshes synchronously, persists the new bundle, and returns
 *     the fresh access token. On refresh failure it returns `null` so
 *     callers (e.g. the biometrics fetch worker) can skip the user
 *     without throwing.
 *   - `refresh()` exposes the same refresh path but rethrows on
 *     failure for callers that need the failure mode.
 *   - `setTokens()` persists a freshly-exchanged bundle.
 *   - `signOut()` clears the store.
 *   - `peek()` is read-through to the store for debug surfaces.
 *
 * Parameterization points (the only places providers legitimately
 * differ):
 *   - `tokenEndpoint` — provider's OAuth2 token URL.
 *   - `refreshExtraBody` — static fields merged into the REFRESH grant
 *     body only (e.g. WHOOP's `scope=offline`; Oura's refresh grant
 *     has no such field).
 *   - `provider` — used only to compose error message text, so
 *     `${provider} refresh failed: ...` matches each provider's
 *     existing (byte-for-byte) error strings.
 *
 * Refresh-token rotation: every provider migrated onto this kit keeps
 * the PRIOR refresh token when the response omits a new one
 * (defensive — every documented contract today always returns one).
 */

import type { Logger } from "pino";

/** Provider-agnostic token bundle. Same shape as WhoopTokens /
 *  OuraTokens / GarminTokens / StravaTokens. `expiresAt` is epoch ms. */
export interface ProviderTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  scope?: string | null;
}

/** Per-user storage adapter. Structurally identical to
 *  WhoopTokenStore / OuraTokenStore — any of those satisfies this. */
export interface ProviderTokenStore {
  read(): Promise<ProviderTokens | null>;
  write(t: ProviderTokens): Promise<void>;
  clear(): Promise<void>;
}

/** Wire shape returned by every provider's token endpoint (OAuth2
 *  standard token response). */
export interface ProviderTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type?: string;
  scope?: string;
}

export interface ProviderOAuthConfig {
  clientId: string;
  clientSecret: string;
}

/**
 * A coordinator wraps a single-shot refresh function and decides
 * whether to invoke it or to attach to an in-flight call. Structurally
 * identical to `WhoopRefreshCoordinator` / `OuraRefreshCoordinator`.
 */
export type ProviderRefreshCoordinator = (
  impl: () => Promise<ProviderTokens>,
) => Promise<ProviderTokens>;

export interface ProviderTokenManagerOptions {
  /** Provider name, used only to compose error message text
   *  (`"${provider} refresh failed: ..."`) matching each provider's
   *  existing strings exactly. */
  provider: string;
  tokenEndpoint: string;
  store: ProviderTokenStore;
  config: ProviderOAuthConfig;
  /** Extra static form fields merged into the REFRESH grant body only
   *  (e.g. `{ scope: "offline" }` for WHOOP). Omitted -> no extra
   *  fields, matching Oura's refresh contract. */
  refreshExtraBody?: Record<string, string>;
  /** Override for tests. */
  fetchImpl?: typeof fetch;
  /** Override for tests; defaults to `Date.now`. */
  nowMs?: () => number;
  /** Refresh proactively when this many ms remain on the access
   *  token. Default 60_000. */
  refreshSkewMs?: number;
  /** Optional process-level refresh coordinator (singleflight across
   *  manager instances for the same user). Default: per-manager. */
  refreshCoordinator?: ProviderRefreshCoordinator;
  /** Optional logger. When provided, `getValidAccessToken` logs the
   *  otherwise silently-swallowed refresh failure instead of
   *  returning null with no trace. */
  log?: Pick<Logger, "error">;
}

export interface ProviderTokenManager {
  /** Current valid access token, refreshing if needed. Null when no
   *  tokens stored or refresh failed. */
  getValidAccessToken(): Promise<string | null>;
  /** Force a refresh now. Throws on network / OAuth error. */
  refresh(): Promise<ProviderTokens>;
  /** Persist a fresh token bundle (e.g. after the initial OAuth code
   *  exchange). */
  setTokens(tokens: ProviderTokens): Promise<void>;
  /** Clear stored tokens (sign-out / revoke). */
  signOut(): Promise<void>;
  /** Inspect — never on the hot path, useful for debug/admin surfaces. */
  peek(): Promise<ProviderTokens | null>;
}

/**
 * Read a provider's OAuth config from env. Fails loudly with a clear
 * message so an OAuth callback route doesn't 500 with an opaque
 * "client_id missing" later. Hidden-infra friendly: the missing vars
 * don't block server boot, they only block managers that try to
 * refresh (and, for providers whose router is gated on the same vars,
 * the router simply isn't mounted).
 */
export function getProviderOAuthConfigFromEnv(opts: {
  provider: string;
  clientIdVar: string;
  clientSecretVar: string;
  env?: Record<string, string | undefined>;
}): ProviderOAuthConfig {
  const env = opts.env ?? process.env;
  const clientId = env[opts.clientIdVar];
  const clientSecret = env[opts.clientSecretVar];
  if (!clientId || !clientSecret) {
    throw new Error(
      `${opts.provider} OAuth config missing: set ${opts.clientIdVar} and ${opts.clientSecretVar}`,
    );
  }
  return { clientId, clientSecret };
}

export interface ExchangeProviderAuthorizationCodeArgs {
  /** Used only to compose error message text — see the module doc. */
  provider: string;
  tokenEndpoint: string;
  code: string;
  codeVerifier: string;
  redirectUri: string;
  config: ProviderOAuthConfig;
  fetchImpl?: typeof fetch;
  nowMs?: () => number;
}

/**
 * Exchange a provider's authorization code for a token bundle.
 * Standalone (not on the per-user manager) because at callback time
 * there is no manager bound yet — the caller recovers the userId from
 * the auth-state record, runs this exchange, then persists via the
 * user's token store.
 *
 * Throws on:
 *   - HTTP non-2xx (provider rejected the code or PKCE failed)
 *   - Malformed JSON payload (missing access_token / refresh_token /
 *     expires_in)
 * Callers (the OAuth callback route) convert this to a 502 and never
 * bubble the underlying error message, which can contain the code.
 */
export async function exchangeProviderAuthorizationCode(
  args: ExchangeProviderAuthorizationCodeArgs,
): Promise<ProviderTokens> {
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
  const res = await fetchImpl(args.tokenEndpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  if (!res.ok) {
    throw new Error(`${args.provider} code exchange failed: HTTP ${res.status}`);
  }
  const json = (await res.json()) as ProviderTokenResponse;
  if (
    typeof json.access_token !== "string" ||
    typeof json.refresh_token !== "string" ||
    typeof json.expires_in !== "number" ||
    !Number.isFinite(json.expires_in)
  ) {
    throw new Error(`${args.provider} code exchange failed: malformed payload`);
  }
  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token,
    expiresAt: now() + json.expires_in * 1000,
    scope: json.scope ?? null,
  };
}

export function createProviderTokenManager(
  opts: ProviderTokenManagerOptions,
): ProviderTokenManager {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const now = opts.nowMs ?? ((): number => Date.now());
  const skew = opts.refreshSkewMs ?? 60_000;
  const provider = opts.provider;

  // Singleflight: while a refresh is in-flight for this manager (which
  // is per-user), additional callers await the same promise instead of
  // each firing their own POST. Providers rotate refresh tokens, so
  // two concurrent refreshes would race — the first to land invalidates
  // the refresh token the second is still using, returning invalid_grant
  // for the loser. Singleflight collapses that into one network call;
  // every caller gets the same ProviderTokens (or the same rejection).
  // The promise is cleared on settle (resolve OR reject) so the next
  // call after a failure retries cleanly rather than caching the error.
  //
  // Scope: when `opts.refreshCoordinator` is provided, the manager
  // delegates singleflight to that function — which can dedupe across
  // multiple manager instances (process-level, keyed by userId). When
  // no coordinator is passed, the per-manager `inflight` slot below is
  // used; this is sufficient for any caller that only ever holds one
  // manager per user.
  let inflight: Promise<ProviderTokens> | null = null;
  const defaultCoordinator: ProviderRefreshCoordinator = (impl) => {
    if (inflight) return inflight;
    const p = impl().finally(() => {
      // Owner-check — only the original creator clears its slot.
      if (inflight === p) inflight = null;
    });
    inflight = p;
    return p;
  };
  const coordinate: ProviderRefreshCoordinator =
    opts.refreshCoordinator ?? defaultCoordinator;

  async function refreshImpl(): Promise<ProviderTokens> {
    const current = await opts.store.read();
    if (!current?.refreshToken) {
      throw new Error(`${provider} refresh failed: no refresh token stored`);
    }
    const body = new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: current.refreshToken,
      client_id: opts.config.clientId,
      client_secret: opts.config.clientSecret,
      ...(opts.refreshExtraBody ?? {}),
    });
    const res = await fetchImpl(opts.tokenEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });
    if (!res.ok) {
      throw new Error(`${provider} refresh failed: HTTP ${res.status}`);
    }
    const json = (await res.json()) as ProviderTokenResponse;
    if (
      typeof json.access_token !== "string" ||
      typeof json.expires_in !== "number" ||
      !Number.isFinite(json.expires_in)
    ) {
      throw new Error(`${provider} refresh failed: malformed payload`);
    }
    const next: ProviderTokens = {
      accessToken: json.access_token,
      // Providers rotate refresh tokens; keep the previous one when
      // the response omits a new one (defensive — the contract today
      // always returns one).
      refreshToken: json.refresh_token ?? current.refreshToken,
      expiresAt: now() + json.expires_in * 1000,
      scope: json.scope ?? current.scope ?? null,
    };
    await opts.store.write(next);
    return next;
  }

  function refresh(): Promise<ProviderTokens> {
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
      } catch (err) {
        // Surface the real cause (redacted — no token leak) instead of
        // silently swallowing it, then keep the null-on-failure
        // contract so the caller (e.g. a fetch sweep) moves on.
        opts.log?.error(
          { err: err instanceof Error ? { name: err.name, message: err.message } : err },
          `${provider.toLowerCase()}TokenManager:getValidAccessToken refresh failed`,
        );
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
