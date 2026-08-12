/**
 * GET /api/admin/metrics — founder-only operational metrics snapshot
 * (Wave-3 PR9). In-memory counters/latency histograms from
 * observability/metrics.ts; process-lifetime, reset on deploy.
 * NEVER exposed unauthenticated; dimensions are privacy-safe by
 * construction (route buckets, status classes, seam names — no user
 * identity anywhere in the registry).
 */
import { Router, type IRouter } from "express";
import { requireFounder } from "../middlewares/requireFounder";
import { snapshot } from "../observability/metrics";

const router: IRouter = Router();

router.get("/admin/metrics", requireFounder, (_req, res) => {
  res.json({ generatedAt: new Date().toISOString(), ...snapshot() });
});

export default router;
