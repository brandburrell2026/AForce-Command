/**
 * POST /api/shopify/webhook — D-2 bridge (PASS-3 slice 4c): Shopify Command
 * subscription contracts grant app entitlement.
 *
 * Mounted with express.raw() BEFORE the global express.json() (mirrors
 * stripeWebhook.ts) so the HMAC verifies over the exact bytes Shopify signed.
 * FAIL-CLOSED: unset secret → 503; bad HMAC → 401; unknown topics → 200
 * (acknowledged, ignored — Shopify retries non-2xx forever).
 */
import express, { Router, type IRouter } from "express";
import { createHash } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { webhookLimiter } from "../middlewares/rateLimits";
import { aforceWebhookDeliveries } from "@workspace/db/schema";
import { db, aforceWebEntitlements } from "@workspace/db";
import { sql } from "drizzle-orm";
import { logger } from "../lib/logger";
import { verifyShopifyHmac, planWebEntitlement } from "../lib/shopifyWebhook";

const router: IRouter = Router();

router.post(
  "/shopify/webhook",
  webhookLimiter,
  express.raw({ type: "application/json", limit: "1mb" }),
  async (req, res) => {
    const secret = process.env["SHOPIFY_WEBHOOK_SECRET"] ?? "";
    if (!secret) return res.status(503).json({ error: "webhook_not_configured" });
    const hmac = String(req.get("X-Shopify-Hmac-Sha256") ?? "");
    const raw = Buffer.isBuffer(req.body) ? req.body : Buffer.from("");
    if (!verifyShopifyHmac(raw, hmac, secret)) {
      logger.warn("shopify webhook: HMAC verification failed");
      return res.status(401).json({ error: "invalid_hmac" });
    }
    const topic = String(req.get("X-Shopify-Topic") ?? "");

    // Wave-3 PR6: delivery-level idempotency + audit trail. HMAC has
    // already verified this request, so the delivery id is trustworthy.
    // A replayed delivery (same X-Shopify-Webhook-Id) is suppressed
    // BEFORE any entitlement write — duplicates can never double-grant.
    const deliveryId = String(req.get("X-Shopify-Webhook-Id") ?? "");
    let payload: unknown = null;
    try { payload = JSON.parse(raw.toString("utf8")); } catch { /* ignored below */ }
    const plan = planWebEntitlement(topic, payload);
    if (deliveryId) {
      try {
        const inserted = await db
          .insert(aforceWebhookDeliveries)
          .values({
            source: "shopify",
            deliveryId,
            topic,
            action: plan.action,
            externalRef: plan.externalRef,
          })
          .onConflictDoNothing({ target: [aforceWebhookDeliveries.source, aforceWebhookDeliveries.deliveryId] })
          .returning({ id: aforceWebhookDeliveries.id });
        if (inserted.length === 0) {
          logger.info({ deliveryId, topic }, "shopify webhook: duplicate delivery suppressed");
          return res.json({ ok: true, duplicate: true });
        }
      } catch (err) {
        // Ledger unavailability must not drop a paid event — the
        // entity-level (source, external_ref) upsert below stays the
        // idempotency backstop.
        logger.warn({ code: (err as { code?: string })?.code }, "shopify webhook: delivery ledger write failed");
      }
    }
    if (plan.action === "ignore") return res.json({ ok: true, ignored: true });

    // Email-less cancel (refunds/create): revoke by external_ref only —
    // UPDATE, never INSERT (there is nothing to create for an unknown ref).
    if (plan.action === "cancel" && !plan.email) {
      try {
        await db
          .update(aforceWebEntitlements)
          .set({ status: "cancelled", updatedAt: sql`now()` })
          .where(and(
            eq(aforceWebEntitlements.source, "shopify"),
            eq(aforceWebEntitlements.externalRef, plan.externalRef!),
          ));
        logger.info({ topic, externalRef: plan.externalRef, action: "cancel" }, "shopify webhook: entitlement revoked");
        return res.json({ ok: true });
      } catch (err) {
        logger.error({ code: (err as { code?: string })?.code }, "shopify webhook: revoke failed");
        return res.status(500).json({ error: "bridge_write_failed" });
      }
    }
    try {
      // Idempotent upsert on (source, external_ref) — Shopify redelivers.
      await db
        .insert(aforceWebEntitlements)
        .values({
          email: plan.email!,
          planId: "athlete", // Command's storage key (D-1)
          source: "shopify",
          externalRef: plan.externalRef!,
          status: plan.action === "activate" ? "active" : "cancelled",
          currentPeriodEnd: plan.currentPeriodEnd,
        })
        .onConflictDoUpdate({
          target: [aforceWebEntitlements.source, aforceWebEntitlements.externalRef],
          set: {
            // #3 (release gate): a stale redelivered 'create' must never
            // resurrect a cancelled contract — cancelled is terminal per
            // external_ref; only an explicit cancel can set it.
            status:
              plan.action === "activate"
                ? sql`CASE WHEN ${aforceWebEntitlements.status} = 'cancelled' THEN 'cancelled' ELSE 'active' END`
                : "cancelled",
            // Wave-3 PR6: a stale redelivery must never move a LIVE grant's
            // expiry backward — activate takes the LATER of existing/new;
            // cancel leaves expiry untouched (cancelled is terminal anyway).
            currentPeriodEnd:
              plan.action === "activate"
                ? sql`GREATEST(coalesce(${aforceWebEntitlements.currentPeriodEnd}, to_timestamp(0)), ${plan.currentPeriodEnd})`
                : aforceWebEntitlements.currentPeriodEnd,
            email: plan.email!,
            updatedAt: sql`now()`,
          },
        });
      logger.info(
        {
          topic,
          externalRef: plan.externalRef,
          action: plan.action,
          emailHash: plan.email ? createHash("sha256").update(plan.email).digest("hex").slice(0, 12) : null,
          currentPeriodEnd: plan.currentPeriodEnd?.toISOString() ?? null,
        },
        "shopify webhook: entitlement upserted",
      );
      return res.json({ ok: true });
    } catch (err) {
      // code only — a pg constraint error's `detail` embeds the conflicting
      // key values (the purchaser email); it must never reach the logs.
      logger.error({ code: (err as { code?: string })?.code }, "shopify webhook: upsert failed");
      return res.status(500).json({ error: "bridge_write_failed" });
    }
  },
);

export default router;
