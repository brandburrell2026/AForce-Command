/**
 * WHOOP refresh-control store — REAL Postgres (db-lane, DB_TESTS=1).
 *
 * This suite exists because its absence shipped a production bug. The first
 * `readWhoopEligibilityInput` used a raw correlated subquery; drizzle rendered
 * the outer column reference unqualified, the correlation degenerated to
 * `u.user_id = u.user_id`, and the query failed the moment `aforce_user_state`
 * held a second row — which production always does. Unit tests never caught it
 * because they inject fake stores; the SQL itself had never executed. The
 * gate's fail-open kept production at pre-redesign behavior (visible warnings,
 * no silent damage), but suppression was inert until the fix.
 *
 * Rule this file enforces: every function in the control store runs against a
 * real database, with MULTIPLE user rows present, before it ships.
 */
import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import { inArray, sql } from "drizzle-orm";
import { db, aforceWhoopTokens, aforceUserState } from "@workspace/db";
import {
  readWhoopEligibilityInput,
  recordWhoopRefreshFailure,
  clearWhoopRefreshFailureState,
} from "../lib/whoopRefreshControlStore";
import {
  WHOOP_NEEDS_REAUTH_AFTER,
  whoopBackoffDelayMs,
} from "../lib/whoopRefreshPolicy";

const DB = Boolean(process.env["DB_TESTS"]);

const U1 = "ctrl-store-user-1";
const U2 = "ctrl-store-user-2";

async function cleanup(): Promise<void> {
  if (!DB) return;
  await db.delete(aforceWhoopTokens).where(inArray(aforceWhoopTokens.userId, [U1, U2]));
  await db.delete(aforceUserState).where(inArray(aforceUserState.userId, [U1, U2]));
}

async function seedTokenRow(userId: string): Promise<void> {
  await db.insert(aforceWhoopTokens).values({
    userId,
    accessToken: "at-" + userId,
    refreshToken: "rt-" + userId,
    expiresAt: new Date(),
  });
}

async function seedStateRow(userId: string, fetchedAtMs: number | null): Promise<void> {
  await db.insert(aforceUserState).values({
    userId,
    ...(fetchedAtMs == null
      ? {}
      : {
          biometrics: {
            whoop: { providerId: "whoop", fetchedAt: fetchedAtMs },
          } as never,
        }),
  });
}

beforeAll(cleanup);
beforeEach(cleanup);
afterAll(cleanup);

describe.runIf(DB)("whoopRefreshControlStore — real Postgres", () => {
  it("reads eligibility with MULTIPLE user rows present (the exact shipped bug)", async () => {
    // Two users, two state rows — the correlated-subquery bug fired precisely
    // here, so this shape is the regression lock.
    await seedTokenRow(U1);
    await seedTokenRow(U2);
    await seedStateRow(U1, 1_111);
    await seedStateRow(U2, 2_222);

    const one = await readWhoopEligibilityInput(db, U1);
    const two = await readWhoopEligibilityInput(db, U2);
    expect(one).toEqual({
      blobFetchedAtMs: 1_111,
      failureCount: null,
      backoffUntilMs: null,
      needsReauth: null,
    });
    expect(two?.blobFetchedAtMs).toBe(2_222);
  });

  it("returns null for a user with no token row", async () => {
    expect(await readWhoopEligibilityInput(db, U1)).toBeNull();
  });

  it("token row without a state row / without a whoop blob reads as never-fetched", async () => {
    await seedTokenRow(U1);
    expect((await readWhoopEligibilityInput(db, U1))?.blobFetchedAtMs).toBeNull();
    await seedStateRow(U1, null);
    expect((await readWhoopEligibilityInput(db, U1))?.blobFetchedAtMs).toBeNull();
  });

  it("failure recording walks the ladder and latches needs_reauth at the threshold", async () => {
    await seedTokenRow(U1);
    const now = Date.now();
    for (let n = 1; n <= WHOOP_NEEDS_REAUTH_AFTER; n++) {
      await recordWhoopRefreshFailure(db, U1, now);
      const state = await readWhoopEligibilityInput(db, U1);
      expect(state?.failureCount).toBe(n);
      const expected = now + whoopBackoffDelayMs(n);
      expect(Math.abs((state?.backoffUntilMs ?? 0) - expected)).toBeLessThan(1_500);
      expect(state?.needsReauth).toBe(n >= WHOOP_NEEDS_REAUTH_AFTER);
    }
  });

  it("clear resets all three columns to NULL and is a no-op on clean rows", async () => {
    await seedTokenRow(U1);
    await recordWhoopRefreshFailure(db, U1, Date.now());
    await clearWhoopRefreshFailureState(db, U1);
    const state = await readWhoopEligibilityInput(db, U1);
    expect(state).toEqual({
      blobFetchedAtMs: null,
      failureCount: null,
      backoffUntilMs: null,
      needsReauth: null,
    });
    // Second clear on an already-clean row must not throw.
    await clearWhoopRefreshFailureState(db, U1);
  });

  it("bookkeeping never touches token columns or other users' rows", async () => {
    await seedTokenRow(U1);
    await seedTokenRow(U2);
    await recordWhoopRefreshFailure(db, U1, Date.now());
    await clearWhoopRefreshFailureState(db, U1);

    const rows = await db
      .select({
        userId: aforceWhoopTokens.userId,
        accessToken: aforceWhoopTokens.accessToken,
        refreshToken: aforceWhoopTokens.refreshToken,
        failureCount: aforceWhoopTokens.refreshFailureCount,
      })
      .from(aforceWhoopTokens)
      .where(sql`${aforceWhoopTokens.userId} in (${U1}, ${U2})`);
    const byId = Object.fromEntries(rows.map((r) => [r.userId, r]));
    expect(byId[U1]?.accessToken).toBe("at-" + U1);
    expect(byId[U1]?.refreshToken).toBe("rt-" + U1);
    expect(byId[U2]?.failureCount).toBeNull();
    expect(byId[U2]?.accessToken).toBe("at-" + U2);
  });
});
