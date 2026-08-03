/**
 * Route-level tests for the Oura OAuth flow. Faithful mirror of
 * `whoopOAuth.test.ts`, extended with the status/disconnect/sync
 * endpoints (mirroring `garminOAuth.ts`'s shape).
 *
 * Drives the real Express router via fetch, with an in-memory
 * auth-state store, an injected fetchImpl for the token exchange, and
 * an in-memory token-store factory in place of Drizzle.
 *
 * Auth: tests run without CLERK_SECRET_KEY, so `requireAuth` falls
 * through to DEFAULT_USER_ID in dev mode — same pattern as the other
 * route-level test files in this suite.
 *
 * Coverage matrix:
 *   /oura/oauth/start
 *     - 200 happy: returns an authorize URL containing the issued
 *       state, S256 challenge, configured client_id + redirect_uri
 *     - the verifier <-> state pair is recorded in the auth state store
 *   /oura/oauth/callback
 *     - 400 when neither code nor state nor error is present
 *     - 400 when Oura returns ?error=access_denied (reason surfaced)
 *     - 400 invalid_or_expired_state for unknown state
 *     - 400 invalid_or_expired_state on REPLAY of a consumed state
 *     - 502 code_exchange_failed when Oura rejects the code (no code
 *       leakage in the response body)
 *     - 200 happy: persists tokens via tokenStoreFor()
 *     - 302 redirect when successRedirectUrl is configured
 *     - 500 token_persist_failed when the token store write throws
 *   /oura/status, /oura/disconnect, /oura/sync
 *     - status reflects connected/disconnected
 *     - disconnect clears tokens (idempotent)
 *     - sync: 409 not_connected / 200 ok / 500 sync_unconfigured / 502 sync_failed
 */
import { describe, it, expect, beforeEach } from "vitest";
import express, { type Express } from "express";
import http from "node:http";
import {
  createInMemoryOuraTokenStore,
  type OuraTokenStore,
  type OuraTokens,
} from "@workspace/db";
import { logger } from "../../lib/logger";
import { DEFAULT_USER_ID } from "../../lib/aforceState";
import {
  createInMemoryOuraAuthStateStore,
  type OuraAuthStateStore,
} from "../../lib/ouraAuthStateStore";
import { buildOuraOAuthRouter } from "../ouraOAuth";

process.env["NODE_ENV"] = "test";
delete process.env["CLERK_SECRET_KEY"];

const CONFIG = { clientId: "cid_X", clientSecret: "secret_Y" };
const REDIRECT_URI = "https://example.test/api/oura/oauth/callback";
const SUCCESS_URL = "https://example.test/connected";

interface TestHarness {
  app: Express;
  server: http.Server;
  baseUrl: string;
  authStateStore: OuraAuthStateStore;
  tokenStores: Map<string, OuraTokenStore>;
  fetchCalls: Array<{ url: string; body: string }>;
  setFetchResponse: (r: Response | (() => Response | Promise<Response>)) => void;
  close: () => Promise<void>;
}

async function startHarness(opts: {
  successRedirectUrl?: string;
  tokenStoreFor?: (userId: string) => OuraTokenStore;
  nowMs?: () => number;
  ttlMs?: number;
  runSyncForUser?: (userId: string) => Promise<{
    status: "ok" | "skipped_no_token" | "skipped_no_state" | "error";
    fetchedAt?: number;
  }>;
} = {}): Promise<TestHarness> {
  const authStateStore = createInMemoryOuraAuthStateStore(
    opts.ttlMs ? { ttlMs: opts.ttlMs } : undefined,
  );
  const tokenStores = new Map<string, OuraTokenStore>();
  const fetchCalls: Array<{ url: string; body: string }> = [];
  let fetchHandler: () => Response | Promise<Response> = () =>
    new Response("not-set", { status: 500 });
  const fetchImpl: typeof fetch = (async (url, init) => {
    fetchCalls.push({
      url: String(url),
      body: (init as { body?: string })?.body ?? "",
    });
    return fetchHandler();
  }) as unknown as typeof fetch;

  const app = express();
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use((req, _res, next) => {
    (req as unknown as { log: typeof logger }).log = logger;
    next();
  });
  app.use(
    buildOuraOAuthRouter({
      // DELETE /{p}/disconnect is now gated by `requireRealAuth` (F5):
      // a genuine Clerk identity in EVERY environment, no DEFAULT_USER_ID
      // fallback. This suite predates that and runs without Clerk, so it
      // injects the identity it has always assumed. The strict gate
      // itself — and every way around it — is attacked in
      // `destructiveEndpointSecurity.test.ts`.
      destructiveAuth: (req, _res, next) => {
        req.userId = DEFAULT_USER_ID;
        next();
      },
      authStateStore,
      oauthConfig: CONFIG,
      redirectUri: REDIRECT_URI,
      tokenStoreFor:
        opts.tokenStoreFor ??
        ((userId: string): OuraTokenStore => {
          let store = tokenStores.get(userId);
          if (!store) {
            store = createInMemoryOuraTokenStore();
            tokenStores.set(userId, store);
          }
          return store;
        }),
      successRedirectUrl: opts.successRedirectUrl,
      fetchImpl,
      nowMs: opts.nowMs,
      runSyncForUser: opts.runSyncForUser,
    }),
  );

  const server = http.createServer(app);
  await new Promise<void>((r) => server.listen(0, r));
  const addr = server.address();
  if (!addr || typeof addr === "string") throw new Error("no address");
  const baseUrl = `http://127.0.0.1:${addr.port}`;
  return {
    app,
    server,
    baseUrl,
    authStateStore,
    tokenStores,
    fetchCalls,
    setFetchResponse(r) {
      fetchHandler = typeof r === "function" ? r : () => r;
    },
    async close() {
      await new Promise<void>((res) => server.close(() => res()));
    },
  };
}

function ouraTokenResponse(overrides: Partial<{
  access_token: string;
  refresh_token: string;
  expires_in: number;
  scope: string;
}> = {}): Response {
  return new Response(
    JSON.stringify({
      access_token: "AT",
      refresh_token: "RT",
      expires_in: 3600,
      scope: "personal daily heartrate workout",
      ...overrides,
    }),
    { status: 200, headers: { "content-type": "application/json" } },
  );
}

let h: TestHarness;
beforeEach(async () => {
  if (h) await h.close();
});

describe("POST /oura/oauth/start", () => {
  it("returns an authorize URL containing the issued state, S256 challenge, and configured client_id/redirect_uri; and records the (state, verifier) pair", async () => {
    h = await startHarness();
    const res = await fetch(`${h.baseUrl}/oura/oauth/start`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { authorizeUrl: string; state: string };
    expect(body.state).toMatch(/^[A-Za-z0-9_-]{32}$/u);
    const url = new URL(body.authorizeUrl);
    expect(url.origin + url.pathname).toBe(
      "https://cloud.ouraring.com/oauth/authorize",
    );
    expect(url.searchParams.get("client_id")).toBe(CONFIG.clientId);
    expect(url.searchParams.get("redirect_uri")).toBe(REDIRECT_URI);
    expect(url.searchParams.get("state")).toBe(body.state);
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    const challenge = url.searchParams.get("code_challenge") ?? "";
    expect(challenge).toMatch(/^[A-Za-z0-9_-]+$/u);
    const consumed = await h.authStateStore.consume(body.state, Date.now());
    expect(consumed?.codeVerifier).toBeTruthy();
    expect(consumed?.userId).toBeTruthy();
    await h.close();
  });
});

describe("GET /oura/oauth/callback", () => {
  it("400 when neither code nor state nor error is present", async () => {
    h = await startHarness();
    const res = await fetch(`${h.baseUrl}/oura/oauth/callback`);
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("missing_code_or_state");
    await h.close();
  });

  it("surfaces a provider error from Oura as 400 oauth_provider_error", async () => {
    h = await startHarness();
    const res = await fetch(
      `${h.baseUrl}/oura/oauth/callback?error=access_denied`,
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string; reason: string };
    expect(body.error).toBe("oauth_provider_error");
    expect(body.reason).toBe("access_denied");
    await h.close();
  });

  it("400 invalid_or_expired_state for an unknown state", async () => {
    h = await startHarness();
    const res = await fetch(
      `${h.baseUrl}/oura/oauth/callback?code=C&state=NEVER_ISSUED`,
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("invalid_or_expired_state");
    await h.close();
  });

  it("enforces single-use: replaying a consumed state returns 400 invalid_or_expired_state", async () => {
    h = await startHarness();
    h.setFetchResponse(ouraTokenResponse());
    const startRes = await fetch(`${h.baseUrl}/oura/oauth/start`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    });
    const startBody = (await startRes.json()) as { state: string };
    const ok = await fetch(
      `${h.baseUrl}/oura/oauth/callback?code=C&state=${startBody.state}`,
    );
    expect(ok.status).toBe(200);
    const replay = await fetch(
      `${h.baseUrl}/oura/oauth/callback?code=C&state=${startBody.state}`,
    );
    expect(replay.status).toBe(400);
    expect(((await replay.json()) as { error: string }).error).toBe(
      "invalid_or_expired_state",
    );
    await h.close();
  });

  it("happy: exchanges the code and persists tokens via tokenStoreFor(userId)", async () => {
    h = await startHarness();
    h.setFetchResponse(ouraTokenResponse());
    const startRes = await fetch(`${h.baseUrl}/oura/oauth/start`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    });
    const { state } = (await startRes.json()) as { state: string };
    const cb = await fetch(
      `${h.baseUrl}/oura/oauth/callback?code=CODE_X&state=${state}`,
    );
    expect(cb.status).toBe(200);
    expect(((await cb.json()) as { ok: boolean }).ok).toBe(true);
    expect(h.fetchCalls).toHaveLength(1);
    const form = new URLSearchParams(h.fetchCalls[0]!.body);
    expect(form.get("grant_type")).toBe("authorization_code");
    expect(form.get("code")).toBe("CODE_X");
    expect(form.get("redirect_uri")).toBe(REDIRECT_URI);
    expect(form.get("code_verifier")).toBeTruthy();
    expect(h.tokenStores.size).toBe(1);
    const [storedUserId, store] = Array.from(h.tokenStores.entries())[0]!;
    expect(storedUserId).toBeTruthy();
    const stored = (await store.read()) as OuraTokens;
    expect(stored.accessToken).toBe("AT");
    expect(stored.refreshToken).toBe("RT");
    expect(stored.scope).toBe("personal daily heartrate workout");
    await h.close();
  });

  it("redirects 302 to successRedirectUrl when configured", async () => {
    h = await startHarness({ successRedirectUrl: SUCCESS_URL });
    h.setFetchResponse(ouraTokenResponse());
    const startRes = await fetch(`${h.baseUrl}/oura/oauth/start`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    });
    const { state } = (await startRes.json()) as { state: string };
    const cb = await fetch(
      `${h.baseUrl}/oura/oauth/callback?code=C&state=${state}`,
      { redirect: "manual" },
    );
    expect(cb.status).toBe(302);
    expect(cb.headers.get("location")).toBe(SUCCESS_URL);
    await h.close();
  });

  it("502 code_exchange_failed when Oura rejects the code; no code leakage", async () => {
    h = await startHarness();
    h.setFetchResponse(new Response("invalid_grant", { status: 400 }));
    const startRes = await fetch(`${h.baseUrl}/oura/oauth/start`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    });
    const { state } = (await startRes.json()) as { state: string };
    const cb = await fetch(
      `${h.baseUrl}/oura/oauth/callback?code=CODE_SECRET&state=${state}`,
    );
    expect(cb.status).toBe(502);
    const txt = await cb.text();
    expect(txt).not.toMatch(/CODE_SECRET/);
    expect(JSON.parse(txt).error).toBe("code_exchange_failed");
    await h.close();
  });

  it("expired state -> 400 invalid_or_expired_state end-to-end (clock advanced past ttlMs)", async () => {
    let nowMs = 1_000_000;
    h = await startHarness({ ttlMs: 1_000, nowMs: () => nowMs });
    h.setFetchResponse(ouraTokenResponse());
    const startRes = await fetch(`${h.baseUrl}/oura/oauth/start`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    });
    const { state } = (await startRes.json()) as { state: string };
    nowMs += 2_000;
    const cb = await fetch(
      `${h.baseUrl}/oura/oauth/callback?code=C&state=${state}`,
    );
    expect(cb.status).toBe(400);
    expect(((await cb.json()) as { error: string }).error).toBe(
      "invalid_or_expired_state",
    );
    expect(h.fetchCalls).toHaveLength(0);
    await h.close();
  });

  it("500 token_persist_failed when the token store write throws", async () => {
    const exploding: OuraTokenStore = {
      async read() {
        return null;
      },
      async write() {
        throw new TypeError("db down");
      },
      async clear() {
        return;
      },
    };
    h = await startHarness({ tokenStoreFor: () => exploding });
    h.setFetchResponse(ouraTokenResponse());
    const startRes = await fetch(`${h.baseUrl}/oura/oauth/start`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    });
    const { state } = (await startRes.json()) as { state: string };
    const cb = await fetch(
      `${h.baseUrl}/oura/oauth/callback?code=C&state=${state}`,
    );
    expect(cb.status).toBe(500);
    expect(((await cb.json()) as { error: string }).error).toBe(
      "token_persist_failed",
    );
    await h.close();
  });
});

describe("GET /oura/status + DELETE /oura/disconnect", () => {
  it("reports disconnected, then connected after a write, then disconnected after disconnect", async () => {
    const store = createInMemoryOuraTokenStore();
    h = await startHarness({ tokenStoreFor: () => store });
    const before = await fetch(`${h.baseUrl}/oura/status`);
    expect(before.status).toBe(200);
    expect(
      ((await before.json()) as { connected: boolean }).connected,
    ).toBe(false);

    await store.write({
      accessToken: "AT",
      refreshToken: "RT",
      expiresAt: Date.now() + 100_000,
      scope: "daily",
    });
    const after = await fetch(`${h.baseUrl}/oura/status`);
    const afterBody = (await after.json()) as {
      connected: boolean;
      expiresAt: number | null;
    };
    expect(afterBody.connected).toBe(true);
    expect(afterBody.expiresAt).not.toBeNull();

    const disconnect = await fetch(`${h.baseUrl}/oura/disconnect`, {
      method: "DELETE",
    });
    expect(disconnect.status).toBe(200);
    expect(((await disconnect.json()) as { ok: boolean }).ok).toBe(true);
    const afterDisconnect = await fetch(`${h.baseUrl}/oura/status`);
    expect(
      ((await afterDisconnect.json()) as { connected: boolean }).connected,
    ).toBe(false);
    // disconnect is idempotent
    const disconnectAgain = await fetch(`${h.baseUrl}/oura/disconnect`, {
      method: "DELETE",
    });
    expect(disconnectAgain.status).toBe(200);
    await h.close();
  });
});

describe("POST /oura/sync", () => {
  it("500 sync_unconfigured when no runSyncForUser was wired", async () => {
    h = await startHarness();
    const res = await fetch(`${h.baseUrl}/oura/sync`, { method: "POST" });
    expect(res.status).toBe(500);
    expect(((await res.json()) as { error: string }).error).toBe(
      "sync_unconfigured",
    );
    await h.close();
  });

  it("409 not_connected when the sync runner reports skipped_no_token", async () => {
    h = await startHarness({
      runSyncForUser: async () => ({ status: "skipped_no_token" }),
    });
    const res = await fetch(`${h.baseUrl}/oura/sync`, { method: "POST" });
    expect(res.status).toBe(409);
    expect(((await res.json()) as { error: string }).error).toBe(
      "not_connected",
    );
    await h.close();
  });

  it("200 ok:true, synced:true, fetchedAt on success", async () => {
    h = await startHarness({
      runSyncForUser: async () => ({ status: "ok", fetchedAt: 12345 }),
    });
    const res = await fetch(`${h.baseUrl}/oura/sync`, { method: "POST" });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      ok: boolean;
      synced: boolean;
      fetchedAt: number;
    };
    expect(body.ok).toBe(true);
    expect(body.synced).toBe(true);
    expect(body.fetchedAt).toBe(12345);
    await h.close();
  });

  it("200 ok:true, synced:false, reason:no_state when skipped_no_state", async () => {
    h = await startHarness({
      runSyncForUser: async () => ({ status: "skipped_no_state" }),
    });
    const res = await fetch(`${h.baseUrl}/oura/sync`, { method: "POST" });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      ok: boolean;
      synced: boolean;
      reason: string;
    };
    expect(body.ok).toBe(true);
    expect(body.synced).toBe(false);
    expect(body.reason).toBe("no_state");
    await h.close();
  });

  it("502 sync_failed when the runner reports error or throws", async () => {
    h = await startHarness({
      runSyncForUser: async () => ({ status: "error" }),
    });
    const res = await fetch(`${h.baseUrl}/oura/sync`, { method: "POST" });
    expect(res.status).toBe(502);
    expect(((await res.json()) as { error: string }).error).toBe(
      "sync_failed",
    );
    await h.close();
  });
});
