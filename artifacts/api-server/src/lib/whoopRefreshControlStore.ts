/**
 * WHOOP refresh-control store — reads/writes ONLY the three scheduling
 * columns added by the 2026-08-19 founder-approved migration
 * (`refresh_failure_count`, `refresh_backoff_until`, `needs_reauth`) plus a
 * read-only peek at the biometrics blob's `fetchedAt` for freshness.
 *
 * Boundary rules, enforced by test (`whoopRefreshControlStore` source scan):
 *   - NEVER writes a token column (access/refresh, plaintext or enc).
 *   - NEVER deletes a row.
 *   - Failure/success bookkeeping is fire-and-forget at every call site — a
 *     broken bookkeeping write must not break the fetch path it observes.
 */

import { and, eq, sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { aforceUserState, aforceWhoopTokens } from "@workspace/db";
import {
  nextWhoopFailureState,
  type WhoopEligibilityInput,
} from "./whoopRefreshPolicy";

type Db = NodePgDatabase<Record<string, unknown>>;

/**
 * Everything eligibility needs, in one round trip: the control columns from
 * the token row LEFT JOINed to the user's whoop blob `fetchedAt`. Returns
 * null when the user has no token row (nothing to schedule).
 */
export async function readWhoopEligibilityInput(
  db: Db,
  userId: string,
): Promise<WhoopEligibilityInput | null> {
  // Two indexed primary-key lookups instead of one correlated subquery. The
  // first shipped version correlated with a raw sql fragment, and drizzle
  // rendered the OUTER column reference unqualified — inside the subquery
  // scope `"user_id"` resolved to the inner table, the correlation became
  // `u.user_id = u.user_id` (always true), and the scalar subquery failed the
  // moment aforce_user_state held more than one row. It escaped because the
  // store's real SQL never ran against Postgres in tests (unit suites inject
  // fakes); `whoopRefreshControlStore.dbtest.ts` now executes every function
  // here against a real database so a render-level bug like that cannot ship
  // silently again. The gate's fail-open kept production at exact
  // pre-redesign behavior while this was broken — visible, not silent.
  const tokenRows = await db
    .select({
      failureCount: aforceWhoopTokens.refreshFailureCount,
      backoffUntil: aforceWhoopTokens.refreshBackoffUntil,
      needsReauth: aforceWhoopTokens.needsReauth,
    })
    .from(aforceWhoopTokens)
    .where(eq(aforceWhoopTokens.userId, userId))
    .limit(1);
  const token = tokenRows[0];
  if (!token) return null;

  const stateRows = await db
    .select({
      blobFetchedAt: sql<
        string | null
      >`${aforceUserState.biometrics} -> 'whoop' ->> 'fetchedAt'`,
    })
    .from(aforceUserState)
    .where(eq(aforceUserState.userId, userId))
    .limit(1);
  const raw = stateRows[0]?.blobFetchedAt ?? null;
  const parsed = raw == null ? NaN : Number(raw);
  return {
    blobFetchedAtMs: Number.isFinite(parsed) ? parsed : null,
    failureCount: token.failureCount ?? null,
    backoffUntilMs: token.backoffUntil ? token.backoffUntil.getTime() : null,
    needsReauth: token.needsReauth ?? null,
  };
}

/**
 * Record one more consecutive refresh failure: bump the count, arm the
 * exponential backoff, latch `needs_reauth` at the founder-ratified
 * threshold. Reads the current count first so concurrent failures cannot
 * skip steps by writing a stale increment blindly; the singleflight
 * registry already collapses same-user refreshes, so this is belt and
 * braces, not a hot path.
 */
export async function recordWhoopRefreshFailure(
  db: Db,
  userId: string,
  nowMs: number,
): Promise<void> {
  const rows = await db
    .select({ failureCount: aforceWhoopTokens.refreshFailureCount })
    .from(aforceWhoopTokens)
    .where(eq(aforceWhoopTokens.userId, userId))
    .limit(1);
  if (!rows[0]) return; // no token row — nothing to schedule against
  const next = nextWhoopFailureState(rows[0].failureCount, nowMs);
  await db
    .update(aforceWhoopTokens)
    .set({
      refreshFailureCount: next.failureCount,
      refreshBackoffUntil: new Date(next.backoffUntilMs),
      needsReauth: next.needsReauth,
    })
    .where(eq(aforceWhoopTokens.userId, userId));
}

/**
 * Any successful refresh or re-auth clears the whole failure state
 * (founder-ratified). The guard keeps the write away from rows that are
 * already clean, so the steady healthy state costs zero UPDATEs.
 */
export async function clearWhoopRefreshFailureState(
  db: Db,
  userId: string,
): Promise<void> {
  await db
    .update(aforceWhoopTokens)
    .set({
      refreshFailureCount: null,
      refreshBackoffUntil: null,
      needsReauth: null,
    })
    .where(
      and(
        eq(aforceWhoopTokens.userId, userId),
        sql`(
          ${aforceWhoopTokens.refreshFailureCount} is not null
          or ${aforceWhoopTokens.refreshBackoffUntil} is not null
          or ${aforceWhoopTokens.needsReauth} is not null
        )`,
      ),
    );
}
