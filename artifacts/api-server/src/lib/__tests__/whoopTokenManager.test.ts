/**
 * Tests for the server-side WHOOP token manager + in-memory store.
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
 *   - Refresh body is the exact WHOOP form contract.
 *   - WHOOP token rotation: a refresh that omits `refresh_token`
 *     keeps the previous one (defensive); a refresh that includes
 *     a new one rotates.
 *   - Malformed refresh payload -> throws (refuses to persist junk).
 *   - `setTokens` / `signOut` / `peek` round-trip.
 *   - `getWhoopOAuthConfigFromEnv` throws cleanly on missing vars.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  createInMemoryWhoopTokenStore,
  type WhoopTokens,
} from "@workspace/db";
import {
  createWhoopTokenManager,
  getWhoopOAuthConfigFromEnv,
  WHOOP_TOKEN_ENDPOINT,
  type WhoopTokenResponse,
} from "../whoopTokenManager";

const CONFIG = { clientId: "cid", clientSecret: "csecret" };

function makeFetchOk(payload: WhoopTokenResponse): {
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
function makeGatedFetch(payload: WhoopTokenResponse): {
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

describe("in-memory WhoopTokenStore", () => {
  it("round-trips read/write/clear", async () => {
    const store = createInMemoryWhoopTokenStore();
    expect(await store.read()).toBeNull();
    const t: WhoopTokens = {
      accessToken: "a",
      refreshToken: "r",
      expiresAt: 1000,
      scope: "offline",
    };
    await store.write(t);
    expect(await store.read()).toEqual(t);
    await store.clear();
    expect(await store.read()).toBeNull();
  });
});

describe("createWhoopTokenManager.getValidAccessToken", () => {
  it("returns null when no tokens are stored — no network call", async () => {
    const store = createInMemoryWhoopTokenStore();
    const manager = createWhoopTokenManager({
      store,
      config: CONFIG,
      fetchImpl: makeFetchThrow(),
      nowMs: () => 1_000,
    });
    expect(await manager.getValidAccessToken()).toBeNull();
  });

  it("returns the cached token while it has > skew ms of life left", async () => {
    const store = createInMemoryWhoopTokenStore({
      accessToken: "AT",
      refreshToken: "RT",
      expiresAt: 1_000 + 120_000, // 120s from now
    });
    const manager = createWhoopTokenManager({
      store,
      config: CONFIG,
      fetchImpl: makeFetchThrow(),
      nowMs: () => 1_000,
      refreshSkewMs: 60_000,
    });
    expect(await manager.getValidAccessToken()).toBe("AT");
  });

  it("refreshes inside the skew window, persists, and returns the new token", async () => {
    const store = createInMemoryWhoopTokenStore({
      accessToken: "OLD",
      refreshToken: "RT_OLD",
      expiresAt: 1_000 + 30_000, // 30s — inside default 60s skew
    });
    const { fetchImpl, calls } = makeFetchOk({
      access_token: "NEW",
      refresh_token: "RT_NEW",
      expires_in: 3600,
      scope: "offline read:recovery",
    });
    const manager = createWhoopTokenManager({
      store,
      config: CONFIG,
      fetchImpl,
      nowMs: () => 1_000,
    });
    expect(await manager.getValidAccessToken()).toBe("NEW");
    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toBe(WHOOP_TOKEN_ENDPOINT);
    // Exact WHOOP form contract — including grant_type and rotated
    // refresh token from the store.
    const sent = String(calls[0]?.init?.body);
    expect(sent).toContain("grant_type=refresh_token");
    expect(sent).toContain("refresh_token=RT_OLD");
    expect(sent).toContain("client_id=cid");
    expect(sent).toContain("client_secret=csecret");
    expect(sent).toContain("scope=offline");
    // Persisted with expires_in folded into absolute epoch ms.
    const persisted = await store.read();
    expect(persisted?.accessToken).toBe("NEW");
    expect(persisted?.refreshToken).toBe("RT_NEW");
    expect(persisted?.expiresAt).toBe(1_000 + 3600 * 1000);
    expect(persisted?.scope).toBe("offline read:recovery");
  });

  it("returns null on refresh HTTP failure — caller can skip the user", async () => {
    const store = createInMemoryWhoopTokenStore({
      accessToken: "OLD",
      refreshToken: "RT_OLD",
      expiresAt: 0,
    });
    const manager = createWhoopTokenManager({
      store,
      config: CONFIG,
      fetchImpl: makeFetchStatus(401),
      nowMs: () => 1_000,
    });
    expect(await manager.getValidAccessToken()).toBeNull();
    // Store was NOT mutated by the failed refresh.
    expect((await store.read())?.accessToken).toBe("OLD");
  });
});

describe("createWhoopTokenManager.refresh", () => {
  it("throws when no refresh token is stored", async () => {
    const store = createInMemoryWhoopTokenStore();
    const manager = createWhoopTokenManager({
      store,
      config: CONFIG,
      fetchImpl: makeFetchThrow(),
    });
    await expect(manager.refresh()).rejects.toThrow(/no refresh token/);
  });

  it("rethrows on non-2xx so callers that need the failure mode see it", async () => {
    const store = createInMemoryWhoopTokenStore({
      accessToken: "x",
      refreshToken: "y",
      expiresAt: 0,
    });
    const manager = createWhoopTokenManager({
      store,
      config: CONFIG,
      fetchImpl: makeFetchStatus(500),
    });
    await expect(manager.refresh()).rejects.toThrow(/HTTP 500/);
  });

  it("keeps the previous refresh token when WHOOP omits a new one (defensive rotation)", async () => {
    const store = createInMemoryWhoopTokenStore({
      accessToken: "OLD",
      refreshToken: "RT_KEEP",
      expiresAt: 0,
      scope: "offline read:recovery",
    });
    // No refresh_token in the response.
    const { fetchImpl } = makeFetchOk({
      access_token: "NEW",
      refresh_token: undefined as unknown as string,
      expires_in: 3600,
    });
    const manager = createWhoopTokenManager({
      store,
      config: CONFIG,
      fetchImpl,
      nowMs: () => 0,
    });
    const next = await manager.refresh();
    expect(next.refreshToken).toBe("RT_KEEP");
    // Scope also preserved when the response omits it.
    expect(next.scope).toBe("offline read:recovery");
  });

  it("throws on malformed payload — refuses to persist junk", async () => {
    const store = createInMemoryWhoopTokenStore({
      accessToken: "OLD",
      refreshToken: "RT",
      expiresAt: 0,
    });
    const { fetchImpl } = makeFetchOk({
      // No access_token, no expires_in.
    } as unknown as WhoopTokenResponse);
    const manager = createWhoopTokenManager({
      store,
      config: CONFIG,
      fetchImpl,
    });
    await expect(manager.refresh()).rejects.toThrow(/malformed/);
    // Store untouched.
    expect((await store.read())?.accessToken).toBe("OLD");
  });
});

describe("createWhoopTokenManager — refresh singleflight", () => {
  it("N concurrent refresh() calls share one inflight promise (one POST, identical result)", async () => {
    const store = createInMemoryWhoopTokenStore();
    await store.write({
      accessToken: "old",
      refreshToken: "r0",
      expiresAt: 0,
      scope: "offline",
    });
    const gate = makeGatedFetch({
      access_token: "fresh",
      refresh_token: "r1",
      expires_in: 3600,
      scope: "offline",
    });
    const manager = createWhoopTokenManager({
      store,
      config: CONFIG,
      fetchImpl: gate.fetchImpl,
      nowMs: () => 1_000_000,
    });

    // Fire 5 concurrent refresh() calls; none can resolve until the
    // gated fetch is released.
    const pending = [
      manager.refresh(),
      manager.refresh(),
      manager.refresh(),
      manager.refresh(),
      manager.refresh(),
    ];
    // Yield once so the inflight fetch is registered.
    await Promise.resolve();
    expect(gate.calls).toBe(1);
    gate.release();
    const results = await Promise.all(pending);
    // Still exactly one network call.
    expect(gate.calls).toBe(1);
    // Every caller observed the same token bundle (object identity is
    // strong evidence the inflight promise was shared, not just the
    // value).
    for (const r of results) expect(r).toBe(results[0]);
    expect(results[0]!.accessToken).toBe("fresh");
    // Store reflects the single write.
    expect(await store.read()).toEqual(results[0]);
  });

  it("inflight is cleared on rejection — a follow-up refresh attempts a new POST", async () => {
    const store = createInMemoryWhoopTokenStore();
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
    const manager = createWhoopTokenManager({
      store,
      config: CONFIG,
      fetchImpl,
      nowMs: () => 1_000_000,
    });
    // First batch: both concurrent calls share one failing POST.
    const [a, b] = await Promise.allSettled([manager.refresh(), manager.refresh()]);
    expect(a.status).toBe("rejected");
    expect(b.status).toBe("rejected");
    expect(call).toBe(1);
    // Second call AFTER settlement must fire a fresh POST — we did
    // NOT cache the failure.
    const next = await manager.refresh();
    expect(call).toBe(2);
    expect(next.accessToken).toBe("fresh");
  });

  it("getValidAccessToken — concurrent near-expired callers collapse to one refresh", async () => {
    const store = createInMemoryWhoopTokenStore();
    // expiresAt within the default 60s skew of now() -> all callers
    // will trigger refresh.
    await store.write({
      accessToken: "old",
      refreshToken: "r0",
      expiresAt: 1_000_500,
      scope: null,
    });
    const gate = makeGatedFetch({
      access_token: "fresh",
      refresh_token: "r1",
      expires_in: 3600,
    });
    const manager = createWhoopTokenManager({
      store,
      config: CONFIG,
      fetchImpl: gate.fetchImpl,
      nowMs: () => 1_000_000,
    });
    const pending = [
      manager.getValidAccessToken(),
      manager.getValidAccessToken(),
      manager.getValidAccessToken(),
    ];
    // Yield so store reads + the inflight fetch register.
    await Promise.resolve();
    await Promise.resolve();
    expect(gate.calls).toBe(1);
    gate.release();
    const tokens = await Promise.all(pending);
    expect(gate.calls).toBe(1);
    for (const t of tokens) expect(t).toBe("fresh");
  });
});

describe("createWhoopTokenManager.setTokens / signOut / peek", () => {
  it("round-trips through the store", async () => {
    const store = createInMemoryWhoopTokenStore();
    const manager = createWhoopTokenManager({
      store,
      config: CONFIG,
      fetchImpl: makeFetchThrow(),
    });
    expect(await manager.peek()).toBeNull();
    const t: WhoopTokens = {
      accessToken: "a",
      refreshToken: "r",
      expiresAt: 99,
      scope: "offline",
    };
    await manager.setTokens(t);
    expect(await manager.peek()).toEqual(t);
    await manager.signOut();
    expect(await manager.peek()).toBeNull();
  });
});

describe("getWhoopOAuthConfigFromEnv", () => {
  let saved: { id: string | undefined; sec: string | undefined };
  beforeEach(() => {
    saved = {
      id: process.env["WHOOP_CLIENT_ID"],
      sec: process.env["WHOOP_CLIENT_SECRET"],
    };
    delete process.env["WHOOP_CLIENT_ID"];
    delete process.env["WHOOP_CLIENT_SECRET"];
  });
  afterEach(() => {
    if (saved.id != null) process.env["WHOOP_CLIENT_ID"] = saved.id;
    if (saved.sec != null) process.env["WHOOP_CLIENT_SECRET"] = saved.sec;
  });

  it("throws cleanly when either var is missing", () => {
    expect(() => getWhoopOAuthConfigFromEnv()).toThrow(
      /WHOOP OAuth config missing/,
    );
    process.env["WHOOP_CLIENT_ID"] = "cid";
    expect(() => getWhoopOAuthConfigFromEnv()).toThrow(
      /WHOOP OAuth config missing/,
    );
  });

  it("returns the config when both vars are set", () => {
    process.env["WHOOP_CLIENT_ID"] = "cid";
    process.env["WHOOP_CLIENT_SECRET"] = "csecret";
    expect(getWhoopOAuthConfigFromEnv()).toEqual({
      clientId: "cid",
      clientSecret: "csecret",
    });
  });
});
