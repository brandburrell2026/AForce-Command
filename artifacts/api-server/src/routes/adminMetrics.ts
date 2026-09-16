/**
 * GET /api/admin/metrics — founder-only operational metrics snapshot
 * (Wave-3 PR9). In-memory counters/latency histograms from
 * observability/metrics.ts; process-lifetime, reset on deploy.
 * NEVER exposed unauthenticated; dimensions are privacy-safe by
 * construction (route buckets, status classes, seam names — no user
 * identity anywhere in the registry).
 */
import { Router, type IRouter } from "express";
import { pool } from "@workspace/db";
import { flagSources, snapshot as flagSnapshot } from "../config/featureFlags";
import { requireFounder } from "../middlewares/requireFounder";
import { setGauge, snapshot } from "../observability/metrics";

const router: IRouter = Router();

/**
 * Pool saturation, sampled when asked rather than polled.
 *
 * `waiting` is the number that matters: requests queued for one of the ten
 * connections. A sustained non-zero value means the pool is the bottleneck,
 * which is what the roster fan-out used to cause and what a future one would
 * cause again. Sampling on read keeps it free when nobody is looking.
 */
function samplePool(): { total: number; idle: number; waiting: number } {
  const stats = {
    total: pool.totalCount,
    idle: pool.idleCount,
    waiting: pool.waitingCount,
  };
  setGauge("db_pool.total", stats.total);
  setGauge("db_pool.idle", stats.idle);
  setGauge("db_pool.waiting", stats.waiting);
  return stats;
}

router.get("/admin/metrics", requireFounder, (_req, res) => {
  samplePool();
  res.json({
    generatedAt: new Date().toISOString(),
    // WHICH FLAGS ARE ON, AND WHY. Without this, the only way to learn
    // whether a kill switch actually took effect was to probe a route and
    // infer it from a 404. `sources` distinguishes a value someone set from
    // a default that happens to match — the difference between "we turned it
    // off" and "we never turned it on".
    flags: { values: flagSnapshot(), sources: flagSources() },
    ...snapshot(),
  });
});

export default router;
