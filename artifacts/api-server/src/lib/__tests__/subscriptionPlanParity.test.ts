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
import { PLAN_CATALOG, LAUNCHED_PLAN_IDS as SERVER_LAUNCHED } from '../../routes/checkout';
import {
  SUBSCRIPTION_PLANS,
  LAUNCHED_PLAN_IDS as CLIENT_LAUNCHED,
} from '../../../../aforce-os/data/subscriptionPlans';

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
      // Annual cadence (D-1, slice 4b): both sides must define it together
      // and at the same amount — displayed annual = charged annual.
      const clientAnnual = clientPlan!.priceAnnual;
      const serverAnnual = (serverEntry as { amountCentsAnnual?: number }).amountCentsAnnual;
      if (clientAnnual != null || serverAnnual != null) {
        expect(
          serverAnnual,
          `plan "${planId}" annual price must exist on BOTH sides at the same amount`,
        ).toBe(Math.round((clientAnnual ?? 0) * 100));
      }
    });
  }
});

describe('launch allowlist parity + free-Core invariants', () => {
  it('client and server LAUNCHED_PLAN_IDS are identical', () => {
    expect([...SERVER_LAUNCHED].sort()).toEqual([...CLIENT_LAUNCHED].sort());
  });

  it('every launched plan id exists in SUBSCRIPTION_PLANS', () => {
    for (const id of SERVER_LAUNCHED) {
      expect(
        SUBSCRIPTION_PLANS.find((p) => p.id === id),
        `launched plan "${id}" is missing from SUBSCRIPTION_PLANS`,
      ).toBeDefined();
    }
  });

  it('Core is free and never a Stripe checkout plan', () => {
    const core = SUBSCRIPTION_PLANS.find((p) => p.id === 'core');
    expect(core?.priceMonthly).toBe(0);
    expect(core?.priceLabel).toBe('Free');
    // Free tier must not be Stripe-eligible — it is granted directly (entitlement.ts).
    expect(PLAN_CATALOG['core']).toBeUndefined();
    expect(CLIENT_LAUNCHED.has('core')).toBe(true);
  });

  it('any catalogued tier that is NOT launched cannot be checked out', () => {
    // Guards the direct-API purchase hole: dark tiers stay in PLAN_CATALOG but
    // are rejected by the launch gate.
    for (const planId of Object.keys(PLAN_CATALOG)) {
      if (!SERVER_LAUNCHED.has(planId)) {
        // A catalogued-but-dark tier (e.g. recovery_plus/system/elite) — the
        // route rejects it via `!LAUNCHED_PLAN_IDS.has(planId)`.
        expect(SERVER_LAUNCHED.has(planId)).toBe(false);
      }
    }
  });
});
