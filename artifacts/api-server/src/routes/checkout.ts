/**
 * Checkout route — creates a Stripe Checkout Session for one consumer plan.
 *
 * Demo flow (no DB / webhooks):
 *   POST /api/checkout/session  body: { planId, returnUrl }
 *     → returns { url } that the client opens in WebBrowser.
 *     The Stripe success/cancel URLs always point back at THIS server's
 *     /api/checkout/return endpoint, which then bounces the browser to the
 *     caller's `returnUrl` (works equally for https web origins and native
 *     custom-scheme deep links like `aforce://`, `exp://`, etc).
 *     The caller is responsible for switching its local subscription state
 *     when the user is redirected back to `${returnUrl}?status=success`.
 *
 * The price is created inline via `price_data` so we don't need pre-seeded
 * Stripe products to demo. For production you'd seed real Price IDs and
 * sync via stripe-replit-sync.
 */

import { Router, type IRouter, type Request, type Response } from 'express';
import { getStripeClient } from '../lib/stripeClient';
import { logger } from '../lib/logger';

const router: IRouter = Router();

interface PlanCatalogEntry {
  amountCents: number;
  name: string;
  description: string;
}

// Mirror of the consumer plans on the client. Kept tiny on purpose — Stripe
// is only enabled for the consumer tier upgrade demo today.
const PLAN_CATALOG: Record<string, PlanCatalogEntry> = {
  athlete: {
    amountCents: 1900,
    name: 'AForce Athlete',
    description: 'Train and perform with precision.',
  },
  system: {
    amountCents: 4900,
    name: 'AForce System',
    description: 'Full performance control — software + product.',
  },
};

// Acceptable schemes for the app-redirect bounce. Restricting to known
// Expo / app-native / web schemes blocks open-redirect abuse.
const ALLOWED_RETURN_SCHEMES = new Set([
  'http:', 'https:', 'exp:', 'exps:', 'aforce:', 'aforceos:',
]);

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

function isAllowedReturnUrl(raw: string): boolean {
  try {
    const u = new URL(raw);
    return ALLOWED_RETURN_SCHEMES.has(u.protocol);
  } catch {
    return false;
  }
}

router.post('/checkout/session', async (req: Request, res: Response) => {
  const { planId, returnUrl } = (req.body ?? {}) as { planId?: string; returnUrl?: string };

  if (!planId || typeof planId !== 'string') {
    res.status(400).json({ error: 'planId is required' });
    return;
  }
  if (!returnUrl || typeof returnUrl !== 'string' || !isAllowedReturnUrl(returnUrl)) {
    res.status(400).json({ error: 'returnUrl must be a valid http(s)/exp/aforce URL' });
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
      success_url: `${base}/api/checkout/return?status=success&planId=${encodeURIComponent(planId)}&app=${app}`,
      cancel_url:  `${base}/api/checkout/return?status=cancel&planId=${encodeURIComponent(planId)}&app=${app}`,
      metadata: { planId },
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

/**
 * Bridge endpoint Stripe redirects to. Forwards the browser to the original
 * caller's returnUrl with the same status + planId query params, so native
 * deep links (`aforce://...`) work even though Stripe only accepts https.
 */
router.get('/checkout/return', (req: Request, res: Response) => {
  const status = String(req.query['status'] ?? '');
  const planId = String(req.query['planId'] ?? '');
  const appRaw = String(req.query['app'] ?? '');

  if (!appRaw || !isAllowedReturnUrl(appRaw)) {
    res.status(400).type('text/plain').send('Invalid app return URL.');
    return;
  }
  if (status !== 'success' && status !== 'cancel') {
    res.status(400).type('text/plain').send('Invalid status.');
    return;
  }

  const u = new URL(appRaw);
  u.searchParams.set('status', status);
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

export default router;
