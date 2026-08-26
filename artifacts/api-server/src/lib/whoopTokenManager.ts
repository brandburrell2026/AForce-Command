/**
 * Server-side WHOOP OAuth2 token manager.
 *
 * Thin wrapper over `providerKit/tokenManager.ts` — the authorization
 * grant, refresh grant, 60s skew, and sanitized-error behavior are all
 * shared implementation now (see that module for the full contract
 * doc). This file exists to keep WHOOP's public API — every exported
 * name, type, and default — byte-identical to what it was before the
 * extraction, so `routes/whoopOAuth.ts`, `whoopFetchWorker.ts`, and
 * every existing WHOOP test keep passing unchanged.
 *
 * Refresh contract (per WHOOP):
 *   `POST https://api.prod.whoop.com/oauth/oauth2/token`
 *   form body: grant_type=refresh_token, refresh_token, client_id,
 *   client_secret, scope=offline. WHOOP is the one provider on this
 *   kit whose refresh grant needs the extra `scope=offline` field —
 *   passed via `refreshExtraBody`.
 *
 * WHOOP-specific behavior the kit can't express, kept local to this
 * wrapper: `getValidAccessToken` logs a refresh failure through
 * `serializeError` (redacts JWT/Bearer/opaque-token-shaped substrings
 * from the message + stack before it ever reaches a log line — see
 * `./serializeError.ts`). `providerKit/tokenManager.ts`'s own built-in
 * failure log is a raw `{name, message}` with NO redaction, which is
 * unsafe to wire up for a token endpoint (an error message from a
 * misbehaving OAuth provider or a corrupt stored token could echo the
 * literal secret into the log stream). This wrapper therefore never
 * passes `log` into the kit's manager; instead it re-implements the
 * thin `getValidAccessToken` orchestration (read -> skew check ->
 * `refresh()` -> catch-and-log) atop the kit's `refresh()` — which
 * still carries the kit's singleflight/coordinator behavior — so the
 * only thing duplicated is the skew check, not the network/refresh
 * logic itself.
 *
 * Architecture lock: hidden-infra. No public route invokes this
 * module unless WHOOP_* env vars are configured (the OAuth router is
 * only mounted then).
 */

import type { Logger } from "pino";
import type { WhoopTokens, WhoopTokenStore } from "@workspace/db";
import type { WhoopRefreshCoordinator } from "./whoopRefreshRegistry";
import { serializeError } from "./serializeError";
import {
  createProviderTokenManager,
  exchangeProviderAuthorizationCode,
  getProviderOAuthConfigFromEnv,
  type ProviderTokenManager,
  type ProviderTokenResponse,
} from "./providerKit/tokenManager";

export const WHOOP_TOKEN_ENDPOINT =
  "https://api.prod.whoop.com/oauth/oauth2/token";

/** Wire shape returned by the WHOOP token endpoint. */
export type WhoopTokenResponse = ProviderTokenResponse;

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
  /**
   * Optional refresh coordinator. When provided, the manager delegates
   * refresh-singleflight to this function instead of its own
   * per-manager `inflight` slot. The fetch worker passes a coordinator
   * bound to a process-level registry so two manager INSTANCES for the
   * same user (e.g. two concurrent `runWhoopFetchOnce` calls) still
   * collapse to one WHOOP POST. Default: per-manager singleflight,
   * which is sufficient when only one manager exists per user.
   */
  refreshCoordinator?: WhoopRefreshCoordinator;
  /**
   * Optional logger. When provided, `getValidAccessToken` logs the otherwise
   * silently-swallowed refresh failure (undecryptable refresh token, WHOOP 401,
   * etc.) instead of returning null with no trace.
   */
  log?: Pick<Logger, "error">;
  /**
   * Refresh-outcome observers (WHOOP sweep redesign, 2026-08-19). Called
   * fire-and-forget: a throwing observer is swallowed so bookkeeping can
   * never break the token path it watches. `onRefreshSuccess` also fires on
   * `setTokens` (re-auth), which the founder ratified as clearing failure
   * state.
   */
  onRefreshSuccess?: () => void | Promise<void>;
  onRefreshFailure?: () => void | Promise<void>;
}

export type WhoopTokenManager = ProviderTokenManager;

/**
 * Read WHOOP OAuth config from env. Fails loudly with a clear
 * message so the OAuth callback route doesn't 500 with an opaque
 * "client_id missing" later. Hidden-infra friendly: the missing
 * vars don't block server boot, they only block managers that try
 * to refresh.
 */
export function getWhoopOAuthConfigFromEnv(): WhoopOAuthConfig {
  return getProviderOAuthConfigFromEnv({
    provider: "WHOOP",
    clientIdVar: "WHOOP_CLIENT_ID",
    clientSecretVar: "WHOOP_CLIENT_SECRET",
  });
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
  return exchangeProviderAuthorizationCode({
    provider: "WHOOP",
    tokenEndpoint: WHOOP_TOKEN_ENDPOINT,
    code: args.code,
    codeVerifier: args.codeVerifier,
    redirectUri: args.redirectUri,
    config: args.config,
    fetchImpl: args.fetchImpl,
    nowMs: args.nowMs,
  });
}

/** Fire-and-forget observer call — bookkeeping must never break the path. */
function notify(fn: (() => void | Promise<void>) | undefined): void {
  if (!fn) return;
  try {
    void Promise.resolve(fn()).catch(() => {});
  } catch {
    /* observer threw synchronously — ignored by contract */
  }
}

export function createWhoopTokenManager(
  opts: WhoopTokenManagerOptions,
): WhoopTokenManager {
  const now = opts.nowMs ?? ((): number => Date.now());
  const skew = opts.refreshSkewMs ?? 60_000;

  // Deliberately NOT passed to the kit — see the module doc's
  // "WHOOP-specific behavior" note. The kit's own failure log has no
  // secret redaction; this wrapper does its own catch-and-log below
  // using `serializeError`, so `inner`'s built-in log path (which only
  // fires from ITS `getValidAccessToken`, never called here) is simply
  // unused.
  const inner = createProviderTokenManager({
    provider: "WHOOP",
    tokenEndpoint: WHOOP_TOKEN_ENDPOINT,
    store: opts.store,
    config: opts.config,
    // WHOOP's refresh grant requires `scope=offline`.
    refreshExtraBody: { scope: "offline" },
    fetchImpl: opts.fetchImpl,
    nowMs: opts.nowMs,
    refreshSkewMs: opts.refreshSkewMs,
    refreshCoordinator: opts.refreshCoordinator,
  });

  return {
    async getValidAccessToken() {
      const current = await opts.store.read();
      if (!current) return null;
      if (current.expiresAt - now() > skew) return current.accessToken;
      try {
        const next = await inner.refresh();
        notify(opts.onRefreshSuccess);
        return next.accessToken;
      } catch (err) {
        notify(opts.onRefreshFailure);
        // Previously swallowed silently. Surface the real cause (undecryptable
        // refresh token after a key rotation, WHOOP rejecting a stale refresh
        // token, network, …) — redacted so no token leaks — then keep the
        // null-on-failure contract so the sweep moves on.
        opts.log?.error(
          { err: serializeError(err) },
          "whoopTokenManager:getValidAccessToken refresh failed",
        );
        return null;
      }
    },
    refresh: async () => {
      try {
        const next = await inner.refresh();
        notify(opts.onRefreshSuccess);
        return next;
      } catch (err) {
        notify(opts.onRefreshFailure);
        throw err;
      }
    },
    setTokens: async (tokens) => {
      const out = await inner.setTokens(tokens);
      // Re-auth stores fresh tokens — founder-ratified reset point.
      notify(opts.onRefreshSuccess);
      return out;
    },
    signOut: () => inner.signOut(),
    peek: () => inner.peek(),
  };
}
