/**
 * shopifyWebhook — pure helpers for the D-2 web→app entitlement bridge
 * (PASS-3 slice 4c). Route: routes/shopifyWebhook.ts.
 *
 * FAIL-CLOSED: nothing is processed without a verified HMAC. The secret is
 * env-supplied (SHOPIFY_WEBHOOK_SECRET); an unset secret disables the route
 * (503) rather than accepting unverified payloads.
 */
import { createHmac, timingSafeEqual } from "node:crypto";

export function verifyShopifyHmac(rawBody: Buffer, hmacHeader: string, secret: string): boolean {
  if (!secret || !hmacHeader) return false;
  const digest = createHmac("sha256", secret).update(rawBody).digest("base64");
  const a = Buffer.from(digest);
  const b = Buffer.from(hmacHeader);
  return a.length === b.length && timingSafeEqual(a, b);
}

export interface WebEntitlementPlan {
  action: "activate" | "cancel" | "ignore";
  email: string | null;
  externalRef: string | null;
  currentPeriodEnd: Date | null;
}

/** ONLY the web Command selling plans may grant the app tier (D-2 scope).
 *  Anything else — e.g. the Ritual Membership physical plan 2501607542 —
 *  must be IGNORED, or every drink subscriber gets Command free. */
export const COMMAND_SELLING_PLAN_IDS = new Set(["2532999286", "2533032054"]);
/** The Command product's variant — the orders/paid allowlist key. */
export const COMMAND_VARIANT_IDS = new Set(["43905417838710"]);
/** Rolling entitlement windows (orders/paid path): each renewal order
 *  re-activates and extends; no renewal → the grant EXPIRES ON ITS OWN.
 *  Small grace over the billing interval absorbs processing delays. */
export const MONTHLY_WINDOW_MS = 35 * 24 * 60 * 60 * 1000;
export const ANNUAL_WINDOW_MS = 370 * 24 * 60 * 60 * 1000;
export const ANNUAL_SELLING_PLAN_ID = "2533032054";

const ACTIVE = new Set(["active", "ACTIVE"]);
const ENDED = new Set(["cancelled", "CANCELLED", "expired", "EXPIRED", "failed", "FAILED"]);

/** Map a webhook payload onto the bridge's upsert plan. Two supported paths:
 *  subscription_contracts/* (API-registered, if ever added) and orders/paid
 *  (Admin-UI-registerable — the operative path). Anything unrecognized is
 *  IGNORED — never a guess, never a grant. */
export function planWebEntitlement(topic: string, payload: unknown): WebEntitlementPlan {
  const none: WebEntitlementPlan = { action: "ignore", email: null, externalRef: null, currentPeriodEnd: null };
  if (topic === "orders/paid") return planFromPaidOrder(payload);
  if (topic === "orders/refunded" || topic === "refunds/create") {
    // A refunded Command order revokes ITS OWN grant row (same external_ref).
    const paid = planFromPaidOrder(
      topic === "refunds/create" ? (payload as { order?: unknown })?.order ?? payload : payload,
    );
    return paid.action === "activate" ? { ...paid, action: "cancel" } : paid;
  }
  if (!topic.startsWith("subscription_contracts/")) return none;
  const p = payload as {
    id?: unknown;
    admin_graphql_api_id?: unknown;
    status?: unknown;
    customer?: { email?: unknown };
    email?: unknown;
    next_billing_date?: unknown;
    lines?: Array<{ selling_plan_id?: unknown; selling_plan?: { id?: unknown } }>;
    line_items?: Array<{ selling_plan_id?: unknown }>;
  } | null;
  if (!p) return none;
  const ref = String(p.admin_graphql_api_id ?? p.id ?? "");
  const emailRaw = (p.customer?.email ?? p.email) as string | undefined;
  const email = typeof emailRaw === "string" && emailRaw.includes("@") ? emailRaw.trim().toLowerCase() : null;
  if (!ref || !email) return none;
  // Selling-plan allowlist (#1 from the release-gate review): the contract
  // must contain a Command selling plan. No line match -> ignore, never grant.
  const lines = [...(p.lines ?? []), ...(p.line_items ?? [])];
  const hasCommandPlan = lines.some((l) => {
    const sp = (l as { selling_plan_id?: unknown; selling_plan?: { id?: unknown } });
    const raw = sp.selling_plan_id ?? sp.selling_plan?.id;
    const idNum = String(raw ?? "").replace(/^gid:\/\/shopify\/SellingPlan\//, "");
    return COMMAND_SELLING_PLAN_IDS.has(idNum);
  });
  if (!hasCommandPlan) return none;
  const status = String(p.status ?? "");
  const nextBilling = typeof p.next_billing_date === "string" ? new Date(p.next_billing_date) : null;
  const periodEnd = nextBilling && !Number.isNaN(nextBilling.getTime()) ? nextBilling : null;
  if (ACTIVE.has(status)) return { action: "activate", email, externalRef: ref, currentPeriodEnd: periodEnd };
  if (ENDED.has(status)) return { action: "cancel", email, externalRef: ref, currentPeriodEnd: periodEnd };
  return none;
}

/** orders/paid: activate ONLY when a line item is the Command variant.
 *  Rolling expiry per cadence (selling plan when present, else line price —
 *  $200 line = annual). Cancellation model: non-renewal → natural expiry. */
function planFromPaidOrder(payload: unknown): WebEntitlementPlan {
  const none: WebEntitlementPlan = { action: "ignore", email: null, externalRef: null, currentPeriodEnd: null };
  const o = payload as {
    id?: unknown;
    admin_graphql_api_id?: unknown;
    email?: unknown;
    contact_email?: unknown;
    customer?: { email?: unknown };
    processed_at?: unknown;
    created_at?: unknown;
    line_items?: Array<{ variant_id?: unknown; selling_plan_id?: unknown; price?: unknown }>;
  } | null;
  if (!o) return none;
  const line = (o.line_items ?? []).find((l) => COMMAND_VARIANT_IDS.has(String(l?.variant_id ?? "")));
  if (!line) return none;
  const emailRaw = (o.email ?? o.contact_email ?? o.customer?.email) as string | undefined;
  const email = typeof emailRaw === "string" && emailRaw.includes("@") ? emailRaw.trim().toLowerCase() : null;
  const ref = String(o.admin_graphql_api_id ?? o.id ?? "");
  if (!email || !ref) return none;
  const planRaw = String(line.selling_plan_id ?? "");
  const priceNum = Number.parseFloat(String(line.price ?? "0"));
  const isAnnual = planRaw === ANNUAL_SELLING_PLAN_ID || (!planRaw && priceNum >= 100);
  const baseRaw = (o.processed_at ?? o.created_at) as string | undefined;
  const base = baseRaw ? new Date(baseRaw) : new Date();
  const baseMs = Number.isNaN(base.getTime()) ? Date.now() : base.getTime();
  return {
    action: "activate",
    email,
    externalRef: ref,
    currentPeriodEnd: new Date(baseMs + (isAnnual ? ANNUAL_WINDOW_MS : MONTHLY_WINDOW_MS)),
  };
}
