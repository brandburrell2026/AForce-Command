/**
 * Env-gated boot helpers for Oura's biometrics fetch sweep + auth-state
 * purge loops.
 *
 * Mirrors `whoopFetchSweepBootstrap.ts` + `whoopAuthStatePurgeBootstrap.ts`,
 * rebuilt on top of `providerKit/sweepLoop.ts` (env-cadence parsing +
 * worker-pool fan-out + setTimeout scheduling) instead of duplicating
 * that machinery. WHOOP's own bootstrap files are frozen/production
 * and are NOT touched or reused directly.
 *
 * Exports TWO independent bootstraps:
 *   - `maybeStartOuraFetchSweep` — runs `runOuraFetchOnce` for every
 *     user with stored Oura tokens at a configured interval. Reads
 *     `OURA_FETCH_SWEEP_INTERVAL_MS`.
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
 * ARCHITECTURE LOCK — hidden-infra, NOT wired into server boot in this
 * lane. `src/index.ts` does not call either export here. Wiring these
 * into boot (alongside deciding multi-replica / advisory-lock parity
 * with WHOOP) is a separate integration decision, tracked as a
 * follow-up once Oura is ready to activate at production scale.
 *
 * KNOWN SIMPLIFICATION vs. WHOOP: the fetch sweep below lists every
 * `aforce_oura_tokens` userId in one query rather than WHOOP's
 * keyset-paginated streaming iterator (`iterWhoopTokenUserIdsForSweep`).
 * WHOOP's pagination exists to bound sweep memory at O(pageSize)
 * against a production-scale table; Oura has no rows yet (dormant
 * until OURA_* env vars are configured AND this bootstrap is wired
 * into boot). Add keyset pagination here before activating Oura at
 * meaningful scale — do not copy this simplification forward
 * uncritically.
 */

import { type NodePgDatabase } from "drizzle-orm/node-postgres";
import type { Logger } from "pino";
import { aforceOuraTokens } from "@workspace/db";
import {
  buildDefaultOuraFetchDeps,
  runOuraFetchOnce,
} from "./ouraFetchWorker";
import type { OuraRefreshRegistry } from "./ouraRefreshRegistry";
import {
  OURA_AUTH_STATE_DEFAULT_TTL_MS,
  purgeExpiredOuraAuthStates,
} from "./ouraAuthStateStore";
import {
  parseSweepIntervalMs,
  runProviderFetchSweep,
  startProviderFetchSweepLoop,
  type ProviderFetchSweepResult,
} from "./providerKit/sweepLoop";

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
  /** TEST SEAM: override the userId lister. Defaults to querying
   *  `aforce_oura_tokens` directly. */
  listUserIds?: (
    db: NodePgDatabase<Record<string, unknown>>,
  ) => Promise<string[]>;
}

export type OuraFetchSweepHandle = {
  /** Halt the loop; in-flight sweep allowed to drain. */
  stop: () => void;
  intervalMs: number;
};

/** Every userId with a stored Oura token row. See the module doc's
 *  KNOWN SIMPLIFICATION note — no keyset pagination yet. */
async function listOuraTokenUserIds(
  db: NodePgDatabase<Record<string, unknown>>,
): Promise<string[]> {
  const rows = await db
    .select({ userId: aforceOuraTokens.userId })
    .from(aforceOuraTokens);
  return rows.map((r) => r.userId);
}

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

  const listUserIds = opts.listUserIds ?? listOuraTokenUserIds;

  const stop = startProviderFetchSweepLoop({
    intervalMs,
    log,
    logPrefix: "ouraFetchSweep",
    runSweep: async (): Promise<ProviderFetchSweepResult> => {
      const userIds = await listUserIds(opts.db);
      return runProviderFetchSweep({
        userIds,
        concurrency: opts.concurrency,
        log,
        logPrefix: "ouraFetchSweep",
        runOnce: (userId) =>
          runOuraFetchOnce(
            userId,
            buildDefaultOuraFetchDeps(opts.db, userId, {
              log,
              refreshRegistry: opts.refreshRegistry,
            }),
          ),
      });
    },
  });

  log.info({ intervalMs }, "ouraFetchSweep:bootstrap started");

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
