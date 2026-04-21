/**
 * Subscription gate — resolves whether a feature is unlocked at the
 * user's current plan, and points to the cheapest plan that grants it.
 *
 * Gates are CONTENT-aware (feature id → minimum plan id), not flag-aware.
 * The flag system is the runtime kill switch; this gate is the entitlements
 * layer on top.
 */

import type {
  GateCheck,
  SubscriptionPlanId,
  UserSubscription,
} from '../types/subscription';
import { PLAN_BY_ID, getEffectiveFeatures } from '../data/subscriptionPlans';

/** Map feature id → minimum plan id required to unlock it. */
export const FEATURE_REQUIREMENTS: Record<string, { plan: SubscriptionPlanId; label: string }> = {
  // Core
  home:           { plan: 'core',     label: 'Hydration Control Center' },
  pulse:          { plan: 'core',     label: 'Status Pulse' },
  protocol:       { plan: 'core',     label: 'AForce Protocol' },
  ai_basic:       { plan: 'core',     label: 'AI Hydration Commands' },
  logging:        { plan: 'core',     label: 'Quick Intake Logging' },
  scan_compare:   { plan: 'core',     label: 'Hydration Scan — Compare' },

  // Athlete Mode
  ai_pro:         { plan: 'athlete',  label: 'Enhanced AI Decisioning' },
  recovery_pro:   { plan: 'athlete',  label: 'Advanced Recovery Guidance' },
  trends:         { plan: 'athlete',  label: 'Expanded Trends + History' },
  competition:    { plan: 'athlete',  label: 'Community Competition' },
  city_compete:   { plan: 'athlete',  label: 'City + State Leaderboards' },
  team_compete:   { plan: 'athlete',  label: 'Team Leaderboards' },
  phantom:        { plan: 'athlete',  label: 'PHANTOM Band Pairing' },

  // Bundle
  product_sub:    { plan: 'bundle',   label: 'AForce Product Subscription' },
  preferred_pricing: { plan: 'bundle', label: 'Preferred Member Pricing' },

  // Clutch
  clutch_grid:    { plan: 'clutch',   label: 'CLUTCH Command Grid' },
  heat_mode:      { plan: 'clutch',   label: 'Heat Mode' },
  inventory:      { plan: 'clutch',   label: 'Auto-Replenish + Inventory' },
  clutch_clip:    { plan: 'clutch',   label: 'CLUTCH Clip Hardware' },

  // Guardian
  risk_score:     { plan: 'guardian', label: 'Roster-Wide Risk Score' },
  body_map:       { plan: 'guardian', label: 'Body Risk Map' },
  critical_alert: { plan: 'guardian', label: 'Critical Injury Alerts' },
};

/** Strict has-feature check — walks the user's plan inheritance chain. */
export function hasFeature(sub: UserSubscription, featureId: string): boolean {
  const features = getEffectiveFeatures(sub.planId);
  return features.some((f) => f.id === featureId);
}

/** Returns a structured gate result usable by UpgradePrompt. */
export function gate(sub: UserSubscription, featureId: string): GateCheck {
  const req = FEATURE_REQUIREMENTS[featureId];
  const label = req?.label ?? featureId;
  if (!req) {
    // Unknown features fall open by default — never block on missing config.
    return { allowed: true, featureLabel: label };
  }
  const allowed = hasFeature(sub, featureId);
  return {
    allowed,
    requiredPlanId: allowed ? undefined : req.plan,
    featureLabel: label,
  };
}

/** Comparator for sorting plans by tier rank. */
export function planRank(planId: SubscriptionPlanId): number {
  return PLAN_BY_ID[planId]?.rank ?? 0;
}
