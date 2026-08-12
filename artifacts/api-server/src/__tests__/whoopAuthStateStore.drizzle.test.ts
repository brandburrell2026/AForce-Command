/**
 * DB integration tests for `createDrizzleWhoopAuthStateStore`.
 *
 * The whole point of moving off the in-memory map is multi-replica
 * correctness, so the load-bearing coverage here is:
 *   - parity with the in-memory contract (put/consume/TTL/single-use)
 *   - atomicity of single-use under concurrency — N callers racing
 *     `consume` on the same state must see EXACTLY one winning row,
 *     everyone else null. This is what `DELETE ... RETURNING` buys us
 *     and what an "in-memory map per replica" cannot provide.
 *   - sweep helper removes only the rows older than `ttlMs`.
 *
 * Test isolation: every row is prefixed `test_authstate_<pid>_` so
 * parallel test runs don't collide. Setup/teardown deletes by prefix.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { sql } from "drizzle-orm";
import { db, aforceWhoopAuthStates } from "@workspace/db";
import {
  createDrizzleWhoopAuthStateStore,
  purgeExpiredWhoopAuthStates,
  type WhoopAuthStateRecord,
} from "../lib/whoopAuthStateStore";

// requires real Postgres — runs in the DB lane (pnpm test:db)
const DB = Boolean(process.env['DB_TESTS']);

const PREFIX = `test_authstate_${process.pid}_`;
const k = (n: string): string => `${PREFIX}${n}`;

async function cleanup(): Promise<void> {
  await db
    .delete(aforceWhoopAuthStates)
    .where(sql`${aforceWhoopAuthStates.state} LIKE ${PREFIX + "%"}`);
}

beforeAll(cleanup);
afterAll(cleanup);

function rec(overrides: Partial<WhoopAuthStateRecord> = {}): WhoopAuthStateRecord {
  return {
    codeVerifier: "VERIFIER",
    userId: "user_1",
    createdAtMs: Date.now(),
    ...overrides,
  };
}

describe.runIf(DB)("createDrizzleWhoopAuthStateStore — DB integration", () => {
  it("rejects an empty state on put", async () => {
    const store = createDrizzleWhoopAuthStateStore(db);
    await expect(store.put("", rec())).rejects.toThrow(/non-empty/);
  });

  it("consume on a never-issued state returns null", async () => {
    const store = createDrizzleWhoopAuthStateStore(db);
    expect(await store.consume(k("nope"), Date.now())).toBeNull();
  });

  it("put then consume returns the record verbatim", async () => {
    const store = createDrizzleWhoopAuthStateStore(db);
    const r = rec({ codeVerifier: "V1", userId: "u1", createdAtMs: 1_700_000_000_000 });
    await store.put(k("happy"), r);
    const got = await store.consume(k("happy"), r.createdAtMs);
    expect(got).toEqual(r);
  });

  it("is single-use — a second consume returns null even within TTL", async () => {
    const store = createDrizzleWhoopAuthStateStore(db, { ttlMs: 60_000 });
    const t0 = 1_700_000_000_000;
    await store.put(k("single"), rec({ createdAtMs: t0 }));
    expect(await store.consume(k("single"), t0 + 1_000)).not.toBeNull();
    expect(await store.consume(k("single"), t0 + 1_001)).toBeNull();
  });

  it("expired records return null AND are deleted (no clock-rewind revive)", async () => {
    const store = createDrizzleWhoopAuthStateStore(db, { ttlMs: 1_000 });
    const t0 = 1_700_000_000_000;
    await store.put(k("expired"), rec({ createdAtMs: t0 }));
    expect(await store.consume(k("expired"), t0 + 5_000)).toBeNull();
    expect(await store.consume(k("expired"), t0)).toBeNull();
  });

  it("put with the same state twice is last-write-wins (UPSERT)", async () => {
    const store = createDrizzleWhoopAuthStateStore(db);
    await store.put(k("upsert"), rec({ codeVerifier: "V1" }));
    await store.put(k("upsert"), rec({ codeVerifier: "V2" }));
    const got = await store.consume(k("upsert"), Date.now());
    expect(got?.codeVerifier).toBe("V2");
  });

  it("CONCURRENT consume on the same state: exactly one winner, all others null", async () => {
    // This is the multi-replica correctness test. Two concurrent
    // `consume` calls model "callback handlers on two replicas racing
    // a double-clicked OAuth redirect". `DELETE ... RETURNING` must
    // hand the row to exactly one caller.
    const store = createDrizzleWhoopAuthStateStore(db);
    const state = k("race");
    const r = rec({ codeVerifier: "RACE", userId: "u_race", createdAtMs: Date.now() });
    await store.put(state, r);

    const racers = 8;
    const now = Date.now();
    const results = await Promise.all(
      Array.from({ length: racers }, () => store.consume(state, now)),
    );
    const winners = results.filter((x) => x !== null);
    expect(winners).toHaveLength(1);
    expect(winners[0]?.codeVerifier).toBe("RACE");
    // And the row is gone.
    expect(await store.consume(state, now)).toBeNull();
  });

  it("purgeExpiredWhoopAuthStates reaps only rows older than ttlMs", async () => {
    const store = createDrizzleWhoopAuthStateStore(db);
    const now = Date.now();
    // One stale (created 1h ago), one fresh (created now).
    await store.put(k("stale"), rec({ createdAtMs: now - 60 * 60 * 1000 }));
    await store.put(k("fresh"), rec({ createdAtMs: now }));

    const reaped = await purgeExpiredWhoopAuthStates(db, now, 10 * 60 * 1000);
    // At least the one we just inserted should be reaped. Other
    // parallel-test rows under different prefixes are not our concern
    // here — we only assert ours is gone and the fresh one survives.
    expect(reaped).toBeGreaterThanOrEqual(1);
    expect(await store.consume(k("stale"), now)).toBeNull();
    expect(await store.consume(k("fresh"), now)).not.toBeNull();
  });
});
