/**
 * Seed Stripe with the AForce OS product catalog.
 *
 * Currently seeds the Recovery+ subscription ($9.99/mo) — the gate that
 * RecoveryModePaywall.tsx unlocks. The product carries
 * `metadata.planId = 'recovery_plus'` so the api-server can look up the
 * real Stripe price id by local plan id (see checkout.ts → lookupStripePriceId).
 *
 * Idempotent — re-running is safe; it skips products that already exist.
 *
 * Run: pnpm --filter @workspace/scripts exec tsx src/seed-products.ts
 */

import { getUncachableStripeClient } from './stripeClient';

interface Plan {
  planId: string;
  name: string;
  description: string;
  unitAmountCents: number;
  interval: 'month' | 'year';
}

const PLANS: Plan[] = [
  {
    planId: 'recovery_plus',
    name: 'Recovery+',
    description: 'Unlock Recovery Mode after Social Mode sessions — calm morning protocols, RTD-paced steps, and tomorrow-ready commands.',
    unitAmountCents: 999, // $9.99
    interval: 'month',
  },
];

async function ensureProduct(stripe: Awaited<ReturnType<typeof getUncachableStripeClient>>, plan: Plan) {
  // Search by metadata.planId rather than name so the lookup matches
  // the same predicate the server uses in lookupStripePriceId().
  const existing = await stripe.products.search({
    query: `metadata['planId']:'${plan.planId}' AND active:'true'`,
  });
  let productId: string;
  if (existing.data.length > 0 && existing.data[0]) {
    productId = existing.data[0].id;
    console.log(`[seed] product '${plan.planId}' already exists: ${productId}`);
  } else {
    const product = await stripe.products.create({
      name: plan.name,
      description: plan.description,
      metadata: { planId: plan.planId },
    });
    productId = product.id;
    console.log(`[seed] created product '${plan.planId}': ${productId}`);
  }

  // Look for an active price matching this amount + interval — re-runs
  // shouldn't proliferate prices.
  const prices = await stripe.prices.list({ product: productId, active: true, limit: 100 });
  const match = prices.data.find(
    (p) => p.unit_amount === plan.unitAmountCents && p.recurring?.interval === plan.interval,
  );
  if (match) {
    console.log(`[seed] price for '${plan.planId}' already exists: ${match.id}`);
    return;
  }
  const price = await stripe.prices.create({
    product: productId,
    unit_amount: plan.unitAmountCents,
    currency: 'usd',
    recurring: { interval: plan.interval },
    metadata: { planId: plan.planId },
  });
  console.log(`[seed] created price for '${plan.planId}': ${price.id} ($${(plan.unitAmountCents / 100).toFixed(2)}/${plan.interval})`);
}

async function main() {
  const stripe = await getUncachableStripeClient();
  console.log('[seed] starting Stripe product seed…');
  for (const plan of PLANS) {
    try {
      await ensureProduct(stripe, plan);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[seed] failed for '${plan.planId}':`, msg);
      process.exitCode = 1;
    }
  }
  console.log('[seed] done. Webhooks will sync these into the local stripe schema.');
}

main();
