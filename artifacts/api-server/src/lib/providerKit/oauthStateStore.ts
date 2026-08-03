/**
 * providerKit — PKCE / OAuth-state store, parameterized by provider.
 *
 * Pure extraction. `whoopAuthStateStore.ts`, `ouraAuthStateStore.ts`,
 * `garminAuthStateStore.ts`, and `stravaAuthStateStore.ts` are
 * byte-identical after s/PROVIDER/whoop|oura|garmin|strava/ renames —
 * this module is the shared shape they all wrap. WHOOP's file is
 * frozen (production) and is NOT changed to use this — only Oura is
 * migrated onto it in this lane. See `../ouraAuthStateStore.ts`.
 *
 * Records the (codeVerifier, userId) pair the server minted at
 * authorize-start time, keyed by the random `state` param handed back
 * to the client. The callback consumes the record by `state` to:
 *   - prove the inbound callback corresponds to a flow this server
 *     started (CSRF defense), and
 *   - recover the verifier needed for the PKCE code exchange.
 *
 * Contract (identical across every provider today):
 *   - put: insert a fresh record. Empty state rejected — never
 *     collapse multiple flows into one row.
 *   - consume: SINGLE-USE — deletes the record on read even if it
 *     has expired. Replaying a stale state must not resurrect it.
 *   - expiry: lazy on consume. Records older than `ttlMs` return
 *     null. Background sweep is unnecessary at this volume; the
 *     map/table is bounded by inflight authorize attempts per user.
 *
 * Two drivers, selected via `createProviderAuthStateStore`:
 *   - `memory` — per-process Map. Fine for local dev, tests, and
 *     single-replica deploys.
 *   - `drizzle` — Postgres-backed. Required for horizontally scaled
 *     deploys, since an authorize started on replica A must be
 *     consumable on replica B. Atomicity of the single-use guarantee
 *     is enforced via `DELETE ... RETURNING` (one statement, one
 *     winner — concurrent callbacks for the same state see exactly
 *     one record).
 */

import { sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type { AnyPgColumn, PgTable } from "drizzle-orm/pg-core";

/** Default TTL for an in-flight OAuth state record. Generous for a
 *  flow that should take < 30s. Callers that need a different value
 *  pass `ttlMs`; a background purge cron must use the SAME value the
 *  store uses, or it risks reaping rows `consume` would still accept. */
export const PROVIDER_AUTH_STATE_DEFAULT_TTL_MS = 10 * 60 * 1000;

export interface ProviderAuthStateRecord {
  /** PKCE verifier minted alongside this state. */
  codeVerifier: string;
  /** Authenticated user who started this flow. */
  userId: string;
  /** Epoch ms at start; used for TTL on consume. */
  createdAtMs: number;
}

export interface ProviderAuthStateStore {
  put(state: string, record: ProviderAuthStateRecord): Promise<void>;
  /** Returns the record once, then deletes it. Returns null when
   *  missing or expired. */
  consume(
    state: string,
    nowMs: number,
  ): Promise<ProviderAuthStateRecord | null>;
}

/**
 * Structural shape every provider's `aforce_<provider>_auth_states`
 * table satisfies (`aforceWhoopAuthStates`, `aforceOuraAuthStates`,
 * `aforceGarminAuthStates`, `aforceStravaAuthStates`, ...). Callers
 * pass the real Drizzle table object for their provider; this module
 * only ever references these four columns.
 */
export type ProviderAuthStateTable = PgTable & {
  state: AnyPgColumn;
  codeVerifier: AnyPgColumn;
  userId: AnyPgColumn;
  createdAt: AnyPgColumn;
};

export interface InMemoryProviderAuthStateStoreOptions {
  /** Defaults to {@link PROVIDER_AUTH_STATE_DEFAULT_TTL_MS}. */
  ttlMs?: number;
}

export function createInMemoryProviderAuthStateStore(
  opts: InMemoryProviderAuthStateStoreOptions = {},
): ProviderAuthStateStore {
  const ttlMs = opts.ttlMs ?? PROVIDER_AUTH_STATE_DEFAULT_TTL_MS;
  const map = new Map<string, ProviderAuthStateRecord>();
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

export interface DrizzleProviderAuthStateStoreOptions {
  /** Defaults to {@link PROVIDER_AUTH_STATE_DEFAULT_TTL_MS}. */
  ttlMs?: number;
}

/**
 * Postgres-backed auth-state store, generic over the provider's table.
 * Multi-replica-safe. Semantics — must match the in-memory contract
 * exactly:
 *   - `put`: UPSERT on `state`. Defensive last-write-wins, mirrors
 *     in-memory `Map.set`. State uniqueness is owned by the issuer
 *     (cryptographic random), so a real collision is effectively
 *     impossible; the UPSERT only protects against pathological
 *     callers that reuse a state under the same authorize flow.
 *   - `consume`: `DELETE ... WHERE state = $1 RETURNING *`. Atomic,
 *     single-use — concurrent callbacks with the same `state` result
 *     in exactly one row returned across all callers; everyone else
 *     gets null. TTL is applied AFTER the delete so an expired row is
 *     still removed (no clock-rewind revive, matching in-memory).
 */
export function createDrizzleProviderAuthStateStore(
  db: NodePgDatabase<Record<string, unknown>>,
  table: ProviderAuthStateTable,
  opts: DrizzleProviderAuthStateStoreOptions = {},
): ProviderAuthStateStore {
  const ttlMs = opts.ttlMs ?? PROVIDER_AUTH_STATE_DEFAULT_TTL_MS;
  return {
    async put(state, record) {
      if (!state) throw new Error("state must be non-empty");
      await db
        .insert(table)
        .values({
          state,
          codeVerifier: record.codeVerifier,
          userId: record.userId,
          createdAt: new Date(record.createdAtMs),
        } as never)
        .onConflictDoUpdate({
          target: table.state,
          set: {
            codeVerifier: record.codeVerifier,
            userId: record.userId,
            createdAt: new Date(record.createdAtMs),
          } as never,
        });
    },
    async consume(state, nowMs) {
      const deleted = await db
        .delete(table)
        .where(sql`${table.state} = ${state}`)
        .returning();
      const row = deleted[0] as
        | { codeVerifier: string; userId: string; createdAt: Date }
        | undefined;
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
 */
export async function purgeExpiredProviderAuthStates(
  db: NodePgDatabase<Record<string, unknown>>,
  table: ProviderAuthStateTable,
  nowMs: number,
  ttlMs: number,
): Promise<number> {
  const cutoff = new Date(nowMs - ttlMs);
  const deleted = await db
    .delete(table)
    .where(sql`${table.createdAt} < ${cutoff}`)
    .returning({ state: table.state });
  return deleted.length;
}

/** Selects the backing driver for {@link createProviderAuthStateStore}. */
export type ProviderAuthStateDriver =
  | { readonly kind: "memory" }
  | {
      readonly kind: "drizzle";
      db: NodePgDatabase<Record<string, unknown>>;
      table: ProviderAuthStateTable;
    };

export interface CreateProviderAuthStateStoreOptions {
  /** Provider name — used only for the empty-provider guard error
   *  message; never persisted or logged elsewhere by this module. */
  provider: string;
  driver: ProviderAuthStateDriver;
  /** Defaults to {@link PROVIDER_AUTH_STATE_DEFAULT_TTL_MS}. */
  ttlMs?: number;
}

/**
 * Single entry point: build the record store for a provider, either
 * in-memory or Drizzle-backed, based on `driver.kind`. Thin dispatch
 * over the two factories above — kept separate so tests (and any
 * caller that already knows which driver it wants) can call the
 * concrete factory directly without threading a discriminated union.
 */
export function createProviderAuthStateStore(
  opts: CreateProviderAuthStateStoreOptions,
): ProviderAuthStateStore {
  if (!opts.provider) {
    throw new Error("createProviderAuthStateStore: provider is required");
  }
  if (opts.driver.kind === "memory") {
    return createInMemoryProviderAuthStateStore({ ttlMs: opts.ttlMs });
  }
  return createDrizzleProviderAuthStateStore(opts.driver.db, opts.driver.table, {
    ttlMs: opts.ttlMs,
  });
}
