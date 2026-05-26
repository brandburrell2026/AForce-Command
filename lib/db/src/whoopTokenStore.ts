/**
 * WHOOP OAuth2 token store — server-side, per-user persistence.
 *
 * Mirrors the mobile `WhoopTokenStore` interface from
 * `artifacts/aforce-os/services/whoopAuth.ts` so the server-side
 * `WhoopTokenManager` can be a near-drop-in port. Differences from
 * mobile:
 *   - Mobile is single-user, device-bound (`expo-secure-store`).
 *   - Server is multi-user, Postgres-backed — every store is bound
 *     to a single `userId` via the factory functions below. Once
 *     bound, the read/write/clear interface is identical, which
 *     keeps the manager code shape-compatible with mobile.
 *
 * `expiresAt` semantics:
 *   - In-memory and in the manager: epoch ms (cheap arithmetic).
 *   - At the Postgres boundary: `timestamptz` for native ordering
 *     and index range scans. Converted at the store boundary.
 *
 * Architecture lock: hidden-infra. No UI / public route writes here
 * yet. The schema + store + manager land first; OAuth callback +
 * biometrics worker follow in later PRs.
 */

import { eq, sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { aforceWhoopTokens } from "./schema/aforce";

/** Same shape as mobile `WhoopTokens`. `expiresAt` is epoch ms. */
export interface WhoopTokens {
  accessToken: string;
  refreshToken: string;
  /** Epoch ms when the access token expires. */
  expiresAt: number;
  /** Space-separated scopes the user granted. Optional — null on
   *  legacy rows or when WHOOP didn't echo `scope` back. */
  scope?: string | null;
}

/**
 * Per-user storage adapter. Once a store is created it is bound to
 * a single `userId`; the manager doesn't need to know about user
 * identity, which keeps the mobile/server manager surfaces
 * identical.
 */
export interface WhoopTokenStore {
  read(): Promise<WhoopTokens | null>;
  write(t: WhoopTokens): Promise<void>;
  clear(): Promise<void>;
}

/** In-memory store. Use for tests, local dev, and as a fallback
 *  when DB is unavailable. */
export function createInMemoryWhoopTokenStore(
  seed: WhoopTokens | null = null,
): WhoopTokenStore {
  let current: WhoopTokens | null = seed;
  return {
    async read() {
      return current;
    },
    async write(t) {
      current = { ...t };
    },
    async clear() {
      current = null;
    },
  };
}

/**
 * Per-user, Postgres-backed store. Pass the user's id once; the
 * returned store talks only about that user.
 */
export function createDrizzleWhoopTokenStoreForUser(
  db: NodePgDatabase<Record<string, unknown>>,
  userId: string,
): WhoopTokenStore {
  if (!userId) {
    // Refuse to bind to an empty user id — would otherwise let one
    // caller's tokens be read/written under the empty-string key
    // and cross-contaminate users at the row level.
    throw new Error(
      "createDrizzleWhoopTokenStoreForUser: userId must be non-empty",
    );
  }

  return {
    async read() {
      const rows = await db
        .select()
        .from(aforceWhoopTokens)
        .where(eq(aforceWhoopTokens.userId, userId))
        .limit(1);
      const row = rows[0];
      if (!row) return null;
      return {
        accessToken: row.accessToken,
        refreshToken: row.refreshToken,
        expiresAt: row.expiresAt.getTime(),
        scope: row.scope,
      };
    },
    async write(t) {
      // UPSERT — first connect writes the row; refreshes UPDATE in
      // place. `updated_at` bumps on every write for ops visibility.
      await db
        .insert(aforceWhoopTokens)
        .values({
          userId,
          accessToken: t.accessToken,
          refreshToken: t.refreshToken,
          expiresAt: new Date(t.expiresAt),
          scope: t.scope ?? null,
        })
        .onConflictDoUpdate({
          target: aforceWhoopTokens.userId,
          set: {
            accessToken: t.accessToken,
            refreshToken: t.refreshToken,
            expiresAt: new Date(t.expiresAt),
            scope: t.scope ?? null,
            updatedAt: sql`now()`,
          },
        });
    },
    async clear() {
      await db
        .delete(aforceWhoopTokens)
        .where(eq(aforceWhoopTokens.userId, userId));
    },
  };
}
