/**
 * Env-gated boot helper for the WHOOP fetch sweep loop.
 *
 * Reads `WHOOP_FETCH_SWEEP_INTERVAL_MS`:
 *   - unset / empty -> sweep is disabled, returns null (no-op).
 *   - not a positive finite number -> logs warn, returns null. We
 *     refuse to silently round / coerce a misconfig because a typo
 *     like "5min" would otherwise become 0 / NaN and either spin or
 *     never fire.
 *   - valid -> wires `listWhoopTokenUserIds(db)` + a per-user runner
 *     that shares the process-singleton WhoopRefreshRegistry with the
 *     admin trigger surface, then calls `startWhoopFetchSweepLoop`.
 *     Returns the loop's `stop` function.
 *
 * Hidden-infra: server boot calls this unconditionally; the env gate
 * lives here. Default deployments have the env unset and pay nothing.
 *
 * Multi-replica note: by default this gives single-replica process
 * safety only. Set `WHOOP_FETCH_SWEEP_MULTI_REPLICA=1` (or any truthy
 * value — see `parseMultiReplica`) to enable the cross-process
 * singleflight via Postgres advisory locks (`whoopAdvisoryLock.ts`).
 * The lock is keyed by `hashtextextended(userId, namespace)`; on
 * acquired:false the sweep tallies the user as `skipped_locked` and
 * moves on. Default OFF preserves the hidden-infra contract (no
 * behavior change for deployments that don't opt in).
 */

import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type { Logger } from "pino";
import { pool as defaultPool } from "@workspace/db";
import {
  buildDefaultWhoopFetchDeps,
  getDbNow,
  iterWhoopTokenUserIdsForSweep,
  runWhoopFetchOnce,
} from "./whoopFetchWorker";
import type { WhoopRefreshRegistry } from "./whoopRefreshRegistry";
import {
  runWhoopFetchSweepStreaming,
  startWhoopFetchSweepLoop,
  type AcquireUserSweepLock,
} from "./whoopFetchSweep";
import {
  withWhoopUserAdvisoryLock,
  type PgPoolLike,
} from "./whoopAdvisoryLock";
import { readWhoopEligibilityInput } from "./whoopRefreshControlStore";
import {
  resolveWhoopEligibility,
  WHOOP_DATA_FRESH_MS,
  type WhoopEligibility,
} from "./whoopRefreshPolicy";
import type { WhoopFetchOutcome } from "./whoopFetchWorker";

export interface MaybeStartWhoopFetchSweepOpts {
  db: NodePgDatabase<Record<string, unknown>>;
  refreshRegistry: WhoopRefreshRegistry;
  log: Pick<Logger, "info" | "warn" | "error">;
  /** Override for tests. Defaults to `process.env`. */
  env?: Record<string, string | undefined>;
  /** Override for tests. Defaults to `WHOOP_FETCH_SWEEP_INTERVAL_MS`. */
  envVarName?: string;
  /** Override the per-sweep concurrency. Defaults to 4 (whoopFetchSweep
   *  default). The singleflight registry collapses same-user concurrent
   *  refreshes, so this caps unrelated-user parallelism only. */
  concurrency?: number;
  /** Override the keyset page size. Defaults to
   *  `WHOOP_TOKEN_USERS_DEFAULT_PAGE_SIZE` (500). Process memory during
   *  a sweep stays bounded at O(pageSize) regardless of table size. */
  pageSize?: number;
  /** TEST SEAM: override the iterator factory. Defaults to
   *  `iterWhoopTokenUserIdsForSweep`. Production code should not pass
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
   *  `WHOOP_FETCH_SWEEP_MULTI_REPLICA`. */
  multiReplicaEnvVarName?: string;
  /** TEST SEAM: override the connection pool used by the advisory
   *  lock. Defaults to the shared `@workspace/db` pool. */
  pool?: PgPoolLike;
  /** TEST SEAM: override the acquireLock builder. When set, takes
   *  precedence over the env-gated default. Use to inject a fake
   *  lock in unit tests without touching env. */
  acquireLock?: AcquireUserSweepLock;
  /** Freshness threshold override. Defaults to WHOOP_DATA_FRESH_MS (30 min,
   *  founder-ratified); env `WHOOP_DATA_FRESH_MS` overrides when it parses
   *  to a positive number. */
  freshMs?: number;
  /** TEST SEAM: override the eligibility reader (defaults to the drizzle
   *  control-store read). Production code should not pass this. */
  eligibilityGate?: (userId: string) => Promise<WhoopEligibility>;
  /** TEST SEAM: override the per-user fetch runner (defaults to
   *  `runWhoopFetchOnce` with production deps). */
  runOnce?: (userId: string) => Promise<WhoopFetchOutcome>;
}

/**
 * Parse the multi-replica env flag. Truthy values: "1", "true",
 * "yes", "on" (case-insensitive). Everything else (including unset,
 * empty, "0", "false") is OFF. Strict whitelist instead of generic
 * truthiness so a typo doesn't silently enable distributed locking
 * in a single-replica deployment (where it would only cost a tiny
 * amount of DB chatter, but the principle is "explicit opt-in").
 */
function parseMultiReplica(raw: string | undefined): boolean {
  if (raw === undefined) return false;
  const v = raw.trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes" || v === "on";
}

export type WhoopFetchSweepHandle = {
  /** Halt the loop; in-flight sweep allowed to drain. */
  stop: () => void;
  intervalMs: number;
};

export function maybeStartWhoopFetchSweep(
  opts: MaybeStartWhoopFetchSweepOpts,
): WhoopFetchSweepHandle | null {
  const env = opts.env ?? process.env;
  const varName = opts.envVarName ?? "WHOOP_FETCH_SWEEP_INTERVAL_MS";
  const raw = env[varName];
  if (raw === undefined || raw === null || raw === "") {
    // Hidden-infra default. Quiet (no log spam) — most deployments
    // never want this.
    return null;
  }
  const intervalMs = Number(raw);
  if (!Number.isFinite(intervalMs) || intervalMs <= 0) {
    opts.log.warn(
      { [varName]: raw },
      "whoopFetchSweep:bootstrap ignored — value is not a positive number",
    );
    return null;
  }

  const log = opts.log;
  const iterFactory = opts.iterFactory ?? iterWhoopTokenUserIdsForSweep;
  const dbNow = opts.dbNow ?? getDbNow;
  const multiReplicaVarName =
    opts.multiReplicaEnvVarName ?? "WHOOP_FETCH_SWEEP_MULTI_REPLICA";
  const multiReplica = parseMultiReplica(env[multiReplicaVarName]);
  // Resolution order: explicit test override > env-gated default >
  // undefined (single-replica path). The explicit override lets unit
  // tests inject a fake lock without setting env. The env path is
  // what production deployments use.
  let acquireLock: AcquireUserSweepLock | undefined = opts.acquireLock;
  if (acquireLock === undefined && multiReplica) {
    const lockPool = opts.pool ?? defaultPool;
    acquireLock = <T>(
      userId: string,
      fn: () => Promise<T>,
    ): Promise<{ acquired: true; value: T } | { acquired: false }> =>
      withWhoopUserAdvisoryLock(lockPool, userId, fn);
  }
  const freshMsEnvRaw = env["WHOOP_DATA_FRESH_MS"];
  const freshMsEnv = Number(freshMsEnvRaw);
  const freshMs =
    opts.freshMs ??
    (freshMsEnvRaw && Number.isFinite(freshMsEnv) && freshMsEnv > 0
      ? freshMsEnv
      : WHOOP_DATA_FRESH_MS);
  const eligibilityGate =
    opts.eligibilityGate ??
    (async (userId: string): Promise<WhoopEligibility> => {
      const input = await readWhoopEligibilityInput(opts.db, userId);
      // No token row: let the worker produce its canonical skipped_no_token.
      if (input === null) return "fetch";
      return resolveWhoopEligibility(input, Date.now(), freshMs);
    });
  const runOnce =
    opts.runOnce ??
    ((userId: string) =>
      runWhoopFetchOnce(
        userId,
        buildDefaultWhoopFetchDeps(opts.db, userId, {
          log,
          refreshRegistry: opts.refreshRegistry,
        }),
      ));

  const stop = startWhoopFetchSweepLoop({
    intervalMs,
    log,
    runSweep: async () => {
      // Snapshot cutoff captured from the DB clock (not `new Date()`)
      // BEFORE creating the iterator. The token store writes
      // `updated_at` via DB `now()`; if the app clock lagged the DB
      // clock, an in-sweep refresh could land at a timestamp <= an
      // app-derived cutoff and re-trigger the round-1 PR-21 bug.
      // Comparing cutoff to writes that share the same clock source
      // closes that window. New users created during the sweep are
      // picked up next tick.
      const sweepStartCutoff = await dbNow(opts.db);
      return runWhoopFetchSweepStreaming({
        pages: iterFactory(opts.db, {
          cutoff: sweepStartCutoff,
          pageSize: opts.pageSize,
        }),
        concurrency: opts.concurrency,
        acquireLock,
        log,
        runOnce: async (userId) => {
          // WHOOP sweep redesign (2026-08-19): eligibility gate BEFORE any
          // fetch work. A suppressed user costs one control-row read and
          // zero provider calls. Gate failure fails OPEN to 'fetch' — a
          // broken bookkeeping read must never silence the sweep, only the
          // suppressions.
          let gate: WhoopEligibility = "fetch";
          try {
            gate = await eligibilityGate(userId);
          } catch (err) {
            log.warn(
              { userId, err: err instanceof Error ? err.message : String(err) },
              "whoopFetchSweep:eligibility read failed — fetching anyway",
            );
          }
          if (gate !== "fetch") return { userId, status: gate };
          return runOnce(userId);
        },
      });
    },
  });

  log.info(
    { intervalMs, multiReplica: acquireLock !== undefined },
    "whoopFetchSweep:bootstrap started",
  );

  return { stop, intervalMs };
}
