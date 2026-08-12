/**
 * Checkout routes — Stripe Checkout Sessions for both consumer plans
 * (subscription mode) and Store cart purchases (one-time payment mode).
 *
 * Demo flow (no DB / webhooks yet):
 *
 *   POST /api/checkout/session  body: { planId, returnUrl }
 *     → mode: 'subscription'
 *     → returns { url } that the client opens in WebBrowser.
 *
 *   POST /api/checkout/cart     body: { items: [{skuId, qty}], returnUrl }
 *     → mode: 'payment'
 *     → server prices every line against STORE_CATALOG (never trusts client
 *       prices); shipping + tax are added as additional line items so the
 *       Stripe total matches what CartScreen displayed.
 *
 *   GET  /api/checkout/return   query: status, kind, planId?, app
 *     → bridges Stripe's https-only redirect back to the caller's deep link
 *       (works for https web origins and `aforce://` / `exp://` schemes).
 *       The `kind` param tells the app whether this was a subscription or
 *       cart return so it can react appropriately (clear cart vs switch plan).
 */

import { Router, type IRouter, type Request, type Response } from 'express';
import { getStripeClient, getUncachableStripeClient } from '../lib/stripeClient';
import { logger } from '../lib/logger';
import { priceCart } from '../lib/storeCatalog';
import { checkoutLimiter } from '../middlewares/rateLimits';
import { requireAuth } from '../middlewares/requireAuth';
import { db, aforceUsers } from '@workspace/db';
import { eq, sql } from 'drizzle-orm';
import { analyticsIdFromHeader } from '../lib/serverAnalytics';

/**
 * Look up the active Stripe price id for a given local plan id by
 * matching `stripe.products.metadata->>'planId'`. Seeded by
 * `scripts/src/seed-products.ts`. Returns null when the integration
 * isn't connected yet (so callers can fall back to inline price_data).
 */
async function lookupStripePriceId(
  planId: string,
  expectedCents: number,
  interval: 'month' | 'year',
): Promise<string | null> {
  // Revenue-guardian (slice-4 review, 2026-07-26): the lookup MUST pin the
  // interval AND the exact amount. Inline price_data checkouts mint new
  // active planId-tagged products, so a recency-only match would eventually
  // serve one cadence's price to the other (e.g. a monthly buyer inheriting
  // a fresh $200/year price — a 10x mischarge). If nothing matches exactly,
  // the caller's inline fallback charges the catalog price — always correct.
  try {
    const result = await db.execute(sql`
      SELECT pr.id AS price_id
      FROM stripe.products p
      JOIN stripe.prices pr ON pr.product = p.id
      WHERE p.metadata->>'planId' = ${planId}
        AND p.active = true
        AND pr.active = true
        AND pr.unit_amount = ${expectedCents}
        AND pr.recurring->>'interval' = ${interval}
      ORDER BY pr.created DESC NULLS LAST
      LIMIT 1
    `);
    const row = result.rows?.[0] as { price_id?: string } | undefined;
    return row?.price_id ?? null;
  } catch {
    return null;
  }
}

/**
 * Get-or-create a Stripe customer for the authenticated user, persisting
 * the customer id back onto `aforce_users` so future checkouts (and the
 * Customer Portal) can reuse it.
 */
async function ensureStripeCustomer(userId: string): Promise<string | null> {
  try {
    const [row] = await db
      .select()
      .from(aforceUsers)
      .where(eq(aforceUsers.id, userId))
      .limit(1);
    if (row?.stripeCustomerId) return row.stripeCustomerId;

    const stripe = await getUncachableStripeClient();
    const customer = await stripe.customers.create({
      metadata: { userId },
      ...(row?.email ? { email: row.email } : {}),
    });
    await db
      .insert(aforceUsers)
      .values({ id: userId, stripeCustomerId: customer.id })
      .onConflictDoUpdate({
        target: aforceUsers.id,
        set: { stripeCustomerId: customer.id, updatedAt: new Date() },
      });
    return customer.id;
  } catch (err) {
    logger.warn({ err, userId }, 'ensureStripeCustomer failed');
    return null;
  }
}

const router: IRouter = Router();

interface PlanCatalogEntry {
  amountCents: number;
  /** Annual price in cents — only plans offering an annual cadence set it
   *  (D-1: Command $200/yr). Absent = monthly-only. */
  amountCentsAnnual?: number;
  name: string;
  description: string;
}

// Mirror of the consumer plans on the client. Stripe-eligible consumer
// tiers only — `core` is the always-on entry tier and is sold as a
// freemium upgrade target rather than a Stripe checkout. Keep prices in
// lockstep with `artifacts/aforce-os/data/subscriptionPlans.ts` —
// `subscriptionPlanParity.test.ts` enforces this.
export const PLAN_CATALOG: Record<string, PlanCatalogEntry> = {
  recovery_plus: {
    amountCents: 999,
    name: 'Recovery+',
    description: 'Unlock Recovery Mode after Social Mode sessions.',
  },
  athlete: {
    // D-1 (2026-07-26): canonical Command pricing — $20.00/mo · $200.00/yr,
    // matching the marketing site. Internal id stays 'athlete' (storage key).
    amountCents: 2000,
    amountCentsAnnual: 20000,
    name: 'AForce Command',
    description: 'The paid intelligence layer — Command interprets the pattern.',
  },
  system: {
    amountCents: 5999,
    name: 'Performance Bundle',
    description: 'Full performance control — Athlete tier + monthly product drop.',
  },
  elite: {
    amountCents: 9900,
    name: 'AForce Elite',
    description: 'Guardian Mode + premium analytics + full monthly bundle.',
  },
};

// Launch allowlist — mirror of the client `LAUNCHED_PLAN_IDS`
// (aforce-os/data/subscriptionPlans.ts). Only launched tiers are
// checkout-eligible: a catalogued-but-not-launched planId (e.g. recovery_plus /
// system / elite before their launch) is rejected exactly like an unknown plan,
// so a dark tier cannot be purchased via a direct API call. `core` is launched
// but intentionally absent from PLAN_CATALOG (it's free — never a Stripe
// checkout). Parity with the client set is enforced by
// subscriptionPlanParity.test.ts. To launch a tier: add its id here + on the client.
export const LAUNCHED_PLAN_IDS = new Set<string>(['core', 'athlete']);

// Acceptable schemes for the app-redirect bounce. Restricting to known
// Expo / app-native / web schemes blocks open-redirect abuse.
//
// Wave-3 PR3: 'aforce-os:' is the app's REAL registered scheme
// (artifacts/aforce-os/app.json "scheme": "aforce-os"; every client
// Linking.createURL return uses it). It was MISSING here, so every
// native checkout died with a 400 before Stripe was ever contacted.
// NATIVE_APP_RETURN_SCHEMES is exported for the app.json parity test —
// keep it in lockstep with the app scheme.
export const NATIVE_APP_RETURN_SCHEMES = new Set([
  'exp:', 'exps:', 'aforce:', 'aforceos:', 'aforce-os:',
]);
const ALLOWED_RETURN_SCHEMES = new Set(['http:', 'https:', ...NATIVE_APP_RETURN_SCHEMES]);

const ALLOWED_KINDS = new Set(['subscription', 'cart']);

/** Minimal HTML attribute/text escaper for the bounce page (Wave-3 PR3). */
function escapeHtml(raw: string): string {
  return raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function publicBaseUrl(req: Request): string {
  // Wave-3 PR3: a request-derived host is attacker-influenced (raw
  // x-forwarded-host bypasses Express's trust-proxy handling entirely), and
  // the same value was ALSO the comparison target for the "same-origin"
  // returnUrl check — the control validated attacker input against attacker
  // input. When PUBLIC_BASE_URL is configured (production), it is now the
  // ONLY source; the request-derived path survives strictly for dev.
  const configured = process.env['PUBLIC_BASE_URL']?.replace(/\/+$/, '');
  if (configured) return configured;
  const proto =
    (req.headers['x-forwarded-proto'] as string | undefined)?.split(',')[0]?.trim() ??
    req.protocol;
  const host =
    (req.headers['x-forwarded-host'] as string | undefined)?.split(',')[0]?.trim() ??
    req.get('host') ??
    'localhost';
  return `${proto}://${host}`;
}

/**
 * Return-URL validation.
 *
 * Native deep-link schemes (`exp:`, `aforce:`, `aforceos:`) are trusted by
 * the OS — only the owning app handles them, so any host is fine.
 *
 * Web schemes (`http:`, `https:`) are dangerous: without a host check this
 * endpoint becomes an open redirect that an attacker can use to bounce
 * through Stripe's checkout flow back to a phishing page on a domain that
 * looks legitimate. We tie web returnUrls to the same host the request
 * came in on (workspace proxy in dev, deployment domain in prod), which
 * is exactly what `Linking.createURL` produces from the Expo web client
 * and matches the api-server's own origin.
 */
export function isAllowedReturnUrl(raw: string, requestHost: string | null): boolean {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return false;
  }
  if (!ALLOWED_RETURN_SCHEMES.has(u.protocol)) return false;

  if (u.protocol === 'http:' || u.protocol === 'https:') {
    if (!requestHost) return false;
    // u.host includes port if present; same for requestHost — compare verbatim.
    return u.host.toLowerCase() === requestHost.toLowerCase();
  }
  // Native schemes — trust the OS handler.
  return true;
}

export function inboundHost(req: Request): string | null {
  // Same PUBLIC_BASE_URL-first rule as publicBaseUrl (see above): web
  // returnUrls in production must match the CONFIGURED origin, not a
  // header the caller controls.
  const configured = process.env['PUBLIC_BASE_URL'];
  if (configured) {
    try {
      return new URL(configured).host;
    } catch {
      /* fall through to request-derived (dev) */
    }
  }
  const host =
    (req.headers['x-forwarded-host'] as string | undefined)?.split(',')[0]?.trim() ??
    req.get('host') ??
    null;
  return host && host.length > 0 ? host : null;
}

// ─── Subscription: POST /checkout/session ────────────────────────────────────
router.post('/checkout/session', requireAuth, checkoutLimiter, async (req: Request, res: Response) => {
  const { planId, returnUrl, cadence } = (req.body ?? {}) as {
    planId?: string;
    returnUrl?: string;
    /** Optional billing cadence — omitted/legacy clients get monthly. */
    cadence?: string;
  };

  if (!planId || typeof planId !== 'string') {
    res.status(400).json({ error: 'planId is required' });
    return;
  }
  if (cadence != null && cadence !== 'monthly' && cadence !== 'annual') {
    res.status(400).json({ error: 'cadence must be "monthly" or "annual"' });
    return;
  }
  if (!returnUrl || typeof returnUrl !== 'string' || !isAllowedReturnUrl(returnUrl, inboundHost(req))) {
    res.status(400).json({ error: 'returnUrl must be a same-origin web URL or an app deep link' });
    return;
  }

  // Gate on the launch allowlist first: a not-yet-launched (dark) tier is
  // rejected exactly like an unknown plan, closing the direct-API purchase hole.
  const plan = PLAN_CATALOG[planId];
  if (!plan || !LAUNCHED_PLAN_IDS.has(planId)) {
    res.status(404).json({ error: `Plan "${planId}" is not eligible for Stripe checkout` });
    return;
  }
  // Annual is offered only where the catalog defines an annual price (D-1:
  // Command). Requesting annual on a monthly-only plan is a 400, never a
  // silent monthly fallback — displayed cadence must equal charged cadence.
  const isAnnual = cadence === 'annual';
  if (isAnnual && plan.amountCentsAnnual == null) {
    res.status(400).json({ error: `Plan "${planId}" has no annual option` });
    return;
  }

  try {
    const stripe = await getStripeClient();
    const base = publicBaseUrl(req);
    const app = encodeURIComponent(returnUrl);
    const userId = req.userId ?? '';

    // Prefer a real seeded Stripe price id (recommended pattern). Fall
    // back to inline price_data when the product hasn't been seeded yet
    // — keeps the demo flow working before `seed-products.ts` runs.
    // The lookup is pinned to the requested cadence's exact amount+interval,
    // so it can never cross-serve prices; a miss falls back to inline
    // price_data at the catalog amount (metadata planId keeps entitlement
    // resolution identical for both cadences).
    const realPriceId = await lookupStripePriceId(
      planId,
      isAnnual ? plan.amountCentsAnnual! : plan.amountCents,
      isAnnual ? 'year' : 'month',
    );
    const lineItem = realPriceId
      ? { quantity: 1, price: realPriceId }
      : {
          quantity: 1,
          price_data: {
            currency: 'usd',
            unit_amount: isAnnual ? plan.amountCentsAnnual! : plan.amountCents,
            recurring: { interval: (isAnnual ? 'year' : 'month') as 'year' | 'month' },
            // Echo planId into product metadata so the entitlement
            // lookup (which joins via stripe.products.metadata->>'planId')
            // still resolves to the right plan for un-seeded products.
            product_data: {
              name: plan.name,
              description: plan.description,
              metadata: { planId },
            },
          },
        };

    // Get-or-create the Stripe customer so the entitlement endpoint can
    // join back via aforce_users.stripe_customer_id (and so the Customer
    // Portal works on second visit). FAIL CLOSED if linkage cannot be
    // persisted — without it the user could pay but never get entitled,
    // since the only join key from Stripe back to the Clerk user is the
    // stored stripe_customer_id (the webhook recovery path also relies
    // on it via Customer.metadata.userId).
    const analyticsId = analyticsIdFromHeader(req.header('x-aforce-analytics-id'));
    const customerId = userId ? await ensureStripeCustomer(userId) : null;
    if (!customerId) {
      logger.warn({ userId, planId }, 'Refusing checkout — could not persist Stripe customer linkage');
      res.status(503).json({ error: 'Could not start checkout. Please try again.' });
      return;
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [lineItem],
      customer: customerId,
      // Stripe requires https success/cancel URLs — bounce through this
      // server, which then forwards to the caller's returnUrl (web or native).
      success_url: `${base}/api/checkout/return?status=success&kind=subscription&planId=${encodeURIComponent(planId)}&app=${app}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url:  `${base}/api/checkout/return?status=cancel&kind=subscription&planId=${encodeURIComponent(planId)}&app=${app}`,
      // userId is critical: lets us recover linkage from Stripe metadata
      // even if customer creation failed for some reason.
      metadata: { planId, kind: 'subscription', userId },
      subscription_data: {
        // analytics_id is the consented pseudonymous id (when present) so
        // the webhook can emit `subscription_started` keyed to the same
        // anon identity — never the Clerk user id. Internal analytics only;
        // does not affect pricing, entitlement, or any payment behavior.
        metadata: {
          planId,
          userId,
          ...(analyticsId ? { analytics_id: analyticsId } : {}),
        },
      },
    });

    if (!session.url) {
      res.status(502).json({ error: 'Stripe did not return a checkout URL' });
      return;
    }
    res.json({ url: session.url, sessionId: session.id });
  } catch (err) {
    logger.error({ err, planId }, 'Stripe checkout session creation failed');
    // Don't echo upstream error text to clients — log server-side, return generic.
    res.status(500).json({ error: 'Could not start checkout. Please try again.' });
  }
});

// ─── Cart: POST /checkout/cart ───────────────────────────────────────────────
router.post('/checkout/cart', requireAuth, checkoutLimiter, async (req: Request, res: Response) => {
  const { items, returnUrl } = (req.body ?? {}) as {
    items?: unknown;
    returnUrl?: string;
  };

  if (!returnUrl || typeof returnUrl !== 'string' || !isAllowedReturnUrl(returnUrl, inboundHost(req))) {
    res.status(400).json({ error: 'returnUrl must be a same-origin web URL or an app deep link' });
    return;
  }

  let priced;
  try {
    priced = priceCart(items);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Invalid cart';
    res.status(400).json({ error: message });
    return;
  }

  try {
    const stripe = await getStripeClient();
    const base = publicBaseUrl(req);
    const app = encodeURIComponent(returnUrl);

    // Line items: each SKU at server-priced unit_amount × qty, plus shipping
    // and tax as separate non-product line items so the Stripe total is
    // identical to what CartScreen displayed (subtotal + shipping + tax).
    const line_items = priced.lines.map((l) => ({
      quantity: l.qty,
      price_data: {
        currency: 'usd',
        unit_amount: l.unitAmountCents,
        product_data: { name: l.name },
      },
    }));

    if (priced.shippingCents > 0) {
      line_items.push({
        quantity: 1,
        price_data: {
          currency: 'usd',
          unit_amount: priced.shippingCents,
          product_data: { name: 'Shipping' },
        },
      });
    }
    if (priced.taxCents > 0) {
      line_items.push({
        quantity: 1,
        price_data: {
          currency: 'usd',
          unit_amount: priced.taxCents,
          product_data: { name: 'Estimated tax' },
        },
      });
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items,
      success_url: `${base}/api/checkout/return?status=success&kind=cart&app=${app}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url:  `${base}/api/checkout/return?status=cancel&kind=cart&app=${app}`,
      metadata: {
        kind: 'cart',
        // userId lets order-fulfillment lookups join back to the
        // Clerk user that placed the order. Same role it plays in
        // the subscription flow.
        userId: req.userId ?? '',
        // Compact summary — full line detail will live on the Session itself.
        // Stripe metadata values cap at 500 chars so we keep it terse.
        skuSummary: priced.lines.map((l) => `${l.skuId}x${l.qty}`).join(','),
        subtotalCents: String(priced.subtotalCents),
        totalCents: String(priced.totalCents),
      },
    });

    if (!session.url) {
      res.status(502).json({ error: 'Stripe did not return a checkout URL' });
      return;
    }
    res.json({
      url: session.url,
      sessionId: session.id,
      totals: {
        subtotalCents: priced.subtotalCents,
        shippingCents: priced.shippingCents,
        taxCents: priced.taxCents,
        totalCents: priced.totalCents,
      },
    });
  } catch (err) {
    logger.error({ err }, 'Stripe cart checkout session creation failed');
    res.status(500).json({ error: 'Could not start checkout. Please try again.' });
  }
});

/**
 * Bridge endpoint Stripe redirects to. Forwards the browser to the original
 * caller's returnUrl with status + kind (+ planId for subscriptions), so
 * native deep links (`aforce://...`) work even though Stripe only accepts https.
 */
router.get('/checkout/return', (req: Request, res: Response) => {
  const status = String(req.query['status'] ?? '');
  const kind = String(req.query['kind'] ?? 'subscription');
  const planId = String(req.query['planId'] ?? '');
  const appRaw = String(req.query['app'] ?? '');

  if (!appRaw || !isAllowedReturnUrl(appRaw, inboundHost(req))) {
    res.status(400).type('text/plain').send('Invalid app return URL.');
    return;
  }
  if (status !== 'success' && status !== 'cancel') {
    res.status(400).type('text/plain').send('Invalid status.');
    return;
  }
  if (!ALLOWED_KINDS.has(kind)) {
    res.status(400).type('text/plain').send('Invalid kind.');
    return;
  }

  const u = new URL(appRaw);
  u.searchParams.set('status', status);
  u.searchParams.set('kind', kind);
  if (planId) u.searchParams.set('planId', planId);
  // Wave-3 PR3: forward the Stripe session id (shape-validated) so a
  // cold-start / interrupted-bounce deep link can still verify the
  // purchase server-side. The id is NOT an entitlement grant — the app
  // verifies payment_status via GET /checkout/session and then waits for
  // authoritative entitlement resolution.
  const sessionId = String(req.query['session_id'] ?? '');
  if (/^cs_[A-Za-z0-9_]+$/.test(sessionId)) u.searchParams.set('session_id', sessionId);
  const target = u.toString();

  // Use a tiny HTML bounce — `res.redirect` to a custom-scheme URL is blocked
  // by some browsers/proxies, but a meta-refresh + JS hop reliably hands off
  // to the OS scheme handler.
  res.type('text/html').send(`<!doctype html>
<html><head>
<meta charset="utf-8">
<title>Returning to AForce…</title>
<meta http-equiv="refresh" content="0;url=${escapeHtml(target)}">
<style>body{font-family:-apple-system,system-ui,sans-serif;background:#0A0A0F;color:#fff;display:flex;align-items:center;justify-content:center;height:100vh;margin:0}</style>
</head><body>
<p>Returning to AForce…</p>
<script>window.location.replace(${JSON.stringify(target).replace(/</g, '\\u003C')});</script>
</body></html>`);
});

/**
 * Server-side finalization check. The client must call this with the session
 * id from `createCart/CheckoutSession` BEFORE clearing the cart or applying
 * a plan switch — trusting the redirect's `?status=success` alone is unsafe
 * (a successful payment whose deep-link bounce is interrupted could let the
 * user check out again and double-charge themselves).
 *
 * Returns the authoritative `paid` boolean derived from the Stripe session's
 * `payment_status`. Sessions for unrelated checkouts (mode mismatch, etc)
 * also return `paid: false` so callers can fail closed.
 */
router.get('/checkout/session/:id', requireAuth, checkoutLimiter, async (req: Request, res: Response) => {
  const idRaw = req.params['id'];
  const id = typeof idRaw === 'string' ? idRaw : '';
  if (!id || !/^cs_(test|live)_[A-Za-z0-9]+$/.test(id)) {
    res.status(400).json({ error: 'Invalid session id' });
    return;
  }

  try {
    const stripe = await getStripeClient();
    const session = await stripe.checkout.sessions.retrieve(id);
    // For one-time payments, `payment_status` flips to 'paid' on success.
    // For subscriptions in synchronous flows it's also 'paid'. For trials or
    // async-payment flows it can be 'unpaid' — we still return the raw value
    // so the client can decide.
    const paid = session.payment_status === 'paid';
    res.json({
      sessionId: session.id,
      mode: session.mode,
      paymentStatus: session.payment_status,
      status: session.status,
      paid,
      kind: (session.metadata?.['kind'] as string | undefined) ?? null,
      planId: (session.metadata?.['planId'] as string | undefined) ?? null,
    });
  } catch (err) {
    logger.error({ err, id }, 'Stripe session retrieval failed');
    res.status(404).json({ error: 'Session not found' });
  }
});

export default router;
