/**
 * Tests for `providerKit/tokenManager.ts` — the provider-agnostic
 * OAuth2 token manager extracted from the WHOOP/Oura pattern.
 *
 * Faithful in spirit to `whoopTokenManager.test.ts` / `ouraTokenManager.test.ts`,
 * generalized to the kit's provider-parameterized surface, plus new
 * coverage for the parameterization points themselves (`refreshExtraBody`,
 * message text keyed by `provider`) that don't exist as separate
 * concerns in either single-provider file.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  createProviderTokenManager,
  exchangeProviderAuthorizationCode,
  getProviderOAuthConfigFromEnv,
  type ProviderTokenResponse,
  type ProviderTokens,
  type ProviderTokenStore,
} from "../providerKit/tokenManager";

const CONFIG = { clientId: "cid", clientSecret: "csecret" };
const ENDPOINT = "https://example.test/oauth/token";

function createInMemoryStore(seed: ProviderTokens | null = null): ProviderTokenStore {
  let current: ProviderTokens | null = seed;
  return {
    async read() {
      return current;
    },
    async write(t) {
      current = { ...t };
    },
    async clear() {
      current = null;
    },
  };
}

function makeFetchOk(payload: ProviderTokenResponse): {
  fetchImpl: typeof fetch;
  calls: Array<{ url: string; init: RequestInit | undefined }>;
} {
  const calls: Array<{ url: string; init: RequestInit | undefined }> = [];
  const fetchImpl: typeof fetch = (async (url, init) => {
    calls.push({ url: String(url), init });
    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }) as unknown as typeof fetch;
  return { fetchImpl, calls };
}

function makeFetchStatus(status: number): typeof fetch {
  return (async () => new Response("err", { status })) as unknown as typeof fetch;
}

function makeFetchThrow(): typeof fetch {
  return (async () => {
    throw new Error("expected-not-called");
  }) as unknown as typeof fetch;
}

function makeGatedFetch(payload: ProviderTokenResponse): {
  fetchImpl: typeof fetch;
  calls: number;
  release: () => void;
} {
  let release: () => void = () => {};
  const gate = new Promise<void>((r) => {
    release = r;
  });
  const state = { calls: 0 };
  const fetchImpl: typeof fetch = (async () => {
    state.calls += 1;
    await gate;
    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }) as unknown as typeof fetch;
  return {
    fetchImpl,
    get calls() {
      return state.calls;
    },
    release,
  };
}

describe("exchangeProviderAuthorizationCode", () => {
  it("posts the authorization_code grant and returns the token bundle", async () => {
    const { fetchImpl, calls } = makeFetchOk({
      access_token: "AT",
      refresh_token: "RT",
      expires_in: 3600,
      scope: "a b",
    });
    const tokens = await exchangeProviderAuthorizationCode({
      provider: "Oura",
      tokenEndpoint: ENDPOINT,
      code: "CODE_X",
      codeVerifier: "VERIFIER_X",
      redirectUri: "https://example.test/cb",
      config: CONFIG,
      fetchImpl,
      nowMs: () => 1_000,
    });
    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toBe(ENDPOINT);
    const sent = String(calls[0]?.init?.body);
    expect(sent).toContain("grant_type=authorization_code");
    expect(sent).toContain("code=CODE_X");
    expect(sent).toContain("code_verifier=VERIFIER_X");
    expect(tokens).toEqual({
      accessToken: "AT",
      refreshToken: "RT",
      expiresAt: 1_000 + 3600 * 1000,
      scope: "a b",
    });
  });

  it("throws on HTTP non-2xx, message keyed by `provider`", async () => {
    await expect(
      exchangeProviderAuthorizationCode({
        provider: "Oura",
        tokenEndpoint: ENDPOINT,
        code: "C",
        codeVerifier: "V",
        redirectUri: "https://example.test/cb",
        config: CONFIG,
        fetchImpl: makeFetchStatus(400),
      }),
    ).rejects.toThrow(/Oura code exchange failed: HTTP 400/);
  });

  it("throws on malformed payload, message keyed by `provider`", async () => {
    const { fetchImpl } = makeFetchOk({} as unknown as ProviderTokenResponse);
    await expect(
      exchangeProviderAuthorizationCode({
        provider: "Garmin",
        tokenEndpoint: ENDPOINT,
        code: "C",
        codeVerifier: "V",
        redirectUri: "https://example.test/cb",
        config: CONFIG,
        fetchImpl,
      }),
    ).rejects.toThrow(/Garmin code exchange failed: malformed payload/);
  });
});

describe("createProviderTokenManager.getValidAccessToken", () => {
  it("returns null when no tokens are stored — no network call", async () => {
    const store = createInMemoryStore();
    const manager = createProviderTokenManager({
      provider: "Oura",
      tokenEndpoint: ENDPOINT,
      store,
      config: CONFIG,
      fetchImpl: makeFetchThrow(),
      nowMs: () => 1_000,
    });
    expect(await manager.getValidAccessToken()).toBeNull();
  });

  it("returns the cached token while it has > skew ms of life left", async () => {
    const store = createInMemoryStore({
      accessToken: "AT",
      refreshToken: "RT",
      expiresAt: 1_000 + 120_000,
      scope: null,
    });
    const manager = createProviderTokenManager({
      provider: "Oura",
      tokenEndpoint: ENDPOINT,
      store,
      config: CONFIG,
      fetchImpl: makeFetchThrow(),
      nowMs: () => 1_000,
      refreshSkewMs: 60_000,
    });
    expect(await manager.getValidAccessToken()).toBe("AT");
  });

  it("refreshes inside the skew window, persists, and returns the new token", async () => {
    const store = createInMemoryStore({
      accessToken: "OLD",
      refreshToken: "RT_OLD",
      expiresAt: 1_000 + 30_000,
      scope: null,
    });
    const { fetchImpl, calls } = makeFetchOk({
      access_token: "NEW",
      refresh_token: "RT_NEW",
      expires_in: 3600,
      scope: "a b",
    });
    const manager = createProviderTokenManager({
      provider: "Oura",
      tokenEndpoint: ENDPOINT,
      store,
      config: CONFIG,
      fetchImpl,
      nowMs: () => 1_000,
    });
    expect(await manager.getValidAccessToken()).toBe("NEW");
    expect(calls).toHaveLength(1);
    const sent = String(calls[0]?.init?.body);
    expect(sent).toContain("grant_type=refresh_token");
    expect(sent).toContain("refresh_token=RT_OLD");
    expect(sent).not.toContain("scope=");
    const persisted = await store.read();
    expect(persisted?.accessToken).toBe("NEW");
    expect(persisted?.refreshToken).toBe("RT_NEW");
  });

  it("merges `refreshExtraBody` into the refresh grant only (WHOOP's scope=offline shape)", async () => {
    const store = createInMemoryStore({
      accessToken: "OLD",
      refreshToken: "RT_OLD",
      expiresAt: 0,
      scope: null,
    });
    const { fetchImpl, calls } = makeFetchOk({
      access_token: "NEW",
      refresh_token: "RT_NEW",
      expires_in: 3600,
    });
    const manager = createProviderTokenManager({
      provider: "WHOOP",
      tokenEndpoint: ENDPOINT,
      store,
      config: CONFIG,
      fetchImpl,
      nowMs: () => 1_000,
      refreshExtraBody: { scope: "offline" },
    });
    await manager.refresh();
    const sent = String(calls[0]?.init?.body);
    expect(sent).toContain("scope=offline");
  });

  it("returns null on refresh HTTP failure — caller can skip the user", async () => {
    const store = createInMemoryStore({
      accessToken: "OLD",
      refreshToken: "RT_OLD",
      expiresAt: 0,
      scope: null,
    });
    const manager = createProviderTokenManager({
      provider: "Oura",
      tokenEndpoint: ENDPOINT,
      store,
      config: CONFIG,
      fetchImpl: makeFetchStatus(401),
      nowMs: () => 1_000,
    });
    expect(await manager.getValidAccessToken()).toBeNull();
    expect((await store.read())?.accessToken).toBe("OLD");
  });

  it("logs (redacted) and returns null when a `log` is provided and refresh fails", async () => {
    const store = createInMemoryStore({
      accessToken: "OLD",
      refreshToken: "RT_OLD",
      expiresAt: 0,
      scope: null,
    });
    const errors: unknown[] = [];
    const manager = createProviderTokenManager({
      provider: "Oura",
      tokenEndpoint: ENDPOINT,
      store,
      config: CONFIG,
      fetchImpl: makeFetchStatus(401),
      nowMs: () => 1_000,
      log: { error: (obj: unknown) => errors.push(obj) },
    });
    expect(await manager.getValidAccessToken()).toBeNull();
    expect(errors).toHaveLength(1);
    expect(JSON.stringify(errors[0])).not.toMatch(/RT_OLD/);
  });
});

describe("createProviderTokenManager.refresh", () => {
  it("throws when no refresh token is stored, message keyed by `provider`", async () => {
    const store = createInMemoryStore();
    const manager = createProviderTokenManager({
      provider: "Garmin",
      tokenEndpoint: ENDPOINT,
      store,
      config: CONFIG,
      fetchImpl: makeFetchThrow(),
    });
    await expect(manager.refresh()).rejects.toThrow(
      /Garmin refresh failed: no refresh token stored/,
    );
  });

  it("rethrows on non-2xx so callers that need the failure mode see it", async () => {
    const store = createInMemoryStore({
      accessToken: "x",
      refreshToken: "y",
      expiresAt: 0,
      scope: null,
    });
    const manager = createProviderTokenManager({
      provider: "Oura",
      tokenEndpoint: ENDPOINT,
      store,
      config: CONFIG,
      fetchImpl: makeFetchStatus(500),
    });
    await expect(manager.refresh()).rejects.toThrow(/HTTP 500/);
  });

  it("keeps the previous refresh token when the provider omits a new one (defensive rotation)", async () => {
    const store = createInMemoryStore({
      accessToken: "OLD",
      refreshToken: "RT_KEEP",
      expiresAt: 0,
      scope: "a b",
    });
    const { fetchImpl } = makeFetchOk({
      access_token: "NEW",
      refresh_token: undefined as unknown as string,
      expires_in: 3600,
    });
    const manager = createProviderTokenManager({
      provider: "Oura",
      tokenEndpoint: ENDPOINT,
      store,
      config: CONFIG,
      fetchImpl,
      nowMs: () => 0,
    });
    const next = await manager.refresh();
    expect(next.refreshToken).toBe("RT_KEEP");
    expect(next.scope).toBe("a b");
  });

  it("throws on malformed payload — refuses to persist junk", async () => {
    const store = createInMemoryStore({
      accessToken: "OLD",
      refreshToken: "RT",
      expiresAt: 0,
      scope: null,
    });
    const { fetchImpl } = makeFetchOk({} as unknown as ProviderTokenResponse);
    const manager = createProviderTokenManager({
      provider: "Oura",
      tokenEndpoint: ENDPOINT,
      store,
      config: CONFIG,
      fetchImpl,
    });
    await expect(manager.refresh()).rejects.toThrow(/malformed/);
    expect((await store.read())?.accessToken).toBe("OLD");
  });
});

describe("createProviderTokenManager — refresh singleflight", () => {
  it("N concurrent refresh() calls share one inflight promise (one POST, identical result)", async () => {
    const store = createInMemoryStore();
    await store.write({
      accessToken: "old",
      refreshToken: "r0",
      expiresAt: 0,
      scope: "daily",
    });
    const gate = makeGatedFetch({
      access_token: "fresh",
      refresh_token: "r1",
      expires_in: 3600,
      scope: "daily",
    });
    const manager = createProviderTokenManager({
      provider: "Oura",
      tokenEndpoint: ENDPOINT,
      store,
      config: CONFIG,
      fetchImpl: gate.fetchImpl,
      nowMs: () => 1_000_000,
    });

    const pending = [
      manager.refresh(),
      manager.refresh(),
      manager.refresh(),
      manager.refresh(),
      manager.refresh(),
    ];
    await Promise.resolve();
    expect(gate.calls).toBe(1);
    gate.release();
    const results = await Promise.all(pending);
    expect(gate.calls).toBe(1);
    for (const r of results) expect(r).toBe(results[0]);
    expect(results[0]!.accessToken).toBe("fresh");
    expect(await store.read()).toEqual(results[0]);
  });

  it("inflight is cleared on rejection — a follow-up refresh attempts a new POST", async () => {
    const store = createInMemoryStore();
    await store.write({ accessToken: "old", refreshToken: "r0", expiresAt: 0, scope: null });
    let call = 0;
    const fetchImpl: typeof fetch = (async () => {
      call += 1;
      if (call === 1) return new Response("nope", { status: 500 });
      return new Response(
        JSON.stringify({ access_token: "fresh", refresh_token: "r1", expires_in: 3600 }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    }) as unknown as typeof fetch;
    const manager = createProviderTokenManager({
      provider: "Oura",
      tokenEndpoint: ENDPOINT,
      store,
      config: CONFIG,
      fetchImpl,
      nowMs: () => 1_000_000,
    });
    const [a, b] = await Promise.allSettled([manager.refresh(), manager.refresh()]);
    expect(a.status).toBe("rejected");
    expect(b.status).toBe("rejected");
    expect(call).toBe(1);
    const next = await manager.refresh();
    expect(call).toBe(2);
    expect(next.accessToken).toBe("fresh");
  });
});

describe("createProviderTokenManager — refreshCoordinator (process-level singleflight)", () => {
  it("two MANAGER INSTANCES sharing one coordinator for the same user collapse to ONE POST", async () => {
    const inflight = new Map<string, Promise<ProviderTokens>>();
    const coord = (impl: () => Promise<ProviderTokens>): Promise<ProviderTokens> => {
      const key = "user-shared";
      const existing = inflight.get(key);
      if (existing) return existing;
      const p = impl().finally(() => {
        if (inflight.get(key) === p) inflight.delete(key);
      });
      inflight.set(key, p);
      return p;
    };

    const seedA = createInMemoryStore({ accessToken: "old", refreshToken: "r0", expiresAt: 0, scope: null });
    const seedB = createInMemoryStore({ accessToken: "old", refreshToken: "r0", expiresAt: 0, scope: null });
    const gate = makeGatedFetch({ access_token: "fresh", refresh_token: "r1", expires_in: 3600 });

    const managerA = createProviderTokenManager({
      provider: "Oura",
      tokenEndpoint: ENDPOINT,
      store: seedA,
      config: CONFIG,
      fetchImpl: gate.fetchImpl,
      nowMs: () => 1_000_000,
      refreshCoordinator: coord,
    });
    const managerB = createProviderTokenManager({
      provider: "Oura",
      tokenEndpoint: ENDPOINT,
      store: seedB,
      config: CONFIG,
      fetchImpl: gate.fetchImpl,
      nowMs: () => 1_000_000,
      refreshCoordinator: coord,
    });

    const pending = [managerA.refresh(), managerB.refresh()];
    await Promise.resolve();
    expect(gate.calls).toBe(1);
    expect(inflight.size).toBe(1);
    gate.release();
    const [ra, rb] = await Promise.all(pending);
    expect(gate.calls).toBe(1);
    expect(ra).toBe(rb);
    expect(inflight.size).toBe(0);
  });

  it("WITHOUT a shared coordinator, two manager instances DO fire two POSTs", async () => {
    const seedA = createInMemoryStore();
    const seedB = createInMemoryStore();
    await seedA.write({ accessToken: "old", refreshToken: "rA", expiresAt: 0, scope: null });
    await seedB.write({ accessToken: "old", refreshToken: "rB", expiresAt: 0, scope: null });
    let calls = 0;
    const fetchImpl: typeof fetch = (async () => {
      calls += 1;
      return new Response(
        JSON.stringify({ access_token: `fresh-${calls}`, refresh_token: "r1", expires_in: 3600 }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    }) as unknown as typeof fetch;
    const a = createProviderTokenManager({ provider: "Oura", tokenEndpoint: ENDPOINT, store: seedA, config: CONFIG, fetchImpl });
    const b = createProviderTokenManager({ provider: "Oura", tokenEndpoint: ENDPOINT, store: seedB, config: CONFIG, fetchImpl });
    await Promise.all([a.refresh(), b.refresh()]);
    expect(calls).toBe(2);
  });
});

describe("createProviderTokenManager.setTokens / signOut / peek", () => {
  it("round-trips through the store", async () => {
    const store = createInMemoryStore();
    const manager = createProviderTokenManager({
      provider: "Oura",
      tokenEndpoint: ENDPOINT,
      store,
      config: CONFIG,
      fetchImpl: makeFetchThrow(),
    });
    expect(await manager.peek()).toBeNull();
    const t: ProviderTokens = { accessToken: "a", refreshToken: "r", expiresAt: 99, scope: "daily" };
    await manager.setTokens(t);
    expect(await manager.peek()).toEqual(t);
    await manager.signOut();
    expect(await manager.peek()).toBeNull();
  });
});

describe("getProviderOAuthConfigFromEnv", () => {
  let saved: { id: string | undefined; sec: string | undefined };
  beforeEach(() => {
    saved = {
      id: process.env["TEST_PROVIDER_CLIENT_ID"],
      sec: process.env["TEST_PROVIDER_CLIENT_SECRET"],
    };
    delete process.env["TEST_PROVIDER_CLIENT_ID"];
    delete process.env["TEST_PROVIDER_CLIENT_SECRET"];
  });
  afterEach(() => {
    if (saved.id != null) process.env["TEST_PROVIDER_CLIENT_ID"] = saved.id;
    else delete process.env["TEST_PROVIDER_CLIENT_ID"];
    if (saved.sec != null) process.env["TEST_PROVIDER_CLIENT_SECRET"] = saved.sec;
    else delete process.env["TEST_PROVIDER_CLIENT_SECRET"];
  });

  it("throws cleanly when either var is missing, message keyed by provider + var names", () => {
    expect(() =>
      getProviderOAuthConfigFromEnv({
        provider: "TestProvider",
        clientIdVar: "TEST_PROVIDER_CLIENT_ID",
        clientSecretVar: "TEST_PROVIDER_CLIENT_SECRET",
      }),
    ).toThrow(/TestProvider OAuth config missing: set TEST_PROVIDER_CLIENT_ID and TEST_PROVIDER_CLIENT_SECRET/);
  });

  it("returns the config when both vars are set", () => {
    process.env["TEST_PROVIDER_CLIENT_ID"] = "cid";
    process.env["TEST_PROVIDER_CLIENT_SECRET"] = "csecret";
    expect(
      getProviderOAuthConfigFromEnv({
        provider: "TestProvider",
        clientIdVar: "TEST_PROVIDER_CLIENT_ID",
        clientSecretVar: "TEST_PROVIDER_CLIENT_SECRET",
      }),
    ).toEqual({ clientId: "cid", clientSecret: "csecret" });
  });

  it("reads from an injected `env` map instead of process.env when provided", () => {
    expect(
      getProviderOAuthConfigFromEnv({
        provider: "TestProvider",
        clientIdVar: "X_ID",
        clientSecretVar: "X_SECRET",
        env: { X_ID: "cid2", X_SECRET: "sec2" },
      }),
    ).toEqual({ clientId: "cid2", clientSecret: "sec2" });
  });
});
