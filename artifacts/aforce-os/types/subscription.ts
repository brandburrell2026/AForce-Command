/**
 * AForce Subscription System — type contracts.
 *
 * AForce OS pricing is structured into three categories:
 *   - Consumer (Core / Athlete / System)
 *   - Team / Program (Starter / Growth / Pro)
 *   - Performance Systems (Clutch + Guardian)
 *
 * Architecture is mock-billing for the demo but contract-shaped so a
 * real billing layer (Stripe, Apple IAP, RevenueCat, Sales) can drop in.
 */

import type { FluidType } from './index';

export type SubscriptionPlanId =
  // Consumer
  | 'core'
  | 'athlete'
  | 'system'
  // Team / Program
  | 'team_starter'
  | 'team_growth'
  | 'team_pro'
  // Performance Systems — Clutch
  | 'clutch_starter'
  | 'clutch_pro'
  | 'clutch_elite'
  // Performance Systems — Guardian
  | 'guardian_core'
  | 'guardian_elite';

export type SubscriptionAudience = 'consumer' | 'team' | 'performance';
export type SubscriptionSubcategory = 'consumer' | 'team' | 'clutch' | 'guardian';

export type BillingCadence = 'monthly' | 'annual';

export type BillingProvider = 'mock' | 'stripe' | 'apple_iap' | 'invoice';

export type SubscriptionStatus =
  | 'active'
  | 'trialing'
  | 'past_due'
  | 'canceled'
  | 'paused';

export type PlanBadge = 'BEST VALUE' | 'ELITE';

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
  /** High-level marketing category. */
  category: SubscriptionAudience;
  /** Sub-grouping within Performance Systems (clutch | guardian) or category for others. */
  subcategory: SubscriptionSubcategory;
  /** One-line positioning statement (spec language). */
  positioning: string;
  /** Long-form description used on detail surfaces. */
  description: string;
  /** Fixed monthly price in USD. 0 = Free. */
  priceMonthly: number;
  /** Optional one-time setup / onboarding fee (USD). */
  setupFee?: number;
  /** Optional minimum contract term (months). */
  minimumTermMonths?: number;
  /** Optional seat / user limit on team plans. */
  userLimit?: number;
  /** Pre-computed display string ("$19/mo", "Free", "$5,000/mo"). */
  priceLabel: string;
  /** Inherits feature set from this plan id (used to render "Everything in X plus"). */
  inheritsFromId?: SubscriptionPlanId;
  /** Marketing-grade tier rank (used for sort + gating comparisons). */
  rank: number;
  features: SubscriptionFeature[];
  /** Recurring product shipment included in the plan, if any. */
  productSubscription?: Omit<ProductSubscription, 'nextDeliveryAt' | 'status'>;
  /** Optional emphasis chip text ("BEST VALUE" | "ELITE"). */
  badge?: PlanBadge;
  /** Convenience flag — true when badge === 'BEST VALUE' (the flagship). */
  isBestValue?: boolean;
  /** CTA label shown on the plan card. */
  ctaLabel: string;
  /** Optional ROI / value note shown beneath the plan body. */
  valueNote?: string;
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
