/**
 * Health endpoints (Wave-3 PR7 — real checks replace the constant stub).
 *
 *   GET /api/healthz       PROCESS ALIVE  — cheap, no dependencies.
 *                          200 {status:"ok"} | 503 {status:"draining"}
 *   GET /api/healthz/deep  SERVICE READY  — runs registered checks.
 *                          200 {status:"ok"|"degraded", checks:[...]}
 *                          503 {status:"unready"|"draining", checks:[...]}
 *
 * `degraded` = a NON-critical dependency is failing (named in `checks`);
 * traffic keeps flowing. `unready` = a CRITICAL check failed (database,
 * critical config) — the LB should stop sending traffic.
 *
 * Deploy note (founder-owned, deliberately NOT changed here): Railway has
 * no healthcheckPath configured; adding `healthcheckPath = "/api/healthz/deep"`
 * under [deploy] in railway.toml is a one-line founder change.
 */
import { Router, type IRouter } from "express";
import { livenessHandler, readinessHandler } from "../health/checks";
import { registerProductionChecks } from "../health/registerChecks";

registerProductionChecks();

const router: IRouter = Router();

router.get("/healthz", livenessHandler());
router.get("/healthz/deep", readinessHandler());

export default router;
