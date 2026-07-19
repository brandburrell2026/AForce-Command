/**
 * OAuth-state store for the Strava authorize -> callback hop.
 *
 * Faithful mirror of `ouraAuthStateStore.ts` / `whoopAuthStateStore.ts`
 * / `garminAuthStateStore.ts`, EXCEPT the record has no `codeVerifier`
 * field — Strava is a confidential OAuth2 client with no documented
 * PKCE support (see `stravaAuthorize.ts` for the verified source), so
 * there is no verifier to carry across the hop. The random `state`
 * param is the entire CSRF defense here.
 *
 * Records the (userId) minted at `/strava/oauth/start`, keyed by the
 * random `state` param handed back to the client. The callback
 * consumes the record by `state` to prove the inbound callback
 * corresponds to a flow this server started for this user.
 *
 * Contract:
 *   - put: insert a fresh record. Empty state rejected.
 *   - consume: SINGLE-USE — deletes the record on read even if expired.
 *     Replaying a stale state must not resurrect it.
 *   - expiry: lazy on consume. Records older than `ttlMs` return null.
 */

import { sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { aforceStravaAuthStates } from "@workspace/db";

/** Default TTL for an in-flight Strava OAuth state record. */
export const STRAVA_AUTH_STATE_DEFAULT_TTL_MS = 10 * 60 * 1000;

export interface StravaAuthStateRecord {
  /** Authenticated user who started this flow. */
  userId: string;
  /** Epoch ms at start; used for TTL on consume. */
  createdAtMs: number;
}

export interface StravaAuthStateStore {
  put(state: string, record: StravaAuthStateRecord): Promise<void>;
  /** Returns the record once, then deletes it. Returns null when
   *  missing or expired. */
  consume(state: string, nowMs: number): Promise<StravaAuthStateRecord | null>;
}

export interface InMemoryStravaAuthStateStoreOptions {
  /** Defaults to {@link STRAVA_AUTH_STATE_DEFAULT_TTL_MS}. */
  ttlMs?: number;
}

export function createInMemoryStravaAuthStateStore(
  opts: InMemoryStravaAuthStateStoreOptions = {},
): StravaAuthStateStore {
  const ttlMs = opts.ttlMs ?? STRAVA_AUTH_STATE_DEFAULT_TTL_MS;
  const map = new Map<string, StravaAuthStateRecord>();
  return {
    async put(state, record) {
      if (!state) throw new Error("state must be non-empty");
      map.set(state, record);
    },
    async consume(state, nowMs) {
      const rec = map.get(state);
      if (!rec) return null;
      // Single-use: delete even when expired so a stale state can never
      // be replayed.
      map.delete(state);
      if (nowMs - rec.createdAtMs > ttlMs) return null;
      return rec;
    },
  };
}

export interface DrizzleStravaAuthStateStoreOptions {
  /** Defaults to {@link STRAVA_AUTH_STATE_DEFAULT_TTL_MS}. */
  ttlMs?: number;
}

/**
 * Postgres-backed Strava auth-state store. Multi-replica-safe.
 * Mirrors the in-memory contract exactly; single-use guarantee
 * enforced via `DELETE ... RETURNING`.
 */
export function createDrizzleStravaAuthStateStore(
  db: NodePgDatabase<Record<string, unknown>>,
  opts: DrizzleStravaAuthStateStoreOptions = {},
): StravaAuthStateStore {
  const ttlMs = opts.ttlMs ?? STRAVA_AUTH_STATE_DEFAULT_TTL_MS;
  return {
    async put(state, record) {
      if (!state) throw new Error("state must be non-empty");
      await db
        .insert(aforceStravaAuthStates)
        .values({
          state,
          userId: record.userId,
          createdAt: new Date(record.createdAtMs),
        })
        .onConflictDoUpdate({
          target: aforceStravaAuthStates.state,
          set: {
            userId: record.userId,
            createdAt: new Date(record.createdAtMs),
          },
        });
    },
    async consume(state, nowMs) {
      const deleted = await db
        .delete(aforceStravaAuthStates)
        .where(sql`${aforceStravaAuthStates.state} = ${state}`)
        .returning();
      const row = deleted[0];
      if (!row) return null;
      const createdAtMs = row.createdAt.getTime();
      if (nowMs - createdAtMs > ttlMs) return null;
      return {
        userId: row.userId,
        createdAtMs,
      };
    },
  };
}

/**
 * Operational helper — sweeps rows older than `ttlMs`. Safe to run
 * concurrently with `consume`. Returns the number of rows reaped.
 */
export async function purgeExpiredStravaAuthStates(
  db: NodePgDatabase<Record<string, unknown>>,
  nowMs: number,
  ttlMs: number,
): Promise<number> {
  const cutoff = new Date(nowMs - ttlMs);
  const deleted = await db
    .delete(aforceStravaAuthStates)
    .where(sql`${aforceStravaAuthStates.createdAt} < ${cutoff}`)
    .returning({ state: aforceStravaAuthStates.state });
  return deleted.length;
}
