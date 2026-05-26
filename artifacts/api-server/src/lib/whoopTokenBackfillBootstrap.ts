/**
 * Env-gated boot helper for the WHOOP token encryption backfill loop.
 *
 * Phase B of the pgcrypto rollout. Phase A (already shipped) added
 * the `access_token_enc` / `refresh_token_enc` bytea columns and
 * made the Drizzle store DUAL-WRITE plaintext + enc when a key is
 * configured. Pre-existing rows still have null enc columns. This
 * loop walks the table in batches and fills the enc columns for
 * those rows. Once it returns 0 reaped for a sustained window, ops
 * can flip reads to enc-only (Phase C, separate PR).
 *
 * Reads two env vars:
 *   - `WHOOP_TOKEN_BACKFILL_INTERVAL_MS`
 *       - unset / empty -> disabled, returns null (hidden-infra
 *         default; matches the auth-state purge pattern).
 *       - not a positive finite number -> warn + return null.
 *   - `WHOOP_TOKEN_ENCRYPTION_KEY`
 *       - unset / empty -> warn + return null even if the interval
 *         is configured. Backfill can't run without the key the
 *         runtime store is using, and silently no-op'ing would
 *         leave ops with a false-positive "backfill is running"
 *         signal.
 *
 * Reuses the proven `setInterval + .unref() + per-tick error catch`
 * shape from `whoopAuthStatePurgeBootstrap`. Errors in a tick are
 * logged and the loop continues — the next tick retries.
 */
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type { Logger } from "pino";
import { backfillWhoopTokenEncryption } from "@workspace/db";

const DEFAULT_BATCH_SIZE = 200;

export interface MaybeStartWhoopTokenBackfillOpts {
  db: NodePgDatabase<Record<string, unknown>>;
  log: Pick<Logger, "info" | "warn" | "error">;
  /** Override for tests. Defaults to `process.env`. */
  env?: Record<string, string | undefined>;
  /** Override for tests. Defaults to
   *  `WHOOP_TOKEN_BACKFILL_INTERVAL_MS`. */
  intervalEnvVarName?: string;
  /** Override for tests. Defaults to
   *  `WHOOP_TOKEN_ENCRYPTION_KEY` — same var the runtime store
   *  reads. They MUST agree or the cron will encrypt with a
   *  different key than the store decrypts with. */
  keyEnvVarName?: string;
  /** Override the batch size. Defaults to {@link DEFAULT_BATCH_SIZE}.
   *  Bounds the per-tick row-lock blast radius. */
  batchSize?: number;
  /** TEST SEAM: override the backfill fn. Defaults to
   *  `backfillWhoopTokenEncryption`. */
  backfillFn?: (
    db: NodePgDatabase<Record<string, unknown>>,
    encryptionKey: string,
    batchSize: number,
  ) => Promise<number>;
}

export type WhoopTokenBackfillHandle = {
  /** Halt the loop; in-flight backfill allowed to drain. */
  stop: () => void;
  intervalMs: number;
  batchSize: number;
};

export function maybeStartWhoopTokenBackfill(
  opts: MaybeStartWhoopTokenBackfillOpts,
): WhoopTokenBackfillHandle | null {
  const env = opts.env ?? process.env;
  const intervalVar =
    opts.intervalEnvVarName ?? "WHOOP_TOKEN_BACKFILL_INTERVAL_MS";
  const keyVar = opts.keyEnvVarName ?? "WHOOP_TOKEN_ENCRYPTION_KEY";
  const log = opts.log;

  const rawInterval = env[intervalVar];
  if (rawInterval === undefined || rawInterval === null || rawInterval === "") {
    // Hidden-infra default. Quiet.
    return null;
  }
  const intervalMs = Number(rawInterval);
  if (!Number.isFinite(intervalMs) || intervalMs <= 0) {
    log.warn(
      { [intervalVar]: rawInterval },
      "whoopTokenBackfill:bootstrap ignored — interval is not a positive number",
    );
    return null;
  }

  const rawKey = env[keyVar];
  const encryptionKey =
    typeof rawKey === "string" && rawKey.trim() !== "" ? rawKey : null;
  if (!encryptionKey) {
    // LOUD on this one — if ops set the interval but forgot the
    // key, silently no-op'ing would hide the misconfiguration and
    // backfill would never actually happen.
    log.warn(
      { intervalVar, keyVar },
      "whoopTokenBackfill:bootstrap refused — interval is set but encryption key is missing; backfill cannot run without the key",
    );
    return null;
  }

  const batchSize = opts.batchSize ?? DEFAULT_BATCH_SIZE;
  if (!Number.isFinite(batchSize) || batchSize <= 0) {
    log.warn(
      { batchSize },
      "whoopTokenBackfill:bootstrap ignored — batchSize must be a positive number",
    );
    return null;
  }
  const backfillFn = opts.backfillFn ?? backfillWhoopTokenEncryption;

  const tick = async (): Promise<void> => {
    try {
      const filled = await backfillFn(opts.db, encryptionKey, batchSize);
      if (filled > 0) {
        // Quiet on the zero-filled steady state (post-backfill).
        log.info({ filled }, "whoopTokenBackfill: rows encrypted");
      }
    } catch (err) {
      // Never let a backfill failure crash the process. Next tick
      // retries. The cron is idempotent so a partial batch on a
      // crashed tick is fine — already-encrypted rows won't match
      // the IS NULL predicate on the next run.
      log.error({ err }, "whoopTokenBackfill: tick failed");
    }
  };

  const handle = setInterval(() => {
    void tick();
  }, intervalMs);
  // Don't keep the event loop alive — graceful shutdown owns the
  // lifecycle. Defensive: fake timers may not expose `.unref()`.
  if (typeof handle.unref === "function") handle.unref();

  log.info(
    { intervalMs, batchSize },
    "whoopTokenBackfill:bootstrap started",
  );

  return {
    stop: () => clearInterval(handle),
    intervalMs,
    batchSize,
  };
}
