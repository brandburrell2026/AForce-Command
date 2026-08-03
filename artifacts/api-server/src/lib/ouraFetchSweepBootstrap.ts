/**
 * Env-gated boot helpers for Oura's biometrics fetch sweep + auth-state
 * purge loops.
 *
 * Mirrors `whoopFetchSweepBootstrap.ts` + `whoopAuthStatePurgeBootstrap.ts`,
 * built on top of `providerKit/sweepLoop.ts` (env-cadence parsing +
 * worker-pool fan-out + setTimeout scheduling) instead of duplicating
 * that machinery. WHOOP's own bootstrap files are frozen/production
 * and are NOT touched or reused directly.
 *
 * Exports TWO independent bootstraps:
 *   - `maybeStartOuraFetchSweep` — runs `runOuraFetchOnce` for every
 *     user with stored Oura tokens at a configured interval. Reads
 *     `OURA_FETCH_SWEEP_INTERVAL_MS`. Streams over `aforce_oura_tokens`
 *     via the keyset paginator in `./ouraTokenUserIds.ts` (same
 *     tuple-cursor + snapshot-cutoff shape as WHOOP's
 *     `iterWhoopTokenUserIdsForSweep`) so process memory stays bounded
 *     at O(pageSize) regardless of table size. Optional
 *     `OURA_FETCH_SWEEP_MULTI_REPLICA` opt-in adds a cross-process
 *     singleflight via a Postgres advisory lock scoped to a distinct
 *     Oura namespace (see `withOuraUserAdvisoryLock` below) — same
 *     pattern as WHOOP's `whoopAdvisoryLock.ts`, deliberately NOT
 *     imported from there so the two providers occupy disjoint regions
 *     of the advisory-lock keyspace independently.
 *   - `maybeStartOuraAuthStatePurge` — reaps expired
 *     `aforce_oura_auth_states` rows (already-implemented via
 *     `purgeExpiredOuraAuthStates`, itself now backed by
 *     `providerKit/oauthStateStore.ts`). Reads
 *     `OURA_AUTH_STATE_PURGE_INTERVAL_MS`.
 *
 * Both follow the same env-cadence contract (via
 * `parseSweepIntervalMs`): unset/empty -> disabled, quiet; not a
 * positive finite number -> disabled + warn (refuses to coerce a
 * misconfig like "5min").
 *
 * ARCHITECTURE LOCK — hidden-infra. `src/index.ts` wires
 * `maybeStartOuraFetchSweep` + `maybeStartOuraAuthStatePurge` at boot
 * (mirroring the WHOOP wiring), but BOTH remain no-ops with the
 * relevant env vars unset — zero behavior change for any deployment
 * that hasn't opted in. No OAuth changes, no user-facing activation.
 */

import { type NodePgDatabase } from "drizzle-orm/node-postgres";
import type { Logger } from "pino";
import { pool as defaultPool } from "@workspace/db";
import {
  buildDefaultOuraFetchDeps,
  runOuraFetchOnce,
} from "./ouraFetchWorker";
import type { OuraRefreshRegistry } from "./ouraRefreshRegistry";
import {
  getDbNow,
  iterOuraTokenUserIdsForSweep,
  OURA_TOKEN_USERS_DEFAULT_PAGE_SIZE,
} from "./ouraTokenUserIds";
import {
  OURA_AUTH_STATE_DEFAULT_TTL_MS,
  purgeExpiredOuraAuthStates,
} from "./ouraAuthStateStore";
import {
  parseSweepIntervalMs,
  runProviderFetchSweepStreaming,
  startProviderFetchSweepLoop,
  type AcquireUserSweepLock,
  type ProviderFetchSweepResult,
} from "./providerKit/sweepLoop";
import {
  withProviderUserAdvisoryLock,
  type PgClientLike as ProviderPgClientLike,
  type PgPoolLike as ProviderPgPoolLike,
  type ProviderAdvisoryLockOutcome,
} from "./providerKit/advisoryLock";

/* ─── Multi-replica advisory lock (Oura namespace) ──────────────────────
 *
 * Thin wrapper over `providerKit/advisoryLock.ts`'s
 * `withProviderUserAdvisoryLock` — session-level
 * `pg_try_advisory_lock(hashtextextended(userId, seed))`, non-blocking,
 * connection-pinned for the acquire/fn/unlock cycle. See that module
 * for the full invariants (client release on every path, destroy-vs-
 * recycle on acquire/unlock failure). Namespace-parameterized: this
 * file supplies the Oura-specific seed so Oura's locks occupy a
 * disjoint region of the 64-bit advisory-lock keyspace from WHOOP's
 * (`whoopAdvisoryLock.ts`), even though both hash the same userId
 * strings.
 *
 * Value mnemonic: 0x4f550001 = "OU" (0x4f55) slot 1 — parallel to
 * WHOOP's 0x57480001 ("WH" slot 1). Picked once, never reuse for
 * anything else in this DB.
 */
export const OURA_USER_ADVISORY_LOCK_NAMESPACE = 0x4f550001;

/** Minimal `pg.Pool` shape we actually use. Re-exported from
 *  `providerKit/advisoryLock.ts` — structurally identical to what this
 *  file declared before the extraction (and to `whoopAdvisoryLock.ts`'s
 *  `PgPoolLike`). */
export type OuraPgPoolLike = ProviderPgPoolLike;

/** Minimal `pg.PoolClient` shape. */
export type OuraPgClientLike = ProviderPgClientLike;

export type OuraAdvisoryLockOutcome<T> = ProviderAdvisoryLockOutcome<T>;

/**
 * Run `fn` exactly once across all replicas that share this DB, keyed
 * by `userId`, in the Oura namespace. If another replica already holds
 * the lock, returns `{ acquired: false }` immediately — caller should
 * skip this user, not block, not retry.
 *
 * Same invariants as `withWhoopUserAdvisoryLock`: the PoolClient is
 * released in every path; on `pg_advisory_unlock` failure OR
 * `pg_try_advisory_lock` failure the client is DESTROYED
 * (`client.release(err)`) rather than recycled, because lock state is
 * ambiguous and a plain `release()` would risk poisoning a later
 * checkout with a stuck advisory lock.
 */
export function withOuraUserAdvisoryLock<T>(
  pool: OuraPgPoolLike,
  userId: string,
  fn: () => Promise<T>,
): Promise<OuraAdvisoryLockOutcome<T>> {
  return withProviderUserAdvisoryLock(
    pool,
    userId,
    OURA_USER_ADVISORY_LOCK_NAMESPACE,
    fn,
  );
}

/** Parse the multi-replica env flag. Truthy values: "1", "true",
 *  "yes", "on" (case-insensitive, trimmed). Everything else (including
 *  unset, empty, "0", "false") is OFF. Mirrors WHOOP bootstrap's
 *  `parseMultiReplica` — strict whitelist so a typo can't silently
 *  enable distributed locking. */
function parseMultiReplica(raw: string | undefined): boolean {
  if (raw === undefined) return false;
  const v = raw.trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes" || v === "on";
}

/* ─── Fetch sweep ─────────────────────────────────────────────────────── */

export interface MaybeStartOuraFetchSweepOpts {
  db: NodePgDatabase<Record<string, unknown>>;
  refreshRegistry: OuraRefreshRegistry;
  log: Pick<Logger, "info" | "warn" | "error">;
  /** Override for tests. Defaults to `process.env`. */
  env?: Record<string, string | undefined>;
  /** Override for tests. Defaults to `OURA_FETCH_SWEEP_INTERVAL_MS`. */
  envVarName?: string;
  /** Override the per-sweep concurrency. Defaults to 4. */
  concurrency?: number;
  /** Override the keyset page size. Defaults to
   *  `OURA_TOKEN_USERS_DEFAULT_PAGE_SIZE` (500). Process memory during
   *  a sweep stays bounded at O(pageSize) regardless of table size. */
  pageSize?: number;
  /** TEST SEAM: override the iterator factory. Defaults to
   *  `iterOuraTokenUserIdsForSweep`. Production code should not pass
   *  this — it exists so the bootstrap can be unit-tested without a
   *  real DB. */
  iterFactory?: (
    db: NodePgDatabase<Record<string, unknown>>,
    opts: { cutoff: Date; pageSize?: number },
  ) => AsyncIterable<readonly string[]>;
  /** TEST SEAM: override the DB-clock cutoff source. Defaults to
   *  `getDbNow`. Production code should not pass this. */
  dbNow?: (db: NodePgDatabase<Record<string, unknown>>) => Promise<Date>;
  /** TEST SEAM: override the multi-replica env var name. Defaults to
   *  `OURA_FETCH_SWEEP_MULTI_REPLICA`. */
  multiReplicaEnvVarName?: string;
  /** TEST SEAM: override the connection pool used by the advisory
   *  lock. Defaults to the shared `@workspace/db` pool. */
  pool?: OuraPgPoolLike;
  /** TEST SEAM: override the acquireLock builder. When set, takes
   *  precedence over the env-gated default. Use to inject a fake lock
   *  in unit tests without touching env. */
  acquireLock?: AcquireUserSweepLock;
}

export type OuraFetchSweepHandle = {
  /** Halt the loop; in-flight sweep allowed to drain. */
  stop: () => void;
  intervalMs: number;
};

export function maybeStartOuraFetchSweep(
  opts: MaybeStartOuraFetchSweepOpts,
): OuraFetchSweepHandle | null {
  const env = opts.env ?? process.env;
  const varName = opts.envVarName ?? "OURA_FETCH_SWEEP_INTERVAL_MS";
  const log = opts.log;
  const intervalMs = parseSweepIntervalMs({
    envVarName: varName,
    env,
    log,
    logPrefix: "ouraFetchSweep",
  });
  if (intervalMs === null) return null;

  const iterFactory = opts.iterFactory ?? iterOuraTokenUserIdsForSweep;
  const dbNow = opts.dbNow ?? getDbNow;
  const multiReplicaVarName =
    opts.multiReplicaEnvVarName ?? "OURA_FETCH_SWEEP_MULTI_REPLICA";
  const multiReplica = parseMultiReplica(env[multiReplicaVarName]);
  // Resolution order: explicit test override > env-gated default >
  // undefined (single-replica path) — same as WHOOP's bootstrap.
  let acquireLock: AcquireUserSweepLock | undefined = opts.acquireLock;
  if (acquireLock === undefined && multiReplica) {
    const lockPool = opts.pool ?? defaultPool;
    acquireLock = <T>(
      userId: string,
      fn: () => Promise<T>,
    ): Promise<{ acquired: true; value: T } | { acquired: false }> =>
      withOuraUserAdvisoryLock(lockPool, userId, fn);
  }

  const stop = startProviderFetchSweepLoop({
    intervalMs,
    log,
    logPrefix: "ouraFetchSweep",
    runSweep: async (): Promise<ProviderFetchSweepResult> => {
      const runOnce = (userId: string): ReturnType<typeof runOuraFetchOnce> =>
        runOuraFetchOnce(
          userId,
          buildDefaultOuraFetchDeps(opts.db, userId, {
            log,
            refreshRegistry: opts.refreshRegistry,
          }),
        );

      // Snapshot cutoff captured from the DB clock (not `new Date()`)
      // BEFORE creating the iterator — same reasoning as WHOOP's
      // bootstrap: the token store writes `updated_at` via DB `now()`,
      // so comparing the cutoff against writes that share the same
      // clock source avoids a same-user reprocess window under app/DB
      // clock skew. New users created during the sweep are picked up
      // next tick.
      const sweepStartCutoff = await dbNow(opts.db);
      return runProviderFetchSweepStreaming({
        pages: iterFactory(opts.db, {
          cutoff: sweepStartCutoff,
          pageSize: opts.pageSize ?? OURA_TOKEN_USERS_DEFAULT_PAGE_SIZE,
        }),
        concurrency: opts.concurrency,
        acquireLock,
        log,
        logPrefix: "ouraFetchSweep",
        runOnce,
      });
    },
  });

  log.info(
    { intervalMs, multiReplica: acquireLock !== undefined },
    "ouraFetchSweep:bootstrap started",
  );

  return { stop, intervalMs };
}

/* ─── Auth-state purge ────────────────────────────────────────────────── */

export interface MaybeStartOuraAuthStatePurgeOpts {
  db: NodePgDatabase<Record<string, unknown>>;
  log: Pick<Logger, "info" | "warn" | "error">;
  /** Override for tests. Defaults to `process.env`. */
  env?: Record<string, string | undefined>;
  /** Override for tests. Defaults to
   *  `OURA_AUTH_STATE_PURGE_INTERVAL_MS`. */
  envVarName?: string;
  /** Override the TTL. Defaults to
   *  {@link OURA_AUTH_STATE_DEFAULT_TTL_MS} — same single source of
   *  truth the store factories use, so the purge can never reap rows
   *  `consume` would still accept. */
  ttlMs?: number;
  /** TEST SEAM: override the purge fn. Defaults to
   *  `purgeExpiredOuraAuthStates` (kit-backed). */
  purgeFn?: (
    db: NodePgDatabase<Record<string, unknown>>,
    nowMs: number,
    ttlMs: number,
  ) => Promise<number>;
  /** TEST SEAM: clock source for the cutoff. Defaults to `Date.now`. */
  now?: () => number;
}

export type OuraAuthStatePurgeHandle = {
  /** Halt the loop; in-flight purge allowed to drain. */
  stop: () => void;
  intervalMs: number;
  ttlMs: number;
};

export function maybeStartOuraAuthStatePurge(
  opts: MaybeStartOuraAuthStatePurgeOpts,
): OuraAuthStatePurgeHandle | null {
  const env = opts.env ?? process.env;
  const varName = opts.envVarName ?? "OURA_AUTH_STATE_PURGE_INTERVAL_MS";
  const log = opts.log;
  const intervalMs = parseSweepIntervalMs({
    envVarName: varName,
    env,
    log,
    logPrefix: "ouraAuthStatePurge",
  });
  if (intervalMs === null) return null;

  const ttlMs = opts.ttlMs ?? OURA_AUTH_STATE_DEFAULT_TTL_MS;
  const purgeFn = opts.purgeFn ?? purgeExpiredOuraAuthStates;
  const now = opts.now ?? Date.now;

  const tick = async (): Promise<void> => {
    try {
      const reaped = await purgeFn(opts.db, now(), ttlMs);
      if (reaped > 0) {
        // Quiet on the zero-reaped happy path (most ticks).
        log.info({ reaped }, "ouraAuthStatePurge: rows reaped");
      }
    } catch (err) {
      // Never let a purge failure crash the process. Next tick
      // retries.
      log.error({ err }, "ouraAuthStatePurge: tick failed");
    }
  };

  const handle = setInterval(() => {
    void tick();
  }, intervalMs);
  // Don't keep the event loop alive — graceful shutdown owns the
  // lifecycle. Defensive: in test environments setInterval may not
  // have `.unref()` (e.g. fake timers).
  if (typeof handle.unref === "function") handle.unref();

  log.info({ intervalMs, ttlMs }, "ouraAuthStatePurge:bootstrap started");

  return {
    stop: () => clearInterval(handle),
    intervalMs,
    ttlMs,
  };
}
