/**
 * PKCE / OAuth-state store for the Oura authorize -> callback hop.
 *
 * Thin wrapper over `providerKit/oauthStateStore.ts` — the in-memory
 * and Drizzle drivers, single-use consume, TTL, and purge helper are
 * all shared implementation now (see that module for the full
 * contract doc). This file exists to keep Oura's public API — every
 * exported name, type, and default — byte-identical to what it was
 * before the extraction, so `routes/ouraOAuth.ts` and every existing
 * Oura test keep passing unchanged.
 *
 * Faithful mirror of `whoopAuthStateStore.ts` / `garminAuthStateStore.ts`
 * (still standalone — WHOOP is frozen/production and is not migrated
 * onto providerKit in this lane).
 */

import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { aforceOuraAuthStates } from "@workspace/db";
import {
  PROVIDER_AUTH_STATE_DEFAULT_TTL_MS,
  createInMemoryProviderAuthStateStore,
  createDrizzleProviderAuthStateStore,
  purgeExpiredProviderAuthStates,
  type ProviderAuthStateRecord,
  type ProviderAuthStateStore,
  type ProviderAuthStateTable,
} from "./providerKit/oauthStateStore";

/** Default TTL for an in-flight Oura OAuth state record. */
export const OURA_AUTH_STATE_DEFAULT_TTL_MS = PROVIDER_AUTH_STATE_DEFAULT_TTL_MS;

export type OuraAuthStateRecord = ProviderAuthStateRecord;
export type OuraAuthStateStore = ProviderAuthStateStore;

// `aforceOuraAuthStates` (state/codeVerifier/userId/createdAt) satisfies
// `ProviderAuthStateTable` structurally.
const OURA_AUTH_STATE_TABLE = aforceOuraAuthStates as unknown as ProviderAuthStateTable;

export interface InMemoryOuraAuthStateStoreOptions {
  /** Defaults to {@link OURA_AUTH_STATE_DEFAULT_TTL_MS}. */
  ttlMs?: number;
}

export function createInMemoryOuraAuthStateStore(
  opts: InMemoryOuraAuthStateStoreOptions = {},
): OuraAuthStateStore {
  return createInMemoryProviderAuthStateStore(opts);
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
  return createDrizzleProviderAuthStateStore(db, OURA_AUTH_STATE_TABLE, opts);
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
  return purgeExpiredProviderAuthStates(db, OURA_AUTH_STATE_TABLE, nowMs, ttlMs);
}
