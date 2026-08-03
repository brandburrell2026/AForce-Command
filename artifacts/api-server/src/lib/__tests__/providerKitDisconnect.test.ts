/**
 * Tests for `providerKit/disconnect.ts` — the provider-agnostic
 * disconnect + local-cleanup orchestration (Lane F5: privacy/disconnect/
 * deletion enforcement).
 *
 * Pure unit tests with hand-rolled in-memory deps — no Postgres, no
 * real HTTP. The jsonb `#-` (delete-path) operator inside
 * `createDrizzleProviderUserStateDb` is only proven against a REAL
 * Postgres in
 * `lib/db/src/__integration__/providerCleanup.integration.test.ts`;
 * here `ProviderUserStateDb` is faked directly so these tests stay fast
 * and Docker-free.
 *
 * Coverage matrix:
 *   - step ORDERING: revoke -> token clear -> snapshot removal ->
 *     (optional) record tombstone, in that exact sequence
 *   - revoker FAILURE is non-blocking: local cleanup still completes,
 *     the failure is recorded (not thrown)
 *   - no revoker configured (the Garmin case): disconnect still
 *     completes; revocation.reason reports why nothing was attempted
 *   - IDEMPOTENCY: a second `disconnect()` call for the same user is a
 *     clean no-op success (nothing left to revoke/clear/remove/tombstone)
 *   - USER ISOLATION: disconnecting user A never touches user B's
 *     tokens or snapshot state
 *   - real failures (token clear / snapshot removal / record tombstone
 *     throwing) propagate — the route layer must be able to 500 rather
 *     than report a disconnect that didn't happen
 *   - `status` reflects whether a record tombstone was attempted
 *   - `createOuraRevoker` / `createStravaRevoker`: correct endpoint +
 *     access_token param; non-2xx response throws
 *   - `createDrizzleProviderUserStateDb`: wiring-level check (fake
 *     drizzle chain) that `removed` reflects whether a row came back
 */
import './_f5Env';
import { describe, it, expect, vi } from "vitest";
import {
  createProviderDisconnector,
  createOuraRevoker,
  createStravaRevoker,
  createDrizzleProviderUserStateDb,
  type ProviderUserStateDb,
  type ProviderRecordsRepoLike,
  type CreateProviderDisconnectorOptions,
} from "../providerKit/disconnect";
import type { ProviderTokens, ProviderTokenStore } from "../providerKit/tokenManager";

/* ─── fakes ───────────────────────────────────────────────────────────────── */

function fakeTokenStore(
  seed: ProviderTokens | null,
  calls: string[],
  label: string,
): ProviderTokenStore {
  let current = seed;
  return {
    async read() {
      calls.push(`${label}:read`);
      return current;
    },
    async write(t) {
      calls.push(`${label}:write`);
      current = t;
    },
    async clear() {
      calls.push(`${label}:clear`);
      current = null;
    },
  };
}

function fakeUserStateDb(
  seed: Map<string, Set<string>>,
  calls: string[],
): ProviderUserStateDb {
  return {
    async removeProviderSnapshotEntry(userId, providerKey) {
      calls.push(`db:remove(${userId},${providerKey})`);
      const keys = seed.get(userId);
      if (!keys || !keys.has(providerKey)) return { removed: false };
      keys.delete(providerKey);
      return { removed: true };
    },
  };
}

function fakeRecordsRepo(
  seed: Map<string, Set<string>>,
  calls: string[],
): ProviderRecordsRepoLike {
  return {
    async tombstoneProvider(userId, provider) {
      calls.push(`records:tombstone(${userId},${provider})`);
      const providers = seed.get(userId);
      if (!providers || !providers.has(provider)) return { tombstoned: 0 };
      providers.delete(provider);
      return { tombstoned: 1 };
    },
  };
}

const SAMPLE_TOKENS: ProviderTokens = {
  accessToken: "at_123",
  refreshToken: "rt_456",
  expiresAt: Date.now() + 3_600_000,
};

/* ─── ordering + basic contract ──────────────────────────────────────────── */

describe("createProviderDisconnector.disconnect — step ordering", () => {
  it("revokes, THEN clears tokens, THEN removes the snapshot key, THEN (if asked) tombstones records — in that order", async () => {
    const calls: string[] = [];
    const store = fakeTokenStore(SAMPLE_TOKENS, calls, "oura");
    const db = fakeUserStateDb(new Map([["u1", new Set(["oura"])]]), calls);
    const records = fakeRecordsRepo(new Map([["u1", new Set(["oura"])]]), calls);
    const revoker = vi.fn(async () => {
      calls.push("revoker:call");
    });

    const disconnector = createProviderDisconnector({
      provider: "Oura",
      tokenStoreFor: () => store,
      db,
      revoker,
      healthRecordsRepo: records,
    });

    const result = await disconnector.disconnect("u1", { purgeRecords: true });

    expect(calls).toEqual([
      "oura:read",
      "revoker:call",
      "oura:clear",
      "db:remove(u1,oura)",
      "records:tombstone(u1,oura)",
    ]);
    expect(result).toMatchObject({
      provider: "Oura",
      userId: "u1",
      status: "data_tombstoned",
      tokensDeleted: true,
      snapshotRemoved: true,
      recordsTombstoned: 1,
      revocation: { attempted: true, ok: true },
    });
  });

  it("status is 'snapshot_removed' (not 'data_tombstoned') when purgeRecords is omitted", async () => {
    const calls: string[] = [];
    const store = fakeTokenStore(SAMPLE_TOKENS, calls, "strava");
    const db = fakeUserStateDb(new Map([["u1", new Set(["strava"])]]), calls);
    const records = fakeRecordsRepo(new Map([["u1", new Set(["strava"])]]), calls);

    const disconnector = createProviderDisconnector({
      provider: "Strava",
      tokenStoreFor: () => store,
      db,
      healthRecordsRepo: records,
    });

    const result = await disconnector.disconnect("u1");

    expect(result.status).toBe("snapshot_removed");
    expect(result.recordsTombstoned).toBeNull();
    // Never reached the tombstone step at all.
    expect(calls.some((c) => c.startsWith("records:tombstone"))).toBe(false);
  });
});

/* ─── revoker failure is non-blocking ────────────────────────────────────── */

describe("createProviderDisconnector.disconnect — revocation failure never blocks local cleanup", () => {
  it("records revocation.ok=false and STILL clears tokens + removes the snapshot key", async () => {
    const calls: string[] = [];
    const store = fakeTokenStore(SAMPLE_TOKENS, calls, "oura");
    const db = fakeUserStateDb(new Map([["u1", new Set(["oura"])]]), calls);
    const revoker = vi.fn(async () => {
      throw new Error("oura revoke failed: HTTP 500");
    });

    const disconnector = createProviderDisconnector({
      provider: "Oura",
      tokenStoreFor: () => store,
      db,
      revoker,
    });

    const result = await disconnector.disconnect("u1");

    expect(revoker).toHaveBeenCalledTimes(1);
    expect(result.revocation).toMatchObject({ attempted: true, ok: false });
    expect(result.revocation.reason).toBe("Error");
    expect(result.tokensDeleted).toBe(true);
    expect(result.snapshotRemoved).toBe(true);
  });

  it("a token-read failure before revoke is also non-blocking, and is reported as 'failed' — NEVER 'skipped_no_tokens'", async () => {
    // This is the F5-follow-up fix: a store.read() throw used to fall into
    // the "nothing stored" branch and claim skipped_no_tokens — "nothing to
    // revoke" — when the truth was "couldn't look." A live grant could be
    // sitting unrevoked while the caller is told there was nothing to do.
    const calls: string[] = [];
    const store: ProviderTokenStore = {
      async read() {
        throw new Error("transient read error");
      },
      async write() {},
      async clear() {
        calls.push("clear");
      },
    };
    const db = fakeUserStateDb(new Map(), calls);
    const revoker = vi.fn();

    const disconnector = createProviderDisconnector({
      provider: "Oura",
      tokenStoreFor: () => store,
      db,
      revoker,
    });

    const result = await disconnector.disconnect("u1");

    // Nothing safe to hand the revoker, so it's never invoked — but that
    // must not be conflated with "confirmed nothing to revoke."
    expect(revoker).not.toHaveBeenCalled();
    expect(result.revocation).toEqual({
      attempted: false,
      // ok:false (not null) — err toward "the grant may still be live",
      // the same posture as a revoker call that actually ran and lost.
      ok: false,
      reason: "token_read_failed",
      outcome: "failed",
    });
    // Local cleanup (step 2+) still proceeds regardless.
    expect(calls).toContain("clear");
  });

  it("an EMPTY store (read resolves null, no throw) is the true idempotent case — still skipped_no_tokens", async () => {
    const calls: string[] = [];
    const store: ProviderTokenStore = {
      async read() {
        return null;
      },
      async write() {},
      async clear() {
        calls.push("clear");
      },
    };
    const db = fakeUserStateDb(new Map(), calls);
    const revoker = vi.fn();

    const disconnector = createProviderDisconnector({
      provider: "Oura",
      tokenStoreFor: () => store,
      db,
      revoker,
    });

    const result = await disconnector.disconnect("u1");

    expect(revoker).not.toHaveBeenCalled();
    expect(result.revocation).toEqual({
      attempted: false,
      ok: null,
      reason: "no_tokens_stored",
      outcome: "skipped_no_tokens",
    });
    expect(calls).toContain("clear");
  });

  it("a MALFORMED stored token (store resolves a truthy value with no usable accessToken) is honestly 'failed', never handed to the revoker", async () => {
    const calls: string[] = [];
    const revoker = vi.fn(async () => {
      throw new Error("revoker must never be called with a malformed token");
    });
    const garbageCases: Array<Record<string, unknown>> = [
      // Missing accessToken entirely.
      { refreshToken: "rt", expiresAt: Date.now() },
      // accessToken present but blank — equally unusable against a real
      // provider endpoint (e.g. `?access_token=` with nothing after it).
      { accessToken: "", refreshToken: "rt", expiresAt: Date.now() },
    ];

    for (const garbage of garbageCases) {
      const store: ProviderTokenStore = {
        async read() {
          return garbage as unknown as ProviderTokens;
        },
        async write() {},
        async clear() {
          calls.push("clear");
        },
      };
      const disconnector = createProviderDisconnector({
        provider: "Oura",
        tokenStoreFor: () => store,
        db: fakeUserStateDb(new Map(), calls),
        revoker,
      });

      const result = await disconnector.disconnect("u1");

      expect(revoker).not.toHaveBeenCalled();
      expect(result.revocation).toEqual({
        attempted: false,
        ok: false,
        reason: "token_read_malformed",
        outcome: "failed",
      });
      // Local cleanup still proceeds even though revocation couldn't run.
      expect(result.tokensDeleted).toBe(true);
    }
  });

  it("no revoker configured (the Garmin case) — disconnect still completes", async () => {
    const calls: string[] = [];
    const store = fakeTokenStore(SAMPLE_TOKENS, calls, "garmin");
    const db = fakeUserStateDb(new Map([["u1", new Set(["garmin"])]]), calls);

    const disconnector = createProviderDisconnector({
      provider: "Garmin",
      tokenStoreFor: () => store,
      db,
      // revoker omitted — mirrors the Garmin mount (unverified partner API).
    });

    const result = await disconnector.disconnect("u1");

    expect(result.revocation).toEqual({
      attempted: false,
      ok: null,
      reason: "no_revoker_configured",
      // No `revocationSupported: false` passed here, so this mount reads
      // as a fixable deployment gap rather than "Garmin has no revoke
      // contract". The production Garmin mount DOES pass the flag and
      // therefore reports 'unsupported' — see
      // `routes/__tests__/providerDisconnectMounts.test.ts`.
      outcome: "skipped_not_configured",
    });
    expect(result.tokensDeleted).toBe(true);
    expect(result.snapshotRemoved).toBe(true);
    // Never even reads tokens when there's no revoker to hand them to.
    expect(calls).toEqual(["garmin:clear", "db:remove(u1,garmin)"]);
  });
});

/* ─── idempotency ─────────────────────────────────────────────────────────── */

describe("createProviderDisconnector.disconnect — idempotency", () => {
  it("a repeat call for the same user is a clean no-op success", async () => {
    const calls: string[] = [];
    const store = fakeTokenStore(SAMPLE_TOKENS, calls, "oura");
    const db = fakeUserStateDb(new Map([["u1", new Set(["oura"])]]), calls);
    const records = fakeRecordsRepo(new Map([["u1", new Set(["oura"])]]), calls);
    const revoker = vi.fn(async () => {});

    const disconnector = createProviderDisconnector({
      provider: "Oura",
      tokenStoreFor: () => store,
      db,
      revoker,
      healthRecordsRepo: records,
    });

    const first = await disconnector.disconnect("u1", { purgeRecords: true });
    expect(first.revocation.attempted).toBe(true);
    expect(first.snapshotRemoved).toBe(true);
    expect(first.recordsTombstoned).toBe(1);

    const second = await disconnector.disconnect("u1", { purgeRecords: true });
    expect(second.revocation).toEqual({
      attempted: false,
      ok: null,
      reason: "no_tokens_stored",
      // Truthful about the repeat call: nothing was revoked THIS time.
      outcome: "skipped_no_tokens",
    });
    expect(second.tokensDeleted).toBe(true); // clear() on empty store still "succeeds"
    expect(second.snapshotRemoved).toBe(false); // key already gone
    expect(second.recordsTombstoned).toBe(0); // already tombstoned
    expect(second.status).toBe("data_tombstoned"); // still "attempted", just 0 rows

    // Revoker was only ever invoked once — the second call had nothing to revoke.
    expect(revoker).toHaveBeenCalledTimes(1);
  });
});

/* ─── user isolation ──────────────────────────────────────────────────────── */

describe("createProviderDisconnector.disconnect — user isolation", () => {
  it("disconnecting user A never touches user B's tokens or snapshot state", async () => {
    const calls: string[] = [];
    const stores = new Map<string, ProviderTokenStore>([
      ["userA", fakeTokenStore(SAMPLE_TOKENS, calls, "oura:A")],
      ["userB", fakeTokenStore(SAMPLE_TOKENS, calls, "oura:B")],
    ]);
    const snapshotState = new Map<string, Set<string>>([
      ["userA", new Set(["oura"])],
      ["userB", new Set(["oura"])],
    ]);
    const db = fakeUserStateDb(snapshotState, calls);

    const disconnector = createProviderDisconnector({
      provider: "Oura",
      tokenStoreFor: (userId) => stores.get(userId)!,
      db,
    });

    await disconnector.disconnect("userA");

    // No revoker configured here, so there's no read-before-revoke step
    // (see the "no revoker configured" test above) — just clear + remove,
    // both scoped to user A only. User B's store is never touched at all.
    expect(calls).toEqual(["oura:A:clear", "db:remove(userA,oura)"]);
    expect(snapshotState.get("userA")!.has("oura")).toBe(false);
    expect(snapshotState.get("userB")!.has("oura")).toBe(true);

    // User B's store is untouched — reading it directly still returns tokens.
    expect(await stores.get("userB")!.read()).toEqual(SAMPLE_TOKENS);
  });
});

/* ─── real failures propagate ─────────────────────────────────────────────── */

describe("createProviderDisconnector.disconnect — durable-write failures propagate", () => {
  function baseOpts(overrides: Partial<CreateProviderDisconnectorOptions> = {}) {
    const calls: string[] = [];
    return {
      calls,
      opts: {
        provider: "Oura",
        tokenStoreFor: () => fakeTokenStore(SAMPLE_TOKENS, calls, "oura"),
        db: fakeUserStateDb(new Map([["u1", new Set(["oura"])]]), calls),
        ...overrides,
      } satisfies CreateProviderDisconnectorOptions,
    };
  }

  it("throws when the token store fails to clear", async () => {
    const { opts } = baseOpts({
      tokenStoreFor: () => ({
        read: async () => SAMPLE_TOKENS,
        write: async () => {},
        clear: async () => {
          throw new Error("db down");
        },
      }),
    });
    const disconnector = createProviderDisconnector(opts);
    await expect(disconnector.disconnect("u1")).rejects.toThrow("db down");
  });

  it("throws when snapshot removal fails", async () => {
    const { opts } = baseOpts({
      db: {
        removeProviderSnapshotEntry: async () => {
          throw new Error("update failed");
        },
      },
    });
    const disconnector = createProviderDisconnector(opts);
    await expect(disconnector.disconnect("u1")).rejects.toThrow("update failed");
  });

  it("local-cleanup failure propagates even when revocation itself SUCCEEDED — never surfaces a misleading partial-success result", async () => {
    // A successful revoker call followed by a snapshot-removal throw must
    // reject the whole call, not resolve with a result object that reports
    // revocation:'succeeded' while silently omitting that cleanup failed.
    // The route layer's only honest option here is to 500.
    const { opts } = baseOpts({
      revoker: async () => {},
      db: {
        removeProviderSnapshotEntry: async () => {
          throw new Error("snapshot update failed");
        },
      },
    });
    const disconnector = createProviderDisconnector(opts);
    await expect(disconnector.disconnect("u1")).rejects.toThrow(
      "snapshot update failed",
    );
  });

  it("throws when the record tombstone fails (only when purgeRecords is requested)", async () => {
    const { opts } = baseOpts({
      healthRecordsRepo: {
        tombstoneProvider: async () => {
          throw new Error("tombstone failed");
        },
      },
    });
    const disconnector = createProviderDisconnector(opts);
    await expect(
      disconnector.disconnect("u1", { purgeRecords: true }),
    ).rejects.toThrow("tombstone failed");
    // Without purgeRecords, the same failing repo is never even called.
    await expect(disconnector.disconnect("u1")).resolves.toMatchObject({
      status: "snapshot_removed",
    });
  });
});

/* ─── revokers ────────────────────────────────────────────────────────────── */

describe("createOuraRevoker", () => {
  it("POSTs to the Oura revoke endpoint with the access token as a query param", async () => {
    const calls: Array<{ url: string; init: unknown }> = [];
    const fetchImpl = vi.fn(async (url: string | URL, init?: RequestInit) => {
      calls.push({ url: String(url), init });
      return new Response(null, { status: 200 });
    }) as unknown as typeof fetch;

    await createOuraRevoker({ fetchImpl })(SAMPLE_TOKENS);

    expect(calls).toHaveLength(1);
    expect(calls[0]!.url).toBe(
      "https://api.ouraring.com/oauth/revoke?access_token=at_123",
    );
    expect((calls[0]!.init as RequestInit).method).toBe("POST");
  });

  it("throws on a non-2xx response", async () => {
    const fetchImpl = vi.fn(async () => new Response(null, { status: 401 })) as unknown as typeof fetch;
    await expect(createOuraRevoker({ fetchImpl })(SAMPLE_TOKENS)).rejects.toThrow(
      /HTTP 401/,
    );
  });
});

describe("createStravaRevoker", () => {
  it("POSTs to the Strava deauthorize endpoint with the access token as a query param", async () => {
    const calls: Array<{ url: string; init: unknown }> = [];
    const fetchImpl = vi.fn(async (url: string | URL, init?: RequestInit) => {
      calls.push({ url: String(url), init });
      return new Response(null, { status: 200 });
    }) as unknown as typeof fetch;

    await createStravaRevoker({ fetchImpl })(SAMPLE_TOKENS);

    expect(calls).toHaveLength(1);
    expect(calls[0]!.url).toBe(
      "https://www.strava.com/oauth/deauthorize?access_token=at_123",
    );
    expect((calls[0]!.init as RequestInit).method).toBe("POST");
  });

  it("throws on a non-2xx response", async () => {
    const fetchImpl = vi.fn(async () => new Response(null, { status: 500 })) as unknown as typeof fetch;
    await expect(createStravaRevoker({ fetchImpl })(SAMPLE_TOKENS)).rejects.toThrow(
      /HTTP 500/,
    );
  });
});

/* ─── createDrizzleProviderUserStateDb — wiring level ────────────────────── */

describe("createDrizzleProviderUserStateDb", () => {
  function fakeDrizzleDb(returningRows: Array<{ id: string }>) {
    const calls: string[] = [];
    const db = {
      update(table: unknown) {
        calls.push("update");
        return {
          set(setObj: unknown) {
            calls.push("set");
            void table;
            void setObj;
            return {
              where(whereObj: unknown) {
                calls.push("where");
                void whereObj;
                return {
                  returning: async (sel: unknown) => {
                    calls.push("returning");
                    void sel;
                    return returningRows;
                  },
                };
              },
            };
          },
        };
      },
    };
    return { db: db as unknown as Parameters<typeof createDrizzleProviderUserStateDb>[0], calls };
  }

  it("reports removed:true when the UPDATE returns a row", async () => {
    const { db, calls } = fakeDrizzleDb([{ id: "u1" }]);
    const stateDb = createDrizzleProviderUserStateDb(db);
    const result = await stateDb.removeProviderSnapshotEntry("u1", "oura");
    expect(result).toEqual({ removed: true });
    expect(calls).toEqual(["update", "set", "where", "returning"]);
  });

  it("reports removed:false when the UPDATE returns no row (e.g. no state row for this user)", async () => {
    const { db } = fakeDrizzleDb([]);
    const stateDb = createDrizzleProviderUserStateDb(db);
    const result = await stateDb.removeProviderSnapshotEntry("u1", "oura");
    expect(result).toEqual({ removed: false });
  });
});
