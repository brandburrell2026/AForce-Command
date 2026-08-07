/**
 * providerKit — biometrics-blob write surface, parameterized by
 * provider key.
 *
 * SOURCE OF TRUTH as of the W3 lane (WHOOP cutover). Before W3, this
 * module only re-exported `UserStateRepo` / `createDrizzleUserStateRepo`
 * from `../whoopFetchWorker.ts` (WHOOP was production and frozen, so the
 * definitions lived there and every other provider — Oura, Strava,
 * Garmin — depended on this re-export seam instead of reaching into a
 * WHOOP-named file directly). W3 moves WHOOP itself onto providerKit,
 * so the indirection is no longer needed in that direction: the
 * definitions live HERE now, and `whoopFetchWorker.ts` re-exports FROM
 * this module instead of the other way around — a value- and
 * type-identical swap for every existing importer (`garminFetchWorker.ts`,
 * `stravaFetchWorker.ts`, and `whoopFetchWorker.ts` itself all still
 * import the same two names from the same import specifiers they used
 * before).
 *
 * UPDATE-only: writes a single provider's entry into the `biometrics`
 * JSONB column via `jsonb_set`, so concurrent writers for DIFFERENT
 * providers cannot lose-update each other — only the targeted key is
 * touched. `COALESCE(biometrics, '{}'::jsonb)` handles the
 * row-exists-but-biometrics-is-null case. The `create_missing` flag
 * (4th arg to `jsonb_set`) is `true` — creates the provider key if
 * absent. Returns `false` (no state row) rather than fabricating a
 * user — every fetch worker built on this repo treats that as a skip.
 */
import { eq, sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { aforceUserState } from "@workspace/db";

/** Subset of the state-row write surface every provider fetch worker
 *  needs. The interface deliberately operates on a single provider key
 *  rather than a full biometrics blob — see the module doc for why. */
export interface UserStateRepo {
  /**
   * UPDATE-only: writes a single provider's entry into the
   * `biometrics` JSONB column. Returns true when a row was updated,
   * false when no row existed (callers treat this as a skip — never
   * fabricate users). */
  writeProviderEntry(
    userId: string,
    providerKey: string,
    entry: Record<string, unknown>,
  ): Promise<boolean>;
  /**
   * Read-only: the CURRENTLY stored entry for one provider key, or
   * `null` when the user has no state row yet OR the row exists but
   * has never had this provider key written. Added for Founder Ruling
   * C (RC-2 arbitration freshness, 2026-08-06) — every fetch-worker
   * `runOnce` calls this BEFORE building its write, to decide whether
   * the newly fetched content actually changed (see
   * `providerKit/fetchWorker.ts`'s `resolveProviderFetchedAt`). Never
   * throws on a missing row/key — only on a real I/O failure, which
   * callers treat as "assume changed" (fail toward a fresh timestamp,
   * never toward a silently-frozen one). */
  readProviderEntry(
    userId: string,
    providerKey: string,
  ): Promise<Record<string, unknown> | null>;
}

/** Default Drizzle-backed UserStateRepo. Path is built as a
 *  parameterized `text[]` so unusual key characters (commas, braces)
 *  cannot alter PG path semantics — the providerKey lives in its own
 *  SQL parameter, not in a string-built `{...}` literal. */
export function createDrizzleUserStateRepo(
  db: NodePgDatabase<Record<string, unknown>>,
): UserStateRepo {
  return {
    async writeProviderEntry(userId, providerKey, entry) {
      const updated = await db
        .update(aforceUserState)
        .set({
          biometrics: sql`jsonb_set(
            COALESCE(${aforceUserState.biometrics}, '{}'::jsonb),
            ARRAY[${providerKey}]::text[],
            ${JSON.stringify(entry)}::jsonb,
            true
          )` as never,
        })
        .where(eq(aforceUserState.userId, userId))
        .returning({ id: aforceUserState.userId });
      return updated.length > 0;
    },

    // Single-column, single-key SELECT — cheap (no full-row fetch) and
    // read-only, so it carries none of the concurrent-writer hazard
    // `writeProviderEntry`'s jsonb_set guards against. `->` on a NULL
    // `biometrics` column, or a key absent from an existing object,
    // both evaluate to SQL NULL — no COALESCE needed on the read side.
    async readProviderEntry(userId, providerKey) {
      const rows = await db
        .select({
          entry: sql<Record<
            string,
            unknown
          > | null>`${aforceUserState.biometrics} -> ${providerKey}::text`,
        })
        .from(aforceUserState)
        .where(eq(aforceUserState.userId, userId))
        .limit(1);
      return rows[0]?.entry ?? null;
    },
  };
}
