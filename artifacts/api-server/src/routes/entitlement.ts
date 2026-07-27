/**
 * GET /api/entitlement
 *
 * Returns the entitled plan id + subscription status for the authenticated
 * user. Source of truth is `stripe.subscriptions` (kept in sync by
 * stripe-replit-sync). We query that synced table by joining to
 * `aforce_users.stripe_customer_id` — the linkage is written when the
 * user opens Checkout (see routes/checkout.ts).
 *
 * `aforce_users.plan_id` / `subscription_status` are kept as a fallback
 * cache for users with no live subscription (so a freshly signed-up
 * Clerk user immediately gets `core` instead of a 404), and refreshed
 * opportunistically on every read so they stay in lockstep with Stripe.
 */

import { Router, type IRouter } from "express";
import { db, aforceUsers, aforceWebEntitlements } from "@workspace/db";
import { and, desc, eq, sql } from "drizzle-orm";
import { requireAuth } from "../middlewares/requireAuth";
import { logger } from "../lib/logger";

const router: IRouter = Router();

interface SubRow {
  status: string;
  current_period_end: number | null;
  plan_id: string | null;
}

const ACTIVE_STATUSES = new Set(["active", "trialing", "past_due"]);

router.get("/entitlement", requireAuth, async (req, res) => {
  try {
    const userId = req.userId;
    if (!userId) {
      res.status(401).json({ error: "unauthorized" });
      return;
    }

    // Insert-if-missing on first authenticated read.
    let [row] = await db
      .select()
      .from(aforceUsers)
      .where(eq(aforceUsers.id, userId))
      .limit(1);
    if (!row) {
      const [inserted] = await db
        .insert(aforceUsers)
        .values({ id: userId, planId: "core", subscriptionStatus: "none" })
        .onConflictDoNothing({ target: aforceUsers.id })
        .returning();
      row = inserted ?? (await db.select().from(aforceUsers).where(eq(aforceUsers.id, userId)).limit(1))[0];
    }

    let planId = row?.planId ?? "core";
    let status = row?.subscriptionStatus ?? "none";
    let currentPeriodEnd: Date | null = row?.currentPeriodEnd ?? null;

    // If we have a Stripe customer linkage, query the synced subscription
    // table and let it override the cached plan/status. Wrapped in
    // try/catch so a missing stripe schema (integration not connected)
    // never breaks the entitlement endpoint.
    if (row?.stripeCustomerId) {
      try {
        const result = await db.execute(sql`
          SELECT
            s.status::text AS status,
            s.current_period_end,
            COALESCE(pr.metadata->>'planId', p.metadata->>'planId') AS plan_id
          FROM stripe.subscriptions s
          LEFT JOIN stripe.subscription_items si ON si.subscription = s.id
          LEFT JOIN stripe.prices pr ON pr.id = si.price
          LEFT JOIN stripe.products p ON p.id = pr.product
          WHERE s.customer = ${row.stripeCustomerId}
            AND s.status IN ('active','trialing','past_due')
          ORDER BY s.created DESC NULLS LAST
          LIMIT 1
        `);
        const live = (result.rows?.[0] ?? null) as unknown as SubRow | null;
        if (live) {
          status = live.status;
          if (live.plan_id) planId = live.plan_id;
          currentPeriodEnd = live.current_period_end
            ? new Date(live.current_period_end * 1000)
            : null;
          // Refresh cache so subsequent reads (or downstream reads via
          // aforce_users) stay current.
          if (
            row.planId !== planId ||
            row.subscriptionStatus !== status ||
            row.currentPeriodEnd?.getTime() !== currentPeriodEnd?.getTime()
          ) {
            await db
              .update(aforceUsers)
              .set({
                planId,
                subscriptionStatus: status,
                currentPeriodEnd,
                updatedAt: new Date(),
              })
              .where(eq(aforceUsers.id, userId));
          }
        } else if (ACTIVE_STATUSES.has(status) || planId !== "core") {
          // No live Stripe sub — force a safe downgrade to core. We do this
          // not just when the cached status is active, but any time the
          // cached planId is paid, so a stale cache (e.g., `canceled` with
          // planId=`recovery_plus`) cannot keep granting paid features.
          planId = "core";
          status = ACTIVE_STATUSES.has(status) ? "canceled" : status;
          currentPeriodEnd = null;
          await db
            .update(aforceUsers)
            .set({
              planId,
              subscriptionStatus: status,
              currentPeriodEnd,
              updatedAt: new Date(),
            })
            .where(eq(aforceUsers.id, userId));
        }
      } catch (err) {
        // stripe schema missing or query failed — silent fallback to cache.
        logger.debug({ err }, "entitlement: stripe.subscriptions lookup failed; using cache");
      }
    }

    // D-2 bridge (slice 4c): a web (Shopify) Command purchase grants app
    // entitlement when the Stripe rail has nothing better. Additive OR —
    // Stripe stays primary; an unexpired active web row upgrades core, never
    // downgrades a live Stripe plan. Cache is NOT overwritten (the web rail
    // is re-checked each read, so a cancelled web sub loses access on the
    // next read — same fail-safe posture as the Stripe path).
    if (planId === "core" && row?.email) {
      try {
        const [web] = await db
          .select()
          .from(aforceWebEntitlements)
          .where(
            and(
              eq(aforceWebEntitlements.email, row.email.trim().toLowerCase()),
              eq(aforceWebEntitlements.status, "active"),
              // Gate FIX-FIRST: expiry must live in SQL — with many rows per
              // email, a redelivered EXPIRED order bumps updatedAt and would
              // shadow a live renewal row at LIMIT 1 (denying a paying user).
              sql`(${aforceWebEntitlements.currentPeriodEnd} IS NULL OR ${aforceWebEntitlements.currentPeriodEnd} > now())`,
            ),
          )
          .orderBy(desc(aforceWebEntitlements.updatedAt))
          .limit(1);
        const unexpired =
          web && (web.currentPeriodEnd == null || web.currentPeriodEnd.getTime() > Date.now());
        // Defense-in-depth (security sign-off; re-applied after a lost race
        // with the #400 merge): the web rail may only ever grant these plans,
        // regardless of what a future writer or DB edit stores.
        const WEB_GRANTABLE_PLANS = new Set(["athlete"]);
        if (web && unexpired && WEB_GRANTABLE_PLANS.has(web.planId)) {
          planId = web.planId;
          status = "active";
          currentPeriodEnd = web.currentPeriodEnd;
          if (web.userId !== userId) {
            await db
              .update(aforceWebEntitlements)
              .set({ userId, updatedAt: new Date() })
              .where(eq(aforceWebEntitlements.id, web.id));
          }
        }
      } catch (err) {
        logger.debug({ err }, "entitlement: web-entitlement lookup failed; using stripe/cache result");
      }
    }

    res.json({
      planId,
      status,
      currentPeriodEnd: currentPeriodEnd?.toISOString() ?? null,
      stripeCustomerId: row?.stripeCustomerId ?? null,
    });
  } catch (err) {
    logger.error({ err }, "GET /entitlement failed");
    res.status(500).json({ error: "entitlement_failed" });
  }
});

export default router;
