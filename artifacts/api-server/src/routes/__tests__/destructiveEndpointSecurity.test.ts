/**
 * ADVERSARIAL suite for the destructive endpoints (F5 security pass).
 *
 * Scope: the four provider `DELETE /api/{provider}/disconnect` routes and
 * `POST /api/account/delete-health-data`. These are the only endpoints on
 * the server that irreversibly destroy physiological data, so they are
 * the ones worth attacking on purpose.
 *
 * Written from the attacker's side, not the happy path. Each `describe`
 * below is one way in:
 *
 *   1.  unauthenticated caller                       -> 401
 *   2.  Clerk unconfigured (the DEFAULT_USER_ID hole) -> 503, never "default"
 *   3.  cross-origin browser request                  -> 403, no side effect
 *   4.  rate-limit exhaustion                         -> 429
 *   5.  unknown provider id                           -> 404, nothing runs
 *   6.  user A trying to destroy user B's data        -> only A's data moves
 *   7.  repeated disconnect                           -> idempotent 200
 *   8.  revocation 'succeeded'                        -> truthful
 *   9.  revocation 'failed' (provider still live)     -> truthful, NOT ok-washed
 *   10. revocation 'unsupported' (Garmin)             -> truthful
 *   11. served snapshot after disconnect              -> absent, not stale
 *
 * Plus the legacy no-disconnector path's `'skipped_not_configured'` and
 * the account-deletion cascade + sibling-user preservation.
 *
 * DB-free by construction: in-memory token stores, a fake
 * `ProviderUserStateDb`, and a fake records repo. The same contracts are
 * proven against a REAL Postgres in
 * `lib/db/src/__integration__/providerCleanup.integration.test.ts` —
 * this file proves the ROUTE and GUARD behavior, that file proves the
 * SQL. Neither substitutes for the other.
 */
import "../../lib/__tests__/_f5Env";
import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";
import express, { type Express, type RequestHandler } from "express";
import http from "node:http";
import {
  createInMemoryOuraTokenStore,
  createInMemoryGarminTokenStore,
  createInMemoryWhoopTokenStore,
  createInMemoryStravaTokenStore,
  type OuraTokenStore,
  type GarminTokenStore,
  type WhoopTokenStore,
  type StravaTokenStore,
} from "@workspace/db";

// Clerk is mocked so the REAL `requireRealAuth` can be exercised without
// a Clerk backend. Tests that aren't about auth inject a stub identity
// instead (see `authAs`) and never reach this.
const { authHolder } = vi.hoisted(() => ({
  authHolder: {
    value: { userId: null as string | null, sessionClaims: null as unknown },
  },
}));
vi.mock("@clerk/express", () => ({
  getAuth: () => authHolder.value,
}));

import { createInMemoryOuraAuthStateStore } from "../../lib/ouraAuthStateStore";
import { createInMemoryGarminAuthStateStore } from "../../lib/garminAuthStateStore";
import { createInMemoryWhoopAuthStateStore } from "../../lib/whoopAuthStateStore";
import { buildOuraOAuthRouter } from "../ouraOAuth";
import { buildGarminOAuthRouter } from "../garminOAuth";
import { buildWhoopOAuthRouter } from "../whoopOAuth";
import {
  buildAccountDeletionRouter,
  type AccountDeletionDeps,
} from "../accountDeletion";
import {
  createProviderDisconnector,
  createOuraRevoker,
  type ProviderDisconnector,
  type ProviderUserStateDb,
} from "../../lib/providerKit/disconnect";
import { DEFAULT_USER_ID } from "../../lib/aforceState";

process.env["NODE_ENV"] = "test";

const USER_A = "user_2aAaAaAaAaAaAaAaAaAaAaAa";
const USER_B = "user_2bBbBbBbBbBbBbBbBbBbBbBb";

const ORIGINAL_CLERK_KEY = process.env["CLERK_SECRET_KEY"];
const ORIGINAL_CORS = process.env["CORS_ALLOWED_ORIGINS"];
afterAll(() => {
  if (ORIGINAL_CLERK_KEY === undefined) delete process.env["CLERK_SECRET_KEY"];
  else process.env["CLERK_SECRET_KEY"] = ORIGINAL_CLERK_KEY;
  if (ORIGINAL_CORS === undefined) delete process.env["CORS_ALLOWED_ORIGINS"];
  else process.env["CORS_ALLOWED_ORIGINS"] = ORIGINAL_CORS;
});

beforeEach(() => {
  authHolder.value = { userId: null, sessionClaims: null };
  delete process.env["CLERK_SECRET_KEY"];
  delete process.env["CORS_ALLOWED_ORIGINS"];
});

/* ─── Fakes ───────────────────────────────────────────────────────────────── */

/** Fake biometrics blob, one entry per provider per user — the thing
 *  `GET /api/aforce/state` serves. Disconnect must remove exactly one
 *  key and leave the siblings alone. */
function createFakeUserStateDb(
  initial: Record<string, Record<string, unknown>> = {},
): ProviderUserStateDb & {
  blobs: Map<string, Record<string, unknown>>;
  calls: Array<{ userId: string; providerKey: string }>;
} {
  const blobs = new Map(Object.entries(initial).map(([k, v]) => [k, { ...v }]));
  const calls: Array<{ userId: string; providerKey: string }> = [];
  return {
    blobs,
    calls,
    async removeProviderSnapshotEntry(userId, providerKey) {
      calls.push({ userId, providerKey });
      const blob = blobs.get(userId);
      if (!blob || !(providerKey in blob)) return { removed: false };
      delete blob[providerKey];
      return { removed: true };
    },
  };
}

/** Identity stub standing in for `requireRealAuth`. Used only by tests
 *  that are NOT about the auth gate itself — auth tests use the real
 *  middleware via the Clerk mock above. */
function authAs(userId: string): RequestHandler {
  return (req, _res, next) => {
    req.userId = userId;
    next();
  };
}

interface Harness {
  baseUrl: string;
  close: () => Promise<void>;
}

async function listen(app: Express): Promise<Harness> {
  const server: http.Server = app.listen(0);
  await new Promise<void>((r) => server.once("listening", () => r()));
  const addr = server.address();
  const port = typeof addr === "object" && addr ? addr.port : 0;
  return {
    baseUrl: `http://127.0.0.1:${port}`,
    close: () => new Promise<void>((r) => server.close(() => r())),
  };
}

interface OuraHarnessOpts {
  auth?: RequestHandler;
  disconnector?: ProviderDisconnector | null;
  revokeImpl?: typeof fetch;
  userStateDb?: ReturnType<typeof createFakeUserStateDb>;
  stores?: Map<string, OuraTokenStore>;
  limit?: number;
}

/** Oura is the representative provider for the guard tests: it has a
 *  real revoke contract, so every `RevocationOutcome` except
 *  `'unsupported'` is reachable through it. */
async function ouraHarness(opts: OuraHarnessOpts = {}): Promise<
  Harness & {
    stores: Map<string, OuraTokenStore>;
    userStateDb: ReturnType<typeof createFakeUserStateDb>;
  }
> {
  const stores = opts.stores ?? new Map<string, OuraTokenStore>();
  const tokenStoreFor = (userId: string): OuraTokenStore => {
    let s = stores.get(userId);
    if (!s) {
      s = createInMemoryOuraTokenStore();
      stores.set(userId, s);
    }
    return s;
  };
  const userStateDb = opts.userStateDb ?? createFakeUserStateDb();
  const disconnector =
    opts.disconnector === null
      ? undefined
      : (opts.disconnector ??
        createProviderDisconnector({
          provider: "Oura",
          tokenStoreFor,
          db: userStateDb,
          revoker: createOuraRevoker({ fetchImpl: opts.revokeImpl }),
        }));

  const app = express();
  app.use(express.json());
  app.use(
    "/api",
    buildOuraOAuthRouter({
      authStateStore: createInMemoryOuraAuthStateStore(),
      oauthConfig: { clientId: "cid", clientSecret: "sec" },
      redirectUri: "https://example.test/cb",
      tokenStoreFor,
      disconnector,
      destructiveAuth: opts.auth,
      destructiveRateLimit: opts.limit ? { limit: opts.limit } : undefined,
    }),
  );
  const h = await listen(app);
  return { ...h, stores, userStateDb };
}

function okRevoke(): typeof fetch {
  return (async () => new Response(null, { status: 200 })) as typeof fetch;
}
function failingRevoke(): typeof fetch {
  return (async () => new Response("nope", { status: 500 })) as typeof fetch;
}

async function seedOura(store: OuraTokenStore): Promise<void> {
  await store.write({
    accessToken: "at",
    refreshToken: "rt",
    expiresAt: Date.now() + 3_600_000,
  });
}

/* ─── 1 + 2. Authentication ───────────────────────────────────────────────── */

describe("unauthenticated / fallback-identity callers cannot destroy data", () => {
  it("401s an unauthenticated caller when Clerk IS configured", async () => {
    process.env["CLERK_SECRET_KEY"] = "sk_test_present";
    authHolder.value = { userId: null, sessionClaims: null };
    const h = await ouraHarness(); // real requireRealAuth
    try {
      const res = await fetch(`${h.baseUrl}/api/oura/disconnect`, {
        method: "DELETE",
      });
      expect(res.status).toBe(401);
      expect(await res.json()).toEqual({ error: "unauthorized" });
      // Nothing ran.
      expect(h.userStateDb.calls).toHaveLength(0);
    } finally {
      await h.close();
    }
  });

  it("REFUSES the DEFAULT_USER_ID dev fallback: no Clerk key -> 503, not a deletion", async () => {
    // This is the core F5 fix. `requireAuth` would hand this request
    // DEFAULT_USER_ID and let an anonymous caller wipe the demo user's
    // biometrics on any non-production deployment.
    delete process.env["CLERK_SECRET_KEY"];
    const userStateDb = createFakeUserStateDb({
      [DEFAULT_USER_ID]: { oura: { readinessScore: 82 } },
    });
    const h = await ouraHarness({ userStateDb });
    try {
      const res = await fetch(`${h.baseUrl}/api/oura/disconnect`, {
        method: "DELETE",
      });
      expect(res.status).toBe(503);
      expect(await res.json()).toEqual({ error: "auth_unavailable" });
      expect(h.userStateDb.calls).toHaveLength(0);
      expect(h.userStateDb.blobs.get(DEFAULT_USER_ID)).toEqual({
        oura: { readinessScore: 82 },
      });
    } finally {
      await h.close();
    }
  });

  it("401s even when Clerk resolves the literal DEFAULT_USER_ID", async () => {
    // Belt-and-braces: "default" can only reach us from a fallback path,
    // and no fallback path may authorize a destructive op.
    process.env["CLERK_SECRET_KEY"] = "sk_test_present";
    authHolder.value = { userId: DEFAULT_USER_ID, sessionClaims: null };
    const h = await ouraHarness();
    try {
      const res = await fetch(`${h.baseUrl}/api/oura/disconnect`, {
        method: "DELETE",
      });
      expect(res.status).toBe(401);
      expect(h.userStateDb.calls).toHaveLength(0);
    } finally {
      await h.close();
    }
  });

  it("admits a genuine Clerk identity and acts as THAT user", async () => {
    process.env["CLERK_SECRET_KEY"] = "sk_test_present";
    authHolder.value = { userId: USER_A, sessionClaims: null };
    const userStateDb = createFakeUserStateDb({
      [USER_A]: { oura: { readinessScore: 82 }, whoop: { recovery: 60 } },
    });
    const h = await ouraHarness({ userStateDb, revokeImpl: okRevoke() });
    try {
      const res = await fetch(`${h.baseUrl}/api/oura/disconnect`, {
        method: "DELETE",
      });
      expect(res.status).toBe(200);
      expect(h.userStateDb.calls).toEqual([
        { userId: USER_A, providerKey: "oura" },
      ]);
    } finally {
      await h.close();
    }
  });
});

/* ─── 3. Cross-origin ─────────────────────────────────────────────────────── */

describe("cross-origin destructive requests are refused server-side", () => {
  it("403s a foreign Origin under the dev reflect-all config, with NO side effect", async () => {
    // The dev CORS config in app.ts reflects any origin with
    // credentials:true. That makes this exact request succeed today.
    const userStateDb = createFakeUserStateDb({
      [USER_A]: { oura: { readinessScore: 82 } },
    });
    const h = await ouraHarness({ auth: authAs(USER_A), userStateDb });
    try {
      const res = await fetch(`${h.baseUrl}/api/oura/disconnect`, {
        method: "DELETE",
        headers: { Origin: "https://evil.example" },
      });
      expect(res.status).toBe(403);
      expect(await res.json()).toEqual({ error: "cross_origin_forbidden" });
      // The deletion did NOT happen — the point of enforcing server-side
      // rather than relying on the browser to hide the response.
      expect(h.userStateDb.calls).toHaveLength(0);
      expect(h.userStateDb.blobs.get(USER_A)).toEqual({
        oura: { readinessScore: 82 },
      });
    } finally {
      await h.close();
    }
  });

  it("allows a request with NO Origin header (native app / curl)", async () => {
    const h = await ouraHarness({
      auth: authAs(USER_A),
      revokeImpl: okRevoke(),
    });
    try {
      const res = await fetch(`${h.baseUrl}/api/oura/disconnect`, {
        method: "DELETE",
      });
      expect(res.status).toBe(200);
    } finally {
      await h.close();
    }
  });

  it("allows a loopback Origin outside production (Expo web preview)", async () => {
    const h = await ouraHarness({
      auth: authAs(USER_A),
      revokeImpl: okRevoke(),
    });
    try {
      const res = await fetch(`${h.baseUrl}/api/oura/disconnect`, {
        method: "DELETE",
        headers: { Origin: "http://localhost:8081" },
      });
      expect(res.status).toBe(200);
    } finally {
      await h.close();
    }
  });

  it("honors CORS_ALLOWED_ORIGINS exactly: listed passes, unlisted 403s", async () => {
    process.env["CORS_ALLOWED_ORIGINS"] =
      "https://app.drinkaforce.com, https://drinkaforce.com";
    const h = await ouraHarness({
      auth: authAs(USER_A),
      revokeImpl: okRevoke(),
    });
    try {
      const good = await fetch(`${h.baseUrl}/api/oura/disconnect`, {
        method: "DELETE",
        headers: { Origin: "https://app.drinkaforce.com" },
      });
      expect(good.status).toBe(200);

      // An allow-list makes the dev loopback affordance irrelevant —
      // once configured, it is the ONLY list that counts.
      const bad = await fetch(`${h.baseUrl}/api/oura/disconnect`, {
        method: "DELETE",
        headers: { Origin: "http://localhost:8081" },
      });
      expect(bad.status).toBe(403);
    } finally {
      await h.close();
    }
  });
});

/* ─── 4. Rate limiting ────────────────────────────────────────────────────── */

describe("destructive endpoints are rate limited", () => {
  it("429s after the bucket is exhausted, and the limiter does NOT skip in test", async () => {
    const h = await ouraHarness({
      auth: authAs(USER_A),
      revokeImpl: okRevoke(),
      limit: 2,
    });
    try {
      const first = await fetch(`${h.baseUrl}/api/oura/disconnect`, {
        method: "DELETE",
      });
      const second = await fetch(`${h.baseUrl}/api/oura/disconnect`, {
        method: "DELETE",
      });
      const third = await fetch(`${h.baseUrl}/api/oura/disconnect`, {
        method: "DELETE",
      });
      expect([first.status, second.status]).toEqual([200, 200]);
      expect(third.status).toBe(429);
      expect(await third.json()).toEqual({
        error: "rate_limited",
        scope: "oura_disconnect",
      });
      // Only the two admitted requests reached the handler.
      expect(h.userStateDb.calls).toHaveLength(2);
    } finally {
      await h.close();
    }
  });

  it("shapes UNAUTHENTICATED floods too — the limiter runs before auth", async () => {
    process.env["CLERK_SECRET_KEY"] = "sk_test_present";
    authHolder.value = { userId: null, sessionClaims: null };
    const h = await ouraHarness({ limit: 1 });
    try {
      const first = await fetch(`${h.baseUrl}/api/oura/disconnect`, {
        method: "DELETE",
      });
      const second = await fetch(`${h.baseUrl}/api/oura/disconnect`, {
        method: "DELETE",
      });
      expect(first.status).toBe(401);
      expect(second.status).toBe(429);
    } finally {
      await h.close();
    }
  });
});

/* ─── 5. Invalid provider id ──────────────────────────────────────────────── */

describe("provider identity cannot be forged", () => {
  it("404s an unknown provider id — there is no generic disconnect route", async () => {
    const h = await ouraHarness({ auth: authAs(USER_A) });
    try {
      for (const path of [
        "/api/bogus/disconnect",
        "/api/oura/../whoop/disconnect",
        "/api/disconnect",
      ]) {
        const res = await fetch(`${h.baseUrl}${path}`, { method: "DELETE" });
        expect(res.status).toBe(404);
      }
      expect(h.userStateDb.calls).toHaveLength(0);
    } finally {
      await h.close();
    }
  });

  it("passes the provider key as a bound parameter, never as a path literal", async () => {
    // The jsonb `#-` path is built as ARRAY[$1]::text[]. Proven here at
    // the seam: whatever the provider name is, it arrives at the db
    // adapter as one opaque VALUE, so it cannot alter path semantics.
    const userStateDb = createFakeUserStateDb();
    const disconnector = createProviderDisconnector({
      provider: 'Ou,ra}"{',
      tokenStoreFor: () => createInMemoryOuraTokenStore(),
      db: userStateDb,
    });
    await disconnector.disconnect(USER_A);
    expect(userStateDb.calls).toEqual([
      { userId: USER_A, providerKey: 'ou,ra}"{' },
    ]);
  });
});

/* ─── 6. Authorization (A vs B) ───────────────────────────────────────────── */

describe("a caller can only destroy their OWN data", () => {
  it("ignores an attacker-supplied userId in query/body and never touches user B", async () => {
    const stores = new Map<string, OuraTokenStore>();
    const aStore = createInMemoryOuraTokenStore();
    const bStore = createInMemoryOuraTokenStore();
    stores.set(USER_A, aStore);
    stores.set(USER_B, bStore);
    await seedOura(aStore);
    await seedOura(bStore);
    const userStateDb = createFakeUserStateDb({
      [USER_A]: { oura: { readinessScore: 82 } },
      [USER_B]: { oura: { readinessScore: 91 } },
    });
    const h = await ouraHarness({
      auth: authAs(USER_A),
      stores,
      userStateDb,
      revokeImpl: okRevoke(),
    });
    try {
      const res = await fetch(
        `${h.baseUrl}/api/oura/disconnect?userId=${USER_B}&user_id=${USER_B}`,
        {
          method: "DELETE",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ userId: USER_B }),
        },
      );
      expect(res.status).toBe(200);

      // The identity came from the session, not the request.
      expect(userStateDb.calls).toEqual([
        { userId: USER_A, providerKey: "oura" },
      ]);
      expect(await aStore.read()).toBeNull();
      expect(await bStore.read()).not.toBeNull();
      expect(userStateDb.blobs.get(USER_B)).toEqual({
        oura: { readinessScore: 91 },
      });
    } finally {
      await h.close();
    }
  });
});

/* ─── 7 + 11. Idempotency and the served snapshot ─────────────────────────── */

describe("disconnect is idempotent and leaves no stale served snapshot", () => {
  it("removes ONLY this provider's snapshot key, leaving siblings intact", async () => {
    const stores = new Map<string, OuraTokenStore>();
    const aStore = createInMemoryOuraTokenStore();
    stores.set(USER_A, aStore);
    await seedOura(aStore);
    const userStateDb = createFakeUserStateDb({
      [USER_A]: {
        oura: { readinessScore: 82 },
        whoop: { recovery: 60 },
        garmin: { bodyBattery: 44 },
      },
    });
    const h = await ouraHarness({
      auth: authAs(USER_A),
      stores,
      userStateDb,
      revokeImpl: okRevoke(),
    });
    try {
      const res = await fetch(`${h.baseUrl}/api/oura/disconnect`, {
        method: "DELETE",
      });
      expect(res.status).toBe(200);
      const blob = userStateDb.blobs.get(USER_A)!;
      // The stale-snapshot bug: this key used to survive disconnect and
      // keep rendering in GET /api/aforce/state.
      expect("oura" in blob).toBe(false);
      expect(blob).toEqual({
        whoop: { recovery: 60 },
        garmin: { bodyBattery: 44 },
      });
    } finally {
      await h.close();
    }
  });

  it("a repeated disconnect is a clean 200 that truthfully reports nothing left to revoke", async () => {
    const stores = new Map<string, OuraTokenStore>();
    const aStore = createInMemoryOuraTokenStore();
    stores.set(USER_A, aStore);
    await seedOura(aStore);
    const userStateDb = createFakeUserStateDb({
      [USER_A]: { oura: { readinessScore: 82 } },
    });
    const revokeCalls: string[] = [];
    const revokeImpl = (async (url: unknown) => {
      revokeCalls.push(String(url));
      return new Response(null, { status: 200 });
    }) as typeof fetch;

    const h = await ouraHarness({
      auth: authAs(USER_A),
      stores,
      userStateDb,
      revokeImpl,
    });
    try {
      const first = await fetch(`${h.baseUrl}/api/oura/disconnect`, {
        method: "DELETE",
      });
      expect(first.status).toBe(200);
      expect(await first.json()).toEqual({
        ok: true,
        local: "succeeded",
        revocation: "succeeded",
        status: "snapshot_removed",
      });

      const second = await fetch(`${h.baseUrl}/api/oura/disconnect`, {
        method: "DELETE",
      });
      expect(second.status).toBe(200);
      expect(await second.json()).toEqual({
        ok: true,
        local: "succeeded",
        // NOT "succeeded" — nothing was revoked on this call. Claiming
        // otherwise is the lie this contract exists to prevent.
        revocation: "skipped_no_tokens",
        status: "snapshot_removed",
      });
      // And we did not fire a second pointless request at Oura.
      expect(revokeCalls).toHaveLength(1);
    } finally {
      await h.close();
    }
  });
});

/* ─── 8-10. Revocation truthfulness ───────────────────────────────────────── */

describe("disconnect responses tell the truth about the upstream grant", () => {
  it("'succeeded' when the provider accepted the revoke", async () => {
    const stores = new Map<string, OuraTokenStore>();
    const s = createInMemoryOuraTokenStore();
    stores.set(USER_A, s);
    await seedOura(s);
    const h = await ouraHarness({
      auth: authAs(USER_A),
      stores,
      revokeImpl: okRevoke(),
    });
    try {
      const res = await fetch(`${h.baseUrl}/api/oura/disconnect`, {
        method: "DELETE",
      });
      const body = (await res.json()) as Record<string, unknown>;
      expect(body["revocation"]).toBe("succeeded");
      expect(body["local"]).toBe("succeeded");
    } finally {
      await h.close();
    }
  });

  it("'failed' when the provider rejected it — local cleanup still completes, and we do NOT claim revocation", async () => {
    const stores = new Map<string, OuraTokenStore>();
    const s = createInMemoryOuraTokenStore();
    stores.set(USER_A, s);
    await seedOura(s);
    const userStateDb = createFakeUserStateDb({
      [USER_A]: { oura: { readinessScore: 82 } },
    });
    const h = await ouraHarness({
      auth: authAs(USER_A),
      stores,
      userStateDb,
      revokeImpl: failingRevoke(),
    });
    try {
      const res = await fetch(`${h.baseUrl}/api/oura/disconnect`, {
        method: "DELETE",
      });
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({
        ok: true,
        local: "succeeded",
        // The grant MAY STILL BE LIVE at Oura. The old blanket
        // {ok:true} said nothing about this.
        revocation: "failed",
        status: "snapshot_removed",
      });
      // A revoke failure must never block local cleanup.
      expect(await s.read()).toBeNull();
      expect(userStateDb.blobs.get(USER_A)).toEqual({});
    } finally {
      await h.close();
    }
  });

  it("'failed' when the token READ itself throws — never 'skipped_no_tokens', local cleanup still completes", async () => {
    // The F5-follow-up defect this guards: a token-store read failure used
    // to fall into the same branch as "nothing was ever stored," so the
    // client was told skipped_no_tokens ("nothing to revoke") when the
    // truth was "the server couldn't even look." A live upstream grant
    // could be sitting unrevoked while the response claims otherwise.
    const userStateDb = createFakeUserStateDb({
      [USER_A]: { oura: { readinessScore: 82 }, whoop: { recovery: 60 } },
    });
    const readCalls: string[] = [];
    const brokenStore: OuraTokenStore = {
      async read() {
        readCalls.push("read");
        throw new Error("token store unreachable");
      },
      async write() {},
      async clear() {
        readCalls.push("clear");
      },
    };
    const disconnector = createProviderDisconnector({
      provider: "Oura",
      tokenStoreFor: () => brokenStore,
      db: userStateDb,
      revoker: createOuraRevoker({ fetchImpl: okRevoke() }),
    });
    const h = await ouraHarness({
      auth: authAs(USER_A),
      userStateDb,
      disconnector,
    });
    try {
      const res = await fetch(`${h.baseUrl}/api/oura/disconnect`, {
        method: "DELETE",
      });
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({
        ok: true,
        local: "succeeded",
        // NOT 'skipped_no_tokens' — we never confirmed there was nothing
        // to revoke, we simply couldn't read the store. Wire-collapsed
        // into the same 'failed' value a rejected revoke call reports;
        // the granular reason ('token_read_failed') is server-side only.
        revocation: "failed",
        status: "snapshot_removed",
      });
      expect(readCalls).toEqual(["read", "clear"]);
      // Local cleanup (snapshot removal) proceeded despite the read
      // failure — this provider's key is gone, siblings untouched.
      expect(userStateDb.blobs.get(USER_A)).toEqual({
        whoop: { recovery: 60 },
      });
    } finally {
      await h.close();
    }
  });

  it("'unsupported' for Garmin — no revoke contract exists to call", async () => {
    const garminStores = new Map<string, GarminTokenStore>();
    const s = createInMemoryGarminTokenStore();
    garminStores.set(USER_A, s);
    await s.write({
      accessToken: "at",
      refreshToken: "rt",
      expiresAt: Date.now() + 3_600_000,
    });
    const userStateDb = createFakeUserStateDb({
      [USER_A]: { garmin: { bodyBattery: 44 } },
    });
    const tokenStoreFor = (u: string): GarminTokenStore =>
      garminStores.get(u) ?? createInMemoryGarminTokenStore();

    const app = express();
    app.use(
      "/api",
      buildGarminOAuthRouter({
        authStateStore: createInMemoryGarminAuthStateStore(),
        oauthConfig: { clientId: "cid", clientSecret: "sec" },
        redirectUri: "https://example.test/cb",
        tokenStoreFor,
        destructiveAuth: authAs(USER_A),
        disconnector: createProviderDisconnector({
          provider: "Garmin",
          tokenStoreFor,
          db: userStateDb,
          revocationSupported: false,
        }),
      }),
    );
    const h = await listen(app);
    try {
      const res = await fetch(`${h.baseUrl}/api/garmin/disconnect`, {
        method: "DELETE",
      });
      expect(await res.json()).toEqual({
        ok: true,
        local: "succeeded",
        // Distinct from 'skipped_not_configured': this is a permanent
        // property of Garmin, not a fixable deployment gap.
        revocation: "unsupported",
        status: "snapshot_removed",
      });
      expect(userStateDb.blobs.get(USER_A)).toEqual({});
    } finally {
      await h.close();
    }
  });

  it("'skipped_not_configured' on the legacy path, and it does NOT claim full local cleanup", async () => {
    const stores = new Map<string, OuraTokenStore>();
    const s = createInMemoryOuraTokenStore();
    stores.set(USER_A, s);
    await seedOura(s);
    const h = await ouraHarness({
      auth: authAs(USER_A),
      stores,
      disconnector: null,
    });
    try {
      const res = await fetch(`${h.baseUrl}/api/oura/disconnect`, {
        method: "DELETE",
      });
      expect(await res.json()).toEqual({
        ok: true,
        // Tokens only — the biometrics snapshot survives this path.
        local: "tokens_only",
        revocation: "skipped_not_configured",
      });
    } finally {
      await h.close();
    }
  });

  it("WHOOP now takes the same disconnector seam (W3 adoption)", async () => {
    const whoopStores = new Map<string, WhoopTokenStore>();
    const s = createInMemoryWhoopTokenStore();
    whoopStores.set(USER_A, s);
    await s.write({
      accessToken: "at",
      refreshToken: "rt",
      expiresAt: Date.now() + 3_600_000,
    });
    const userStateDb = createFakeUserStateDb({
      [USER_A]: { whoop: { recovery: 60 }, oura: { readinessScore: 82 } },
    });
    const tokenStoreFor = (u: string): WhoopTokenStore =>
      whoopStores.get(u) ?? createInMemoryWhoopTokenStore();
    const seen: Array<{ url: string; method?: string; auth?: string }> = [];
    const revoker = async (t: { accessToken: string }): Promise<void> => {
      seen.push({ url: "whoop", auth: t.accessToken });
    };

    const app = express();
    app.use(
      "/api",
      buildWhoopOAuthRouter({
        authStateStore: createInMemoryWhoopAuthStateStore(),
        oauthConfig: { clientId: "cid", clientSecret: "sec" },
        redirectUri: "https://example.test/cb",
        tokenStoreFor,
        destructiveAuth: authAs(USER_A),
        disconnector: createProviderDisconnector({
          provider: "Whoop",
          tokenStoreFor,
          db: userStateDb,
          revoker,
        }),
      }),
    );
    const h = await listen(app);
    try {
      const res = await fetch(`${h.baseUrl}/api/whoop/disconnect`, {
        method: "DELETE",
      });
      expect(await res.json()).toEqual({
        ok: true,
        local: "succeeded",
        revocation: "succeeded",
        status: "snapshot_removed",
      });
      expect(seen).toHaveLength(1);
      expect(await s.read()).toBeNull();
      // Sibling provider preserved.
      expect(userStateDb.blobs.get(USER_A)).toEqual({
        oura: { readinessScore: 82 },
      });
    } finally {
      await h.close();
    }
  });

  it("WHOOP's revoker calls the verified v2 endpoint with the user's bearer token", async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    const fetchImpl = (async (url: unknown, init?: RequestInit) => {
      calls.push({ url: String(url), init });
      return new Response(null, { status: 204 });
    }) as typeof fetch;
    const { createWhoopRevoker } = await import(
      "../../lib/providerKit/disconnect"
    );
    await createWhoopRevoker({ fetchImpl })({
      accessToken: "AT_SECRET",
      refreshToken: "RT",
      expiresAt: Date.now(),
    });
    expect(calls[0]?.url).toBe(
      "https://api.prod.whoop.com/developer/v2/user/access",
    );
    expect(calls[0]?.init?.method).toBe("DELETE");
    expect(
      (calls[0]?.init?.headers as Record<string, string>)["Authorization"],
    ).toBe("Bearer AT_SECRET");
  });

  it("treats a 401 from the provider as FAILED, not as already-revoked", async () => {
    // An expired ACCESS token 401s while the grant (and the refresh
    // token, and WHOOP's webhook subscription) can still be live.
    const { createWhoopRevoker } = await import(
      "../../lib/providerKit/disconnect"
    );
    const fetchImpl = (async () =>
      new Response(null, { status: 401 })) as typeof fetch;
    await expect(
      createWhoopRevoker({ fetchImpl })({
        accessToken: "AT",
        refreshToken: "RT",
        expiresAt: Date.now(),
      }),
    ).rejects.toThrow(/401/);
  });
});

/* ─── Account deletion cascade ────────────────────────────────────────────── */

interface CascadeSpy {
  cleared: string[];
  authStatesDeleted: string[];
  biometricsCleared: string[];
  purged: string[];
}

function accountDeletionHarnessDeps(spy: CascadeSpy): AccountDeletionDeps {
  const store = (name: string) => (userId: string) => ({
    clear: async (): Promise<void> => {
      spy.cleared.push(`${name}:${userId}`);
    },
  });
  return {
    whoopTokenStoreFor: store("whoop"),
    garminTokenStoreFor: store("garmin"),
    ouraTokenStoreFor: store("oura"),
    stravaTokenStoreFor: store("strava"),
    authStateDb: {
      deleteWhoopAuthStates: async (u) => {
        spy.authStatesDeleted.push(`whoop:${u}`);
      },
      deleteGarminAuthStates: async (u) => {
        spy.authStatesDeleted.push(`garmin:${u}`);
      },
      deleteOuraAuthStates: async (u) => {
        spy.authStatesDeleted.push(`oura:${u}`);
      },
      deleteStravaAuthStates: async (u) => {
        spy.authStatesDeleted.push(`strava:${u}`);
      },
      clearBiometrics: async (u) => {
        spy.biometricsCleared.push(u);
      },
    },
    healthRecordsRepo: {
      purgeUser: async (u: string) => {
        spy.purged.push(u);
        return { purged: spy.purged.length === 1 ? 3 : 0 };
      },
    },
  };
}

describe("POST /account/delete-health-data", () => {
  async function harness(
    auth: RequestHandler | undefined,
    spy: CascadeSpy,
    limit?: number,
  ): Promise<Harness> {
    const app = express();
    app.use(express.json());
    app.use(
      "/account",
      buildAccountDeletionRouter({
        ...accountDeletionHarnessDeps(spy),
        destructiveAuth: auth,
        destructiveRateLimit: limit ? { limit } : undefined,
      }),
    );
    return listen(app);
  }

  function spy(): CascadeSpy {
    return {
      cleared: [],
      authStatesDeleted: [],
      biometricsCleared: [],
      purged: [],
    };
  }

  it("401s an unauthenticated caller and 503s when Clerk is unconfigured", async () => {
    const s1 = spy();
    process.env["CLERK_SECRET_KEY"] = "sk_test_present";
    authHolder.value = { userId: null, sessionClaims: null };
    const h1 = await harness(undefined, s1);
    try {
      const res = await fetch(`${h1.baseUrl}/account/delete-health-data`, {
        method: "POST",
      });
      expect(res.status).toBe(401);
      expect(s1.purged).toHaveLength(0);
    } finally {
      await h1.close();
    }

    const s2 = spy();
    delete process.env["CLERK_SECRET_KEY"];
    const h2 = await harness(undefined, s2);
    try {
      const res = await fetch(`${h2.baseUrl}/account/delete-health-data`, {
        method: "POST",
      });
      expect(res.status).toBe(503);
      expect(s2.purged).toHaveLength(0);
    } finally {
      await h2.close();
    }
  });

  it("403s a cross-origin request without purging anything", async () => {
    const s = spy();
    const h = await harness(authAs(USER_A), s);
    try {
      const res = await fetch(`${h.baseUrl}/account/delete-health-data`, {
        method: "POST",
        headers: { Origin: "https://evil.example" },
      });
      expect(res.status).toBe(403);
      expect(s.cleared).toHaveLength(0);
      expect(s.purged).toHaveLength(0);
    } finally {
      await h.close();
    }
  });

  it("429s once the (tighter) bucket is exhausted", async () => {
    const s = spy();
    const h = await harness(authAs(USER_A), s, 1);
    try {
      const first = await fetch(`${h.baseUrl}/account/delete-health-data`, {
        method: "POST",
      });
      const second = await fetch(`${h.baseUrl}/account/delete-health-data`, {
        method: "POST",
      });
      expect(first.status).toBe(200);
      expect(second.status).toBe(429);
      expect(await second.json()).toEqual({
        error: "rate_limited",
        scope: "account_delete_health_data",
      });
    } finally {
      await h.close();
    }
  });

  it("cascades all four providers' tokens + auth states + biometrics + records, for the CALLER only", async () => {
    const s = spy();
    const h = await harness(authAs(USER_A), s);
    try {
      const res = await fetch(
        `${h.baseUrl}/account/delete-health-data?userId=${USER_B}`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ userId: USER_B }),
        },
      );
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({
        ok: true,
        status: "purged",
        purgedRecords: 3,
      });
      expect(s.cleared).toEqual([
        `whoop:${USER_A}`,
        `garmin:${USER_A}`,
        `oura:${USER_A}`,
        `strava:${USER_A}`,
      ]);
      expect(s.authStatesDeleted).toEqual([
        `whoop:${USER_A}`,
        `garmin:${USER_A}`,
        `oura:${USER_A}`,
        `strava:${USER_A}`,
      ]);
      expect(s.biometricsCleared).toEqual([USER_A]);
      expect(s.purged).toEqual([USER_A]);
      // Not one operation was performed against the userId the attacker
      // supplied in the query string and body.
      expect(JSON.stringify(s)).not.toContain(USER_B);
    } finally {
      await h.close();
    }
  });

  it("is idempotent — a second call purges 0 and still 200s", async () => {
    const s = spy();
    const h = await harness(authAs(USER_A), s);
    try {
      const first = await fetch(`${h.baseUrl}/account/delete-health-data`, {
        method: "POST",
      });
      const second = await fetch(`${h.baseUrl}/account/delete-health-data`, {
        method: "POST",
      });
      expect(first.status).toBe(200);
      expect(second.status).toBe(200);
      expect((await second.json()) as Record<string, unknown>).toEqual({
        ok: true,
        status: "purged",
        purgedRecords: 0,
      });
    } finally {
      await h.close();
    }
  });
});

/* Keeps the strava in-memory store import honest — the strava router is
 * byte-identical to oura's for these guards (same generated patch), so
 * its guard behavior is covered by the oura cases above; this asserts
 * only that its destructive route exists and refuses an anonymous
 * caller. */
describe("strava disconnect is guarded on the same terms", () => {
  it("refuses an unauthenticated caller", async () => {
    const { buildStravaOAuthRouter } = await import("../stravaOAuth");
    const { createInMemoryStravaAuthStateStore } = await import(
      "../../lib/stravaAuthStateStore"
    );
    delete process.env["CLERK_SECRET_KEY"];
    const app = express();
    app.use(
      "/api",
      buildStravaOAuthRouter({
        authStateStore: createInMemoryStravaAuthStateStore(),
        oauthConfig: { clientId: "cid", clientSecret: "sec" },
        redirectUri: "https://example.test/cb",
        tokenStoreFor: (): StravaTokenStore =>
          createInMemoryStravaTokenStore(),
      }),
    );
    const h = await listen(app);
    try {
      const res = await fetch(`${h.baseUrl}/api/strava/disconnect`, {
        method: "DELETE",
      });
      expect(res.status).toBe(503);
      const cross = await fetch(`${h.baseUrl}/api/strava/disconnect`, {
        method: "DELETE",
        headers: { Origin: "https://evil.example" },
      });
      expect(cross.status).toBe(403);
    } finally {
      await h.close();
    }
  });
});
