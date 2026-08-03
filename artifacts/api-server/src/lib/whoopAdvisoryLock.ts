/**
 * Multi-replica advisory lock for per-user WHOOP work.
 *
 * Thin wrapper over `providerKit/advisoryLock.ts` — the acquire/fn/
 * unlock orchestration, connection-pinning, and destroy-vs-release
 * error handling are all shared implementation now (extracted from
 * this file's proven pattern; see that module for the full contract
 * doc, including the WHY behind connection pinning, the 64-bit
 * `hashtextextended` keyspace choice, and the destroy-on-ambiguous-
 * lock-state invariants). This file exists to keep WHOOP's public API
 * — every exported name, type, and default — byte-identical to what it
 * was before the extraction, so `whoopFetchSweepBootstrap.ts` and every
 * existing WHOOP test (including the DB-integration suite in
 * `src/__tests__/whoopAdvisoryLock.drizzle.test.ts`) keep passing
 * unchanged.
 *
 * Value mnemonic: 0x57480001 = 1,464,336,385 ("WH" = 0x5748, slot 1).
 * Picked once, never reuse for anything else in this DB. Oura uses a
 * distinct namespace (`OURA_USER_ADVISORY_LOCK_NAMESPACE` in
 * `ouraFetchSweepBootstrap.ts`, "OU" = 0x4f55) so the two providers'
 * locks occupy disjoint regions of the 64-bit keyspace even though
 * both hash the same userId strings.
 *
 * Scope of THIS module. Pure helper + namespace constant. The wiring
 * into `runWhoopFetchSweep` (per-user wrap + a new `skipped_locked`
 * tally bucket) lives in `whoopFetchSweepBootstrap.ts`.
 */

import {
  withProviderUserAdvisoryLock,
  type PgClientLike as ProviderPgClientLike,
  type PgPoolLike as ProviderPgPoolLike,
  type ProviderAdvisoryLockOutcome,
} from "./providerKit/advisoryLock";

/**
 * Stable namespace seed for WHOOP-user advisory locks. Travels as the
 * second arg to `hashtextextended(userId, seed)` so different features
 * in the same DB live in disjoint 64-bit keyspaces. Picked once,
 * never reuse for anything else in this DB.
 *
 * Value mnemonic: 0x57480001 = 1,464,336,385 ("WH" = 0x5748, slot 1).
 */
export const WHOOP_USER_ADVISORY_LOCK_NAMESPACE = 0x57480001;

/** Minimal `pg.Pool` shape we actually use. Decoupled so tests can
 *  pass a fake without pulling in the `pg` types. Re-exported from
 *  `providerKit/advisoryLock.ts` — structurally identical to what this
 *  file declared before the extraction. */
export type PgPoolLike = ProviderPgPoolLike;

/** Minimal `pg.PoolClient` shape. */
export type PgClientLike = ProviderPgClientLike;

/** Outcome of `withWhoopUserAdvisoryLock`. Discriminated on
 *  `acquired` so callers can't confuse "lock declined" with "fn
 *  returned undefined / null". */
export type WhoopAdvisoryLockOutcome<T> = ProviderAdvisoryLockOutcome<T>;

/**
 * Run `fn` exactly once across all replicas that share this DB,
 * keyed by `userId`. If another replica already holds the lock,
 * returns `{ acquired: false }` immediately — the caller should
 * SKIP this user, not block, not retry. Skipping is correct: the
 * other replica is processing the user; this sweep can move on.
 *
 * See `providerKit/advisoryLock.ts`'s `withProviderUserAdvisoryLock`
 * for the full invariants (client release on every path, destroy-vs-
 * recycle on acquire/unlock failure, throw-after-unlock ordering).
 */
export function withWhoopUserAdvisoryLock<T>(
  pool: PgPoolLike,
  userId: string,
  fn: () => Promise<T>,
): Promise<WhoopAdvisoryLockOutcome<T>> {
  return withProviderUserAdvisoryLock(
    pool,
    userId,
    WHOOP_USER_ADVISORY_LOCK_NAMESPACE,
    fn,
  );
}
