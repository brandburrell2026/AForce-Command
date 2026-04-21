/**
 * AForce Subscription plans.
 *
 * Pricing and feature inheritance follow the spec:
 *   Core ($5)  →  Athlete ($15)  →  Bundle ($50, FLAGSHIP)
 *   Core Team ($25–$300)
 *   Clutch ($800–$5,000)
 *   Guardian ($5,000–$8,000)
 *
 * Feature flags map back to `featureFlags/flags.ts` so gating + entitlements
 * stay consistent across the product surface.
 */

import type { SubscriptionPlan, SubscriptionPlanId } from '../types/subscription';

export const SUBSCRIPTION_PLANS: SubscriptionPlan[] = [
  {
    id: 'core',
    name: 'Core',
    tagline: 'AForce OS essentials. Status pulse, score, AI commands.',
    audience: 'consumer',
    priceMonthly: 5,
    priceLabel: '$5/mo',
    rank: 1,
    features: [
      { id: 'home',          label: 'Hydration Control Center' },
      { id: 'pulse',         label: 'Status Pulse + Performance Score' },
      { id: 'protocol',      label: 'AForce Protocol guidance' },
      { id: 'ai_basic',      label: 'AI hydration commands (basic)' },
      { id: 'logging',       label: 'Tap-to-log Quick Intake' },
      { id: 'reminders',     label: 'Smart reminders' },
      { id: 'scan_compare',  label: 'Hydration Scan — compare any product' },
    ],
  },
  {
    id: 'athlete',
    name: 'Athlete Mode',
    tagline: 'Personalized AI. Competition. Recovery analytics.',
    audience: 'consumer',
    priceMonthly: 15,
    priceLabel: '$15/mo',
    rank: 2,
    inheritsFromId: 'core',
    features: [
      { id: 'ai_pro',         label: 'Enhanced AI decisioning',          detail: 'Deeper protocol personalization tuned to your activity profile.', badge: 'PRO' },
      { id: 'recovery_pro',   label: 'Advanced recovery guidance',       detail: 'Sleep mode, recovery cycles, post-event protocols.' },
      { id: 'trends',         label: 'Expanded trends + history',        detail: '90-day score history with state breakdown.' },
      { id: 'competition',    label: 'Community Competition access',     flag: 'global_leaderboard_enabled' },
      { id: 'city_compete',   label: 'City + State leaderboards',        flag: 'city_competition_enabled' },
      { id: 'team_compete',   label: 'Team leaderboards',                flag: 'team_competition_enabled' },
      { id: 'premium_notif',  label: 'Premium notifications' },
      { id: 'phantom',        label: 'PHANTOM Band pairing',             flag: 'phantom_wearable_enabled' },
    ],
  },
  {
    id: 'bundle',
    name: 'OS + Hydration Bundle',
    tagline: 'Athlete Mode + recurring AForce shipments at preferred pricing.',
    audience: 'consumer',
    priceMonthly: 50,
    priceLabel: '$50/mo',
    rank: 3,
    isFlagship: true,
    highlight: 'BEST VALUE',
    inheritsFromId: 'athlete',
    productSubscription: {
      allotments: [
        { fluidType: 'aforce_stick',     unitsPerCycle: 30, label: '30 AForce Sticks' },
        { fluidType: 'aforce_rtd',       unitsPerCycle: 12, label: '12 AForce RTDs' },
        { fluidType: 'aforce_canister',  unitsPerCycle: 1,  label: '1 AForce Canister' },
      ],
      cadence: 'monthly',
    },
    features: [
      { id: 'product_sub',    label: 'Monthly AForce shipment',          detail: 'Sticks, RTDs, and canister auto-replenished.', badge: 'NEW' },
      { id: 'preferred_pricing', label: 'Preferred member pricing',      detail: 'Lower per-unit cost than à la carte.' },
      { id: 'priority_ship',  label: 'Priority shipping placeholder' },
      { id: 'custom_mix',     label: 'Custom flavor mix (coming soon)' },
    ],
  },
  {
    id: 'core_team',
    name: 'Team / Program Core',
    tagline: 'Roster-aware Core for small organizations and programs.',
    audience: 'team',
    priceFrom: 25,
    priceTo: 300,
    priceLabel: '$25–$300/mo',
    rank: 4,
    inheritsFromId: 'core',
    features: [
      { id: 'roster_core',    label: 'Roster-aware Core for up to 50 members' },
      { id: 'group_reports',  label: 'Group reporting + protocol templates' },
      { id: 'admin_console',  label: 'Admin console + invite codes' },
      { id: 'bulk_billing',   label: 'Bulk billing + seat management' },
    ],
  },
  {
    id: 'clutch',
    name: 'Clutch Access',
    tagline: 'Live game commands. Heat Mode. Team grid.',
    audience: 'enterprise',
    priceFrom: 800,
    priceTo: 5000,
    priceLabel: '$800–$5,000/mo',
    rank: 5,
    inheritsFromId: 'core_team',
    features: [
      { id: 'clutch_grid',    label: 'CLUTCH command grid',              flag: 'clutch_access_enabled', badge: 'ELITE' },
      { id: 'heat_mode',      label: 'Heat Mode',                        flag: 'clutch_heat_mode_enabled' },
      { id: 'inventory',      label: 'Auto-replenish + inventory logic', flag: 'clutch_inventory_enabled' },
      { id: 'clutch_clip',    label: 'CLUTCH Clip hardware support',     flag: 'clutch_clip_enabled' },
    ],
  },
  {
    id: 'guardian',
    name: 'Guardian',
    tagline: 'Elite injury prevention + roster protection.',
    audience: 'enterprise',
    priceFrom: 5000,
    priceTo: 8000,
    priceLabel: '$5,000–$8,000/mo',
    rank: 6,
    inheritsFromId: 'clutch',
    features: [
      { id: 'risk_score',     label: 'Roster-wide risk score',           flag: 'guardian_intelligence_enabled', badge: 'ELITE' },
      { id: 'body_map',       label: 'Body Risk Map',                    flag: 'guardian_body_map_enabled' },
      { id: 'critical_alert', label: 'Critical injury alerts',           flag: 'guardian_alerts_enabled' },
      { id: 'medical_escal',  label: 'Coach + medical escalation paths' },
    ],
  },
];

export const PLAN_BY_ID: Record<SubscriptionPlanId, SubscriptionPlan> =
  SUBSCRIPTION_PLANS.reduce((acc, p) => {
    acc[p.id] = p;
    return acc;
  }, {} as Record<SubscriptionPlanId, SubscriptionPlan>);

/** Walk the inheritance chain and return all features available at this plan. */
export function getEffectiveFeatures(planId: SubscriptionPlanId) {
  const seen = new Set<string>();
  const out: SubscriptionPlan['features'] = [];
  let cur: SubscriptionPlan | undefined = PLAN_BY_ID[planId];
  while (cur) {
    for (const f of cur.features) {
      if (!seen.has(f.id)) {
        seen.add(f.id);
        out.push(f);
      }
    }
    cur = cur.inheritsFromId ? PLAN_BY_ID[cur.inheritsFromId] : undefined;
  }
  return out;
}

/** Resolve all unlocked feature flags for a plan (via inheritance). */
export function getEffectiveFlags(planId: SubscriptionPlanId): string[] {
  return getEffectiveFeatures(planId)
    .map((f) => f.flag)
    .filter((x): x is string => Boolean(x));
}
