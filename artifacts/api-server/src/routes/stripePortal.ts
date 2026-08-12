/**
 * POST /api/stripe/portal-session
 *
 * Creates a Stripe Customer Portal session so a subscribed user can
 * manage / cancel their plan from inside the app. Requires the user
 * to already have a `stripe_customer_id` on their `aforce_users` row
 * (i.e. they've completed Checkout at least once).
 */

import { Router, type IRouter, type Request, type Response } from "express";
import { NATIVE_APP_RETURN_SCHEMES } from './checkout';
import { serializeError } from "../lib/serializeError";
import { db, aforceUsers } from "@workspace/db";
import { eq } from "drizzle-orm";
import { getUncachableStripeClient } from "../lib/stripeClient";
import { requireAuth } from "../middlewares/requireAuth";
import { checkoutLimiter } from "../middlewares/rateLimits";
import { logger } from "../lib/logger";

const router: IRouter = Router();

// Wave-3 PR3: shared with checkout so the app scheme can never drift again.
const ALLOWED_RETURN_SCHEMES = new Set(['http:', 'https:', ...NATIVE_APP_RETURN_SCHEMES]);

function inboundHost(req: Request): string | null {
  const host =
    (req.headers["x-forwarded-host"] as string | undefined)?.split(",")[0]?.trim() ??
    req.get("host") ??
    null;
  return host && host.length > 0 ? host : null;
}

/**
 * Mirror checkout.ts's same-origin policy: web returnUrls must point at
 * the same host the request came in on, otherwise an attacker could use
 * this authenticated endpoint as an open redirect after the portal flow.
 * Native deep-link schemes are trusted by the OS handler.
 */
function isAllowedReturnUrl(raw: string, requestHost: string | null): boolean {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return false;
  }
  if (!ALLOWED_RETURN_SCHEMES.has(u.protocol)) return false;
  if (u.protocol === "http:" || u.protocol === "https:") {
    if (!requestHost) return false;
    return u.host.toLowerCase() === requestHost.toLowerCase();
  }
  return true;
}

router.post("/stripe/portal-session", requireAuth, checkoutLimiter, async (req: Request, res: Response) => {
  const userId = req.userId;
  if (!userId) {
    res.status(401).json({ error: "unauthorized" });
    return;
  }
  const { returnUrl } = (req.body ?? {}) as { returnUrl?: string };
  if (!returnUrl || typeof returnUrl !== "string" || !isAllowedReturnUrl(returnUrl, inboundHost(req))) {
    res.status(400).json({ error: "returnUrl must be a same-origin web URL or an app deep link" });
    return;
  }

  const [row] = await db
    .select()
    .from(aforceUsers)
    .where(eq(aforceUsers.id, userId))
    .limit(1);
  if (!row?.stripeCustomerId) {
    res.status(404).json({ error: "no_stripe_customer" });
    return;
  }

  try {
    const stripe = await getUncachableStripeClient();
    const session = await stripe.billingPortal.sessions.create({
      customer: row.stripeCustomerId,
      return_url: returnUrl,
    });
    res.json({ url: session.url });
  } catch (err) {
    logger.error({ err: serializeError(err) }, "Stripe portal session creation failed");
    res.status(500).json({ error: "portal_session_failed" });
  }
});

export default router;
