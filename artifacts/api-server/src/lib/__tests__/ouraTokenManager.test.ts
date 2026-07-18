/**
 * Tests for the server-side Oura token manager + in-memory store.
 * Faithful mirror of `whoopTokenManager.test.ts`.
 *
 * Covers:
 *   - In-memory store contract: read/write/clear round-trip.
 *   - Manager returns the cached access token while it has >skew ms
 *     of life left (no network call).
 *   - Manager proactively refreshes inside the skew window, persists
 *     the new bundle, and returns the fresh access token.
 *   - Refresh failure (non-2xx) -> `getValidAccessToken` returns
 *     null (callers can skip the user), `refresh()` throws (callers
 *     that need the failure mode get it).
 *   - Refresh body is the exact Oura form contract (no `scope` param
 *     on the refresh grant — Oura's refresh doesn't take one).
 *   - Oura's single-use refresh token rotation: a refresh that omits
 *     `refresh_token` keeps the previous one (defensive); a refresh
 *     that includes a new one rotates.
 *   - Malformed refresh payload -> throws (refuses to persist junk).
 *   - `setTokens` / `signOut` / `peek` round-trip.
 *   - `getOuraOAuthConfigFromEnv` throws cleanly on missing vars.
 *   - exchangeAuthorizationCode: happy path + non-2xx + malformed
 *     payload.
 *   - refresh singleflight: N concurrent refresh() calls collapse to
 *     one POST; process-level coordinator collapses across manager
 *     instances.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  createInMemoryOuraTokenStore,
  type OuraTokens,
} from "@workspace/db";
import {
  createOuraTokenManager,
  exchangeAuthorizationCode,
  getOuraOAuthConfigFromEnv,
  OURA_TOKEN_ENDPOINT,
  type OuraTokenResponse,
} from "../ouraTokenManager";

const CONFIG = { clientId: "cid", clientSecret: "csecret" };

function makeFetchOk(payload: OuraTokenResponse): {
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
  return (async () =>
    new Response("err", { status })) as unknown as typeof fetch;
}

function makeFetchThrow(): typeof fetch {
  return (async () => {
    throw new Error("expected-not-called");
  }) as unknown as typeof fetch;
}

/**
 * Fetch impl that holds every call open on an externally-resolved
 * promise. Lets a test fire N concurrent refresh() calls, assert
 * exactly one network call has been made, then release the response.
 */
function makeGatedFetch(payload: OuraTokenResponse): {
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

describe("in-memory OuraTokenStore", () => {
  it("round-trips read/write/clear", async () => {
    const store = createInMemoryOuraTokenStore();
    expect(await store.read()).toBeNull();
    const t: OuraTokens = {
      accessToken: "a",
      refreshToken: "r",
      expiresAt: 1000,
      scope: "daily",
    };
    await store.write(t);
    expect(await store.read()).toEqual(t);
    await store.clear();
    expect(await store.read()).toBeNull();
  });
});

describe("exchangeAuthorizationCode", () => {
  it("posts the authorization_code grant with code_verifier and returns the token bundle", async () => {
    const { fetchImpl, calls } = makeFetchOk({
      access_token: "AT",
      refresh_token: "RT",
      expires_in: 3600,
      scope: "daily heartrate",
    });
    const tokens = await exchangeAuthorizationCode({
      code: "CODE_X",
      codeVerifier: "VERIFIER_X",
      redirectUri: "https://example.test/api/oura/oauth/callback",
      config: CONFIG,
      fetchImpl,
      nowMs: () => 1_000,
    });
    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toBe(OURA_TOKEN_ENDPOINT);
    const sent = String(calls[0]?.init?.body);
    expect(sent).toContain("grant_type=authorization_code");
    expect(sent).toContain("code=CODE_X");
    expect(sent).toContain("code_verifier=VERIFIER_X");
    expect(sent).toContain("client_id=cid");
    expect(sent).toContain("client_secret=csecret");
    expect(tokens).toEqual({
      accessToken: "AT",
      refreshToken: "RT",
      expiresAt: 1_000 + 3600 * 1000,
      scope: "daily heartrate",
    });
  });

  it("throws on HTTP non-2xx", async () => {
    await expect(
      exchangeAuthorizationCode({
        code: "C",
        codeVerifier: "V",
        redirectUri: "https://example.test/cb",
        config: CONFIG,
        fetchImpl: makeFetchStatus(400),
      }),
    ).rejects.toThrow(/HTTP 400/);
  });

  it("throws on malformed payload", async () => {
    const { fetchImpl } = makeFetchOk({} as unknown as OuraTokenResponse);
    await expect(
      exchangeAuthorizationCode({
        code: "C",
        codeVerifier: "V",
        redirectUri: "https://example.test/cb",
        config: CONFIG,
        fetchImpl,
      }),
    ).rejects.toThrow(/malformed/);
  });
});

describe("createOuraTokenManager.getValidAccessToken", () => {
  it("returns null when no tokens are stored — no network call", async () => {
    const store = createInMemoryOuraTokenStore();
    const manager = createOuraTokenManager({
      store,
      config: CONFIG,
      fetchImpl: makeFetchThrow(),
      nowMs: () => 1_000,
    });
    expect(await manager.getValidAccessToken()).toBeNull();
  });

  it("returns the cached token while it has > skew ms of life left", async () => {
    const store = createInMemoryOuraTokenStore({
      accessToken: "AT",
      refreshToken: "RT",
      expiresAt: 1_000 + 120_000, // 120s from now
    });
    const manager = createOuraTokenManager({
      store,
      config: CONFIG,
      fetchImpl: makeFetchThrow(),
      nowMs: () => 1_000,
      refreshSkewMs: 60_000,
    });
    expect(await manager.getValidAccessToken()).toBe("AT");
  });

  it("refreshes inside the skew window, persists, and returns the new token", async () => {
    const store = createInMemoryOuraTokenStore({
      accessToken: "OLD",
      refreshToken: "RT_OLD",
      expiresAt: 1_000 + 30_000, // 30s — inside default 60s skew
    });
    const { fetchImpl, calls } = makeFetchOk({
      access_token: "NEW",
      refresh_token: "RT_NEW",
      expires_in: 3600,
      scope: "daily heartrate",
    });
    const manager = createOuraTokenManager({
      store,
      config: CONFIG,
      fetchImpl,
      nowMs: () => 1_000,
    });
    expect(await manager.getValidAccessToken()).toBe("NEW");
    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toBe(OURA_TOKEN_ENDPOINT);
    // Exact Oura form contract — grant_type + rotated refresh token
    // from the store. No `scope` param on the refresh grant.
    const sent = String(calls[0]?.init?.body);
    expect(sent).toContain("grant_type=refresh_token");
    expect(sent).toContain("refresh_token=RT_OLD");
    expect(sent).toContain("client_id=cid");
    expect(sent).toContain("client_secret=csecret");
    expect(sent).not.toContain("scope=");
    const persisted = await store.read();
    expect(persisted?.accessToken).toBe("NEW");
    expect(persisted?.refreshToken).toBe("RT_NEW");
    expect(persisted?.expiresAt).toBe(1_000 + 3600 * 1000);
    expect(persisted?.scope).toBe("daily heartrate");
  });

  it("returns null on refresh HTTP failure — caller can skip the user", async () => {
    const store = createInMemoryOuraTokenStore({
      accessToken: "OLD",
      refreshToken: "RT_OLD",
      expiresAt: 0,
    });
    const manager = createOuraTokenManager({
      store,
      config: CONFIG,
      fetchImpl: makeFetchStatus(401),
      nowMs: () => 1_000,
    });
    expect(await manager.getValidAccessToken()).toBeNull();
    expect((await store.read())?.accessToken).toBe("OLD");
  });
});

describe("createOuraTokenManager.refresh", () => {
  it("throws when no refresh token is stored", async () => {
    const store = createInMemoryOuraTokenStore();
    const manager = createOuraTokenManager({
      store,
      config: CONFIG,
      fetchImpl: makeFetchThrow(),
    });
    await expect(manager.refresh()).rejects.toThrow(/no refresh token/);
  });

  it("rethrows on non-2xx so callers that need the failure mode see it", async () => {
    const store = createInMemoryOuraTokenStore({
      accessToken: "x",
      refreshToken: "y",
      expiresAt: 0,
    });
    const manager = createOuraTokenManager({
      store,
      config: CONFIG,
      fetchImpl: makeFetchStatus(500),
    });
    await expect(manager.refresh()).rejects.toThrow(/HTTP 500/);
  });

  it("keeps the previous refresh token when Oura omits a new one (defensive rotation)", async () => {
    const store = createInMemoryOuraTokenStore({
      accessToken: "OLD",
      refreshToken: "RT_KEEP",
      expiresAt: 0,
      scope: "daily heartrate",
    });
    const { fetchImpl } = makeFetchOk({
      access_token: "NEW",
      refresh_token: undefined as unknown as string,
      expires_in: 3600,
    });
    const manager = createOuraTokenManager({
      store,
      config: CONFIG,
      fetchImpl,
      nowMs: () => 0,
    });
    const next = await manager.refresh();
    expect(next.refreshToken).toBe("RT_KEEP");
    expect(next.scope).toBe("daily heartrate");
  });

  it("throws on malformed payload — refuses to persist junk", async () => {
    const store = createInMemoryOuraTokenStore({
      accessToken: "OLD",
      refreshToken: "RT",
      expiresAt: 0,
    });
    const { fetchImpl } = makeFetchOk({} as unknown as OuraTokenResponse);
    const manager = createOuraTokenManager({
      store,
      config: CONFIG,
      fetchImpl,
    });
    await expect(manager.refresh()).rejects.toThrow(/malformed/);
    expect((await store.read())?.accessToken).toBe("OLD");
  });
});

describe("createOuraTokenManager — refresh singleflight", () => {
  it("N concurrent refresh() calls share one inflight promise (one POST, identical result)", async () => {
    const store = createInMemoryOuraTokenStore();
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
    const manager = createOuraTokenManager({
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
    const store = createInMemoryOuraTokenStore();
    await store.write({
      accessToken: "old",
      refreshToken: "r0",
      expiresAt: 0,
      scope: null,
    });
    let call = 0;
    const fetchImpl: typeof fetch = (async () => {
      call += 1;
      if (call === 1) return new Response("nope", { status: 500 });
      return new Response(
        JSON.stringify({
          access_token: "fresh",
          refresh_token: "r1",
          expires_in: 3600,
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    }) as unknown as typeof fetch;
    const manager = createOuraTokenManager({
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

describe("createOuraTokenManager — refreshCoordinator (process-level singleflight)", () => {
  it("two MANAGER INSTANCES sharing one registry coordinator for the same user collapse to ONE POST", async () => {
    const { createOuraRefreshRegistry } = await import("../ouraRefreshRegistry");
    const registry = createOuraRefreshRegistry();
    const coord = registry.coordinatorFor("user-shared");

    const seedA = await (async () => {
      const s = createInMemoryOuraTokenStore();
      await s.write({
        accessToken: "old",
        refreshToken: "r0",
        expiresAt: 0,
        scope: null,
      });
      return s;
    })();
    const seedB = await (async () => {
      const s = createInMemoryOuraTokenStore();
      await s.write({
        accessToken: "old",
        refreshToken: "r0",
        expiresAt: 0,
        scope: null,
      });
      return s;
    })();

    const gate = makeGatedFetch({
      access_token: "fresh",
      refresh_token: "r1",
      expires_in: 3600,
    });

    const managerA = createOuraTokenManager({
      store: seedA,
      config: CONFIG,
      fetchImpl: gate.fetchImpl,
      nowMs: () => 1_000_000,
      refreshCoordinator: coord,
    });
    const managerB = createOuraTokenManager({
      store: seedB,
      config: CONFIG,
      fetchImpl: gate.fetchImpl,
      nowMs: () => 1_000_000,
      refreshCoordinator: coord,
    });

    const pending = [managerA.refresh(), managerB.refresh()];
    await Promise.resolve();
    expect(gate.calls).toBe(1);
    expect(registry.size()).toBe(1);
    gate.release();
    const [ra, rb] = await Promise.all(pending);
    expect(gate.calls).toBe(1);
    expect(ra).toBe(rb);
    expect(registry.size()).toBe(0);
  });

  it("WITHOUT a shared coordinator, two manager instances DO fire two POSTs (preserves per-manager-default behavior)", async () => {
    const seedA = createInMemoryOuraTokenStore();
    const seedB = createInMemoryOuraTokenStore();
    await seedA.write({
      accessToken: "old",
      refreshToken: "rA",
      expiresAt: 0,
      scope: null,
    });
    await seedB.write({
      accessToken: "old",
      refreshToken: "rB",
      expiresAt: 0,
      scope: null,
    });
    let calls = 0;
    const fetchImpl: typeof fetch = (async () => {
      calls += 1;
      return new Response(
        JSON.stringify({
          access_token: `fresh-${calls}`,
          refresh_token: "r1",
          expires_in: 3600,
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    }) as unknown as typeof fetch;
    const a = createOuraTokenManager({ store: seedA, config: CONFIG, fetchImpl });
    const b = createOuraTokenManager({ store: seedB, config: CONFIG, fetchImpl });
    await Promise.all([a.refresh(), b.refresh()]);
    expect(calls).toBe(2);
  });
});

describe("createOuraTokenManager.setTokens / signOut / peek", () => {
  it("round-trips through the store", async () => {
    const store = createInMemoryOuraTokenStore();
    const manager = createOuraTokenManager({
      store,
      config: CONFIG,
      fetchImpl: makeFetchThrow(),
    });
    expect(await manager.peek()).toBeNull();
    const t: OuraTokens = {
      accessToken: "a",
      refreshToken: "r",
      expiresAt: 99,
      scope: "daily",
    };
    await manager.setTokens(t);
    expect(await manager.peek()).toEqual(t);
    await manager.signOut();
    expect(await manager.peek()).toBeNull();
  });
});

describe("getOuraOAuthConfigFromEnv", () => {
  let saved: { id: string | undefined; sec: string | undefined };
  beforeEach(() => {
    saved = {
      id: process.env["OURA_CLIENT_ID"],
      sec: process.env["OURA_CLIENT_SECRET"],
    };
    delete process.env["OURA_CLIENT_ID"];
    delete process.env["OURA_CLIENT_SECRET"];
  });
  afterEach(() => {
    if (saved.id != null) process.env["OURA_CLIENT_ID"] = saved.id;
    if (saved.sec != null) process.env["OURA_CLIENT_SECRET"] = saved.sec;
  });

  it("throws cleanly when either var is missing", () => {
    expect(() => getOuraOAuthConfigFromEnv()).toThrow(/Oura OAuth config missing/);
    process.env["OURA_CLIENT_ID"] = "cid";
    expect(() => getOuraOAuthConfigFromEnv()).toThrow(/Oura OAuth config missing/);
  });

  it("returns the config when both vars are set", () => {
    process.env["OURA_CLIENT_ID"] = "cid";
    process.env["OURA_CLIENT_SECRET"] = "csecret";
    expect(getOuraOAuthConfigFromEnv()).toEqual({
      clientId: "cid",
      clientSecret: "csecret",
    });
  });
});
