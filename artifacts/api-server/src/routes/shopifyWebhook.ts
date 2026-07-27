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
import { db, aforceWebEntitlements } from "@workspace/db";
import { sql } from "drizzle-orm";
import { logger } from "../lib/logger";
import { verifyShopifyHmac, planWebEntitlement } from "../lib/shopifyWebhook";

const router: IRouter = Router();

router.post(
  "/shopify/webhook",
  express.raw({ type: "application/json" }),
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
    let payload: unknown = null;
    try { payload = JSON.parse(raw.toString("utf8")); } catch { /* ignored below */ }
    const plan = planWebEntitlement(topic, payload);
    if (plan.action === "ignore") return res.json({ ok: true, ignored: true });
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
            status: plan.action === "activate" ? "active" : "cancelled",
            currentPeriodEnd: plan.currentPeriodEnd,
            email: plan.email!,
            updatedAt: sql`now()`,
          },
        });
      return res.json({ ok: true });
    } catch (err) {
      logger.error({ err }, "shopify webhook: upsert failed");
      return res.status(500).json({ error: "bridge_write_failed" });
    }
  },
);

export default router;
