/**
 * Strava OAuth2 authorize-URL builder + CSRF state primitive.
 *
 * Unlike `whoopPkce.ts` / `garminPkce.ts` / `ouraPkce.ts`, this module
 * does NOT implement PKCE. Strava is verified to be a CONFIDENTIAL
 * OAuth2 client: the code->token exchange requires `client_secret`
 * (https://developers.strava.com/docs/authentication, verified
 * 2026-07 — "The secret is used for authentication and should never
 * be shared"), and Strava's authorize/token docs never mention
 * `code_challenge` / `code_challenge_method` / `code_verifier`
 * anywhere. Sending an undocumented PKCE param this API doesn't
 * recognize would be dead weight, not a security control — so this
 * module deliberately has no PKCE surface. No I/O — Node `crypto`
 * only — so this module is trivially unit-tested without HTTP or DB.
 *
 * CSRF defense: the single-use `state` param (minted here, validated
 * single-use server-side — see `stravaAuthStateStore.ts`) is the ONLY
 * defense against a forged callback. This is the same role WHOOP/
 * Garmin/Oura's `state` plays; it just has no PKCE companion here.
 *
 * Authorize endpoint + params — verified against Strava's official
 * OAuth docs (https://developers.strava.com/docs/authentication,
 * 2026-07):
 *   GET https://www.strava.com/oauth/authorize
 *     ?client_id=<id>&redirect_uri=<uri>&response_type=code
 *     &scope=<scope>&state=<state>
 *   `approval_prompt` (force|auto) is documented but optional; this
 *   builder omits it (defaults to Strava's standard behavior — the
 *   consent screen is skipped only if the user already granted the
 *   exact scope requested).
 */

import { randomBytes } from "node:crypto";

export const STRAVA_AUTHORIZE_ENDPOINT = "https://www.strava.com/oauth/authorize";

/**
 * Default scope — least-privilege for exactly the data
 * `stravaSnapshot.ts` reads. Verified against Strava's OAuth docs
 * (https://developers.strava.com/docs/authentication, 2026-07), which
 * enumerate the full scope catalog: `read`, `read_all`,
 * `profile:read_all`, `profile:write`, `activity:read`,
 * `activity:read_all`, `activity:write`.
 *
 * Deliberately uses `activity:read` (public activities only) rather
 * than `activity:read_all` (which additionally exposes the athlete's
 * PRIVATE activities): the snapshot never needs private-activity data,
 * so requesting it would over-collect against the minimum-collection
 * rule (same rationale Oura's PKCE module documents for dropping its
 * `personal` scope). Also deliberately drops every `profile:*` scope —
 * this integration never reads athlete profile data.
 */
export const STRAVA_DEFAULT_SCOPES = "activity:read";

function base64UrlEncode(buf: Buffer): string {
  return buf
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/u, "");
}

export function createOAuthState(): string {
  return base64UrlEncode(randomBytes(24));
}

export interface BuildStravaAuthorizeUrlArgs {
  clientId: string;
  redirectUri: string;
  state: string;
  scope?: string;
}

/**
 * Compose the Strava authorize URL. Uses `URL` + `searchParams` so
 * every parameter is correctly percent-encoded — never string
 * concatenation.
 */
export function buildStravaAuthorizeUrl(args: BuildStravaAuthorizeUrlArgs): string {
  const u = new URL(STRAVA_AUTHORIZE_ENDPOINT);
  u.searchParams.set("client_id", args.clientId);
  u.searchParams.set("redirect_uri", args.redirectUri);
  u.searchParams.set("response_type", "code");
  u.searchParams.set("scope", args.scope ?? STRAVA_DEFAULT_SCOPES);
  u.searchParams.set("state", args.state);
  return u.toString();
}
