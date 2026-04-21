/**
 * AForce Subscription System — type contracts.
 *
 * AForce is a subscription-based performance OS. Plan tiers gate
 * features (Phase 2 Clutch / Phase 3 Guardian / Athlete personalization /
 * physical product replenishment).
 *
 * Architecture is mock-billing for the demo but contract-shaped so a
 * real billing layer (Stripe, Apple IAP, team contracts) can drop in.
 */

import type { FluidType } from './index';

export type SubscriptionPlanId =
  | 'core'
  | 'athlete'
  | 'bundle'
  | 'core_team'
  | 'clutch'
  | 'guardian';

export type SubscriptionAudience = 'consumer' | 'team' | 'enterprise';

export type BillingCadence = 'monthly' | 'annual';

export type BillingProvider = 'mock' | 'stripe' | 'apple_iap' | 'invoice';

export type SubscriptionStatus =
  | 'active'
  | 'trialing'
  | 'past_due'
  | 'canceled'
  | 'paused';

export interface SubscriptionFeature {
  id: string;
  label: string;
  /** Optional one-line description of what this feature unlocks. */
  detail?: string;
  /** Internal feature flag this entitles, when applicable. */
  flag?: string;
  /** Render a 'NEW' or 'PRO' chip. */
  badge?: 'NEW' | 'PRO' | 'ELITE';
}

export interface ProductAllotment {
  fluidType: FluidType;
  /** Units shipped per cycle. */
  unitsPerCycle: number;
  label: string;
}

export interface ProductSubscription {
  /** Allotments included in the cycle shipment. */
  allotments: ProductAllotment[];
  cadence: 'monthly' | 'biweekly' | 'quarterly';
  /** Next ship date (ISO). */
  nextDeliveryAt: string;
  /** Current shipping status. */
  status: 'scheduled' | 'shipped' | 'paused' | 'delivered';
}

export interface SubscriptionPlan {
  id: SubscriptionPlanId;
  name: string;
  /** Single-line tagline. */
  tagline: string;
  /** Best plan to highlight at the top. */
  isFlagship?: boolean;
  audience: SubscriptionAudience;
  /** Display price. For ranged tiers, use `priceFrom`/`priceTo`. */
  priceMonthly?: number;
  priceFrom?: number;
  priceTo?: number;
  /** Pre-computed display string ("$50/mo", "$800–$5,000/mo"). */
  priceLabel: string;
  /** Inherits feature set from this plan id (used to render "Everything in X plus"). */
  inheritsFromId?: SubscriptionPlanId;
  /** Marketing-grade tier rank (used for sort + gating comparisons). */
  rank: number;
  features: SubscriptionFeature[];
  /** Recurring product shipment included in the plan, if any. */
  productSubscription?: Omit<ProductSubscription, 'nextDeliveryAt' | 'status'>;
  /** Optional emphasis chip text (e.g. "BEST VALUE"). */
  highlight?: string;
}

export interface BillingStatus {
  provider: BillingProvider;
  /** Last invoice amount in dollars. */
  lastChargeAmount?: number;
  /** ISO date of next renewal. */
  nextRenewalAt?: string;
  /** Last 4 of card / "Apple ID" / etc. */
  paymentMethodLabel?: string;
}

export interface UserSubscription {
  planId: SubscriptionPlanId;
  status: SubscriptionStatus;
  cadence: BillingCadence;
  /** ISO start date. */
  startedAt: string;
  /** Trial end (ISO) when status === 'trialing'. */
  trialEndsAt?: string;
  /** Plan-level feature flags resolved from the plan + any overrides. */
  unlockedFlags: string[];
  product?: ProductSubscription;
  billing: BillingStatus;
}

/** Result of attempting a feature gate check. */
export interface GateCheck {
  allowed: boolean;
  /** When `allowed === false`, the cheapest plan that grants access. */
  requiredPlanId?: SubscriptionPlanId;
  /** Human-readable feature name for the upgrade prompt. */
  featureLabel: string;
}
