/**
 * Wave-3 PR6 — payment webhook hardening invariants.
 *
 * Behavioral where pure (the refund planner), source-locked where the
 * behavior is SQL/middleware wiring (ledger dedupe order, monotonic
 * expiry, limits, fixed error bodies, no-PII logging); the full
 * duplicate-delivery round-trip runs in the E2E lane (Testcontainers).
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { planWebEntitlement } from "../lib/shopifyWebhook";

const shopifyRouteSrc = readFileSync(resolve(__dirname, "../routes/shopifyWebhook.ts"), "utf8");
const stripeRouteSrc = readFileSync(resolve(__dirname, "../routes/stripeWebhook.ts"), "utf8");
const stripeClientSrc = readFileSync(resolve(__dirname, "../lib/stripeClient.ts"), "utf8");

describe("refunds/create actually revokes (was a silent no-op)", () => {
  it("cancels by order_id when the payload carries refund_line_items only", () => {
    const plan = planWebEntitlement("refunds/create", {
      id: 999,
      order_id: 5551234,
      refund_line_items: [{ line_item_id: 1 }],
    });
    expect(plan.action).toBe("cancel");
    expect(plan.externalRef).toBe("5551234");
    expect(plan.email).toBeNull();
  });

  it("still ignores a refunds/create with no order_id", () => {
    const plan = planWebEntitlement("refunds/create", { refund_line_items: [] });
    expect(plan.action).toBe("ignore");
  });

  it("orders/refunded with the full order still cancels via the paid-order path", () => {
    const plan = planWebEntitlement("orders/refunded", {
      id: 777,
      email: "buyer@x.com",
      line_items: [{ variant_id: 43905417838710, quantity: 1 }],
    });
    expect(plan.action).toBe("cancel");
    expect(plan.externalRef).toBe("777");
  });
});

describe("delivery ledger + duplicate suppression (source locks)", () => {
  it("shopify: dedupe happens AFTER HMAC, BEFORE any entitlement write", () => {
    const handlerStart = shopifyRouteSrc.indexOf("router.post");
    const hmacIdx = shopifyRouteSrc.indexOf("verifyShopifyHmac(", handlerStart);
    const ledgerIdx = shopifyRouteSrc.indexOf("aforceWebhookDeliveries", handlerStart);
    const upsertIdx = shopifyRouteSrc.indexOf("onConflictDoUpdate", handlerStart);
    expect(hmacIdx).toBeGreaterThan(-1);
    expect(ledgerIdx).toBeGreaterThan(hmacIdx);
    expect(upsertIdx).toBeGreaterThan(ledgerIdx);
    expect(shopifyRouteSrc).toContain("X-Shopify-Webhook-Id");
    expect(shopifyRouteSrc).toContain("duplicate: true");
  });

  it("stripe: ledger write is post-verification and non-fatal", () => {
    expect(stripeRouteSrc).toContain("aforceWebhookDeliveries");
    const ackIdx = stripeRouteSrc.indexOf("received: true");
    const ledgerIdx = stripeRouteSrc.indexOf("aforceWebhookDeliveries", stripeRouteSrc.indexOf("router.post"));
    expect(ledgerIdx).toBeGreaterThan(ackIdx);
    expect(stripeRouteSrc).toContain("audit-ledger write failed (non-fatal)");
  });
});

describe("hardening posture (source locks)", () => {
  it("stripe error body is fixed — internal text never echoed to callers", () => {
    expect(stripeRouteSrc).toContain("webhook_verification_failed");
    expect(stripeRouteSrc).not.toMatch(/res\.status\(400\)\.json\(\{ error: msg \}\)/);
  });

  it("both rails: 1mb raw limit + webhookLimiter", () => {
    for (const src of [stripeRouteSrc, shopifyRouteSrc]) {
      expect(/limit: ['"]1mb['"]/.test(src)).toBe(true);
      expect(src).toContain("webhookLimiter");
    }
  });

  it("shopify: activate expiry is monotonic; cancel leaves expiry untouched", () => {
    expect(shopifyRouteSrc).toContain("GREATEST(coalesce(");
    expect(shopifyRouteSrc).toMatch(/: aforceWebEntitlements\.currentPeriodEnd/);
  });

  it("shopify: audit log hashes the email; pg error detail never logged", () => {
    expect(shopifyRouteSrc).toContain('createHash("sha256")');
    expect(shopifyRouteSrc).not.toMatch(/logger\.error\(\{ err \}/);
  });

  it("email-less cancel is UPDATE-only (a refund for an unknown ref inserts nothing)", () => {
    const cancelBlock = shopifyRouteSrc.slice(
      shopifyRouteSrc.indexOf('plan.action === "cancel" && !plan.email'),
      shopifyRouteSrc.indexOf('// Idempotent upsert'),
    );
    expect(cancelBlock).toContain(".update(aforceWebEntitlements)");
    expect(cancelBlock).not.toContain(".insert(");
  });

  it("StripeSync is memoized per secret — no per-webhook pg.Pool", () => {
    expect(stripeClientSrc).toContain("cachedSync");
    expect(stripeClientSrc).toMatch(/cachedSync\.key === secretKey\) return cachedSync\.sync/);
  });
});
