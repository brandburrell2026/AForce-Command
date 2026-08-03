/**
 * WHOOP golden parity suite.
 *
 * Purpose: pin CURRENT WHOOP integration behavior with exact-value
 * assertions against the REAL modules (never a reimplementation), so
 * the W3 kit-migration can replay `whoopParity.fixtures.ts` through its
 * new implementation and diff against this file's expectations for
 * byte-parity. A red run here BEFORE any kit work starts means the
 * fixtures are wrong, not that WHOOP changed underneath us — investigate
 * before touching the fixture file.
 *
 * Pure: no DATABASE_URL, no live network — every HTTP boundary is
 * stubbed via each module's existing `fetchImpl` seam, matching the
 * pattern already used by whoopSnapshot.test.ts / whoopPkce.test.ts /
 * whoopTokenManager.test.ts / whoopOAuth.test.ts.
 *
 * Coverage map (per the parity brief):
 *   - PKCE: state length EXACTLY 8, verifier 43 chars, S256, exact
 *     authorize param set + scope string, authorize endpoint.
 *   - Snapshot: API base, per-endpoint limit=10, score_state
 *     first-SCORED selection incl. flattened-shape tolerance, field
 *     mapping, per-endpoint failure isolation, blank-token short
 *     circuit.
 *   - Token manager: refresh body includes scope=offline, 60s skew
 *     boundary, keeps prior refresh_token when omitted, null-on-failure.
 *   - Route contract: /whoop/status shape, callback non-strict query
 *     (extra params tolerated), state single-use.
 */
import './_env';
import { describe, it, expect } from "vitest";
import express, { type Express } from "express";
import http from "node:http";
import { createHash } from "node:crypto";
import {
  createInMemoryWhoopTokenStore,
  type WhoopTokenStore,
} from "@workspace/db";
import { logger } from "../../lib/logger";
import {
  buildWhoopAuthorizeUrl,
  codeChallengeS256,
  createCodeVerifier,
  createOAuthState,
  WHOOP_AUTHORIZE_ENDPOINT,
  WHOOP_DEFAULT_SCOPES,
} from "../../lib/whoopPkce";
import {
  fetchWhoopSnapshot,
  WHOOP_API_BASE,
  EMPTY_WHOOP_SNAPSHOT,
} from "../../lib/whoopSnapshot";
import {
  createWhoopTokenManager,
  WHOOP_TOKEN_ENDPOINT,
} from "../../lib/whoopTokenManager";
import {
  createInMemoryWhoopAuthStateStore,
  type WhoopAuthStateStore,
} from "../../lib/whoopAuthStateStore";
import { buildWhoopOAuthRouter } from "../../routes/whoopOAuth";
import {
  WHOOP_AUTHORIZE_ENDPOINT_FIXTURE,
  WHOOP_AUTHORIZE_PARAM_KEYS_FIXTURE,
  WHOOP_API_BASE_FIXTURE,
  WHOOP_CYCLE_FIXTURE,
  WHOOP_CYCLE_FLATTENED_FIXTURE,
  WHOOP_EXPECTED_SNAPSHOT,
  WHOOP_RECOVERY_FIXTURE,
  WHOOP_RECOVERY_FLATTENED_FIXTURE,
  WHOOP_SCOPE_FIXTURE,
  WHOOP_SLEEP_FIXTURE,
  WHOOP_SLEEP_FLATTENED_FIXTURE,
  WHOOP_STATE_LENGTH_FIXTURE,
  WHOOP_STATUS_SHAPE_KEYS_FIXTURE,
  WHOOP_TOKEN_ENDPOINT_FIXTURE,
  WHOOP_TOKEN_RESPONSE_FIXTURE,
  WHOOP_TOKEN_RESPONSE_NO_ROTATE_FIXTURE,
  WHOOP_VERIFIER_LENGTH_FIXTURE,
} from "./whoopParity.fixtures";

process.env["NODE_ENV"] = "test";
delete process.env["CLERK_SECRET_KEY"];

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

// ─── PKCE ─────────────────────────────────────────────────────────────────────

describe("parity: WHOOP PKCE / OAuth constants", () => {
  it("endpoints match the frozen fixtures exactly", () => {
    expect(WHOOP_AUTHORIZE_ENDPOINT).toBe(WHOOP_AUTHORIZE_ENDPOINT_FIXTURE);
    expect(WHOOP_TOKEN_ENDPOINT).toBe(WHOOP_TOKEN_ENDPOINT_FIXTURE);
    expect(WHOOP_API_BASE).toBe(WHOOP_API_BASE_FIXTURE);
    expect(WHOOP_DEFAULT_SCOPES).toBe(WHOOP_SCOPE_FIXTURE);
  });

  it("state is EXACTLY 8 chars, verifier is EXACTLY 43 chars, across many draws", () => {
    for (let i = 0; i < 25; i += 1) {
      expect(createOAuthState().length).toBe(WHOOP_STATE_LENGTH_FIXTURE);
      expect(createCodeVerifier().length).toBe(WHOOP_VERIFIER_LENGTH_FIXTURE);
    }
  });

  it("authorize URL uses S256 and carries EXACTLY the frozen param set", () => {
    const verifier = createCodeVerifier();
    const url = new URL(
      buildWhoopAuthorizeUrl({
        clientId: "cid",
        redirectUri: "https://example.test/cb",
        state: createOAuthState(),
        codeChallenge: codeChallengeS256(verifier),
      }),
    );
    expect(`${url.origin}${url.pathname}`).toBe(WHOOP_AUTHORIZE_ENDPOINT_FIXTURE);
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    expect(url.searchParams.get("scope")).toBe(WHOOP_SCOPE_FIXTURE);
    expect(Array.from(url.searchParams.keys()).sort()).toEqual(
      WHOOP_AUTHORIZE_PARAM_KEYS_FIXTURE,
    );
    // code_challenge is independently derivable from the verifier — pins
    // the S256 pipeline end-to-end, not just the param's presence.
    const expectedChallenge = createHash("sha256")
      .update(verifier)
      .digest("base64url");
    expect(url.searchParams.get("code_challenge")).toBe(expectedChallenge);
  });
});

// ─── Snapshot ─────────────────────────────────────────────────────────────────

describe("parity: WHOOP snapshot fetch + normalization", () => {
  it("blank/null token -> empty snapshot, ZERO fetches", async () => {
    let calls = 0;
    const fetchImpl: typeof fetch = (async () => {
      calls += 1;
      return jsonResponse({ records: [] });
    }) as unknown as typeof fetch;
    expect(
      await fetchWhoopSnapshot({ accessToken: null, fetchImpl }),
    ).toEqual(EMPTY_WHOOP_SNAPSHOT);
    expect(
      await fetchWhoopSnapshot({ accessToken: "  ", fetchImpl }),
    ).toEqual(EMPTY_WHOOP_SNAPSHOT);
    expect(calls).toBe(0);
  });

  it("hits exactly /recovery, /cycle, /activity/sleep under developer/v2, each with limit=10", async () => {
    const seen: string[] = [];
    const fetchImpl: typeof fetch = (async (url) => {
      seen.push(String(url));
      return jsonResponse({ records: [] });
    }) as unknown as typeof fetch;
    await fetchWhoopSnapshot({ accessToken: "AT", fetchImpl });
    expect(seen.sort()).toEqual(
      [
        `${WHOOP_API_BASE_FIXTURE}/recovery?limit=10`,
        `${WHOOP_API_BASE_FIXTURE}/cycle?limit=10`,
        `${WHOOP_API_BASE_FIXTURE}/activity/sleep?limit=10`,
      ].sort(),
    );
  });

  it("NESTED score_state shape: skips PENDING_SCORE, maps the SCORED record to the frozen expected snapshot", async () => {
    const fetchImpl: typeof fetch = (async (url) => {
      const u = String(url);
      if (u.includes("/recovery")) return jsonResponse(WHOOP_RECOVERY_FIXTURE);
      if (u.includes("/cycle")) return jsonResponse(WHOOP_CYCLE_FIXTURE);
      if (u.includes("/activity/sleep")) return jsonResponse(WHOOP_SLEEP_FIXTURE);
      return jsonResponse({ records: [] });
    }) as unknown as typeof fetch;
    const snap = await fetchWhoopSnapshot({ accessToken: "AT", fetchImpl });
    expect(snap).toEqual(WHOOP_EXPECTED_SNAPSHOT);
  });

  it("FLATTENED shape tolerance: same fields with no `score` wrapper produce the IDENTICAL expected snapshot", async () => {
    const fetchImpl: typeof fetch = (async (url) => {
      const u = String(url);
      if (u.includes("/recovery")) return jsonResponse(WHOOP_RECOVERY_FLATTENED_FIXTURE);
      if (u.includes("/cycle")) return jsonResponse(WHOOP_CYCLE_FLATTENED_FIXTURE);
      if (u.includes("/activity/sleep")) return jsonResponse(WHOOP_SLEEP_FLATTENED_FIXTURE);
      return jsonResponse({ records: [] });
    }) as unknown as typeof fetch;
    const snap = await fetchWhoopSnapshot({ accessToken: "AT", fetchImpl });
    expect(snap).toEqual(WHOOP_EXPECTED_SNAPSHOT);
  });

  it("per-endpoint failure isolation: a 500 on /recovery nulls only recovery-sourced fields", async () => {
    const fetchImpl: typeof fetch = (async (url) => {
      const u = String(url);
      if (u.includes("/recovery")) return jsonResponse({ error: "boom" }, 500);
      if (u.includes("/cycle")) return jsonResponse(WHOOP_CYCLE_FIXTURE);
      if (u.includes("/activity/sleep")) return jsonResponse(WHOOP_SLEEP_FIXTURE);
      return jsonResponse({ records: [] });
    }) as unknown as typeof fetch;
    const snap = await fetchWhoopSnapshot({ accessToken: "AT", fetchImpl });
    expect(snap.recoveryPct).toBeNull();
    expect(snap.hrvSdnn).toBeNull();
    expect(snap.restingHeartRate).toBeNull();
    expect(snap.strain).toBe(WHOOP_EXPECTED_SNAPSHOT.strain);
    expect(snap.sleepHoursLastNight).toBe(WHOOP_EXPECTED_SNAPSHOT.sleepHoursLastNight);
  });
});

// ─── Token manager ────────────────────────────────────────────────────────────

describe("parity: WHOOP token manager", () => {
  const CONFIG = { clientId: "cid", clientSecret: "secret" };

  it("refresh request body includes scope=offline (WHOOP-required, not optional)", async () => {
    const store = createInMemoryWhoopTokenStore({
      accessToken: "OLD",
      refreshToken: "RT",
      expiresAt: 0,
    });
    let sentBody = "";
    const fetchImpl: typeof fetch = (async (_url, init) => {
      sentBody = String((init as { body?: string })?.body ?? "");
      return jsonResponse(WHOOP_TOKEN_RESPONSE_FIXTURE);
    }) as unknown as typeof fetch;
    const manager = createWhoopTokenManager({
      store,
      config: CONFIG,
      fetchImpl,
      nowMs: () => 1_000,
    });
    await manager.refresh();
    const form = new URLSearchParams(sentBody);
    expect(form.get("grant_type")).toBe("refresh_token");
    expect(form.get("scope")).toBe("offline");
  });

  it("60s skew boundary: exactly at the skew line triggers refresh; one ms above it does not", async () => {
    const skew = 60_000;
    const now = 1_000_000;

    // expiresAt - now === skew (NOT > skew) -> must refresh.
    const atBoundary = createInMemoryWhoopTokenStore({
      accessToken: "OLD",
      refreshToken: "RT",
      expiresAt: now + skew,
    });
    let refreshCalls = 0;
    const refreshingFetch: typeof fetch = (async () => {
      refreshCalls += 1;
      return jsonResponse(WHOOP_TOKEN_RESPONSE_FIXTURE);
    }) as unknown as typeof fetch;
    const managerAtBoundary = createWhoopTokenManager({
      store: atBoundary,
      config: CONFIG,
      fetchImpl: refreshingFetch,
      nowMs: () => now,
      refreshSkewMs: skew,
    });
    const tokenAtBoundary = await managerAtBoundary.getValidAccessToken();
    expect(refreshCalls).toBe(1);
    expect(tokenAtBoundary).toBe(WHOOP_TOKEN_RESPONSE_FIXTURE.access_token);

    // expiresAt - now === skew + 1 (> skew) -> cached, no network call.
    const justAboveBoundary = createInMemoryWhoopTokenStore({
      accessToken: "CACHED",
      refreshToken: "RT",
      expiresAt: now + skew + 1,
    });
    let neverCalled = 0;
    const explodingFetch: typeof fetch = (async () => {
      neverCalled += 1;
      throw new Error("must not be called");
    }) as unknown as typeof fetch;
    const managerAboveBoundary = createWhoopTokenManager({
      store: justAboveBoundary,
      config: CONFIG,
      fetchImpl: explodingFetch,
      nowMs: () => now,
      refreshSkewMs: skew,
    });
    const tokenAboveBoundary = await managerAboveBoundary.getValidAccessToken();
    expect(neverCalled).toBe(0);
    expect(tokenAboveBoundary).toBe("CACHED");
  });

  it("keeps the prior refresh_token when WHOOP's response omits one", async () => {
    const store = createInMemoryWhoopTokenStore({
      accessToken: "OLD",
      refreshToken: "RT_KEEP_ME",
      expiresAt: 0,
    });
    const fetchImpl: typeof fetch = (async () =>
      jsonResponse(WHOOP_TOKEN_RESPONSE_NO_ROTATE_FIXTURE)) as unknown as typeof fetch;
    const manager = createWhoopTokenManager({
      store,
      config: CONFIG,
      fetchImpl,
      nowMs: () => 0,
    });
    const next = await manager.refresh();
    expect(next.refreshToken).toBe("RT_KEEP_ME");
    expect(next.accessToken).toBe(WHOOP_TOKEN_RESPONSE_NO_ROTATE_FIXTURE.access_token);
  });

  it("null-on-failure: getValidAccessToken swallows a refresh HTTP failure and returns null", async () => {
    const store = createInMemoryWhoopTokenStore({
      accessToken: "OLD",
      refreshToken: "RT",
      expiresAt: 0,
    });
    const fetchImpl: typeof fetch = (async () =>
      new Response("nope", { status: 401 })) as unknown as typeof fetch;
    const manager = createWhoopTokenManager({
      store,
      config: CONFIG,
      fetchImpl,
      nowMs: () => 0,
    });
    expect(await manager.getValidAccessToken()).toBeNull();
  });
});

// ─── Route contract ───────────────────────────────────────────────────────────

interface RouteHarness {
  baseUrl: string;
  authStateStore: WhoopAuthStateStore;
  tokenStores: Map<string, WhoopTokenStore>;
  setFetchResponse: (r: Response | (() => Response | Promise<Response>)) => void;
  close: () => Promise<void>;
}

async function startRouteHarness(): Promise<RouteHarness> {
  const authStateStore = createInMemoryWhoopAuthStateStore();
  const tokenStores = new Map<string, WhoopTokenStore>();
  let fetchHandler: () => Response | Promise<Response> = () =>
    jsonResponse(WHOOP_TOKEN_RESPONSE_FIXTURE);
  const fetchImpl: typeof fetch = (async () => fetchHandler()) as unknown as typeof fetch;

  const app: Express = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as unknown as { log: typeof logger }).log = logger;
    next();
  });
  app.use(
    buildWhoopOAuthRouter({
      authStateStore,
      oauthConfig: { clientId: "cid", clientSecret: "secret" },
      redirectUri: "https://example.test/api/whoop/oauth/callback",
      tokenStoreFor: (userId: string): WhoopTokenStore => {
        let store = tokenStores.get(userId);
        if (!store) {
          store = createInMemoryWhoopTokenStore();
          tokenStores.set(userId, store);
        }
        return store;
      },
      fetchImpl,
    }),
  );

  const server = http.createServer(app);
  await new Promise<void>((r) => server.listen(0, r));
  const addr = server.address();
  if (!addr || typeof addr === "string") throw new Error("no address");
  return {
    baseUrl: `http://127.0.0.1:${addr.port}`,
    authStateStore,
    tokenStores,
    setFetchResponse(r) {
      fetchHandler = typeof r === "function" ? r : () => r;
    },
    async close() {
      await new Promise<void>((res) => server.close(() => res()));
    },
  };
}

describe("parity: GET /whoop/status shape", () => {
  it("returns EXACTLY {credentialsConfigured, connected, expiresAt} — disconnected", async () => {
    const h = await startRouteHarness();
    const res = await fetch(`${h.baseUrl}/whoop/status`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(Object.keys(body).sort()).toEqual(WHOOP_STATUS_SHAPE_KEYS_FIXTURE);
    expect(body["credentialsConfigured"]).toBe(true);
    expect(body["connected"]).toBe(false);
    expect(body["expiresAt"]).toBeNull();
    await h.close();
  });

  it("connected=true and expiresAt echoes the stored token once a flow completes", async () => {
    const h = await startRouteHarness();
    h.setFetchResponse(jsonResponse(WHOOP_TOKEN_RESPONSE_FIXTURE));
    const startRes = await fetch(`${h.baseUrl}/whoop/oauth/start`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    });
    const { state } = (await startRes.json()) as { state: string };
    await fetch(`${h.baseUrl}/whoop/oauth/callback?code=C&state=${state}`);
    const res = await fetch(`${h.baseUrl}/whoop/status`);
    const body = (await res.json()) as Record<string, unknown>;
    expect(Object.keys(body).sort()).toEqual(WHOOP_STATUS_SHAPE_KEYS_FIXTURE);
    expect(body["connected"]).toBe(true);
    expect(typeof body["expiresAt"]).toBe("number");
    await h.close();
  });
});

describe("parity: GET /whoop/oauth/callback — non-strict query + single-use state", () => {
  it("tolerates unrecognized extra query params alongside code/state (200, not 400)", async () => {
    const h = await startRouteHarness();
    h.setFetchResponse(jsonResponse(WHOOP_TOKEN_RESPONSE_FIXTURE));
    const startRes = await fetch(`${h.baseUrl}/whoop/oauth/start`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    });
    const { state } = (await startRes.json()) as { state: string };
    // WHOOP (or an intermediary) appending unexpected params must never
    // 400 a valid callback — the schema is deliberately non-`.strict()`.
    const res = await fetch(
      `${h.baseUrl}/whoop/oauth/callback?code=C&state=${state}&utm_source=test&extra_future_param=1`,
    );
    expect(res.status).toBe(200);
    await h.close();
  });

  it("single-use: the SAME state cannot be consumed twice", async () => {
    const h = await startRouteHarness();
    h.setFetchResponse(jsonResponse(WHOOP_TOKEN_RESPONSE_FIXTURE));
    const startRes = await fetch(`${h.baseUrl}/whoop/oauth/start`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    });
    const { state } = (await startRes.json()) as { state: string };
    const first = await fetch(`${h.baseUrl}/whoop/oauth/callback?code=C&state=${state}`);
    expect(first.status).toBe(200);
    const replay = await fetch(`${h.baseUrl}/whoop/oauth/callback?code=C&state=${state}`);
    expect(replay.status).toBe(400);
    expect(((await replay.json()) as { error: string }).error).toBe(
      "invalid_or_expired_state",
    );
    await h.close();
  });

  it("pure store-level single-use: consume() deletes on read, a second consume returns null", async () => {
    // Belt-and-suspenders pin directly on the store contract, independent
    // of the route wiring above.
    const store = createInMemoryWhoopAuthStateStore();
    await store.put("STATE_X", {
      codeVerifier: "verifier",
      userId: "user-1",
      createdAtMs: 0,
    });
    const first = await store.consume("STATE_X", 0);
    expect(first?.userId).toBe("user-1");
    const second = await store.consume("STATE_X", 0);
    expect(second).toBeNull();
  });
});
