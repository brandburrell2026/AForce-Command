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
 * Wave-1 P0 hardening (founder authorization 2026-08-12): unknown
 * entitlement is NOT entitlement. Production cold-starts on `core` (the
 * free tier — Home, logging, reminders, basic protocol all live there),
 * and paid tiers unlock only when `/api/entitlement` returns the real
 * Stripe-mirrored plan. Network failure, offline first launch, or a
 * missing server response therefore FAIL CLOSED to core; a legitimate
 * paying user recovers automatically on the next successful entitlement
 * fetch (useEntitlement refreshes on sign-in, foreground, and a 60s
 * interval).
 *
 * Env-gated demo/capture builds (investor walkthroughs, screenshot
 * sessions — never ordinary production) still seed `elite` so every
 * locked mode presents.
 */
export function defaultSubscription(
  demoBuild: boolean = process.env['EXPO_PUBLIC_DEMO_MODE'] === 'true' ||
    process.env['EXPO_PUBLIC_CAPTURE'] === '1',
): UserSubscription {
  return buildSubscription(demoBuild ? 'elite' : 'core');
}
