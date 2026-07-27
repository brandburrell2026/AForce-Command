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

const ACTIVE = new Set(["active", "ACTIVE"]);
const ENDED = new Set(["cancelled", "CANCELLED", "expired", "EXPIRED", "failed", "FAILED"]);

/** Map a subscription_contracts/* payload onto the bridge's upsert plan.
 *  Anything unrecognized is IGNORED — never a guess, never a grant. */
export function planWebEntitlement(topic: string, payload: unknown): WebEntitlementPlan {
  const none: WebEntitlementPlan = { action: "ignore", email: null, externalRef: null, currentPeriodEnd: null };
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
