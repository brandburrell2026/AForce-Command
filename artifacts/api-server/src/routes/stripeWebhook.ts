/**
 * POST /api/stripe/webhook
 *
 * Stripe webhook receiver. MUST be mounted with `express.raw()` BEFORE
 * the global `express.json()` body parser — Stripe's signature
 * verification hashes the raw bytes, so any prior parsing breaks the HMAC.
 *
 * Lifecycle this handler covers:
 *   - checkout.session.completed   → first-time link customer + sub to user
 *   - customer.subscription.updated → plan id / status / period end mirror
 *   - customer.subscription.deleted → drop entitlement back to `core`
 *
 * The metadata bag set in `checkout.ts` (`metadata.userId` + `planId`)
 * is what bridges a Stripe customer back to a Clerk user id. We refuse
 * to process events without that linkage rather than guessing.
 */

import { Router, type IRouter, type Request, type Response } from "express";
import express from "express";
import { db, aforceUsers } from "@workspace/db";
import { eq } from "drizzle-orm";
import { getStripeClient } from "../lib/stripeClient";
import { logger } from "../lib/logger";

const router: IRouter = Router();

interface PriceLike {
  unit_amount?: number | null;
  metadata?: Record<string, string>;
}

// Reverse-lookup: derive the local plan id from a Stripe price. The
// PLAN_CATALOG in checkout.ts owns plan→amount; here we go amount→plan
// because price_data is created on the fly (no stable Stripe price ids
// in the demo flow). Single source of truth lives in checkout.ts; if
// pricing diverges, the test in subscriptionPlanParity catches it.
const AMOUNT_TO_PLAN: Record<number, string> = {
  999: "recovery_plus",
  1999: "athlete",
  5999: "system",
  9900: "elite",
};

function planFromPrice(price?: PriceLike | null): string | null {
  if (!price) return null;
  if (price.metadata?.["planId"]) return price.metadata["planId"];
  const amt = price.unit_amount ?? 0;
  return AMOUNT_TO_PLAN[amt] ?? null;
}

async function upsertEntitlement(
  userId: string,
  patch: Partial<typeof aforceUsers.$inferInsert>,
): Promise<void> {
  await db
    .insert(aforceUsers)
    .values({ id: userId, planId: patch.planId ?? "core", ...patch })
    .onConflictDoUpdate({
      target: aforceUsers.id,
      set: { ...patch, updatedAt: new Date() },
    });
}

// Mounted with express.raw — `req.body` is a Buffer here, not parsed JSON.
router.post(
  "/stripe/webhook",
  express.raw({ type: "application/json" }),
  async (req: Request, res: Response) => {
    const secret = process.env["STRIPE_WEBHOOK_SECRET"];
    const sig = req.headers["stripe-signature"];

    if (!secret) {
      // Webhook misconfigured — log loudly but 200 so Stripe doesn't
      // retry forever. Operator must set STRIPE_WEBHOOK_SECRET.
      logger.error("STRIPE_WEBHOOK_SECRET not set — webhook is a no-op");
      res.status(200).json({ received: true, ignored: "no_secret" });
      return;
    }
    if (!sig || typeof sig !== "string") {
      res.status(400).json({ error: "missing stripe-signature" });
      return;
    }

    let stripe;
    try {
      stripe = await getStripeClient();
    } catch (err) {
      logger.error({ err }, "Stripe client init failed");
      res.status(500).json({ error: "stripe_unavailable" });
      return;
    }

    let event;
    try {
      event = stripe.webhooks.constructEvent(req.body, sig, secret);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "bad signature";
      logger.warn({ err: msg }, "Stripe webhook signature verification failed");
      res.status(400).json({ error: `Webhook Error: ${msg}` });
      return;
    }

    try {
      switch (event.type) {
        case "checkout.session.completed": {
          const session = event.data.object as {
            id: string;
            mode?: string;
            customer?: string | null;
            subscription?: string | null;
            metadata?: Record<string, string> | null;
          };
          const userId = session.metadata?.["userId"];
          const planId = session.metadata?.["planId"];
          if (!userId) {
            logger.warn({ sessionId: session.id }, "checkout.session.completed missing metadata.userId");
            break;
          }
          if (session.mode === "subscription") {
            await upsertEntitlement(userId, {
              stripeCustomerId: typeof session.customer === "string" ? session.customer : null,
              stripeSubscriptionId: typeof session.subscription === "string" ? session.subscription : null,
              ...(planId ? { planId } : {}),
              subscriptionStatus: "active",
            });
          }
          // mode === "payment" is a one-time cart purchase; nothing to
          // mirror onto the entitlement row.
          break;
        }

        case "customer.subscription.updated":
        case "customer.subscription.created": {
          const sub = event.data.object as {
            id: string;
            customer: string;
            status: string;
            current_period_end?: number;
            items?: { data?: Array<{ price?: PriceLike }> };
            metadata?: Record<string, string> | null;
          };
          // Try to find the existing user row by stripeSubscriptionId
          // (the linkage that checkout.session.completed wrote).
          const [row] = await db
            .select()
            .from(aforceUsers)
            .where(eq(aforceUsers.stripeSubscriptionId, sub.id))
            .limit(1);
          // Fallback to subscription_data.metadata.userId, written by
          // checkout.ts. This recovers linkage when subscription.created
          // arrives before checkout.session.completed (Stripe does not
          // guarantee event ordering) or when checkout.session.completed
          // is lost to a transient failure.
          const metaUserId = sub.metadata?.["userId"];
          const targetUserId = row?.id ?? (metaUserId && metaUserId.length > 0 ? metaUserId : null);
          if (!targetUserId) {
            logger.warn({ subId: sub.id }, "subscription.updated with no resolvable userId — ignoring");
            break;
          }
          const price = sub.items?.data?.[0]?.price;
          const derived = planFromPrice(price);
          await upsertEntitlement(targetUserId, {
            // Backfill the stripeSubscriptionId on the metadata recovery
            // path so future events can hit the fast lookup.
            ...(row ? {} : { stripeSubscriptionId: sub.id, stripeCustomerId: sub.customer }),
            subscriptionStatus: sub.status,
            ...(derived ? { planId: derived } : {}),
            ...(sub.current_period_end
              ? { currentPeriodEnd: new Date(sub.current_period_end * 1000) }
              : {}),
          });
          break;
        }

        case "customer.subscription.deleted": {
          const sub = event.data.object as { id: string };
          const [row] = await db
            .select()
            .from(aforceUsers)
            .where(eq(aforceUsers.stripeSubscriptionId, sub.id))
            .limit(1);
          if (!row) break;
          await upsertEntitlement(row.id, {
            planId: "core",
            subscriptionStatus: "canceled",
            stripeSubscriptionId: null,
          });
          break;
        }

        default:
          // Unhandled event types (invoice.*, payment_intent.*, etc) —
          // 200 OK so Stripe stops retrying, no DB mutation.
          break;
      }
      res.json({ received: true });
    } catch (err) {
      logger.error({ err, type: event.type }, "Stripe webhook handler crashed");
      res.status(500).json({ error: "handler_failed" });
    }
  },
);

export default router;
