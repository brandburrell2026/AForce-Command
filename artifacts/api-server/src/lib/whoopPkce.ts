/**
 * Pure PKCE primitives + WHOOP authorize-URL builder.
 *
 * No I/O — Node `crypto` only — so this module is trivially
 * unit-tested without HTTP or DB.
 *
 * PKCE (RFC 7636) summary:
 *   - code_verifier: 43–128 chars from the unreserved set
 *     [A-Z a-z 0-9 - . _ ~]. We generate 32 random bytes and
 *     base64url-encode -> 43 chars (max-entropy, well under the cap).
 *   - code_challenge (S256): base64url(SHA-256(verifier)).
 *   - state: CSRF token bound to the user's session start. WHOOP requires
 *     the state to be EXACTLY 8 characters when self-generated (a longer
 *     token silently fails the authorize step), so we use
 *     base64url(6 random bytes) -> 8 chars (48 bits; single-use + short-lived
 *     + server-stored, so 48 bits of entropy is sufficient here). See
 *     https://developer.whoop.com/docs/developing/oauth/
 *
 * Why S256-only: WHOOP supports it; `plain` defeats the point of
 * PKCE and is forbidden by anyone who's taken a second look at the
 * threat model.
 */

import { randomBytes, createHash } from "node:crypto";

export const WHOOP_AUTHORIZE_ENDPOINT =
  "https://api.prod.whoop.com/oauth/oauth2/auth";

/**
 * Default scope set — the WHOOP developer app's authorized read scopes plus
 * `offline` (required to receive a refresh token; without it recovery sync
 * breaks on token expiry). `read:workout` is included so training-load reads
 * are authorized alongside recovery/cycles/sleep.
 */
export const WHOOP_DEFAULT_SCOPES =
  "offline read:recovery read:cycles read:sleep read:workout read:profile";

export function base64UrlEncode(buf: Buffer): string {
  return buf
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/u, "");
}

export function createCodeVerifier(): string {
  // 32 random bytes -> 43 base64url chars; well within the RFC's
  // 43–128 range.
  return base64UrlEncode(randomBytes(32));
}

export function codeChallengeS256(verifier: string): string {
  return base64UrlEncode(createHash("sha256").update(verifier).digest());
}

export function createOAuthState(): string {
  // WHOOP requires the `state` to be exactly 8 characters. 6 random bytes
  // base64url-encode to exactly 8 chars (no padding), so this is always 8.
  return base64UrlEncode(randomBytes(6));
}

export interface BuildAuthorizeUrlArgs {
  clientId: string;
  redirectUri: string;
  state: string;
  codeChallenge: string;
  scope?: string;
}

/**
 * Compose the WHOOP authorize URL. Uses `URL` + `searchParams` so
 * every parameter is correctly percent-encoded — never string
 * concatenation, which has bitten more than one OAuth integration.
 */
export function buildWhoopAuthorizeUrl(args: BuildAuthorizeUrlArgs): string {
  const u = new URL(WHOOP_AUTHORIZE_ENDPOINT);
  u.searchParams.set("response_type", "code");
  u.searchParams.set("client_id", args.clientId);
  u.searchParams.set("redirect_uri", args.redirectUri);
  u.searchParams.set("scope", args.scope ?? WHOOP_DEFAULT_SCOPES);
  u.searchParams.set("state", args.state);
  u.searchParams.set("code_challenge", args.codeChallenge);
  u.searchParams.set("code_challenge_method", "S256");
  return u.toString();
}
