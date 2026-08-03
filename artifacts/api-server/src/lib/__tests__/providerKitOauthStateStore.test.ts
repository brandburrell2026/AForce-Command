/**
 * Tests for `providerKit/oauthStateStore.ts` — the provider-agnostic
 * PKCE / OAuth-state store extracted from the WHOOP/Oura pattern.
 *
 * In-memory driver coverage mirrors `whoopAuthStateStore.test.ts`
 * exactly (same contract, generic factory).
 *
 * Drizzle driver coverage uses an injected fake `db` (chainable
 * `.insert().values().onConflictDoUpdate()` / `.delete().where().returning()`
 * mocks) plus a plain stub table object — no real Postgres, no
 * `@workspace/db` schema import needed, since the store only ever
 * references the table's four column properties as opaque values.
 * This is the same "fake writer handle" style used by
 * `scoreSnapshotRepo.test.ts`'s `fakeTx`.
 */
import { describe, it, expect } from "vitest";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import {
  PROVIDER_AUTH_STATE_DEFAULT_TTL_MS,
  createInMemoryProviderAuthStateStore,
  createDrizzleProviderAuthStateStore,
  createProviderAuthStateStore,
  purgeExpiredProviderAuthStates,
  type ProviderAuthStateRecord,
  type ProviderAuthStateTable,
} from "../providerKit/oauthStateStore";

function rec(
  overrides: Partial<ProviderAuthStateRecord> = {},
): ProviderAuthStateRecord {
  return {
    codeVerifier: "VERIFIER",
    userId: "user_1",
    createdAtMs: 1_000_000,
    ...overrides,
  };
}

const FAKE_TABLE = {
  state: "state_col",
  codeVerifier: "code_verifier_col",
  userId: "user_id_col",
  createdAt: "created_at_col",
} as unknown as ProviderAuthStateTable;

interface FakeDbCapture {
  insertValues?: unknown;
  onConflictTarget?: unknown;
  onConflictSet?: unknown;
  deleteCalled?: boolean;
  returningArg?: unknown;
}

function makeFakeDb(opts: { deleteReturns: unknown[] }): {
  db: NodePgDatabase<Record<string, unknown>>;
  capture: FakeDbCapture;
} {
  const capture: FakeDbCapture = {};
  const db = {
    insert(_table: unknown) {
      return {
        values(v: unknown) {
          capture.insertValues = v;
          return {
            onConflictDoUpdate(o: { target: unknown; set: unknown }) {
              capture.onConflictTarget = o.target;
              capture.onConflictSet = o.set;
              return Promise.resolve();
            },
          };
        },
      };
    },
    delete(_table: unknown) {
      capture.deleteCalled = true;
      return {
        where(_w: unknown) {
          return {
            returning(r?: unknown) {
              capture.returningArg = r;
              return Promise.resolve(opts.deleteReturns);
            },
          };
        },
      };
    },
  };
  return { db: db as unknown as NodePgDatabase<Record<string, unknown>>, capture };
}

describe("createInMemoryProviderAuthStateStore", () => {
  it("rejects an empty state on put", async () => {
    const store = createInMemoryProviderAuthStateStore();
    await expect(store.put("", rec())).rejects.toThrow(/non-empty/);
  });

  it("consume on a never-issued state returns null", async () => {
    const store = createInMemoryProviderAuthStateStore();
    expect(await store.consume("nope", 0)).toBeNull();
  });

  it("put then consume returns the record verbatim", async () => {
    const store = createInMemoryProviderAuthStateStore();
    const r = rec({ codeVerifier: "V1", userId: "u1", createdAtMs: 100 });
    await store.put("s1", r);
    expect(await store.consume("s1", 100)).toEqual(r);
  });

  it("is single-use — a second consume returns null even within TTL", async () => {
    const store = createInMemoryProviderAuthStateStore({ ttlMs: 60_000 });
    await store.put("s1", rec({ createdAtMs: 0 }));
    expect(await store.consume("s1", 1_000)).not.toBeNull();
    expect(await store.consume("s1", 1_001)).toBeNull();
  });

  it("expired records return null AND are deleted (no clock-rewind revive)", async () => {
    const store = createInMemoryProviderAuthStateStore({ ttlMs: 1_000 });
    await store.put("s1", rec({ createdAtMs: 0 }));
    expect(await store.consume("s1", 5_000)).toBeNull();
    expect(await store.consume("s1", 0)).toBeNull();
  });

  it("respects a custom ttlMs", async () => {
    const store = createInMemoryProviderAuthStateStore({ ttlMs: 50 });
    await store.put("s1", rec({ createdAtMs: 0 }));
    expect(await store.consume("s1", 49)).not.toBeNull();
    await store.put("s2", rec({ createdAtMs: 0 }));
    expect(await store.consume("s2", 51)).toBeNull();
  });

  it("put with the same state twice is last-write-wins (defensive)", async () => {
    const store = createInMemoryProviderAuthStateStore();
    await store.put("s1", rec({ codeVerifier: "V1" }));
    await store.put("s1", rec({ codeVerifier: "V2" }));
    const got = await store.consume("s1", rec().createdAtMs);
    expect(got?.codeVerifier).toBe("V2");
  });

  it("defaults ttlMs to PROVIDER_AUTH_STATE_DEFAULT_TTL_MS", async () => {
    const store = createInMemoryProviderAuthStateStore();
    await store.put("s1", rec({ createdAtMs: 0 }));
    expect(
      await store.consume("s1", PROVIDER_AUTH_STATE_DEFAULT_TTL_MS - 1),
    ).not.toBeNull();
  });
});

describe("createDrizzleProviderAuthStateStore", () => {
  it("put: rejects an empty state without touching the db", async () => {
    const { db, capture } = makeFakeDb({ deleteReturns: [] });
    const store = createDrizzleProviderAuthStateStore(db, FAKE_TABLE);
    await expect(store.put("", rec())).rejects.toThrow(/non-empty/);
    expect(capture.insertValues).toBeUndefined();
  });

  it("put: inserts + upserts with the exact record shape, conflict-targeted at table.state", async () => {
    const { db, capture } = makeFakeDb({ deleteReturns: [] });
    const store = createDrizzleProviderAuthStateStore(db, FAKE_TABLE);
    await store.put(
      "s1",
      rec({ codeVerifier: "V1", userId: "u1", createdAtMs: 500 }),
    );
    expect(capture.insertValues).toEqual({
      state: "s1",
      codeVerifier: "V1",
      userId: "u1",
      createdAt: new Date(500),
    });
    expect(capture.onConflictTarget).toBe(FAKE_TABLE.state);
    expect(capture.onConflictSet).toEqual({
      codeVerifier: "V1",
      userId: "u1",
      createdAt: new Date(500),
    });
  });

  it("consume: no row deleted -> null", async () => {
    const { db } = makeFakeDb({ deleteReturns: [] });
    const store = createDrizzleProviderAuthStateStore(db, FAKE_TABLE);
    expect(await store.consume("nope", 1_000)).toBeNull();
  });

  it("consume: a fresh deleted row is mapped back to a ProviderAuthStateRecord", async () => {
    const { db } = makeFakeDb({
      deleteReturns: [
        { codeVerifier: "V1", userId: "u1", createdAt: new Date(1_000) },
      ],
    });
    const store = createDrizzleProviderAuthStateStore(db, FAKE_TABLE, {
      ttlMs: 60_000,
    });
    expect(await store.consume("s1", 1_500)).toEqual({
      codeVerifier: "V1",
      userId: "u1",
      createdAtMs: 1_000,
    });
  });

  it("consume: an expired deleted row still returns null (TTL applied after delete)", async () => {
    const { db } = makeFakeDb({
      deleteReturns: [
        { codeVerifier: "V1", userId: "u1", createdAt: new Date(0) },
      ],
    });
    const store = createDrizzleProviderAuthStateStore(db, FAKE_TABLE, {
      ttlMs: 1_000,
    });
    expect(await store.consume("s1", 5_000)).toBeNull();
  });

  it("defaults ttlMs to PROVIDER_AUTH_STATE_DEFAULT_TTL_MS", async () => {
    const { db } = makeFakeDb({
      deleteReturns: [
        { codeVerifier: "V1", userId: "u1", createdAt: new Date(0) },
      ],
    });
    const store = createDrizzleProviderAuthStateStore(db, FAKE_TABLE);
    // No explicit ttlMs -> falls back to the module default. A row
    // created at t=0 is expired by the time PROVIDER_AUTH_STATE_DEFAULT_TTL_MS + 1
    // has elapsed.
    expect(
      await store.consume("s1", PROVIDER_AUTH_STATE_DEFAULT_TTL_MS + 1),
    ).toBeNull();
  });
});

describe("purgeExpiredProviderAuthStates", () => {
  it("returns the count of reaped rows", async () => {
    const { db, capture } = makeFakeDb({
      deleteReturns: [{ state: "a" }, { state: "b" }],
    });
    const n = await purgeExpiredProviderAuthStates(db, FAKE_TABLE, 10_000, 1_000);
    expect(n).toBe(2);
    expect(capture.deleteCalled).toBe(true);
    expect(capture.returningArg).toEqual({ state: FAKE_TABLE.state });
  });

  it("returns 0 when nothing is reaped", async () => {
    const { db } = makeFakeDb({ deleteReturns: [] });
    const n = await purgeExpiredProviderAuthStates(db, FAKE_TABLE, 10_000, 1_000);
    expect(n).toBe(0);
  });
});

describe("createProviderAuthStateStore (dispatch factory)", () => {
  it("throws when provider is empty", () => {
    expect(() =>
      createProviderAuthStateStore({
        provider: "",
        driver: { kind: "memory" },
      }),
    ).toThrow(/provider is required/);
  });

  it("kind:'memory' builds a working in-memory store", async () => {
    const store = createProviderAuthStateStore({
      provider: "test",
      driver: { kind: "memory" },
    });
    await store.put("s1", rec());
    expect(await store.consume("s1", rec().createdAtMs)).not.toBeNull();
  });

  it("kind:'drizzle' builds a store bound to the given db/table", async () => {
    const { db, capture } = makeFakeDb({ deleteReturns: [] });
    const store = createProviderAuthStateStore({
      provider: "test",
      driver: { kind: "drizzle", db, table: FAKE_TABLE },
    });
    await store.put("s1", rec());
    expect(capture.insertValues).toMatchObject({ state: "s1" });
  });
});
