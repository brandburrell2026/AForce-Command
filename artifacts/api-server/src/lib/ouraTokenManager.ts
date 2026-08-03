/**
 * Server-side Oura Ring OAuth2 token manager.
 *
 * Thin wrapper over `providerKit/tokenManager.ts` — the authorization
 * grant, refresh grant, 60s skew, singleflight, and sanitized-error
 * behavior are all shared implementation now (see that module for the
 * full contract doc). This file exists to keep Oura's public API —
 * every exported name, type, and default — byte-identical to what it
 * was before the extraction, so `routes/ouraOAuth.ts`, `ouraFetchWorker.ts`,
 * and every existing Oura test keep passing unchanged.
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
 *   Authorization Code grant, not scope-gated) — so this wrapper
 *   passes no `refreshExtraBody` to the kit.
 *
 * Architecture lock: hidden-infra. No public route invokes this
 * module unless OURA_* env vars are configured (the OAuth router is
 * only mounted then).
 */

import type { OuraTokens, OuraTokenStore } from "@workspace/db";
import type { OuraRefreshCoordinator } from "./ouraRefreshRegistry";
import {
  createProviderTokenManager,
  exchangeProviderAuthorizationCode,
  getProviderOAuthConfigFromEnv,
  type ProviderTokenManager,
  type ProviderTokenResponse,
} from "./providerKit/tokenManager";

export const OURA_TOKEN_ENDPOINT = "https://api.ouraring.com/oauth/token";

/** Wire shape returned by the Oura token endpoint. */
export type OuraTokenResponse = ProviderTokenResponse;

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

export type OuraTokenManager = ProviderTokenManager;

/**
 * Read Oura OAuth config from env. Fails loudly with a clear message
 * so the OAuth callback route doesn't 500 opaquely. Hidden-infra
 * friendly: the missing vars don't block server boot — they only
 * block managers that try to refresh, and the router isn't mounted
 * without them anyway.
 */
export function getOuraOAuthConfigFromEnv(): OuraOAuthConfig {
  return getProviderOAuthConfigFromEnv({
    provider: "Oura",
    clientIdVar: "OURA_CLIENT_ID",
    clientSecretVar: "OURA_CLIENT_SECRET",
  });
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
  return exchangeProviderAuthorizationCode({
    provider: "Oura",
    tokenEndpoint: OURA_TOKEN_ENDPOINT,
    code: args.code,
    codeVerifier: args.codeVerifier,
    redirectUri: args.redirectUri,
    config: args.config,
    fetchImpl: args.fetchImpl,
    nowMs: args.nowMs,
  });
}

export function createOuraTokenManager(
  opts: OuraTokenManagerOptions,
): OuraTokenManager {
  return createProviderTokenManager({
    provider: "Oura",
    tokenEndpoint: OURA_TOKEN_ENDPOINT,
    store: opts.store,
    config: opts.config,
    // Oura's refresh grant takes no extra fields (no `scope=offline`
    // like WHOOP) — omitted.
    fetchImpl: opts.fetchImpl,
    nowMs: opts.nowMs,
    refreshSkewMs: opts.refreshSkewMs,
    refreshCoordinator: opts.refreshCoordinator,
  });
}
