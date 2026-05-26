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
 * Multi-replica note: this gives single-replica process safety only.
 * Horizontal scaling with the sweep enabled needs a distributed lock
 * (Postgres advisory lock keyed by `hashtext(user_id)` or a
 * `whoop_sweep_claims` table with SKIP LOCKED) — see
 * `whoopRefreshRegistry.ts` for the full rationale. Tracked as
 * follow-up.
 */

import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type { Logger } from "pino";
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
} from "./whoopFetchSweep";

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
        log,
        runOnce: (userId) =>
          runWhoopFetchOnce(
            userId,
            buildDefaultWhoopFetchDeps(opts.db, userId, {
              log,
              refreshRegistry: opts.refreshRegistry,
            }),
          ),
      });
    },
  });

  log.info(
    { intervalMs },
    "whoopFetchSweep:bootstrap started",
  );

  return { stop, intervalMs };
}
