/**
 * Tests for the Strava authorize-URL builder + CSRF state primitive.
 * Faithful mirror of `ouraPkce.test.ts`, minus every PKCE assertion —
 * Strava's authorize/token contract has no PKCE surface (see
 * `stravaAuthorize.ts` for the verified source). Covers:
 *   - createOAuthState is url-safe
 *   - createOAuthState yields distinct values across calls (entropy)
 *   - buildStravaAuthorizeUrl encodes every required OAuth param using
 *     URL.searchParams (no string-concat injection risk), targets the
 *     Strava authorize endpoint, defaults to the least-privilege scope
 *   - scope override is honored
 *   - redirect_uri is percent-encoded, never string-concatenated
 *   - NEVER emits code_challenge / code_challenge_method (PKCE is
 *     genuinely inapplicable to Strava's confidential-client flow)
 */
import { describe, it, expect } from "vitest";
import {
  buildStravaAuthorizeUrl,
  createOAuthState,
  STRAVA_AUTHORIZE_ENDPOINT,
  STRAVA_DEFAULT_SCOPES,
} from "../stravaAuthorize";

describe("createOAuthState", () => {
  const URL_SAFE = /^[A-Za-z0-9_-]+$/u;

  it("is url-safe and 32 chars (24 bytes base64url -> 32)", () => {
    const s = createOAuthState();
    expect(s).toMatch(URL_SAFE);
    expect(s.length).toBe(32);
  });

  it("values diverge across calls (cheap entropy check)", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 50; i += 1) seen.add(createOAuthState());
    expect(seen.size).toBe(50);
  });
});

describe("STRAVA_DEFAULT_SCOPES", () => {
  it("is least-privilege activity:read — never activity:read_all or any profile:* scope", () => {
    expect(STRAVA_DEFAULT_SCOPES).toBe("activity:read");
    expect(STRAVA_DEFAULT_SCOPES).not.toContain("read_all");
    expect(STRAVA_DEFAULT_SCOPES).not.toContain("profile");
  });
});

describe("buildStravaAuthorizeUrl", () => {
  it("targets the Strava authorize endpoint with all required params", () => {
    const url = new URL(
      buildStravaAuthorizeUrl({
        clientId: "12345",
        redirectUri: "https://example.test/api/strava/oauth/callback",
        state: "STATE_OPAQUE",
      }),
    );
    expect(`${url.origin}${url.pathname}`).toBe(STRAVA_AUTHORIZE_ENDPOINT);
    expect(url.searchParams.get("client_id")).toBe("12345");
    expect(url.searchParams.get("redirect_uri")).toBe(
      "https://example.test/api/strava/oauth/callback",
    );
    expect(url.searchParams.get("response_type")).toBe("code");
    expect(url.searchParams.get("state")).toBe("STATE_OPAQUE");
    expect(url.searchParams.get("scope")).toBe(STRAVA_DEFAULT_SCOPES);
  });

  it("NEVER emits PKCE params — genuinely inapplicable to Strava's confidential-client flow", () => {
    const url = new URL(
      buildStravaAuthorizeUrl({
        clientId: "12345",
        redirectUri: "https://example.test/cb",
        state: "s",
      }),
    );
    expect(url.searchParams.has("code_challenge")).toBe(false);
    expect(url.searchParams.has("code_challenge_method")).toBe(false);
    expect(url.searchParams.has("code_verifier")).toBe(false);
  });

  it("honors a scope override", () => {
    const url = new URL(
      buildStravaAuthorizeUrl({
        clientId: "cid",
        redirectUri: "https://example.test/cb",
        state: "s",
        scope: "activity:read_all",
      }),
    );
    expect(url.searchParams.get("scope")).toBe("activity:read_all");
  });

  it("percent-encodes the redirect_uri (URLSearchParams, never string concat)", () => {
    const url = buildStravaAuthorizeUrl({
      clientId: "cid",
      redirectUri: "https://example.test/cb?foo=bar&baz=qux",
      state: "s",
    });
    // The literal '&' from the redirect_uri must not appear unescaped
    // in the final URL — that would split into a new query param.
    const queryAfterRedirect = url.split("redirect_uri=")[1] ?? "";
    expect(queryAfterRedirect).toMatch(
      /^https%3A%2F%2Fexample\.test%2Fcb%3Ffoo%3Dbar%26baz%3Dqux/u,
    );
  });
});
