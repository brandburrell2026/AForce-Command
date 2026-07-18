/**
 * PKCE / OAuth-state store for the Oura authorize -> callback hop.
 *
 * Faithful mirror of `whoopAuthStateStore.ts` / `garminAuthStateStore.ts`.
 * Records the (codeVerifier, userId) pair minted at `/oura/oauth/start`,
 * keyed by the random `state` param handed back to the client. The
 * callback consumes the record by `state` to prove the inbound callback
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
import { aforceOuraAuthStates } from "@workspace/db";

/** Default TTL for an in-flight Oura OAuth state record. */
export const OURA_AUTH_STATE_DEFAULT_TTL_MS = 10 * 60 * 1000;

export interface OuraAuthStateRecord {
  /** PKCE verifier minted alongside this state. */
  codeVerifier: string;
  /** Authenticated user who started this flow. */
  userId: string;
  /** Epoch ms at start; used for TTL on consume. */
  createdAtMs: number;
}

export interface OuraAuthStateStore {
  put(state: string, record: OuraAuthStateRecord): Promise<void>;
  /** Returns the record once, then deletes it. Returns null when
   *  missing or expired. */
  consume(state: string, nowMs: number): Promise<OuraAuthStateRecord | null>;
}

export interface InMemoryOuraAuthStateStoreOptions {
  /** Defaults to {@link OURA_AUTH_STATE_DEFAULT_TTL_MS}. */
  ttlMs?: number;
}

export function createInMemoryOuraAuthStateStore(
  opts: InMemoryOuraAuthStateStoreOptions = {},
): OuraAuthStateStore {
  const ttlMs = opts.ttlMs ?? OURA_AUTH_STATE_DEFAULT_TTL_MS;
  const map = new Map<string, OuraAuthStateRecord>();
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

export interface DrizzleOuraAuthStateStoreOptions {
  /** Defaults to {@link OURA_AUTH_STATE_DEFAULT_TTL_MS}. */
  ttlMs?: number;
}

/**
 * Postgres-backed Oura auth-state store. Multi-replica-safe. Mirrors
 * the in-memory contract exactly; single-use guarantee enforced via
 * `DELETE ... RETURNING`.
 */
export function createDrizzleOuraAuthStateStore(
  db: NodePgDatabase<Record<string, unknown>>,
  opts: DrizzleOuraAuthStateStoreOptions = {},
): OuraAuthStateStore {
  const ttlMs = opts.ttlMs ?? OURA_AUTH_STATE_DEFAULT_TTL_MS;
  return {
    async put(state, record) {
      if (!state) throw new Error("state must be non-empty");
      await db
        .insert(aforceOuraAuthStates)
        .values({
          state,
          codeVerifier: record.codeVerifier,
          userId: record.userId,
          createdAt: new Date(record.createdAtMs),
        })
        .onConflictDoUpdate({
          target: aforceOuraAuthStates.state,
          set: {
            codeVerifier: record.codeVerifier,
            userId: record.userId,
            createdAt: new Date(record.createdAtMs),
          },
        });
    },
    async consume(state, nowMs) {
      const deleted = await db
        .delete(aforceOuraAuthStates)
        .where(sql`${aforceOuraAuthStates.state} = ${state}`)
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
export async function purgeExpiredOuraAuthStates(
  db: NodePgDatabase<Record<string, unknown>>,
  nowMs: number,
  ttlMs: number,
): Promise<number> {
  const cutoff = new Date(nowMs - ttlMs);
  const deleted = await db
    .delete(aforceOuraAuthStates)
    .where(sql`${aforceOuraAuthStates.createdAt} < ${cutoff}`)
    .returning({ state: aforceOuraAuthStates.state });
  return deleted.length;
}
