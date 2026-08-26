/**
 * GET /api/entitlement
 *
 * Returns the entitled plan id + subscription status for the authenticated
 * user. Resolution logic (Stripe synced schema > aforce_users cache, plus
 * the D-2 Shopify web rail) lives in lib/entitlementResolver so this route
 * and requireEntitlement middleware share one implementation (Wave-2 PR1
 * extraction — behavior unchanged).
 */

import { Router, type IRouter } from "express";
import { serializeError } from "../lib/serializeError";
import { requireAuth } from "../middlewares/requireAuth";
import { resolveEntitlement } from "../lib/entitlementResolver";
import { logger } from "../lib/logger";

const router: IRouter = Router();

router.get("/entitlement", requireAuth, async (req, res) => {
  try {
    const userId = req.userId;
    if (!userId) {
      res.status(401).json({ error: "unauthorized" });
      return;
    }

    const resolved = await resolveEntitlement(userId);
    res.json({
      planId: resolved.planId,
      status: resolved.status,
      currentPeriodEnd: resolved.currentPeriodEnd?.toISOString() ?? null,
      stripeCustomerId: resolved.stripeCustomerId,
    });
  } catch (err) {
    logger.error({ err: serializeError(err) }, "GET /entitlement failed");
    res.status(500).json({ error: "entitlement_failed" });
  }
});

export default router;
