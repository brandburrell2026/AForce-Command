/**
 * PKCE / OAuth-state store for the WHOOP authorize -> callback hop.
 *
 * Records the (codeVerifier, userId) pair the server minted at
 * `/whoop/oauth/start` time, keyed by the random `state` param the
 * server hands back to the client. The callback consumes the
 * record by `state` to:
 *   - prove the inbound callback corresponds to a flow this server
 *     started (CSRF defense), and
 *   - recover the verifier needed for the PKCE code exchange.
 *
 * Contract:
 *   - put: insert a fresh record. Empty state rejected — never
 *     collapse multiple flows into one row.
 *   - consume: SINGLE-USE — deletes the record on read even if it
 *     has expired. Replaying a stale state must not resurrect it.
 *   - expiry: lazy on consume. Records older than `ttlMs` return
 *     null. Background sweep is unnecessary at this volume; the
 *     map is bounded by inflight authorize attempts per user.
 *
 * Two implementations:
 *   - `createInMemoryWhoopAuthStateStore` — per-process Map. Fine for
 *     local dev, tests, and single-replica deploys.
 *   - `createDrizzleWhoopAuthStateStore` — Postgres-backed. Required
 *     for horizontally scaled deploys, since an authorize started on
 *     replica A must be consumable on replica B. Atomicity of the
 *     single-use guarantee is enforced via `DELETE ... RETURNING`
 *     (one statement, one winner — concurrent callbacks for the same
 *     state see exactly one record).
 */

import { sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { aforceWhoopAuthStates } from "@workspace/db";

/**
 * Default TTL for an in-flight WHOOP OAuth state record. Generous for
 * a flow that should take < 30s. EXPORTED so the purge cron
 * (`whoopAuthStatePurgeBootstrap`) can default to the same value —
 * if the store and purge defaults drift, the purge could reap rows
 * that `consume` would still accept.
 *
 * Single source of truth: any deployment that overrides the store
 * TTL must also pass `ttlMs` to the purge bootstrap.
 */
export const WHOOP_AUTH_STATE_DEFAULT_TTL_MS = 10 * 60 * 1000;

export interface WhoopAuthStateRecord {
  /** PKCE verifier minted alongside this state. */
  codeVerifier: string;
  /** Authenticated user who started this flow. */
  userId: string;
  /** Epoch ms at start; used for TTL on consume. */
  createdAtMs: number;
}

export interface WhoopAuthStateStore {
  put(state: string, record: WhoopAuthStateRecord): Promise<void>;
  /** Returns the record once, then deletes it. Returns null when
   *  missing or expired. */
  consume(state: string, nowMs: number): Promise<WhoopAuthStateRecord | null>;
}

export interface InMemoryWhoopAuthStateStoreOptions {
  /** Defaults to {@link WHOOP_AUTH_STATE_DEFAULT_TTL_MS}. */
  ttlMs?: number;
}

export function createInMemoryWhoopAuthStateStore(
  opts: InMemoryWhoopAuthStateStoreOptions = {},
): WhoopAuthStateStore {
  const ttlMs = opts.ttlMs ?? WHOOP_AUTH_STATE_DEFAULT_TTL_MS;
  const map = new Map<string, WhoopAuthStateRecord>();
  return {
    async put(state, record) {
      if (!state) throw new Error("state must be non-empty");
      map.set(state, record);
    },
    async consume(state, nowMs) {
      const rec = map.get(state);
      if (!rec) return null;
      // Single-use: delete even when expired so a stale state can
      // never be replayed.
      map.delete(state);
      if (nowMs - rec.createdAtMs > ttlMs) return null;
      return rec;
    },
  };
}

export interface DrizzleWhoopAuthStateStoreOptions {
  /** Defaults to {@link WHOOP_AUTH_STATE_DEFAULT_TTL_MS}. */
  ttlMs?: number;
}

/**
 * Postgres-backed WHOOP auth-state store. Multi-replica-safe.
 *
 * Semantics — must match the in-memory contract exactly:
 *   - `put`: UPSERT on `state`. Defensive last-write-wins, mirrors
 *     in-memory `Map.set`. State uniqueness is owned by the issuer
 *     (cryptographic random), so a real collision is effectively
 *     impossible; the UPSERT only protects against pathological
 *     callers that reuse a state under the same authorize flow.
 *   - `consume`: `DELETE ... WHERE state = $1 RETURNING *`. Atomic,
 *     single-use — concurrent callbacks with the same `state` (e.g.
 *     a user double-clicking the OAuth provider's redirect) result
 *     in exactly one row returned across all callers; everyone else
 *     gets null. TTL is applied AFTER the delete so an expired row
 *     is still removed (no clock-rewind revive, matching in-memory).
 */
export function createDrizzleWhoopAuthStateStore(
  db: NodePgDatabase<Record<string, unknown>>,
  opts: DrizzleWhoopAuthStateStoreOptions = {},
): WhoopAuthStateStore {
  const ttlMs = opts.ttlMs ?? WHOOP_AUTH_STATE_DEFAULT_TTL_MS;
  return {
    async put(state, record) {
      if (!state) throw new Error("state must be non-empty");
      await db
        .insert(aforceWhoopAuthStates)
        .values({
          state,
          codeVerifier: record.codeVerifier,
          userId: record.userId,
          createdAt: new Date(record.createdAtMs),
        })
        .onConflictDoUpdate({
          target: aforceWhoopAuthStates.state,
          set: {
            codeVerifier: record.codeVerifier,
            userId: record.userId,
            createdAt: new Date(record.createdAtMs),
          },
        });
    },
    async consume(state, nowMs) {
      const deleted = await db
        .delete(aforceWhoopAuthStates)
        .where(sql`${aforceWhoopAuthStates.state} = ${state}`)
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
 * concurrently with `consume` (each row is owned by exactly one
 * statement). Returns the number of rows reaped.
 *
 * Not wired into a cron yet; exposed so an ops cron or one-off can
 * call it. Steady-state row count is bounded by inflight authorize
 * attempts per TTL window, so this is hygiene, not load-bearing.
 */
export async function purgeExpiredWhoopAuthStates(
  db: NodePgDatabase<Record<string, unknown>>,
  nowMs: number,
  ttlMs: number,
): Promise<number> {
  const cutoff = new Date(nowMs - ttlMs);
  const deleted = await db
    .delete(aforceWhoopAuthStates)
    .where(sql`${aforceWhoopAuthStates.createdAt} < ${cutoff}`)
    .returning({ state: aforceWhoopAuthStates.state });
  return deleted.length;
}
