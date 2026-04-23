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
import { getStripeClient } from '../lib/stripeClient';
import { logger } from '../lib/logger';
import { priceCart } from '../lib/storeCatalog';
import { checkoutLimiter } from '../middlewares/rateLimits';
import { requireAuth } from '../middlewares/requireAuth';

const router: IRouter = Router();

interface PlanCatalogEntry {
  amountCents: number;
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
    amountCents: 1999,
    name: 'AForce Athlete',
    description: 'Train and perform with precision.',
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

// Acceptable schemes for the app-redirect bounce. Restricting to known
// Expo / app-native / web schemes blocks open-redirect abuse.
const ALLOWED_RETURN_SCHEMES = new Set([
  'http:', 'https:', 'exp:', 'exps:', 'aforce:', 'aforceos:',
]);

const ALLOWED_KINDS = new Set(['subscription', 'cart']);

function publicBaseUrl(req: Request): string {
  // Trust the host the request came in on. The api-server sits behind the
  // workspace proxy in dev and behind the deployment proxy in prod, both of
  // which preserve x-forwarded-host. Fall back to the literal Host header.
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
function isAllowedReturnUrl(raw: string, requestHost: string | null): boolean {
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

function inboundHost(req: Request): string | null {
  const host =
    (req.headers['x-forwarded-host'] as string | undefined)?.split(',')[0]?.trim() ??
    req.get('host') ??
    null;
  return host && host.length > 0 ? host : null;
}

// ─── Subscription: POST /checkout/session ────────────────────────────────────
router.post('/checkout/session', requireAuth, checkoutLimiter, async (req: Request, res: Response) => {
  const { planId, returnUrl } = (req.body ?? {}) as { planId?: string; returnUrl?: string };

  if (!planId || typeof planId !== 'string') {
    res.status(400).json({ error: 'planId is required' });
    return;
  }
  if (!returnUrl || typeof returnUrl !== 'string' || !isAllowedReturnUrl(returnUrl, inboundHost(req))) {
    res.status(400).json({ error: 'returnUrl must be a same-origin web URL or an app deep link' });
    return;
  }

  const plan = PLAN_CATALOG[planId];
  if (!plan) {
    res.status(404).json({ error: `Plan "${planId}" is not eligible for Stripe checkout` });
    return;
  }

  try {
    const stripe = await getStripeClient();
    const base = publicBaseUrl(req);
    const app = encodeURIComponent(returnUrl);
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: 'usd',
            unit_amount: plan.amountCents,
            recurring: { interval: 'month' },
            product_data: {
              name: plan.name,
              description: plan.description,
            },
          },
        },
      ],
      // Stripe requires https success/cancel URLs — bounce through this
      // server, which then forwards to the caller's returnUrl (web or native).
      success_url: `${base}/api/checkout/return?status=success&kind=subscription&planId=${encodeURIComponent(planId)}&app=${app}`,
      cancel_url:  `${base}/api/checkout/return?status=cancel&kind=subscription&planId=${encodeURIComponent(planId)}&app=${app}`,
      // userId is critical: the Stripe webhook joins back to the
      // aforce_users row via this metadata bag (see stripeWebhook.ts).
      metadata: { planId, kind: 'subscription', userId: req.userId ?? '' },
      // Mirror onto subscription_data so customer.subscription.* events
      // also carry the linkage even after the checkout session expires.
      subscription_data: {
        metadata: { planId, userId: req.userId ?? '' },
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
      success_url: `${base}/api/checkout/return?status=success&kind=cart&app=${app}`,
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
  const target = u.toString();

  // Use a tiny HTML bounce — `res.redirect` to a custom-scheme URL is blocked
  // by some browsers/proxies, but a meta-refresh + JS hop reliably hands off
  // to the OS scheme handler.
  res.type('text/html').send(`<!doctype html>
<html><head>
<meta charset="utf-8">
<title>Returning to AForce…</title>
<meta http-equiv="refresh" content="0;url=${target.replace(/"/g, '&quot;')}">
<style>body{font-family:-apple-system,system-ui,sans-serif;background:#0A0A0F;color:#fff;display:flex;align-items:center;justify-content:center;height:100vh;margin:0}</style>
</head><body>
<p>Returning to AForce…</p>
<script>window.location.replace(${JSON.stringify(target)});</script>
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
router.get('/checkout/session/:id', async (req: Request, res: Response) => {
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
