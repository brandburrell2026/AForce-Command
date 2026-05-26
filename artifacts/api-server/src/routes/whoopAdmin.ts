/**
 * Admin trigger for the WHOOP biometrics fetch worker.
 *
 *   POST /api/admin/whoop/fetch/:userId   (requireAdmin)
 *     Runs `runWhoopFetchOnce` for the target user and returns the
 *     structured outcome. Used to:
 *       1. Smoke-test the OAuth -> token -> manager -> fetch ->
 *          biometrics pipeline end-to-end after wiring a WHOOP test
 *          account.
 *       2. Force an out-of-cycle refresh for a single user without
 *          waiting for the next sweep tick.
 *       3. Diagnose a stuck user (skipped_no_token vs error vs
 *          skipped_no_state).
 *
 * Hidden-infra: the production-wired router is only mounted from
 * `routes/index.ts` when the same WHOOP env vars that gate the OAuth
 * surface are present. With nothing configured the routes 404 — there
 * is no half-configured surface, and `getWhoopOAuthConfigFromEnv()`
 * (called inside `buildDefaultWhoopFetchDeps`) never has a chance to
 * throw at request time.
 *
 * Architecture lock: returns the raw outcome (status, fetchedAt,
 * sanitized error). The handler maps:
 *   - 'ok' / 'skipped_no_token' / 'skipped_no_state' -> 200
 *   - 'error'                                        -> 500
 * `runWhoopFetchOnce` is contractually never-throws; any throw from
 * the runner is caught here and surfaced as 500.
 *
 * Singleflight: the default-wired router shares the process-singleton
 * `WhoopRefreshRegistry` with the cron sweep loop, so an admin trigger
 * fired while a sweep is mid-refresh for the same user collapses to a
 * single POST against WHOOP's token endpoint — see
 * `lib/whoopRefreshRegistry.ts`.
 */

import { Router, type IRouter } from "express";
import type { Logger } from "pino";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import {
  buildDefaultWhoopFetchDeps,
  runWhoopFetchOnce,
  type WhoopFetchOutcome,
} from "../lib/whoopFetchWorker";
import type { WhoopRefreshRegistry } from "../lib/whoopRefreshRegistry";
import { requireAdmin } from "../middlewares/requireAdmin";
import { getWhoopTokenEncryptionStatus } from "@workspace/db";

export interface WhoopTokenEncryptionStatus {
  total: number;
  encrypted: number;
  plaintextOnly: number;
  halfEncrypted: number;
  /** Whether the runtime store is configured with an encryption key.
   *  Used by the UI to tell "backfill is opt-out" from "we never
   *  enabled encryption." */
  encryptionKeyConfigured: boolean;
  /** Whether the backfill cron is configured to run (interval set). */
  backfillCronEnabled: boolean;
}

export interface WhoopAdminDeps {
  /** Per-user fetch runner. The router never reaches the DB / WHOOP
   *  directly — the runner closes over those. Tests pass a mock. */
  runOnce: (userId: string) => Promise<WhoopFetchOutcome>;
  /** Encryption-status readout. Tests pass a mock so they don't need
   *  a real DB. */
  encryptionStatus: () => Promise<WhoopTokenEncryptionStatus>;
}

export function buildWhoopAdminRouter(deps: WhoopAdminDeps): IRouter {
  const router: IRouter = Router();

  router.use("/admin/whoop", requireAdmin);

  router.get("/admin/whoop/encryption-status", async (_req, res) => {
    // No throw-path in the helper but the route is defensive: if
    // pgcrypto is missing or the table is gone, surface 500 rather
    // than crashing the admin shell.
    try {
      const status = await deps.encryptionStatus();
      res.status(200).json(status);
    } catch (err) {
      res.status(500).json({
        error: "encryption_status_failed",
        message: err instanceof Error ? err.message : "unknown_error",
      });
    }
  });

  router.post("/admin/whoop/fetch/:userId", async (req, res) => {
    const userId = req.params["userId"];
    if (!userId || typeof userId !== "string" || userId.length === 0) {
      // Express won't route an empty :userId, but a path-traversal
      // attempt could land here with something pathological.
      res.status(400).json({ error: "missing_user_id" });
      return;
    }
    let outcome: WhoopFetchOutcome;
    try {
      outcome = await deps.runOnce(userId);
    } catch (err) {
      // Defence-in-depth: runOnce is contractually never-throws.
      req.log?.error(
        { userId, err: err instanceof Error ? err.name : "unknown_error" },
        "whoopAdmin:runOnce threw",
      );
      res.status(500).json({
        error: "fetch_failed",
        userId,
      });
      return;
    }
    const status = outcome.status === "error" ? 500 : 200;
    res.status(status).json({ outcome });
  });

  return router;
}

/**
 * Build the production-wired admin router with all defaults bound:
 * Drizzle-backed deps, shared singleton WhoopRefreshRegistry, and the
 * server logger. Exported as a factory (not a side-effect-evaluated
 * default like adminDemand) because `getWhoopOAuthConfigFromEnv()`
 * throws on missing env — only callers behind the env gate in
 * `routes/index.ts` should construct this.
 */
export function buildDefaultWhoopAdminRouter(opts: {
  db: NodePgDatabase<Record<string, unknown>>;
  refreshRegistry: WhoopRefreshRegistry;
  log: Pick<Logger, "info" | "warn" | "error">;
}): IRouter {
  return buildWhoopAdminRouter({
    runOnce: (userId) =>
      runWhoopFetchOnce(
        userId,
        buildDefaultWhoopFetchDeps(opts.db, userId, {
          log: opts.log,
          refreshRegistry: opts.refreshRegistry,
        }),
      ),
    encryptionStatus: async () => {
      const counts = await getWhoopTokenEncryptionStatus(opts.db);
      const keyRaw = process.env["WHOOP_TOKEN_ENCRYPTION_KEY"];
      const intervalRaw = process.env["WHOOP_TOKEN_BACKFILL_INTERVAL_MS"];
      return {
        ...counts,
        encryptionKeyConfigured:
          typeof keyRaw === "string" && keyRaw.trim() !== "",
        backfillCronEnabled:
          typeof intervalRaw === "string" &&
          intervalRaw !== "" &&
          Number.isFinite(Number(intervalRaw)) &&
          Number(intervalRaw) > 0,
      };
    },
  });
}
