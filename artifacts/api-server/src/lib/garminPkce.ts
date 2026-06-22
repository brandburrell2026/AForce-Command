/**
 * Pure PKCE primitives + Garmin authorize-URL builder.
 *
 * Faithful mirror of `whoopPkce.ts`. No I/O — Node `crypto` only — so
 * this module is trivially unit-tested without HTTP or DB.
 *
 * PKCE (RFC 7636): S256 only. `plain` is forbidden.
 *
 * NOTE ON ENDPOINTS: the constants below are the documented Garmin
 * Health API OAuth2 (PKCE) endpoints. They are overridable via the
 * authorize-URL builder's `authorizeEndpoint` arg so the exact values
 * can be confirmed against the official Garmin Developer Program portal
 * once credentials are provisioned, without a code change. The module
 * is DORMANT regardless — nothing calls it until GARMIN_* env vars are
 * configured.
 */

import { randomBytes, createHash } from "node:crypto";

export const GARMIN_AUTHORIZE_ENDPOINT =
  "https://connect.garmin.com/oauth2Confirm";

/**
 * Default scope set. Garmin's Health API OAuth2 flow does not require
 * granular scopes the way WHOOP does; default to empty and only emit a
 * `scope` param when a non-empty value is configured. Kept as a named
 * export to mirror the WHOOP surface and to allow an explicit override.
 */
export const GARMIN_DEFAULT_SCOPES = "";

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

export interface BuildGarminAuthorizeUrlArgs {
  clientId: string;
  redirectUri: string;
  state: string;
  codeChallenge: string;
  scope?: string;
  /** Override for the authorize endpoint (defaults to the documented
   *  Garmin Health API OAuth2 endpoint). */
  authorizeEndpoint?: string;
}

/**
 * Compose the Garmin authorize URL. Uses `URL` + `searchParams` so
 * every parameter is correctly percent-encoded — never string
 * concatenation. The `scope` param is omitted when empty.
 */
export function buildGarminAuthorizeUrl(
  args: BuildGarminAuthorizeUrlArgs,
): string {
  const u = new URL(args.authorizeEndpoint ?? GARMIN_AUTHORIZE_ENDPOINT);
  u.searchParams.set("response_type", "code");
  u.searchParams.set("client_id", args.clientId);
  u.searchParams.set("redirect_uri", args.redirectUri);
  const scope = args.scope ?? GARMIN_DEFAULT_SCOPES;
  if (scope) u.searchParams.set("scope", scope);
  u.searchParams.set("state", args.state);
  u.searchParams.set("code_challenge", args.codeChallenge);
  u.searchParams.set("code_challenge_method", "S256");
  return u.toString();
}
