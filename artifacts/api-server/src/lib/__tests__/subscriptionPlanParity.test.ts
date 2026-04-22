/**
 * Subscription plan parity guard.
 *
 * The server's `PLAN_CATALOG` (used to build the Stripe Checkout line items
 * for consumer plan upgrades) is a hand-maintained mirror of the
 * client-side `SUBSCRIPTION_PLANS`. If they ever drift, the user sees one
 * price on the SubscriptionScreen and gets charged a different one in
 * Stripe — silent breakage with real money implications.
 *
 * This test enforces, for every Stripe-eligible consumer plan id present
 * on the server, that the client agrees on:
 *   - existence
 *   - exact monthly price (server cents == client priceMonthly * 100)
 *   - display name
 */

import { describe, it, expect } from 'vitest';
import { PLAN_CATALOG } from '../../routes/checkout';
import { SUBSCRIPTION_PLANS } from '../../../../aforce-os/data/subscriptionPlans';

describe('checkout PLAN_CATALOG ↔ SUBSCRIPTION_PLANS parity', () => {
  for (const planId of Object.keys(PLAN_CATALOG)) {
    it(`plan "${planId}": price + display name match the client`, () => {
      const serverEntry = PLAN_CATALOG[planId]!;
      const clientPlan = SUBSCRIPTION_PLANS.find((p) => p.id === planId);
      expect(
        clientPlan,
        `plan "${planId}" exists on the server but is missing from SUBSCRIPTION_PLANS`,
      ).toBeDefined();
      // Floating-point safety: round to the nearest cent before comparing.
      const expectedCents = Math.round(clientPlan!.priceMonthly * 100);
      expect(serverEntry.amountCents).toBe(expectedCents);
      expect(serverEntry.name).toBe(clientPlan!.name);
    });
  }
});
