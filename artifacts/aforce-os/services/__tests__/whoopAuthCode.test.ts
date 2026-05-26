import { describe, it, expect, vi } from 'vitest';
import {
  WHOOP_AUTHORIZE_ENDPOINT,
  WHOOP_TOKEN_ENDPOINT,
  WHOOP_DEFAULT_SCOPES,
  base64UrlEncode,
  buildWhoopAuthorizationUrl,
  deriveCodeChallenge,
  exchangeWhoopAuthorizationCode,
  generatePkceVerifier,
  type WhoopTokenResponse,
} from '../whoopAuth';

type FetchFn = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

describe('base64UrlEncode', () => {
  it('produces unpadded url-safe base64', () => {
    expect(base64UrlEncode(new Uint8Array([1, 2, 3]))).toBe('AQID');
    expect(base64UrlEncode(new Uint8Array([255, 255, 255]))).toBe('____');
    expect(base64UrlEncode(new Uint8Array([251, 255, 191]))).toBe('-_-_');
    expect(base64UrlEncode(new Uint8Array())).toBe('');
  });
});

describe('PKCE helpers', () => {
  it('verifier is base64url-only and >= 43 chars (RFC 7636)', () => {
    const v = generatePkceVerifier();
    expect(v.length).toBeGreaterThanOrEqual(43);
    expect(v).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('two verifiers are different', () => {
    expect(generatePkceVerifier()).not.toBe(generatePkceVerifier());
  });

  it('deriveCodeChallenge matches the canonical RFC 7636 test vector', async () => {
    // From RFC 7636 Appendix B
    const verifier = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';
    const challenge = await deriveCodeChallenge(verifier);
    expect(challenge).toBe('E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM');
  });
});

describe('buildWhoopAuthorizationUrl', () => {
  it('includes all OAuth2 + PKCE params and uses S256', () => {
    const url = buildWhoopAuthorizationUrl({
      clientId: 'CID',
      redirectUri: 'aforce://whoop/cb',
      codeChallenge: 'CHAL',
      state: 'STATE',
    });
    expect(url.startsWith(`${WHOOP_AUTHORIZE_ENDPOINT}?`)).toBe(true);
    const qs = new URL(url).searchParams;
    expect(qs.get('response_type')).toBe('code');
    expect(qs.get('client_id')).toBe('CID');
    expect(qs.get('redirect_uri')).toBe('aforce://whoop/cb');
    expect(qs.get('code_challenge')).toBe('CHAL');
    expect(qs.get('code_challenge_method')).toBe('S256');
    expect(qs.get('state')).toBe('STATE');
    expect(qs.get('scope')).toBe(WHOOP_DEFAULT_SCOPES.join(' '));
  });

  it('honours a custom scope list', () => {
    const url = buildWhoopAuthorizationUrl({
      clientId: 'CID',
      redirectUri: 'r',
      codeChallenge: 'C',
      state: 'S',
      scopes: ['offline', 'read:profile'],
    });
    expect(new URL(url).searchParams.get('scope')).toBe('offline read:profile');
  });
});

describe('exchangeWhoopAuthorizationCode', () => {
  function okFetch(payload: Partial<WhoopTokenResponse>) {
    return vi.fn<FetchFn>(async () =>
      new Response(JSON.stringify(payload), { status: 200 }),
    );
  }

  it('POSTs the right body and returns tokens with absolute expiry', async () => {
    const fetchImpl = okFetch({
      access_token: 'AT',
      refresh_token: 'RT',
      expires_in: 3600,
    });
    const tokens = await exchangeWhoopAuthorizationCode({
      code: 'CODE',
      redirectUri: 'aforce://whoop/cb',
      codeVerifier: 'VERIFIER',
      clientId: 'CID',
      clientSecret: 'CSEC',
      fetchImpl,
      nowMs: () => 1_000_000,
    });

    expect(tokens).toEqual({
      accessToken: 'AT',
      refreshToken: 'RT',
      expiresAt: 1_000_000 + 3600 * 1000,
    });

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0]!;
    expect(url).toBe(WHOOP_TOKEN_ENDPOINT);
    expect(init!.method).toBe('POST');
    const body = String(init!.body);
    expect(body).toContain('grant_type=authorization_code');
    expect(body).toContain('code=CODE');
    expect(body).toContain('code_verifier=VERIFIER');
    expect(body).toContain('client_id=CID');
    expect(body).toContain('client_secret=CSEC');
    expect(body).toContain('redirect_uri=aforce');
  });

  it('throws on non-2xx', async () => {
    const fetchImpl = vi.fn<FetchFn>(async () => new Response('nope', { status: 400 }));
    await expect(
      exchangeWhoopAuthorizationCode({
        code: 'C',
        redirectUri: 'r',
        codeVerifier: 'v',
        clientId: 'cid',
        clientSecret: 'csec',
        fetchImpl,
      }),
    ).rejects.toThrow(/HTTP 400/);
  });

  it('throws on a malformed payload (missing refresh_token)', async () => {
    const fetchImpl = okFetch({ access_token: 'AT', expires_in: 60 });
    await expect(
      exchangeWhoopAuthorizationCode({
        code: 'C',
        redirectUri: 'r',
        codeVerifier: 'v',
        clientId: 'cid',
        clientSecret: 'csec',
        fetchImpl,
      }),
    ).rejects.toThrow(/malformed/);
  });
});
