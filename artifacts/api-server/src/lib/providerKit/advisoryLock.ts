/**
 * providerKit — multi-replica advisory lock orchestration, parameterized
 * by namespace.
 *
 * Pure extraction of `whoopAdvisoryLock.ts`'s `withWhoopUserAdvisoryLock`
 * (the proven, production pattern) merged with the byte-identical copy
 * that lived inline in `ouraFetchSweepBootstrap.ts`
 * (`withOuraUserAdvisoryLock`). Both providers are retargeted onto this
 * module in this lane:
 *   - Oura's copy in `ouraFetchSweepBootstrap.ts` becomes a thin
 *     wrapper (same exported names: `withOuraUserAdvisoryLock`,
 *     `OuraPgPoolLike`, `OuraPgClientLike`, `OURA_USER_ADVISORY_LOCK_NAMESPACE`).
 *   - `whoopAdvisoryLock.ts` becomes a thin wrapper too (same exported
 *     names: `withWhoopUserAdvisoryLock`, `PgPoolLike`, `PgClientLike`,
 *     `WhoopAdvisoryLockOutcome`, `WHOOP_USER_ADVISORY_LOCK_NAMESPACE`) —
 *     zero-risk because every caller and test goes through the public
 *     API only, never the internals.
 *
 * Background. The in-process per-provider refresh registry is a
 * singleflight keyed by userId — it collapses CONCURRENT same-user
 * fetches inside ONE node process. That's sufficient for single-replica
 * deployments. Once we scale horizontally, two replicas can each see
 * the same userId on the same tick (their sweep iterators are
 * independent) and both POST a refresh to the provider's token
 * endpoint. Providers that rotate the refresh token on every refresh
 * (WHOOP does; assume worst-case for any provider) leave the slower
 * replica's response stale and the user's token effectively bricked
 * until the next refresh window.
 *
 * Distributed singleflight via Postgres advisory locks. Session-level
 * `pg_try_advisory_lock(key)` is non-blocking — it returns true if the
 * lock was acquired, false if another session holds it. We use the
 * single-bigint form (not the two-int form) so the key is a full
 * 64-bit value: `hashtextextended(userId, namespace)`. The namespace
 * travels as the hash SEED — callers pass a distinct namespace per
 * provider so their locks occupy disjoint regions of the 64-bit
 * keyspace even though every provider hashes the same userId strings.
 * The wider key matters at scale: collisions translate to *false*
 * mutual exclusion across unrelated users (throughput hit, repeated
 * skips) — 64-bit drops that probability to ~1e-10 per pair at 100k
 * users vs ~5e-4 for 32-bit `hashtext`.
 *
 * Connection pinning is mandatory. Session advisory locks are scoped
 * to the *connection* (Postgres backend process) that acquired them.
 * `db.execute` from the drizzle handle checks out a fresh client from
 * the pool for each query, so acquiring on one query and unlocking on
 * the next would leak the lock on the first connection (where it still
 * holds) and no-op the unlock on the second. We MUST pin a single
 * `PgClientLike` for the lock acquire / fn body / unlock cycle, then
 * `release()` it back to the pool. Worst case (process crash mid-fn):
 * the lock vanishes when the backend session closes — fine.
 */

/** Minimal `pg.Pool` shape we actually use. Decoupled so tests can
 *  pass a fake without pulling in the `pg` types. */
export interface PgPoolLike {
  connect(): Promise<PgClientLike>;
}

/** Minimal `pg.PoolClient` shape. */
export interface PgClientLike {
  query(text: string, values?: unknown[]): Promise<{ rows: Array<unknown> }>;
  release(err?: Error | boolean): void;
}

/** Outcome of `withProviderUserAdvisoryLock`. Discriminated on
 *  `acquired` so callers can't confuse "lock declined" with "fn
 *  returned undefined / null". */
export type ProviderAdvisoryLockOutcome<T> =
  | { acquired: true; value: T }
  | { acquired: false };

/**
 * Run `fn` exactly once across all replicas that share this DB, keyed
 * by `userId` within `namespace`. If another replica already holds the
 * lock, returns `{ acquired: false }` immediately — the caller should
 * SKIP this user, not block, not retry. Skipping is correct: the other
 * replica is processing the user; this sweep can move on.
 *
 * Invariants:
 *   - The PgClientLike is released in every path (fn success, fn
 *     throw, unlock throw, lock-not-acquired). A leaked client pins a
 *     backend process forever.
 *   - On `pg_advisory_unlock` failure we DESTROY the client
 *     (`client.release(err)`) instead of returning it to the pool. A
 *     plain `release()` would put the session back into rotation while
 *     it may still hold the advisory lock at the backend, which would
 *     leak the key (persistent `acquired:false` for that userId until
 *     that backend process dies). Destroying forces the session to
 *     close, which definitively frees the lock.
 *   - On `pg_try_advisory_lock` failure we ALSO destroy the client. If
 *     the acquire query throws, lock state is UNKNOWN — the lock may
 *     have been taken at the backend even though no row came back.
 *     Recycling such a session risks the same lock-leak as the
 *     unlock-failure path. The acquire-throws path also re-throws to
 *     the caller (sweep treats it as an error, not a skip).
 *   - If `fn` throws, the throw propagates AFTER unlock + release.
 */
export async function withProviderUserAdvisoryLock<T>(
  pool: PgPoolLike,
  userId: string,
  namespace: number,
  fn: () => Promise<T>,
): Promise<ProviderAdvisoryLockOutcome<T>> {
  const client = await pool.connect();
  let acquired = false;
  let acquireErr: unknown = undefined;
  let unlockErr: unknown = undefined;
  try {
    try {
      const result = await client.query(
        "SELECT pg_try_advisory_lock(hashtextextended($1, $2::bigint)) AS got",
        [userId, namespace],
      );
      const row = result.rows?.[0] as { got?: boolean } | undefined;
      acquired = row?.got === true;
    } catch (err) {
      acquireErr = err;
      throw err;
    }
    if (!acquired) {
      return { acquired: false };
    }
    const value = await fn();
    return { acquired: true, value };
  } finally {
    if (acquired) {
      try {
        await client.query(
          "SELECT pg_advisory_unlock(hashtextextended($1, $2::bigint))",
          [userId, namespace],
        );
      } catch (err) {
        unlockErr = err;
      }
    }
    // Destroy the client if EITHER the acquire query failed (lock
    // state is unknown — backend may have taken the lock before the
    // error path) OR the unlock query failed (lock may still be
    // held). Plain release() would recycle a session that could
    // poison subsequent checkouts with a stuck advisory lock.
    const fatalErr = acquireErr ?? unlockErr;
    if (fatalErr !== undefined) {
      client.release(
        fatalErr instanceof Error ? fatalErr : new Error(String(fatalErr)),
      );
    } else {
      client.release();
    }
  }
}
