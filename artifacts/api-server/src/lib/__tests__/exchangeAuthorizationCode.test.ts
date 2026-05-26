/**
 * Tests for the standalone WHOOP `exchangeAuthorizationCode` helper.
 *
 * Covers:
 *   - hits the WHOOP token endpoint with the EXACT form body the
 *     OAuth2 + PKCE spec requires (grant_type, code, redirect_uri,
 *     client_id, client_secret, code_verifier) — every key/value
 *     pinned, so a contract regression is caught immediately
 *   - happy path: maps wire payload onto WhoopTokens, stamps
 *     expiresAt = now() + expires_in*1000, preserves scope (null when
 *     absent)
 *   - non-2xx -> throws "HTTP <status>" (no body interpolation —
 *     bodies can contain the code)
 *   - malformed payload (missing access_token / refresh_token /
 *     expires_in / non-finite expires_in) -> throws
 *     "malformed payload"
 */
import { describe, it, expect } from "vitest";
import {
  exchangeAuthorizationCode,
  WHOOP_TOKEN_ENDPOINT,
} from "../whoopTokenManager";

interface CapturedCall {
  url: string;
  method?: string;
  body?: string;
  contentType?: string;
}

function captureFetch(response: Response): {
  fn: typeof fetch;
  calls: CapturedCall[];
} {
  const calls: CapturedCall[] = [];
  const fn: typeof fetch = (async (url, init) => {
    calls.push({
      url: String(url),
      method: (init as { method?: string })?.method,
      body: (init as { body?: string })?.body,
      contentType:
        (init as { headers?: Record<string, string> })?.headers?.[
          "Content-Type"
        ] ?? undefined,
    });
    return response;
  }) as unknown as typeof fetch;
  return { fn, calls };
}

const CONFIG = { clientId: "cid_X", clientSecret: "secret_Y" };
const REDIRECT_URI = "https://example.test/api/whoop/oauth/callback";

describe("exchangeAuthorizationCode", () => {
  it("hits the WHOOP token endpoint with the exact form body the spec requires", async () => {
    const { fn, calls } = captureFetch(
      new Response(
        JSON.stringify({
          access_token: "AT",
          refresh_token: "RT",
          expires_in: 3600,
          scope: "offline read:recovery",
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );
    await exchangeAuthorizationCode({
      code: "CODE_OPAQUE",
      codeVerifier: "VERIFIER_OPAQUE",
      redirectUri: REDIRECT_URI,
      config: CONFIG,
      fetchImpl: fn,
      nowMs: () => 1_700_000_000_000,
    });
    expect(calls).toHaveLength(1);
    expect(calls[0]!.url).toBe(WHOOP_TOKEN_ENDPOINT);
    expect(calls[0]!.method).toBe("POST");
    expect(calls[0]!.contentType).toBe("application/x-www-form-urlencoded");
    const form = new URLSearchParams(calls[0]!.body ?? "");
    expect(form.get("grant_type")).toBe("authorization_code");
    expect(form.get("code")).toBe("CODE_OPAQUE");
    expect(form.get("redirect_uri")).toBe(REDIRECT_URI);
    expect(form.get("client_id")).toBe("cid_X");
    expect(form.get("client_secret")).toBe("secret_Y");
    expect(form.get("code_verifier")).toBe("VERIFIER_OPAQUE");
    // Strictly the six fields above — nothing extra.
    expect(Array.from(form.keys()).sort()).toEqual([
      "client_id",
      "client_secret",
      "code",
      "code_verifier",
      "grant_type",
      "redirect_uri",
    ]);
  });

  it("happy path: maps the payload onto WhoopTokens with expiresAt = now + expires_in*1000", async () => {
    const { fn } = captureFetch(
      new Response(
        JSON.stringify({
          access_token: "AT",
          refresh_token: "RT",
          expires_in: 3600,
          scope: "offline read:recovery",
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );
    const tokens = await exchangeAuthorizationCode({
      code: "C",
      codeVerifier: "V",
      redirectUri: REDIRECT_URI,
      config: CONFIG,
      fetchImpl: fn,
      nowMs: () => 1_700_000_000_000,
    });
    expect(tokens).toEqual({
      accessToken: "AT",
      refreshToken: "RT",
      expiresAt: 1_700_000_000_000 + 3_600_000,
      scope: "offline read:recovery",
    });
  });

  it("preserves scope=null when WHOOP omits it", async () => {
    const { fn } = captureFetch(
      new Response(
        JSON.stringify({
          access_token: "AT",
          refresh_token: "RT",
          expires_in: 60,
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );
    const t = await exchangeAuthorizationCode({
      code: "C",
      codeVerifier: "V",
      redirectUri: REDIRECT_URI,
      config: CONFIG,
      fetchImpl: fn,
    });
    expect(t.scope).toBeNull();
  });

  it("non-2xx -> throws 'HTTP <status>' (no body interpolation — body could contain the code)", async () => {
    const { fn } = captureFetch(
      new Response("invalid_grant", { status: 400 }),
    );
    await expect(
      exchangeAuthorizationCode({
        code: "BAD",
        codeVerifier: "V",
        redirectUri: REDIRECT_URI,
        config: CONFIG,
        fetchImpl: fn,
      }),
    ).rejects.toThrow(/HTTP 400/);
  });

  it.each([
    { payload: { refresh_token: "RT", expires_in: 60 }, label: "no access_token" },
    { payload: { access_token: "AT", expires_in: 60 }, label: "no refresh_token" },
    { payload: { access_token: "AT", refresh_token: "RT" }, label: "no expires_in" },
    {
      payload: {
        access_token: "AT",
        refresh_token: "RT",
        expires_in: Number.NaN,
      },
      label: "non-finite expires_in",
    },
  ])("malformed payload ($label) -> throws 'malformed payload'", async ({ payload }) => {
    const { fn } = captureFetch(
      new Response(JSON.stringify(payload), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    await expect(
      exchangeAuthorizationCode({
        code: "C",
        codeVerifier: "V",
        redirectUri: REDIRECT_URI,
        config: CONFIG,
        fetchImpl: fn,
      }),
    ).rejects.toThrow(/malformed payload/);
  });
});
