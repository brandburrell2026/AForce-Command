/**
 * Pure PKCE primitives + Oura authorize-URL builder.
 *
 * Faithful mirror of `whoopPkce.ts` / `garminPkce.ts`. No I/O — Node
 * `crypto` only — so this module is trivially unit-tested without
 * HTTP or DB.
 *
 * PKCE (RFC 7636): S256 only. `plain` is forbidden.
 *
 * NOTE ON PKCE SUPPORT: Oura's official OAuth2 docs
 * (https://cloud.ouraring.com/docs/authentication, verified 2026-07)
 * document `response_type`, `client_id`, `redirect_uri`, `scope`, and
 * `state` for the authorize step, and do NOT document
 * `code_challenge` / `code_challenge_method`. Oura's token exchange
 * requires `client_secret` regardless (there is no public-client PKCE
 * substitute), so this server always does the exchange server-side —
 * matching the WHOOP/Garmin pattern exactly. We still MINT and SEND a
 * PKCE challenge on the authorize request and verifier on the
 * exchange, for defense-in-depth and codebase consistency (an
 * unrecognized query param is inert on a spec-compliant OAuth2
 * server); this is NOT a verified Oura security guarantee. The `state`
 * param (validated single-use server-side, see `ouraAuthStateStore.ts`)
 * is what actually provides CSRF protection for this integration.
 */

import { randomBytes, createHash } from "node:crypto";

export const OURA_AUTHORIZE_ENDPOINT = "https://cloud.ouraring.com/oauth/authorize";

/**
 * Default scope set. Verified against Oura's authentication docs
 * (https://cloud.ouraring.com/docs/authentication, 2026-07):
 *   - "personal"  — profile (gender, age, height, weight) — mirrors
 *     WHOOP's `read:profile` inclusion even though the snapshot
 *     doesn't consume it today.
 *   - "daily"     — daily summaries: readiness, sleep, activity
 *     (covers daily_readiness, daily_sleep, daily_activity; also
 *     requested for the detailed `/v2/usercollection/sleep` endpoint,
 *     which Oura's docs don't explicitly scope-map — "daily" is the
 *     closest documented bucket and is the assumption used here).
 *   - "heartrate" — time-series heart rate (Gen 3 rings).
 *   - "workout"   — auto-detected + manually entered workouts.
 */
export const OURA_DEFAULT_SCOPES = "personal daily heartrate workout";

export function base64UrlEncode(buf: Buffer): string {
  return buf
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/u, "");
}

export function createCodeVerifier(): string {
  // 32 random bytes -> 43 base64url chars; within the RFC's 43–128 range.
  return base64UrlEncode(randomBytes(32));
}

export function codeChallengeS256(verifier: string): string {
  return base64UrlEncode(createHash("sha256").update(verifier).digest());
}

export function createOAuthState(): string {
  return base64UrlEncode(randomBytes(24));
}

export interface BuildOuraAuthorizeUrlArgs {
  clientId: string;
  redirectUri: string;
  state: string;
  codeChallenge: string;
  scope?: string;
}

/**
 * Compose the Oura authorize URL. Uses `URL` + `searchParams` so every
 * parameter is correctly percent-encoded — never string concatenation.
 */
export function buildOuraAuthorizeUrl(args: BuildOuraAuthorizeUrlArgs): string {
  const u = new URL(OURA_AUTHORIZE_ENDPOINT);
  u.searchParams.set("response_type", "code");
  u.searchParams.set("client_id", args.clientId);
  u.searchParams.set("redirect_uri", args.redirectUri);
  u.searchParams.set("scope", args.scope ?? OURA_DEFAULT_SCOPES);
  u.searchParams.set("state", args.state);
  u.searchParams.set("code_challenge", args.codeChallenge);
  u.searchParams.set("code_challenge_method", "S256");
  return u.toString();
}
