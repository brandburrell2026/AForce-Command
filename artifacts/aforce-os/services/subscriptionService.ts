/**
 * Subscription service — mock billing layer.
 *
 * Provides the same shape a real billing layer (Stripe, Apple IAP)
 * would expose, so screens can switch over without changing call sites.
 *
 * No real payment processing. All calls resolve immediately with a
 * 200–400ms simulated latency to keep the UI feel real.
 */

import type {
  SubscriptionPlanId,
  UserSubscription,
} from '../types/subscription';
import { PLAN_BY_ID, getEffectiveFlags } from '../data/subscriptionPlans';

const LATENCY = () => 200 + Math.floor(Math.random() * 200);

function delay(ms: number) {
  return new Promise<void>((res) => setTimeout(res, ms));
}

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
      provider: 'mock',
      lastChargeAmount: plan.priceMonthly,
      nextRenewalAt: nextRenewal,
      paymentMethodLabel: 'Demo wallet',
    },
  };
}

/** The seed subscription used at app boot. */
export function defaultSubscription(): UserSubscription {
  return buildSubscription('core');
}

/** Switch the active plan. Mocked — returns the new subscription. */
export async function switchPlan(planId: SubscriptionPlanId): Promise<UserSubscription> {
  await delay(LATENCY());
  return buildSubscription(planId);
}

/** Cancel — flips the status to "canceled" but preserves the rest. */
export async function cancel(sub: UserSubscription): Promise<UserSubscription> {
  await delay(LATENCY());
  return { ...sub, status: 'canceled' };
}

/** Pause — for cycle skips. */
export async function pause(sub: UserSubscription): Promise<UserSubscription> {
  await delay(LATENCY());
  return { ...sub, status: 'paused' };
}

/** Resume from paused / canceled. */
export async function resume(sub: UserSubscription): Promise<UserSubscription> {
  await delay(LATENCY());
  return { ...sub, status: 'active' };
}

/** Skip the next product shipment by 14 days. */
export async function skipNextDelivery(sub: UserSubscription): Promise<UserSubscription> {
  await delay(LATENCY());
  if (!sub.product) return sub;
  const next = new Date(new Date(sub.product.nextDeliveryAt).getTime() + 14 * 24 * 60 * 60 * 1000).toISOString();
  return { ...sub, product: { ...sub.product, nextDeliveryAt: next, status: 'scheduled' } };
}
