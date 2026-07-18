/**
 * Pure PKCE primitive tests for the Oura authorize-URL builder.
 *
 * Faithful mirror of `whoopPkce.test.ts`. Covers:
 *   - createCodeVerifier returns a string in the RFC-7636 unreserved
 *     set, length 43 (32 random bytes -> 43 base64url chars)
 *   - createOAuthState is similarly url-safe
 *   - codeChallengeS256 matches the RFC-7636 Appendix B canonical
 *     test vector exactly (regression lock on the SHA-256 + base64url
 *     pipeline)
 *   - createCodeVerifier yields distinct values across calls (entropy)
 *   - buildOuraAuthorizeUrl encodes every required PKCE/OAuth param
 *     using URL.searchParams (no string-concat injection risk),
 *     uses S256, points at the Oura authorize endpoint
 */
import { describe, it, expect } from "vitest";
import {
  buildOuraAuthorizeUrl,
  codeChallengeS256,
  createCodeVerifier,
  createOAuthState,
  OURA_AUTHORIZE_ENDPOINT,
  OURA_DEFAULT_SCOPES,
} from "../ouraPkce";

describe("createCodeVerifier / createOAuthState", () => {
  const URL_SAFE = /^[A-Za-z0-9_-]+$/u;

  it("verifier is url-safe and 43 chars (32 bytes base64url -> 43)", () => {
    const v = createCodeVerifier();
    expect(v).toMatch(URL_SAFE);
    expect(v.length).toBe(43);
  });

  it("state is url-safe and 32 chars (24 bytes base64url -> 32)", () => {
    const s = createOAuthState();
    expect(s).toMatch(URL_SAFE);
    expect(s.length).toBe(32);
  });

  it("verifier values diverge across calls (cheap entropy check)", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 50; i += 1) seen.add(createCodeVerifier());
    expect(seen.size).toBe(50);
  });
});

describe("codeChallengeS256", () => {
  it("matches the RFC 7636 Appendix B canonical vector", () => {
    // RFC 7636 §B: verifier=dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk
    // expected challenge=E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM
    const verifier = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk";
    expect(codeChallengeS256(verifier)).toBe(
      "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM",
    );
  });
});

describe("buildOuraAuthorizeUrl", () => {
  it("targets the Oura authorize endpoint with all required params (S256)", () => {
    const url = new URL(
      buildOuraAuthorizeUrl({
        clientId: "cid_123",
        redirectUri: "https://example.test/api/oura/oauth/callback",
        state: "STATE_OPAQUE",
        codeChallenge: "CHALLENGE_OPAQUE",
      }),
    );
    expect(`${url.origin}${url.pathname}`).toBe(OURA_AUTHORIZE_ENDPOINT);
    expect(url.searchParams.get("response_type")).toBe("code");
    expect(url.searchParams.get("client_id")).toBe("cid_123");
    expect(url.searchParams.get("redirect_uri")).toBe(
      "https://example.test/api/oura/oauth/callback",
    );
    expect(url.searchParams.get("state")).toBe("STATE_OPAQUE");
    expect(url.searchParams.get("code_challenge")).toBe("CHALLENGE_OPAQUE");
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    expect(url.searchParams.get("scope")).toBe(OURA_DEFAULT_SCOPES);
  });

  it("honors a scope override", () => {
    const url = new URL(
      buildOuraAuthorizeUrl({
        clientId: "cid",
        redirectUri: "https://example.test/cb",
        state: "s",
        codeChallenge: "c",
        scope: "daily heartrate",
      }),
    );
    expect(url.searchParams.get("scope")).toBe("daily heartrate");
  });

  it("percent-encodes the redirect_uri (URLSearchParams, never string concat)", () => {
    const url = buildOuraAuthorizeUrl({
      clientId: "cid",
      redirectUri: "https://example.test/cb?foo=bar&baz=qux",
      state: "s",
      codeChallenge: "c",
    });
    // The literal '&' from the redirect_uri must not appear unescaped
    // in the final URL — that would split into a new query param.
    const queryAfterRedirect = url.split("redirect_uri=")[1] ?? "";
    expect(queryAfterRedirect).toMatch(
      /^https%3A%2F%2Fexample\.test%2Fcb%3Ffoo%3Dbar%26baz%3Dqux/u,
    );
  });
});
