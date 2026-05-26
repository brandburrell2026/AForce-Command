/**
 * Env-gated boot helper for the WHOOP auth-state expiry purge loop.
 *
 * Reaps rows from `aforce_whoop_auth_states` whose `created_at` is
 * older than `ttlMs`. These rows are otherwise removed lazily on
 * `consume`, so the only entries that accumulate are abandoned
 * authorize flows (user closed the tab, OAuth provider never
 * redirected back). Steady-state row count is bounded by inflight
 * authorize attempts per TTL window — this is hygiene, not
 * load-bearing.
 *
 * Reads `WHOOP_AUTH_STATE_PURGE_INTERVAL_MS`:
 *   - unset / empty -> purge disabled, returns null (hidden-infra
 *     default; matches the `maybeStartWhoopFetchSweep` pattern).
 *   - not a positive finite number -> logs warn, returns null. We
 *     refuse to coerce a misconfig (e.g. "5min" -> NaN -> spin).
 *   - valid -> schedules a setInterval that calls
 *     `purgeExpiredWhoopAuthStates(db, Date.now(), ttlMs)` and logs
 *     the reaped row count. Returns a `{ stop }` handle.
 *
 * Reuses the proven `setInterval + clearInterval + unref` shape from
 * the sweep loop so the timer never holds the process open on
 * shutdown.
 */
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type { Logger } from "pino";
import {
  purgeExpiredWhoopAuthStates,
  WHOOP_AUTH_STATE_DEFAULT_TTL_MS,
} from "./whoopAuthStateStore";

export interface MaybeStartWhoopAuthStatePurgeOpts {
  db: NodePgDatabase<Record<string, unknown>>;
  log: Pick<Logger, "info" | "warn" | "error">;
  /** Override for tests. Defaults to `process.env`. */
  env?: Record<string, string | undefined>;
  /** Override for tests. Defaults to
   *  `WHOOP_AUTH_STATE_PURGE_INTERVAL_MS`. */
  envVarName?: string;
  /** Override the TTL. Defaults to
   *  {@link WHOOP_AUTH_STATE_DEFAULT_TTL_MS} — same single source of
   *  truth used by the store factories, so the purge can never reap
   *  rows `consume` would still accept. If a deployment overrides
   *  the store TTL, it must override this too. */
  ttlMs?: number;
  /** TEST SEAM: override the purge fn. Defaults to
   *  `purgeExpiredWhoopAuthStates`. */
  purgeFn?: (
    db: NodePgDatabase<Record<string, unknown>>,
    nowMs: number,
    ttlMs: number,
  ) => Promise<number>;
  /** TEST SEAM: clock source for the cutoff. Defaults to `Date.now`. */
  now?: () => number;
}

export type WhoopAuthStatePurgeHandle = {
  /** Halt the loop; in-flight purge allowed to drain. */
  stop: () => void;
  intervalMs: number;
  ttlMs: number;
};

export function maybeStartWhoopAuthStatePurge(
  opts: MaybeStartWhoopAuthStatePurgeOpts,
): WhoopAuthStatePurgeHandle | null {
  const env = opts.env ?? process.env;
  const varName = opts.envVarName ?? "WHOOP_AUTH_STATE_PURGE_INTERVAL_MS";
  const raw = env[varName];
  if (raw === undefined || raw === null || raw === "") {
    // Hidden-infra default. Quiet (no log spam).
    return null;
  }
  const intervalMs = Number(raw);
  if (!Number.isFinite(intervalMs) || intervalMs <= 0) {
    opts.log.warn(
      { [varName]: raw },
      "whoopAuthStatePurge:bootstrap ignored — value is not a positive number",
    );
    return null;
  }

  const ttlMs = opts.ttlMs ?? WHOOP_AUTH_STATE_DEFAULT_TTL_MS;
  const purgeFn = opts.purgeFn ?? purgeExpiredWhoopAuthStates;
  const now = opts.now ?? Date.now;
  const log = opts.log;

  const tick = async (): Promise<void> => {
    try {
      const reaped = await purgeFn(opts.db, now(), ttlMs);
      if (reaped > 0) {
        // Quiet on the zero-reaped happy path (most ticks).
        log.info({ reaped }, "whoopAuthStatePurge: rows reaped");
      }
    } catch (err) {
      // Never let a purge failure crash the process. Next tick
      // retries. The table can absorb backlog — abandoned authorize
      // rows are tiny and indexed by created_at.
      log.error({ err }, "whoopAuthStatePurge: tick failed");
    }
  };

  const handle = setInterval(() => {
    void tick();
  }, intervalMs);
  // Don't keep the event loop alive — graceful shutdown owns the
  // lifecycle. Defensive: in test environments setInterval may not
  // have `.unref()` (e.g. fake timers).
  if (typeof handle.unref === "function") handle.unref();

  log.info(
    { intervalMs, ttlMs },
    "whoopAuthStatePurge:bootstrap started",
  );

  return {
    stop: () => clearInterval(handle),
    intervalMs,
    ttlMs,
  };
}
