/**
 * PKCE / OAuth-state store for the WHOOP authorize -> callback hop.
 *
 * Thin wrapper over `providerKit/oauthStateStore.ts` — the in-memory
 * and Drizzle drivers, single-use consume, TTL, and purge helper are
 * all shared implementation now (see that module for the full
 * contract doc). This file exists to keep WHOOP's public API — every
 * exported name, type, and default — byte-identical to what it was
 * before the extraction, so `routes/whoopOAuth.ts`,
 * `whoopAuthStatePurgeBootstrap.ts`, and every existing WHOOP test
 * keep passing unchanged.
 *
 * W3 lane: WHOOP moves onto providerKit last (it was frozen/production
 * during the O1/F6 extraction that built this kit from WHOOP's own
 * pre-extraction shape — see `ouraAuthStateStore.ts` for the template
 * this file now mirrors byte-for-byte after the s/oura/whoop/ rename).
 */

import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { aforceWhoopAuthStates } from "@workspace/db";
import {
  PROVIDER_AUTH_STATE_DEFAULT_TTL_MS,
  createInMemoryProviderAuthStateStore,
  createDrizzleProviderAuthStateStore,
  purgeExpiredProviderAuthStates,
  type ProviderAuthStateRecord,
  type ProviderAuthStateStore,
} from "./providerKit/oauthStateStore";

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
export const WHOOP_AUTH_STATE_DEFAULT_TTL_MS = PROVIDER_AUTH_STATE_DEFAULT_TTL_MS;

export type WhoopAuthStateRecord = ProviderAuthStateRecord;
export type WhoopAuthStateStore = ProviderAuthStateStore;

// `aforceWhoopAuthStates` (state/codeVerifier/userId/createdAt)
// satisfies `ProviderAuthStateTable` structurally — passed straight
// through below with NO cast. `createDrizzleProviderAuthStateStore` /
// `purgeExpiredProviderAuthStates` are generic over the concrete table
// type, so TypeScript's normal argument-assignability check IS the
// safety net: a future column rename fails to compile here instead of
// silently passing through an `as unknown as ProviderAuthStateTable`
// double-cast (see `providerKit/oauthStateStore.ts`'s module doc for
// why the double-cast was the actual bug this generic fixes).

export interface InMemoryWhoopAuthStateStoreOptions {
  /** Defaults to {@link WHOOP_AUTH_STATE_DEFAULT_TTL_MS}. */
  ttlMs?: number;
}

export function createInMemoryWhoopAuthStateStore(
  opts: InMemoryWhoopAuthStateStoreOptions = {},
): WhoopAuthStateStore {
  return createInMemoryProviderAuthStateStore(opts);
}

export interface DrizzleWhoopAuthStateStoreOptions {
  /** Defaults to {@link WHOOP_AUTH_STATE_DEFAULT_TTL_MS}. */
  ttlMs?: number;
}

/**
 * Postgres-backed WHOOP auth-state store. Multi-replica-safe. Mirrors
 * the in-memory contract exactly; single-use guarantee enforced via
 * `DELETE ... RETURNING`.
 */
export function createDrizzleWhoopAuthStateStore(
  db: NodePgDatabase<Record<string, unknown>>,
  opts: DrizzleWhoopAuthStateStoreOptions = {},
): WhoopAuthStateStore {
  return createDrizzleProviderAuthStateStore(db, aforceWhoopAuthStates, opts);
}

/**
 * Operational helper — sweeps rows older than `ttlMs`. Safe to run
 * concurrently with `consume`. Returns the number of rows reaped.
 */
export async function purgeExpiredWhoopAuthStates(
  db: NodePgDatabase<Record<string, unknown>>,
  nowMs: number,
  ttlMs: number,
): Promise<number> {
  return purgeExpiredProviderAuthStates(db, aforceWhoopAuthStates, nowMs, ttlMs);
}
