/**
 * requireEntitlement — gate an Express route behind a server-resolved
 * subscription entitlement (Wave-2 PR1).
 *
 * Client feature state is NEVER sufficient authorization: this middleware
 * ignores everything the client sends (headers, body, query — including
 * any claimed feature flags, plan ids, or user ids) and derives
 * entitlement exclusively from `req.userId` (set by requireAuth upstream)
 * via `resolveEntitlement`, which reads the synced Stripe schema /
 * aforce_users cache. Identity and entitlement therefore cannot diverge
 * by construction.
 *
 * Failure posture — fail closed on every edge:
 *   - no `req.userId` (requireAuth missing/failed)        → 401
 *   - unknown feature id                                   → 403
 *   - non-entitling status (canceled/paused/none/expired)  → 403
 *   - plan does not include the feature                    → 403 + requiredPlanId
 *   - entitlement lookup failure (DB down, etc.)           → 503, never next()
 *
 * Dev ergonomics mirror requireAuth: when NODE_ENV !== 'production' AND
 * Clerk is not configured (the single-user demo flow), the gate is
 * bypassed — the same environments where requireAuth grants
 * DEFAULT_USER_ID. Any environment with Clerk configured enforces fully.
 *
 * NOTE for future callers: `status: 'none'` (a fresh row that never
 * subscribed) does not entitle — matching the client gate. Core-tier
 * features are open endpoints today; do not wrap a core-feature route
 * with this middleware without first deciding free-tier status semantics.
 */

import type { RequestHandler } from "express";
import { resolveEntitlement } from "../lib/entitlementResolver";
import { FEATURE_MIN_PLAN, planGrantsFeature } from "../lib/featureEntitlements";
import { logger } from "../lib/logger";

export function requireEntitlement(featureId: string): RequestHandler {
  return async (req, res, next) => {
    const isProduction = process.env["NODE_ENV"] === "production";
    const clerkConfigured = Boolean(process.env["CLERK_SECRET_KEY"]);

    // Dev-only bypass, same posture as requireAuth's DEFAULT_USER_ID
    // fallback: no Clerk outside production = single-user demo flow.
    if (!isProduction && !clerkConfigured) {
      next();
      return;
    }

    const userId = req.userId;
    if (!userId) {
      res.status(401).json({ error: "unauthorized" });
      return;
    }

    let planId: string;
    let status: string;
    try {
      const resolved = await resolveEntitlement(userId);
      planId = resolved.planId;
      status = resolved.status;
    } catch (err) {
      // Lookup failure NEVER falls open.
      logger.error({ err, featureId }, "requireEntitlement: lookup failed; denying");
      res.status(503).json({ error: "entitlement_unavailable" });
      return;
    }

    if (!planGrantsFeature(planId, status, featureId)) {
      res.status(403).json({
        error: "entitlement_required",
        featureId,
        requiredPlanId: FEATURE_MIN_PLAN[featureId] ?? null,
      });
      return;
    }

    next();
  };
}
