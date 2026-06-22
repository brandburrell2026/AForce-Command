/**
 * PKCE / OAuth-state store for the Garmin authorize -> callback hop.
 *
 * Faithful mirror of `whoopAuthStateStore.ts`. Records the
 * (codeVerifier, userId) pair minted at `/garmin/oauth/start`, keyed by
 * the random `state` param handed back to the client. The callback
 * consumes the record by `state` to prove the inbound callback
 * corresponds to a flow this server started (CSRF defense) and to
 * recover the verifier for the PKCE code exchange.
 *
 * Contract:
 *   - put: insert a fresh record. Empty state rejected.
 *   - consume: SINGLE-USE — deletes the record on read even if expired.
 *     Replaying a stale state must not resurrect it.
 *   - expiry: lazy on consume. Records older than `ttlMs` return null.
 */

import { sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { aforceGarminAuthStates } from "@workspace/db";

/** Default TTL for an in-flight Garmin OAuth state record. */
export const GARMIN_AUTH_STATE_DEFAULT_TTL_MS = 10 * 60 * 1000;

export interface GarminAuthStateRecord {
  /** PKCE verifier minted alongside this state. */
  codeVerifier: string;
  /** Authenticated user who started this flow. */
  userId: string;
  /** Epoch ms at start; used for TTL on consume. */
  createdAtMs: number;
}

export interface GarminAuthStateStore {
  put(state: string, record: GarminAuthStateRecord): Promise<void>;
  /** Returns the record once, then deletes it. Returns null when
   *  missing or expired. */
  consume(state: string, nowMs: number): Promise<GarminAuthStateRecord | null>;
}

export interface InMemoryGarminAuthStateStoreOptions {
  /** Defaults to {@link GARMIN_AUTH_STATE_DEFAULT_TTL_MS}. */
  ttlMs?: number;
}

export function createInMemoryGarminAuthStateStore(
  opts: InMemoryGarminAuthStateStoreOptions = {},
): GarminAuthStateStore {
  const ttlMs = opts.ttlMs ?? GARMIN_AUTH_STATE_DEFAULT_TTL_MS;
  const map = new Map<string, GarminAuthStateRecord>();
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

export interface DrizzleGarminAuthStateStoreOptions {
  /** Defaults to {@link GARMIN_AUTH_STATE_DEFAULT_TTL_MS}. */
  ttlMs?: number;
}

/**
 * Postgres-backed Garmin auth-state store. Multi-replica-safe. Mirrors
 * the in-memory contract exactly; single-use guarantee enforced via
 * `DELETE ... RETURNING`.
 */
export function createDrizzleGarminAuthStateStore(
  db: NodePgDatabase<Record<string, unknown>>,
  opts: DrizzleGarminAuthStateStoreOptions = {},
): GarminAuthStateStore {
  const ttlMs = opts.ttlMs ?? GARMIN_AUTH_STATE_DEFAULT_TTL_MS;
  return {
    async put(state, record) {
      if (!state) throw new Error("state must be non-empty");
      await db
        .insert(aforceGarminAuthStates)
        .values({
          state,
          codeVerifier: record.codeVerifier,
          userId: record.userId,
          createdAt: new Date(record.createdAtMs),
        })
        .onConflictDoUpdate({
          target: aforceGarminAuthStates.state,
          set: {
            codeVerifier: record.codeVerifier,
            userId: record.userId,
            createdAt: new Date(record.createdAtMs),
          },
        });
    },
    async consume(state, nowMs) {
      const deleted = await db
        .delete(aforceGarminAuthStates)
        .where(sql`${aforceGarminAuthStates.state} = ${state}`)
        .returning();
      const row = deleted[0];
      if (!row) return null;
      const createdAtMs = row.createdAt.getTime();
      if (nowMs - createdAtMs > ttlMs) return null;
      return {
        codeVerifier: row.codeVerifier,
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
export async function purgeExpiredGarminAuthStates(
  db: NodePgDatabase<Record<string, unknown>>,
  nowMs: number,
  ttlMs: number,
): Promise<number> {
  const cutoff = new Date(nowMs - ttlMs);
  const deleted = await db
    .delete(aforceGarminAuthStates)
    .where(sql`${aforceGarminAuthStates.createdAt} < ${cutoff}`)
    .returning({ state: aforceGarminAuthStates.state });
  return deleted.length;
}
