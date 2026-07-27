import { describe, it, expect } from "vitest";
import { createHmac } from "node:crypto";
import { verifyShopifyHmac, planWebEntitlement } from "../shopifyWebhook";

const SECRET = "whsec_test";
const sign = (body: Buffer) => createHmac("sha256", SECRET).update(body).digest("base64");

describe("verifyShopifyHmac (fail-closed)", () => {
  const body = Buffer.from(JSON.stringify({ id: 1 }));
  it("accepts only the exact signature over the exact bytes", () => {
    expect(verifyShopifyHmac(body, sign(body), SECRET)).toBe(true);
    expect(verifyShopifyHmac(Buffer.from("{tampered}"), sign(body), SECRET)).toBe(false);
    expect(verifyShopifyHmac(body, sign(body), "wrong")).toBe(false);
  });
  it("rejects empty secret or header outright", () => {
    expect(verifyShopifyHmac(body, sign(body), "")).toBe(false);
    expect(verifyShopifyHmac(body, "", SECRET)).toBe(false);
  });
});

describe("planWebEntitlement (never a guess, never a grant on unknowns)", () => {
  const base = { admin_graphql_api_id: "gid://shopify/SubscriptionContract/42", customer: { email: "A@X.com" }, next_billing_date: "2026-08-26T00:00:00Z", lines: [{ selling_plan_id: 2532999286 }] };
  it("ACTIVE contract → activate, email lowercased, period end parsed", () => {
    const p = planWebEntitlement("subscription_contracts/create", { ...base, status: "ACTIVE" });
    expect(p).toMatchObject({ action: "activate", email: "a@x.com", externalRef: base.admin_graphql_api_id });
    expect(p.currentPeriodEnd?.toISOString()).toBe("2026-08-26T00:00:00.000Z");
  });
  it("CANCELLED/EXPIRED/FAILED → cancel", () => {
    for (const status of ["CANCELLED", "expired", "FAILED"]) {
      expect(planWebEntitlement("subscription_contracts/update", { ...base, status }).action).toBe("cancel");
    }
  });
  it("ignores: wrong topic, unknown status, missing email or ref, null payload", () => {
    expect(planWebEntitlement("orders/paid", { ...base, status: "ACTIVE" }).action).toBe("ignore");
    expect(planWebEntitlement("subscription_contracts/update", { ...base, status: "paused" }).action).toBe("ignore");
    expect(planWebEntitlement("subscription_contracts/create", { status: "ACTIVE" }).action).toBe("ignore");
    expect(planWebEntitlement("subscription_contracts/create", null).action).toBe("ignore");
  });
});

describe("selling-plan allowlist (#1 release-gate blocker)", () => {
  const cmd = { admin_graphql_api_id: "gid://shopify/SubscriptionContract/9", customer: { email: "b@x.com" }, status: "ACTIVE" };
  it("Ritual Membership (2501607542) contract is IGNORED — no free Command", () => {
    expect(planWebEntitlement("subscription_contracts/create", { ...cmd, lines: [{ selling_plan_id: 2501607542 }] }).action).toBe("ignore");
  });
  it("no lines at all → ignore (never grant on ambiguity)", () => {
    expect(planWebEntitlement("subscription_contracts/create", cmd).action).toBe("ignore");
  });
  it("Command monthly/annual plans grant (numeric + gid forms)", () => {
    expect(planWebEntitlement("subscription_contracts/create", { ...cmd, lines: [{ selling_plan_id: 2532999286 }] }).action).toBe("activate");
    expect(planWebEntitlement("subscription_contracts/update", { ...cmd, lines: [{ selling_plan: { id: "gid://shopify/SellingPlan/2533032054" } }] }).action).toBe("activate");
  });
});

describe("orders/paid path (Admin-UI-registerable bridge)", () => {
  const order = (li: object[], over: object = {}) => ({
    id: 5551, admin_graphql_api_id: "gid://shopify/Order/5551",
    email: "Buyer@X.com", processed_at: "2026-07-26T12:00:00Z", line_items: li, ...over,
  });
  it("Command variant + monthly plan → activate, ~35d rolling window", () => {
    const p = planWebEntitlement("orders/paid", order([{ variant_id: 43905417838710, selling_plan_id: 2532999286, price: "20.00" }]));
    expect(p.action).toBe("activate");
    expect(p.email).toBe("buyer@x.com");
    const days = (p.currentPeriodEnd!.getTime() - Date.parse("2026-07-26T12:00:00Z")) / 86400000;
    expect(days).toBe(35);
  });
  it("annual plan (or $200 line without plan id) → ~370d window", () => {
    for (const li of [
      { variant_id: "43905417838710", selling_plan_id: 2533032054, price: "200.00" },
      { variant_id: "43905417838710", price: "200.00" },
    ]) {
      const p = planWebEntitlement("orders/paid", order([li]));
      const days = (p.currentPeriodEnd!.getTime() - Date.parse("2026-07-26T12:00:00Z")) / 86400000;
      expect(days).toBe(370);
    }
  });
  it("ignored: cans/sticks order (no Command variant), missing email, empty lines", () => {
    expect(planWebEntitlement("orders/paid", order([{ variant_id: 43817994158198, price: "29.99" }])).action).toBe("ignore");
    expect(planWebEntitlement("orders/paid", order([{ variant_id: 43905417838710, price: "20.00" }], { email: null, customer: {} })).action).toBe("ignore");
    expect(planWebEntitlement("orders/paid", order([])).action).toBe("ignore");
    expect(planWebEntitlement("orders/paid", null).action).toBe("ignore");
  });
});

describe("gate follow-ups: mixed cart, one-time, refund revocation", () => {
  const order = (li: object[]) => ({ id: 7, admin_graphql_api_id: "gid://shopify/Order/7", email: "b@x.com", processed_at: "2026-07-26T12:00:00Z", line_items: li });
  it("mixed cart (drink + Command) activates — legit purchase", () => {
    expect(planWebEntitlement("orders/paid", order([
      { variant_id: 43817994158198, price: "29.99" },
      { variant_id: 43905417838710, selling_plan_id: 2532999286, price: "20.00" },
    ])).action).toBe("activate");
  });
  it("one-time Command (no plan id, $20) → 35d self-expiring", () => {
    const p = planWebEntitlement("orders/paid", order([{ variant_id: 43905417838710, price: "20.00" }]));
    expect(p.action).toBe("activate");
    expect((p.currentPeriodEnd!.getTime() - Date.parse("2026-07-26T12:00:00Z")) / 86400000).toBe(35);
  });
  it("orders/refunded on a Command order → cancel (same ref); drink refund ignored", () => {
    const p = planWebEntitlement("orders/refunded", order([{ variant_id: 43905417838710, price: "200.00" }]));
    expect(p).toMatchObject({ action: "cancel", externalRef: "gid://shopify/Order/7" });
    expect(planWebEntitlement("orders/refunded", order([{ variant_id: 43817994158198, price: "29.99" }])).action).toBe("ignore");
  });
});
