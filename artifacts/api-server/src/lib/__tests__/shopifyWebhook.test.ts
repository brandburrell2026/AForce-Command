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
