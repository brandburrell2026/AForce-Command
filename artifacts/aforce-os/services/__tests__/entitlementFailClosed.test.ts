/**
 * Wave-1 P0 invariants: unknown entitlement state is NOT entitlement.
 *
 * Covers the six authorized scenarios through the pure authority layer
 * (defaultSubscription cold-start + gate/hasFeature):
 *   first install · offline first launch · entitlement API failure ·
 *   valid paid entitlement · expired/canceled entitlement · no entitlement.
 * The client keeps the cold-start default until /api/entitlement resolves
 * (useEntitlement leaves the cached subscription on failure), so the
 * cold-start value IS the offline/failure state.
 */
import { describe, it, expect } from 'vitest';

import { defaultSubscription } from '@/services/subscriptionService';
import { gate, hasFeature } from '@/featureFlags/subscriptionGate';
import type { UserSubscription, SubscriptionStatus } from '@/types/subscription';

const PAID_FEATURE = 'metabolic_readiness'; // requires 'athlete'
const FREE_FEATURE = 'logging'; // 'core'

function withStatus(sub: UserSubscription, status: SubscriptionStatus): UserSubscription {
  return { ...sub, status };
}

describe('cold start / offline / API failure — fail closed to core', () => {
  const prodDefault = defaultSubscription(false);

  it('production cold-start is the free tier, never elite', () => {
    expect(prodDefault.planId).toBe('core');
  });

  it('paid features are blocked in the unknown-entitlement state', () => {
    expect(gate(prodDefault, PAID_FEATURE).allowed).toBe(false);
    expect(hasFeature(prodDefault, PAID_FEATURE)).toBe(false);
  });

  it('the free tier keeps working (core features stay available)', () => {
    expect(gate(prodDefault, FREE_FEATURE).allowed).toBe(true);
  });

  it('env-gated demo/capture builds may still seed elite (never ordinary prod)', () => {
    expect(defaultSubscription(true).planId).toBe('elite');
  });
});

describe('server-resolved entitlement states', () => {
  const elite = defaultSubscription(true); // elite-shaped subscription

  it('valid paid entitlement (active) unlocks its features', () => {
    expect(gate(withStatus(elite, 'active'), PAID_FEATURE).allowed).toBe(true);
    expect(gate(withStatus(elite, 'trialing'), PAID_FEATURE).allowed).toBe(true);
    expect(gate(withStatus(elite, 'past_due'), PAID_FEATURE).allowed).toBe(true); // dunning grace
  });

  it('expired/canceled/paused plans do NOT entitle, regardless of plan id', () => {
    expect(gate(withStatus(elite, 'canceled'), PAID_FEATURE).allowed).toBe(false);
    expect(gate(withStatus(elite, 'paused'), PAID_FEATURE).allowed).toBe(false);
    expect(hasFeature(withStatus(elite, 'canceled'), PAID_FEATURE)).toBe(false);
  });
});

describe('gate config — fail closed', () => {
  it('an unknown feature id never falls open', () => {
    const sub = withStatus(defaultSubscription(true), 'active');
    expect(gate(sub, 'nonexistent_feature_id').allowed).toBe(false);
  });
});
