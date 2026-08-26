/**
 * Production health checks (Wave-3 PR7) — registered into the existing
 * health/checks.ts framework (first wiring of that module).
 *
 * CRITICAL checks (failure → 503 unready): the service cannot honestly
 * serve traffic without them.
 *   - database: one cheap `SELECT 1` through the shared pool.
 *   - critical-config: production without CLERK_SECRET_KEY means every
 *     authenticated route 503s — the deploy is misconfigured, say so.
 *
 * NON-critical checks (failure → 200 `degraded`, named): optional
 * dependencies must not mark the whole application dead (founder
 * directive).
 *   - cache: Redis when configured; the in-memory fallback is a valid
 *     mode, reported honestly as such.
 */

import { pool } from "@workspace/db";
import { registerCheck } from "./checks";

const DB_CHECK_TIMEOUT_MS = 2_500;

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms),
    ),
  ]);
}

export function registerProductionChecks(): void {
  registerCheck({
    name: "database",
    critical: true,
    run: async () => {
      await withTimeout(pool.query("SELECT 1"), DB_CHECK_TIMEOUT_MS, "db ping");
      return { ok: true };
    },
  });

  registerCheck({
    name: "critical-config",
    critical: true,
    run: async () => {
      if (process.env["NODE_ENV"] === "production" && !process.env["CLERK_SECRET_KEY"]) {
        return { ok: false, detail: "CLERK_SECRET_KEY missing in production" };
      }
      if (!process.env["DATABASE_URL"]) {
        return { ok: false, detail: "DATABASE_URL missing" };
      }
      return { ok: true };
    },
  });

  registerCheck({
    name: "cache",
    critical: false,
    run: async () => {
      if (!process.env["REDIS_URL"]) {
        return { ok: true, detail: "memory mode (REDIS_URL not configured)" };
      }
      // Redis configured — a failing round-trip degrades but never unreadies.
      const { getCache } = await import("../cache/redisClient");
      const cache = getCache();
      const key = "healthz:ping";
      await withTimeout(
        Promise.resolve(cache.set(key, "1", 5)),
        DB_CHECK_TIMEOUT_MS,
        "cache ping",
      );
      return { ok: true };
    },
  });
}
