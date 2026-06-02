/**
 * Subscription service — boot-time seed only.
 *
 * The shipped app uses real Stripe Checkout for paid plan upgrades and
 * the Stripe Customer Portal for cancel / pause / resume / payment
 * method changes. The plan + status are then sourced from
 * `/api/entitlement` (set by the Stripe webhook) via `useEntitlement`.
 *
 * The only thing this module still owns is the cold-start seed used by
 * `useAppStore` before the first entitlement fetch lands — every other
 * mock CRUD function has been removed because it would write fake state
 * that the real entitlement poll would then have to overwrite.
 */

import type {
  SubscriptionPlanId,
  UserSubscription,
} from '../types/subscription';
import { PLAN_BY_ID, getEffectiveFlags } from '../data/subscriptionPlans';

function buildSubscription(planId: SubscriptionPlanId): UserSubscription {
  const plan = PLAN_BY_ID[planId];
  const startedAt = new Date().toISOString();
  const nextRenewal = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  const productSub = plan.productSubscription
    ? {
        allotments: plan.productSubscription.allotments,
        cadence: plan.productSubscription.cadence,
        nextDeliveryAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
        status: 'scheduled' as const,
      }
    : undefined;

  return {
    planId,
    status: 'active',
    cadence: 'monthly',
    startedAt,
    unlockedFlags: getEffectiveFlags(planId),
    product: productSub,
    billing: {
      provider: 'stripe',
      lastChargeAmount: plan.priceMonthly,
      nextRenewalAt: nextRenewal,
      paymentMethodLabel: undefined,
    },
  };
}

/**
 * Cold-start seed used by `useAppStore`.
 *
 * For the investor / demo build we seed the top consumer tier
 * (`elite`) so every locked mode — Social, Recovery, Cruise, Voyage
 * Shield, and every Athlete / System / Elite feature — is unlocked on
 * first launch. `elite` inherits from all lower tiers via
 * `inheritsFromId`, so `getEffectiveFlags('elite')` returns every
 * feature flag in the catalog. In production this is overwritten a few
 * hundred ms later when `/api/entitlement` returns the real
 * Stripe-mirrored plan for the signed-in user.
 */
export function defaultSubscription(): UserSubscription {
  return buildSubscription('elite');
}
