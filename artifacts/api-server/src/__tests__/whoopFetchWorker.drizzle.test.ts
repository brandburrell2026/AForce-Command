/**
 * Integration tests for the Drizzle UserStateRepo used by the WHOOP
 * fetch worker.
 *
 * The architect flagged a lost-update window in the previous read-
 * merge-write shape. The new repo writes a single provider key via
 * `jsonb_set` so two providers writing concurrently cannot clobber
 * each other. These tests prove that property against real Postgres.
 *
 * Covers:
 *   - writeProviderEntry on a missing row -> false, no rows touched
 *   - row with biometrics = NULL -> jsonb_set materializes a new
 *     object with the provider key (COALESCE path)
 *   - row with an existing OTHER provider key -> our write preserves
 *     the existing key untouched, only the WHOOP key is set
 *   - subsequent write overwrites the WHOOP key only, other
 *     providers still preserved
 *   - concurrent writes for two different providers do not clobber
 *     each other (the original lost-update bug) — both end up in
 *     the final blob
 */
import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { eq, inArray } from "drizzle-orm";
import { db, aforceUserState } from "@workspace/db";
import { createDrizzleUserStateRepo } from "../lib/whoopFetchWorker";

const TEST_PREFIX = "test_whoop_worker_";
const user = (n: string): string => `${TEST_PREFIX}${n}`;
const SEED = [
  user("none"),
  user("null_blob"),
  user("other_only"),
  user("race"),
  user("weird_key"),
];

const repo = createDrizzleUserStateRepo(db);

async function clean(): Promise<void> {
  await db
    .delete(aforceUserState)
    .where(inArray(aforceUserState.userId, SEED));
}

beforeEach(clean);
afterAll(clean);

interface BiometricsRow {
  biometrics: Record<string, unknown> | null;
}

async function readBlob(userId: string): Promise<BiometricsRow | undefined> {
  const rows = await db
    .select({ biometrics: aforceUserState.biometrics })
    .from(aforceUserState)
    .where(eq(aforceUserState.userId, userId))
    .limit(1);
  const row = rows[0];
  if (!row) return undefined;
  return { biometrics: (row.biometrics ?? null) as Record<string, unknown> | null };
}

describe("createDrizzleUserStateRepo.writeProviderEntry", () => {
  it("returns false when no state row exists; no row is created", async () => {
    const ok = await repo.writeProviderEntry(user("none"), "whoop", {
      providerId: "whoop",
      fetchedAt: 1,
    });
    expect(ok).toBe(false);
    expect(await readBlob(user("none"))).toBeUndefined();
  });

  it("materializes a new biometrics object on a row with biometrics = NULL", async () => {
    await db.insert(aforceUserState).values({ userId: user("null_blob") });
    const ok = await repo.writeProviderEntry(user("null_blob"), "whoop", {
      providerId: "whoop",
      fetchedAt: 42,
      recoveryPct: 80,
    });
    expect(ok).toBe(true);
    const row = await readBlob(user("null_blob"));
    expect(row?.biometrics).toEqual({
      whoop: { providerId: "whoop", fetchedAt: 42, recoveryPct: 80 },
    });
  });

  it("preserves an existing other-provider entry — only the targeted key is touched", async () => {
    await db.insert(aforceUserState).values({
      userId: user("other_only"),
      biometrics: {
        samsung_health: {
          providerId: "samsung_health",
          fetchedAt: 1,
          restingHeartRate: 60,
        },
      } as never,
    });
    const ok = await repo.writeProviderEntry(user("other_only"), "whoop", {
      providerId: "whoop",
      fetchedAt: 2,
      recoveryPct: 70,
    });
    expect(ok).toBe(true);
    const row = await readBlob(user("other_only"));
    expect(row?.biometrics).toEqual({
      samsung_health: {
        providerId: "samsung_health",
        fetchedAt: 1,
        restingHeartRate: 60,
      },
      whoop: { providerId: "whoop", fetchedAt: 2, recoveryPct: 70 },
    });

    // Second WHOOP write overwrites the WHOOP key only — other
    // providers still preserved, WHOOP itself fully replaced (not
    // shallow-merged at the key level).
    const ok2 = await repo.writeProviderEntry(user("other_only"), "whoop", {
      providerId: "whoop",
      fetchedAt: 3,
      strain: 12,
    });
    expect(ok2).toBe(true);
    const row2 = await readBlob(user("other_only"));
    expect(row2?.biometrics).toEqual({
      samsung_health: {
        providerId: "samsung_health",
        fetchedAt: 1,
        restingHeartRate: 60,
      },
      whoop: { providerId: "whoop", fetchedAt: 3, strain: 12 },
    });
  });

  it("concurrent writes for two different providers do not clobber each other", async () => {
    // This is the architect-flagged lost-update bug. With the old
    // read-merge-write shape, two simultaneous writers would each
    // read an empty blob, merge their own provider in, then write —
    // and the loser would erase the winner's key. With `jsonb_set`
    // the keys live in independent slots inside Postgres so both
    // survive.
    await db.insert(aforceUserState).values({ userId: user("race") });

    const writes = Array.from({ length: 12 }, (_, i) => {
      const provider = i % 2 === 0 ? "whoop" : "samsung_health";
      return repo.writeProviderEntry(user("race"), provider, {
        providerId: provider,
        fetchedAt: i,
      });
    });
    const results = await Promise.all(writes);
    expect(results.every((r) => r === true)).toBe(true);

    const final = await readBlob(user("race"));
    const blob = final?.biometrics as Record<
      string,
      { providerId: string; fetchedAt: number }
    > | null;
    expect(blob).not.toBeNull();
    // Both keys must be present — the lost-update bug would have
    // dropped one of them under this contention.
    expect(Object.keys(blob!).sort()).toEqual(["samsung_health", "whoop"]);
    expect(blob!["whoop"]!.providerId).toBe("whoop");
    expect(blob!["samsung_health"]!.providerId).toBe("samsung_health");
  });

  it("treats the provider key as a single path element even when it contains path delimiters (architect hardening)", async () => {
    // If we built the jsonb path with a string-literal '{<key>}'
    // form, a key containing a comma or braces would split into
    // multiple path elements and create nested keys. With the
    // parameterized `ARRAY[<key>]::text[]` form the key is always a
    // single element verbatim.
    await db.insert(aforceUserState).values({ userId: user("weird_key") });
    const weird = "weird,key{with}braces";
    const ok = await repo.writeProviderEntry(user("weird_key"), weird, {
      providerId: weird,
      fetchedAt: 1,
    });
    expect(ok).toBe(true);
    const row = await readBlob(user("weird_key"));
    expect(row?.biometrics).toEqual({
      [weird]: { providerId: weird, fetchedAt: 1 },
    });
  });
});
