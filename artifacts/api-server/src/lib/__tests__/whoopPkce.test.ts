/**
 * Pure PKCE primitive tests.
 *
 * Covers:
 *   - base64UrlEncode strips padding and replaces +/ with -_
 *   - createCodeVerifier returns a string in the RFC-7636 unreserved
 *     set, length 43 (32 random bytes -> 43 base64url chars)
 *   - createOAuthState is similarly url-safe
 *   - codeChallengeS256 matches the RFC-7636 Appendix B canonical
 *     test vector exactly (regression lock on the SHA-256 + base64url
 *     pipeline)
 *   - createCodeVerifier yields distinct values across calls (entropy)
 *   - buildWhoopAuthorizeUrl encodes every required PKCE/OAuth param
 *     using URL.searchParams (no string-concat injection risk),
 *     uses S256, points at the WHOOP authorize endpoint
 */
import { describe, it, expect } from "vitest";
import {
  base64UrlEncode,
  buildWhoopAuthorizeUrl,
  codeChallengeS256,
  createCodeVerifier,
  createOAuthState,
  WHOOP_AUTHORIZE_ENDPOINT,
  WHOOP_DEFAULT_SCOPES,
} from "../whoopPkce";

describe("base64UrlEncode", () => {
  it("strips padding and replaces +/ with -_", () => {
    // Buffer that exercises both '+' and '/' in standard base64.
    const input = Buffer.from([
      0xfb, 0xff, 0xbf, 0xfe, 0xff, 0x3f, 0xfa, 0xff, 0xff,
    ]);
    const enc = base64UrlEncode(input);
    expect(enc).not.toMatch(/[+/=]/u);
    expect(enc).toMatch(/^[A-Za-z0-9_-]+$/u);
  });
});

describe("createCodeVerifier / createOAuthState", () => {
  const URL_SAFE = /^[A-Za-z0-9_-]+$/u;

  it("verifier is url-safe and 43 chars (32 bytes base64url -> 43)", () => {
    const v = createCodeVerifier();
    expect(v).toMatch(URL_SAFE);
    expect(v.length).toBe(43);
  });

  it("state is url-safe and EXACTLY 8 chars (WHOOP requirement; 6 bytes base64url -> 8)", () => {
    // WHOOP rejects a longer state at the authorize step, so this length is a
    // hard contract, not an implementation detail — assert it every run.
    for (let i = 0; i < 50; i += 1) {
      const s = createOAuthState();
      expect(s).toMatch(URL_SAFE);
      expect(s.length).toBe(8);
    }
  });

  it("state values diverge across calls (48-bit entropy sanity)", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 200; i += 1) seen.add(createOAuthState());
    expect(seen.size).toBe(200);
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

describe("buildWhoopAuthorizeUrl", () => {
  it("targets the WHOOP authorize endpoint with all required params (S256)", () => {
    const url = new URL(
      buildWhoopAuthorizeUrl({
        clientId: "cid_123",
        redirectUri: "https://example.test/api/whoop/oauth/callback",
        state: "STATE_OPAQUE",
        codeChallenge: "CHALLENGE_OPAQUE",
      }),
    );
    expect(`${url.origin}${url.pathname}`).toBe(WHOOP_AUTHORIZE_ENDPOINT);
    expect(url.searchParams.get("response_type")).toBe("code");
    expect(url.searchParams.get("client_id")).toBe("cid_123");
    expect(url.searchParams.get("redirect_uri")).toBe(
      "https://example.test/api/whoop/oauth/callback",
    );
    expect(url.searchParams.get("state")).toBe("STATE_OPAQUE");
    expect(url.searchParams.get("code_challenge")).toBe("CHALLENGE_OPAQUE");
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    expect(url.searchParams.get("scope")).toBe(WHOOP_DEFAULT_SCOPES);
  });

  it("honors a scope override", () => {
    const url = new URL(
      buildWhoopAuthorizeUrl({
        clientId: "cid",
        redirectUri: "https://example.test/cb",
        state: "s",
        codeChallenge: "c",
        scope: "offline read:recovery",
      }),
    );
    expect(url.searchParams.get("scope")).toBe("offline read:recovery");
  });

  it("percent-encodes the redirect_uri (URLSearchParams, never string concat)", () => {
    const url = buildWhoopAuthorizeUrl({
      clientId: "cid",
      redirectUri: "https://example.test/cb?foo=bar&baz=qux",
      state: "s",
      codeChallenge: "c",
    });
    // The literal '&' from the redirect_uri must not appear unescaped
    // in the final URL — that would split into a new query param.
    const queryAfterRedirect = url.split("redirect_uri=")[1] ?? "";
    expect(queryAfterRedirect).toMatch(/^https%3A%2F%2Fexample\.test%2Fcb%3Ffoo%3Dbar%26baz%3Dqux/u);
  });
});
