/**
 * Stripe webhook delegate. The actual sync is owned by stripe-replit-sync
 * — we only validate that the body arrived as a Buffer (i.e. the route
 * was registered BEFORE express.json()) and then run a small post-process
 * step to repair the Clerk-userId → stripe-customer linkage if it was
 * lost (transient DB error during checkout, manual customer creation in
 * the Stripe dashboard, etc).
 */

import Stripe from 'stripe';
import { getStripeSync } from './stripeClient';
import { db, aforceUsers } from '@workspace/db';
import { eq } from 'drizzle-orm';
import { logger } from './logger';
import { recordServerAnalyticsEvents, deterministicEventId } from './serverAnalytics';

const LINKAGE_EVENT_TYPES = new Set<string>([
  'checkout.session.completed',
  'customer.subscription.created',
  'customer.subscription.updated',
  'customer.created',
  'customer.updated',
]);

/**
 * Best-effort repair: parse the event, pull a userId out of metadata
 * (we set it on every Checkout session, subscription, and customer we
 * create), and ensure aforce_users.stripe_customer_id is populated.
 * Failure is logged but never thrown — the sync write already succeeded.
 */
async function repairUserLinkage(payload: Buffer): Promise<void> {
  let event: Stripe.Event;
  try {
    event = JSON.parse(payload.toString('utf8')) as Stripe.Event;
  } catch {
    return;
  }
  if (!LINKAGE_EVENT_TYPES.has(event.type)) return;

  const obj = event.data?.object as
    | (Stripe.Checkout.Session | Stripe.Subscription | Stripe.Customer)
    | undefined;
  if (!obj) return;

  let userId: string | undefined;
  let stripeCustomerId: string | undefined;

  if (event.type === 'customer.created' || event.type === 'customer.updated') {
    const c = obj as Stripe.Customer;
    userId = (c.metadata?.['userId'] as string | undefined) ?? undefined;
    stripeCustomerId = c.id;
  } else if (event.type === 'checkout.session.completed') {
    const s = obj as Stripe.Checkout.Session;
    userId = (s.metadata?.['userId'] as string | undefined) ?? undefined;
    stripeCustomerId = typeof s.customer === 'string' ? s.customer : s.customer?.id;
  } else {
    const s = obj as Stripe.Subscription;
    userId = (s.metadata?.['userId'] as string | undefined) ?? undefined;
    stripeCustomerId = typeof s.customer === 'string' ? s.customer : s.customer?.id;
  }

  if (!userId || !stripeCustomerId) return;

  try {
    const [row] = await db.select().from(aforceUsers).where(eq(aforceUsers.id, userId)).limit(1);
    if (row?.stripeCustomerId === stripeCustomerId) return;
    await db
      .insert(aforceUsers)
      .values({ id: userId, stripeCustomerId })
      .onConflictDoUpdate({
        target: aforceUsers.id,
        set: { stripeCustomerId, updatedAt: new Date() },
      });
    logger.info({ userId, stripeCustomerId, eventType: event.type }, 'webhook: repaired user linkage');
  } catch (err) {
    logger.warn({ err, userId, stripeCustomerId }, 'webhook: linkage repair failed');
  }
}

/**
 * INTERNAL analytics (Task #39): emit `subscription_started` exactly once
 * when a paid subscription first becomes active/trialing. Keyed to the
 * consented pseudonymous `analytics_id` we stashed on subscription
 * metadata at Checkout; if it's absent (no consent) we emit nothing.
 *
 * We listen to BOTH `created` and `updated`: a subscription can be born
 * `incomplete` (e.g. 3DS/SCA) and only flip to `active` on a later
 * `updated`, so created-only would miss it. The eventId is derived from
 * the subscription id, so created/updated/redelivery all collapse to a
 * single row via ON CONFLICT. Best-effort — never throws, never alters billing.
 */
async function emitSubscriptionAnalytics(payload: Buffer): Promise<void> {
  let event: Stripe.Event;
  try {
    event = JSON.parse(payload.toString('utf8')) as Stripe.Event;
  } catch {
    return;
  }
  if (
    event.type !== 'customer.subscription.created' &&
    event.type !== 'customer.subscription.updated'
  ) {
    return;
  }
  const sub = event.data?.object as Stripe.Subscription | undefined;
  if (!sub) return;
  if (sub.status !== 'active' && sub.status !== 'trialing') return;
  const analyticsId = (sub.metadata?.['analytics_id'] as string | undefined) ?? undefined;
  if (!analyticsId) return;
  const planId = (sub.metadata?.['planId'] as string | undefined) ?? '';
  await recordServerAnalyticsEvents([
    {
      eventId: deterministicEventId(`subscription_started:${sub.id}`),
      eventType: 'subscription_started',
      analyticsId,
      payload: { planId },
    },
  ]);
}

export class WebhookHandlers {
  static async processWebhook(payload: Buffer, signature: string): Promise<void> {
    if (!Buffer.isBuffer(payload)) {
      throw new Error(
        'STRIPE WEBHOOK ERROR: Payload must be a Buffer. ' +
        `Received type: ${typeof payload}. ` +
        'This usually means express.json() parsed the body before reaching this handler. ' +
        'FIX: Ensure webhook route is registered BEFORE app.use(express.json()).',
      );
    }
    const sync = await getStripeSync();
    await sync.processWebhook(payload, signature);
    // Linkage repair runs AFTER sync so the customer row already exists
    // in our `stripe.*` mirror — keeps aforce_users in lockstep even when
    // the original checkout failed to persist the customer id.
    await repairUserLinkage(payload);
    await emitSubscriptionAnalytics(payload);
  }
}
