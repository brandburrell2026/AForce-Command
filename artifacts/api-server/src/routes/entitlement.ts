/**
 * GET /api/entitlement
 *
 * Returns the entitled plan id + subscription status for the
 * authenticated user. The Stripe webhook keeps `aforce_users.plan_id`
 * up to date (see ./stripeWebhook.ts), so this is a single indexed
 * lookup with no upstream Stripe call.
 *
 * Auto-creates the row on first read so a freshly-signed-up Clerk
 * user immediately has a `core` entitlement instead of a 404.
 */

import { Router, type IRouter } from "express";
import { db, aforceUsers } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth } from "../middlewares/requireAuth";
import { logger } from "../lib/logger";

const router: IRouter = Router();

router.get("/entitlement", requireAuth, async (req, res) => {
  try {
    const userId = req.userId;
    if (!userId) {
      res.status(401).json({ error: "unauthorized" });
      return;
    }

    let [row] = await db
      .select()
      .from(aforceUsers)
      .where(eq(aforceUsers.id, userId))
      .limit(1);

    if (!row) {
      // Insert-if-missing on first authenticated read. Race with the
      // webhook is benign — both code paths upsert with onConflictDoNothing
      // semantics (Postgres serializes the inserts and the loser reads
      // the winner's row on the followup select).
      const [inserted] = await db
        .insert(aforceUsers)
        .values({ id: userId, planId: "core", subscriptionStatus: "none" })
        .onConflictDoNothing({ target: aforceUsers.id })
        .returning();
      row = inserted ?? (await db.select().from(aforceUsers).where(eq(aforceUsers.id, userId)).limit(1))[0];
    }

    res.json({
      planId: row?.planId ?? "core",
      status: row?.subscriptionStatus ?? "none",
      currentPeriodEnd: row?.currentPeriodEnd?.toISOString() ?? null,
      stripeCustomerId: row?.stripeCustomerId ?? null,
    });
  } catch (err) {
    logger.error({ err }, "GET /entitlement failed");
    res.status(500).json({ error: "entitlement_failed" });
  }
});

export default router;
