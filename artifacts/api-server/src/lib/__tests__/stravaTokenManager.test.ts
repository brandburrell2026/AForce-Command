/**
 * Tests for the server-side Strava token manager + in-memory store.
 * Faithful mirror of `ouraTokenManager.test.ts`, adjusted for two
 * verified Strava-specific deviations from the WHOOP/Oura contract:
 *   - the authorization_code exchange body has NO `redirect_uri` and
 *     NO `code_verifier` (Strava's docs show only client_id/
 *     client_secret/code/grant_type)
 *   - refresh tokens ROTATE (Strava always issues a new one on
 *     success) but the manager still defensively keeps the previous
 *     one if a response ever omits it
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
 *   - Refresh body is the exact Strava form contract (no `scope` param
 *     on the refresh grant).
 *   - Rotation: a refresh that omits `refresh_token` keeps the
 *     previous one (defensive); a refresh that includes a new one
 *     rotates.
 *   - Malformed refresh payload -> throws (refuses to persist junk).
 *   - `setTokens` / `signOut` / `peek` round-trip.
 *   - `getStravaOAuthConfigFromEnv` throws cleanly on missing vars.
 *   - exchangeAuthorizationCode: happy path (no redirect_uri/
 *     code_verifier sent) + non-2xx + malformed payload.
 *   - refresh singleflight: N concurrent refresh() calls collapse to
 *     one POST; process-level coordinator collapses across manager
 *     instances.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  createInMemoryStravaTokenStore,
  type StravaTokens,
} from "@workspace/db";
import {
  createStravaTokenManager,
  exchangeAuthorizationCode,
  getStravaOAuthConfigFromEnv,
  STRAVA_TOKEN_ENDPOINT,
  type StravaTokenResponse,
} from "../stravaTokenManager";

const CONFIG = { clientId: "12345", clientSecret: "csecret" };

function makeFetchOk(payload: StravaTokenResponse): {
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
function makeGatedFetch(payload: StravaTokenResponse): {
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

describe("in-memory StravaTokenStore", () => {
  it("round-trips read/write/clear", async () => {
    const store = createInMemoryStravaTokenStore();
    expect(await store.read()).toBeNull();
    const t: StravaTokens = {
      accessToken: "a",
      refreshToken: "r",
      expiresAt: 1000,
      scope: "activity:read",
    };
    await store.write(t);
    expect(await store.read()).toEqual(t);
    await store.clear();
    expect(await store.read()).toBeNull();
  });
});

describe("exchangeAuthorizationCode", () => {
  it("posts the authorization_code grant WITHOUT redirect_uri or code_verifier (verified Strava contract)", async () => {
    const { fetchImpl, calls } = makeFetchOk({
      access_token: "AT",
      refresh_token: "RT",
      expires_in: 21600,
      scope: "activity:read",
    });
    const tokens = await exchangeAuthorizationCode({
      code: "CODE_X",
      config: CONFIG,
      fetchImpl,
      nowMs: () => 1_000,
    });
    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toBe(STRAVA_TOKEN_ENDPOINT);
    const sent = String(calls[0]?.init?.body);
    expect(sent).toContain("grant_type=authorization_code");
    expect(sent).toContain("code=CODE_X");
    expect(sent).toContain("client_id=12345");
    expect(sent).toContain("client_secret=csecret");
    expect(sent).not.toContain("redirect_uri");
    expect(sent).not.toContain("code_verifier");
    expect(tokens).toEqual({
      accessToken: "AT",
      refreshToken: "RT",
      expiresAt: 1_000 + 21600 * 1000,
      scope: "activity:read",
    });
  });

  it("throws on HTTP non-2xx", async () => {
    await expect(
      exchangeAuthorizationCode({
        code: "C",
        config: CONFIG,
        fetchImpl: makeFetchStatus(400),
      }),
    ).rejects.toThrow(/HTTP 400/);
  });

  it("throws on malformed payload", async () => {
    await expect(
      exchangeAuthorizationCode({
        code: "C",
        config: CONFIG,
        fetchImpl: makeFetchOk({} as unknown as StravaTokenResponse).fetchImpl,
      }),
    ).rejects.toThrow(/malformed/);
  });
});

describe("createStravaTokenManager.getValidAccessToken", () => {
  it("returns null when no tokens are stored — no network call", async () => {
    const store = createInMemoryStravaTokenStore();
    const manager = createStravaTokenManager({
      store,
      config: CONFIG,
      fetchImpl: makeFetchThrow(),
      nowMs: () => 1_000,
    });
    expect(await manager.getValidAccessToken()).toBeNull();
  });

  it("returns the cached token while it has > skew ms of life left", async () => {
    const store = createInMemoryStravaTokenStore({
      accessToken: "AT",
      refreshToken: "RT",
      expiresAt: 1_000 + 120_000, // 120s from now
    });
    const manager = createStravaTokenManager({
      store,
      config: CONFIG,
      fetchImpl: makeFetchThrow(),
      nowMs: () => 1_000,
      refreshSkewMs: 60_000,
    });
    expect(await manager.getValidAccessToken()).toBe("AT");
  });

  it("refreshes inside the skew window, persists, and returns the new token", async () => {
    const store = createInMemoryStravaTokenStore({
      accessToken: "OLD",
      refreshToken: "RT_OLD",
      expiresAt: 1_000 + 30_000, // 30s — inside default 60s skew
    });
    const { fetchImpl, calls } = makeFetchOk({
      access_token: "NEW",
      refresh_token: "RT_NEW",
      expires_in: 21600,
      scope: "activity:read",
    });
    const manager = createStravaTokenManager({
      store,
      config: CONFIG,
      fetchImpl,
      nowMs: () => 1_000,
    });
    expect(await manager.getValidAccessToken()).toBe("NEW");
    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toBe(STRAVA_TOKEN_ENDPOINT);
    // Exact Strava form contract — grant_type + rotated refresh token
    // from the store. No `scope` param on the refresh grant.
    const sent = String(calls[0]?.init?.body);
    expect(sent).toContain("grant_type=refresh_token");
    expect(sent).toContain("refresh_token=RT_OLD");
    expect(sent).toContain("client_id=12345");
    expect(sent).toContain("client_secret=csecret");
    expect(sent).not.toContain("scope=");
    const persisted = await store.read();
    expect(persisted?.accessToken).toBe("NEW");
    expect(persisted?.refreshToken).toBe("RT_NEW");
    expect(persisted?.expiresAt).toBe(1_000 + 21600 * 1000);
    expect(persisted?.scope).toBe("activity:read");
  });

  it("returns null on refresh HTTP failure — caller can skip the user", async () => {
    const store = createInMemoryStravaTokenStore({
      accessToken: "OLD",
      refreshToken: "RT_OLD",
      expiresAt: 0,
    });
    const manager = createStravaTokenManager({
      store,
      config: CONFIG,
      fetchImpl: makeFetchStatus(401),
      nowMs: () => 1_000,
    });
    expect(await manager.getValidAccessToken()).toBeNull();
    expect((await store.read())?.accessToken).toBe("OLD");
  });
});

describe("createStravaTokenManager.refresh", () => {
  it("throws when no refresh token is stored", async () => {
    const store = createInMemoryStravaTokenStore();
    const manager = createStravaTokenManager({
      store,
      config: CONFIG,
      fetchImpl: makeFetchThrow(),
    });
    await expect(manager.refresh()).rejects.toThrow(/no refresh token/);
  });

  it("rethrows on non-2xx so callers that need the failure mode see it", async () => {
    const store = createInMemoryStravaTokenStore({
      accessToken: "x",
      refreshToken: "y",
      expiresAt: 0,
    });
    const manager = createStravaTokenManager({
      store,
      config: CONFIG,
      fetchImpl: makeFetchStatus(500),
    });
    await expect(manager.refresh()).rejects.toThrow(/HTTP 500/);
  });

  it("keeps the previous refresh token when Strava omits a new one (defensive rotation)", async () => {
    const store = createInMemoryStravaTokenStore({
      accessToken: "OLD",
      refreshToken: "RT_KEEP",
      expiresAt: 0,
      scope: "activity:read",
    });
    const { fetchImpl } = makeFetchOk({
      access_token: "NEW",
      refresh_token: undefined as unknown as string,
      expires_in: 21600,
    });
    const manager = createStravaTokenManager({
      store,
      config: CONFIG,
      fetchImpl,
      nowMs: () => 0,
    });
    const next = await manager.refresh();
    expect(next.refreshToken).toBe("RT_KEEP");
    expect(next.scope).toBe("activity:read");
  });

  it("rotates the refresh token when Strava issues a new one (documented Strava behavior)", async () => {
    const store = createInMemoryStravaTokenStore({
      accessToken: "OLD",
      refreshToken: "RT_OLD",
      expiresAt: 0,
      scope: "activity:read",
    });
    const { fetchImpl } = makeFetchOk({
      access_token: "NEW",
      refresh_token: "RT_ROTATED",
      expires_in: 21600,
    });
    const manager = createStravaTokenManager({
      store,
      config: CONFIG,
      fetchImpl,
      nowMs: () => 0,
    });
    const next = await manager.refresh();
    expect(next.refreshToken).toBe("RT_ROTATED");
  });

  it("throws on malformed payload — refuses to persist junk", async () => {
    const store = createInMemoryStravaTokenStore({
      accessToken: "OLD",
      refreshToken: "RT",
      expiresAt: 0,
    });
    const { fetchImpl } = makeFetchOk({} as unknown as StravaTokenResponse);
    const manager = createStravaTokenManager({
      store,
      config: CONFIG,
      fetchImpl,
    });
    await expect(manager.refresh()).rejects.toThrow(/malformed/);
    expect((await store.read())?.accessToken).toBe("OLD");
  });
});

describe("createStravaTokenManager — refresh singleflight", () => {
  it("N concurrent refresh() calls share one inflight promise (one POST, identical result)", async () => {
    const store = createInMemoryStravaTokenStore();
    await store.write({
      accessToken: "old",
      refreshToken: "r0",
      expiresAt: 0,
      scope: "activity:read",
    });
    const gate = makeGatedFetch({
      access_token: "fresh",
      refresh_token: "r1",
      expires_in: 21600,
      scope: "activity:read",
    });
    const manager = createStravaTokenManager({
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
    const store = createInMemoryStravaTokenStore();
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
          expires_in: 21600,
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    }) as unknown as typeof fetch;
    const manager = createStravaTokenManager({
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

describe("createStravaTokenManager — refreshCoordinator (process-level singleflight)", () => {
  it("two MANAGER INSTANCES sharing one registry coordinator for the same user collapse to ONE POST", async () => {
    const { createStravaRefreshRegistry } = await import(
      "../stravaRefreshRegistry"
    );
    const registry = createStravaRefreshRegistry();
    const coord = registry.coordinatorFor("user-shared");

    const seedA = await (async () => {
      const s = createInMemoryStravaTokenStore();
      await s.write({
        accessToken: "old",
        refreshToken: "r0",
        expiresAt: 0,
        scope: null,
      });
      return s;
    })();
    const seedB = await (async () => {
      const s = createInMemoryStravaTokenStore();
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
      expires_in: 21600,
    });

    const managerA = createStravaTokenManager({
      store: seedA,
      config: CONFIG,
      fetchImpl: gate.fetchImpl,
      nowMs: () => 1_000_000,
      refreshCoordinator: coord,
    });
    const managerB = createStravaTokenManager({
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
    const seedA = createInMemoryStravaTokenStore();
    const seedB = createInMemoryStravaTokenStore();
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
          expires_in: 21600,
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    }) as unknown as typeof fetch;
    const a = createStravaTokenManager({ store: seedA, config: CONFIG, fetchImpl });
    const b = createStravaTokenManager({ store: seedB, config: CONFIG, fetchImpl });
    await Promise.all([a.refresh(), b.refresh()]);
    expect(calls).toBe(2);
  });
});

describe("createStravaTokenManager.setTokens / signOut / peek", () => {
  it("round-trips through the store", async () => {
    const store = createInMemoryStravaTokenStore();
    const manager = createStravaTokenManager({
      store,
      config: CONFIG,
      fetchImpl: makeFetchThrow(),
    });
    expect(await manager.peek()).toBeNull();
    const t: StravaTokens = {
      accessToken: "a",
      refreshToken: "r",
      expiresAt: 99,
      scope: "activity:read",
    };
    await manager.setTokens(t);
    expect(await manager.peek()).toEqual(t);
    await manager.signOut();
    expect(await manager.peek()).toBeNull();
  });
});

describe("getStravaOAuthConfigFromEnv", () => {
  let saved: { id: string | undefined; sec: string | undefined };
  beforeEach(() => {
    saved = {
      id: process.env["STRAVA_CLIENT_ID"],
      sec: process.env["STRAVA_CLIENT_SECRET"],
    };
    delete process.env["STRAVA_CLIENT_ID"];
    delete process.env["STRAVA_CLIENT_SECRET"];
  });
  afterEach(() => {
    if (saved.id != null) process.env["STRAVA_CLIENT_ID"] = saved.id;
    if (saved.sec != null) process.env["STRAVA_CLIENT_SECRET"] = saved.sec;
  });

  it("throws cleanly when either var is missing", () => {
    expect(() => getStravaOAuthConfigFromEnv()).toThrow(
      /Strava OAuth config missing/,
    );
    process.env["STRAVA_CLIENT_ID"] = "12345";
    expect(() => getStravaOAuthConfigFromEnv()).toThrow(
      /Strava OAuth config missing/,
    );
  });

  it("returns the config when both vars are set", () => {
    process.env["STRAVA_CLIENT_ID"] = "12345";
    process.env["STRAVA_CLIENT_SECRET"] = "csecret";
    expect(getStravaOAuthConfigFromEnv()).toEqual({
      clientId: "12345",
      clientSecret: "csecret",
    });
  });
});
