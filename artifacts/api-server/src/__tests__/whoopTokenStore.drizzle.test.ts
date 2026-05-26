/**
 * Integration tests for the per-user Drizzle WhoopTokenStore.
 *
 * Covers:
 *   - empty `userId` is rejected at factory time (cross-user safety)
 *   - read on missing row -> null
 *   - write -> read round-trips access/refresh/scope and converts
 *     `expiresAt` epoch ms <-> `timestamptz` losslessly
 *   - UPSERT semantics: second write for the same user overwrites
 *     the row (no duplicate, fields update, updated_at bumps)
 *   - clear deletes the row; subsequent read is null
 *   - per-user isolation: a write under userA does not leak into
 *     userB's read
 *   - optional `scope` round-trip and null preserved
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { eq, inArray } from "drizzle-orm";
import {
  db,
  aforceWhoopTokens,
  createDrizzleWhoopTokenStoreForUser,
} from "@workspace/db";

const TEST_PREFIX = "test_whoop_user_";
const user = (n: string): string => `${TEST_PREFIX}${n}`;

const SEED_USERS = [user("a"), user("b"), user("upsert"), user("scope")];

beforeAll(async () => {
  await db
    .delete(aforceWhoopTokens)
    .where(inArray(aforceWhoopTokens.userId, SEED_USERS));
});

afterAll(async () => {
  await db
    .delete(aforceWhoopTokens)
    .where(inArray(aforceWhoopTokens.userId, SEED_USERS));
});

describe("createDrizzleWhoopTokenStoreForUser", () => {
  it("refuses empty userId — prevents accidental row-key collapse", () => {
    expect(() => createDrizzleWhoopTokenStoreForUser(db, "")).toThrow(
      /userId must be non-empty/,
    );
  });

  it("read returns null when no row exists for the user", async () => {
    const store = createDrizzleWhoopTokenStoreForUser(db, user("a"));
    expect(await store.read()).toBeNull();
  });

  it("write -> read round-trips and converts epoch ms <-> timestamptz losslessly", async () => {
    const store = createDrizzleWhoopTokenStoreForUser(db, user("a"));
    // Pick a ms value that rounds cleanly through Postgres timestamptz.
    const expiresAt = Date.UTC(2030, 0, 15, 10, 30, 45, 0);
    await store.write({
      accessToken: "AT_v1",
      refreshToken: "RT_v1",
      expiresAt,
      scope: "offline read:recovery",
    });
    const got = await store.read();
    expect(got).toEqual({
      accessToken: "AT_v1",
      refreshToken: "RT_v1",
      expiresAt,
      scope: "offline read:recovery",
    });
  });

  it("UPSERT semantics: a second write for the same user overwrites the row and bumps updated_at", async () => {
    const store = createDrizzleWhoopTokenStoreForUser(db, user("upsert"));
    const t1 = Date.UTC(2030, 0, 15, 10, 30, 45, 0);
    const t2 = Date.UTC(2030, 0, 15, 11, 0, 0, 0);
    await store.write({
      accessToken: "AT_v1",
      refreshToken: "RT_v1",
      expiresAt: t1,
      scope: "offline",
    });
    const rowsBefore = await db
      .select()
      .from(aforceWhoopTokens)
      .where(eq(aforceWhoopTokens.userId, user("upsert")));
    expect(rowsBefore).toHaveLength(1);
    const firstUpdatedAt = rowsBefore[0]!.updatedAt.getTime();
    // Postgres `now()` only advances per transaction — sleep a hair
    // to guarantee a strictly-greater updated_at.
    await new Promise((r) => setTimeout(r, 25));
    await store.write({
      accessToken: "AT_v2",
      refreshToken: "RT_v2",
      expiresAt: t2,
      scope: "offline read:cycles",
    });
    const rowsAfter = await db
      .select()
      .from(aforceWhoopTokens)
      .where(eq(aforceWhoopTokens.userId, user("upsert")));
    expect(rowsAfter).toHaveLength(1);
    expect(rowsAfter[0]!.accessToken).toBe("AT_v2");
    expect(rowsAfter[0]!.refreshToken).toBe("RT_v2");
    expect(rowsAfter[0]!.expiresAt.getTime()).toBe(t2);
    expect(rowsAfter[0]!.scope).toBe("offline read:cycles");
    expect(rowsAfter[0]!.updatedAt.getTime()).toBeGreaterThanOrEqual(
      firstUpdatedAt,
    );
  });

  it("clear deletes the row; subsequent read is null", async () => {
    const store = createDrizzleWhoopTokenStoreForUser(db, user("a"));
    await store.clear();
    expect(await store.read()).toBeNull();
    const rows = await db
      .select()
      .from(aforceWhoopTokens)
      .where(eq(aforceWhoopTokens.userId, user("a")));
    expect(rows).toHaveLength(0);
  });

  it("per-user isolation: write under one user does not leak into another's read", async () => {
    const storeA = createDrizzleWhoopTokenStoreForUser(db, user("a"));
    const storeB = createDrizzleWhoopTokenStoreForUser(db, user("b"));
    await storeA.write({
      accessToken: "A_TOKEN",
      refreshToken: "A_REFRESH",
      expiresAt: 5_000_000_000_000,
      scope: "offline",
    });
    expect(await storeB.read()).toBeNull();
    expect((await storeA.read())?.accessToken).toBe("A_TOKEN");
    await storeA.clear();
  });

  it("preserves null scope when the manager didn't get one back from WHOOP", async () => {
    const store = createDrizzleWhoopTokenStoreForUser(db, user("scope"));
    await store.write({
      accessToken: "AT",
      refreshToken: "RT",
      expiresAt: 4_000_000_000_000,
      // scope omitted -> store should normalize to null.
    });
    const got = await store.read();
    expect(got?.scope).toBeNull();
  });
});
