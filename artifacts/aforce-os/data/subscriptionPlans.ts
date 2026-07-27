/**
 * AForce Subscription plans — overhauled pricing system.
 *
 * LAUNCH GATING: only plans in `LAUNCHED_PLAN_IDS` (core + athlete) are shown
 * in-app and are checkout-eligible. Every other tier stays defined here but
 * dark until its id is added to the allowlist — which is mirrored on the
 * server (api-server/src/routes/checkout.ts) and guarded by
 * subscriptionPlanParity.test.ts.
 *
 *   CONSUMER
 *     core              Free (launched)       "Start your performance system"
 *     recovery_plus     $9.99/mo              "Wake up clear-headed"
 *     athlete           $19.99/mo (launched)  "Train and perform with precision"
 *     system            $59.99/mo             BEST VALUE — "Full control + monthly product"
 *     elite             $99/mo                ELITE — "Guardian Mode + full system"
 *
 *   TEAM / PROGRAM
 *     team_starter      $49/mo        up to 25 — "Run your team with intelligence"
 *     team_growth       $99/mo        up to 50 — "Scale team performance"
 *     team_pro          $149/mo       up to 100 — "Operate at a higher level"
 *
 *   PERFORMANCE SYSTEMS — CLUTCH ACCESS
 *     clutch_starter    $1,000/mo     "Control performance in real time"
 *     clutch_pro        $2,500/mo     "Advance live decision making"
 *     clutch_elite      $5,000/mo     ELITE — "Elite team command system"
 *
 *   PERFORMANCE SYSTEMS — GUARDIAN
 *     guardian_core     $5,000/mo + $7,500 setup, 6mo min   — "Protect athletes before breakdown"
 *     guardian_elite    $8,000/mo + $12,500 setup, 12mo min — ELITE "Elite roster protection system"
 *
 * Feature flags map back to `featureFlags/flags.ts` so gating + entitlements
 * stay consistent across the product surface.
 */

import type { SubscriptionPlan, SubscriptionPlanId } from '../types/subscription';

function priceLabel(price: number): string {
  if (price === 0) return 'Free';
  if (price >= 1000) return `$${price.toLocaleString('en-US')}/mo`;
  // Render the cents only when meaningful so $19.99 → "$19.99/mo" but
  // $99 → "$99/mo" (no trailing .00). Keeps the dark-luxury type rhythm.
  const formatted = Number.isInteger(price) ? `${price}` : price.toFixed(2);
  return `$${formatted}/mo`;
}

export const SUBSCRIPTION_PLANS: SubscriptionPlan[] = [
  // ─── CONSUMER ────────────────────────────────────────────────────────────
  {
    id: 'core',
    name: 'Core',
    category: 'consumer',
    subcategory: 'consumer',
    positioning: 'Start your performance system',
    description:
      'Entry point into AForce OS — OS access, AI commands, and the daily hydration tracking layer.',
    priceMonthly: 0,
    priceLabel: priceLabel(0),
    rank: 1,
    ctaLabel: 'Start with Core',
    features: [
      { id: 'home',       label: 'Hydration Control Center' },
      { id: 'pulse',      label: 'Status Pulse + Performance Score' },
      { id: 'protocol',   label: 'Basic protocol guidance' },
      { id: 'ai_basic',   label: 'Basic AI hydration commands' },
      { id: 'logging',    label: 'Quick intake logging' },
      { id: 'reminders',  label: 'Smart reminders' },
    ],
  },
  {
    id: 'recovery_plus',
    name: 'Recovery+',
    category: 'consumer',
    subcategory: 'consumer',
    positioning: 'Wake up clear-headed',
    description:
      'Standalone add-on that unlocks Recovery Mode after a Social Mode session — pre-sleep protocol, AForce RTD recommendation, and a personalized morning recovery estimate.',
    priceMonthly: 9.99,
    priceLabel: priceLabel(9.99),
    rank: 1.5,
    ctaLabel: 'Subscribe to Recovery+',
    features: [
      {
        id: 'recovery_mode_enabled',
        label: 'Recovery Mode',
        detail: 'Post-session recovery card with morning estimate, hydration steps, and AForce RTD pacing.',
        badge: 'PRO',
      },
    ],
  },
  {
    // D-1 (PASS-3 slice 4, founder 2026-07-26): the canonical paid consumer
    // tier is COMMAND at $20/mo, matching the marketing site. The internal id
    // stays 'athlete' — it is the storage key on live aforce_users rows and
    // Stripe metadata; renaming it would orphan existing subscribers.
    id: 'athlete',
    name: 'AForce Command',
    category: 'consumer',
    subcategory: 'consumer',
    positioning: 'Command interprets the pattern',
    description:
      'The paid intelligence layer for serious users who want deeper decisioning, recovery guidance, and personalized protocols.',
    priceMonthly: 20,
    priceAnnual: 200,
    priceLabel: priceLabel(20),
    rank: 2,
    inheritsFromId: 'core',
    ctaLabel: 'Enter Command',
    features: [
      { id: 'ai_pro',         label: 'Enhanced AI decisioning',          detail: 'Deeper protocol personalization tuned to your activity profile.', badge: 'PRO' },
      { id: 'protocol_pro',   label: 'Personalized hydration protocol' },
      { id: 'recovery_pro',   label: 'Advanced recovery guidance',       detail: 'Sleep mode, recovery cycles, post-event protocols.' },
      { id: 'trends',         label: 'Expanded trends + history',        detail: '90-day score history with state breakdown.' },
      { id: 'competition',    label: 'Community Competition access',     flag: 'global_leaderboard_enabled' },
      { id: 'city_compete',   label: 'City + State leaderboards',        flag: 'city_competition_enabled' },
      { id: 'team_compete',   label: 'Team leaderboard participation',   flag: 'team_competition_enabled' },
      { id: 'premium_notif',  label: 'Premium notifications' },
      { id: 'metabolic_readiness', label: 'Metabolic Readiness', detail: 'Muscle + cognitive readiness estimates from hydration, recovery, sleep & HRV.', flag: 'metabolic_readiness_enabled', badge: 'PRO' },
    ],
  },
  {
    id: 'system',
    name: 'Performance Bundle',
    category: 'consumer',
    subcategory: 'consumer',
    positioning: 'Full performance control + monthly product',
    description:
      'The flagship — Athlete tier plus a recurring product drop (1 canister or 2 stick packs each month) at exclusive member pricing.',
    priceMonthly: 59.99,
    priceLabel: priceLabel(59.99),
    rank: 3,
    inheritsFromId: 'athlete',
    badge: 'BEST VALUE',
    isBestValue: true,
    ctaLabel: 'Get the Performance Bundle',
    productSubscription: {
      // Default fulfillment is the canister; the user can swap to "2 stick
      // packs" from ManageSubscription. UI copy reflects the choice.
      allotments: [
        { fluidType: 'aforce_canister',  unitsPerCycle: 1, label: '1 Canister · 30 servings' },
        { fluidType: 'aforce_stick',     unitsPerCycle: 2, label: 'or 2 Stick Packs · 24 servings' },
      ],
      cadence: 'monthly',
    },
    features: [
      { id: 'product_sub',       label: 'Monthly product drop',                 detail: '1 canister OR 2 stick packs auto-shipped each cycle.', badge: 'NEW' },
      { id: 'preferred_pricing', label: 'Exclusive member pricing on the store' },
      { id: 'priority_ai',       label: 'Priority AI optimization',             badge: 'PRO' },
      { id: 'protocol_tune',     label: 'Advanced protocol tuning' },
      { id: 'premium_insights',  label: 'Premium performance insights' },
      { id: 'system_recs',       label: 'Priority access to new features' },
    ],
  },
  {
    id: 'elite',
    name: 'AForce Elite',
    category: 'consumer',
    subcategory: 'consumer',
    positioning: 'Guardian Mode + the full system, unlocked',
    description:
      'Top-tier consumer experience — Guardian Mode early-warning intelligence, premium analytics, the full monthly product bundle, and early access to new features.',
    priceMonthly: 99,
    priceLabel: priceLabel(99),
    rank: 3.5,
    inheritsFromId: 'system',
    badge: 'ELITE',
    ctaLabel: 'Go Elite',
    productSubscription: {
      allotments: [
        { fluidType: 'aforce_canister',  unitsPerCycle: 1,  label: '1 Canister · 30 servings' },
        { fluidType: 'aforce_stick',     unitsPerCycle: 24, label: '2 Stick Packs · 24 servings' },
        { fluidType: 'aforce_rtd',       unitsPerCycle: 12, label: '12 RTD Cans' },
      ],
      cadence: 'monthly',
    },
    features: [
      { id: 'guardian_consumer', label: 'Guardian Mode for individuals',       detail: 'Personal early-warning heat / strain intelligence layer.', badge: 'ELITE' },
      { id: 'analytics_premium', label: 'Premium analytics + trend deep-dive' },
      { id: 'full_bundle',       label: 'Full monthly bundle (canister + sticks + RTDs)' },
      { id: 'early_access',      label: 'Early access to new features',         badge: 'ELITE' },
      { id: 'concierge',         label: 'Priority concierge support' },
    ],
  },

  // ─── TEAM / PROGRAM ──────────────────────────────────────────────────────
  {
    id: 'team_starter',
    name: 'Team Core Starter',
    category: 'team',
    subcategory: 'team',
    positioning: 'Run your team with intelligence',
    description:
      'Roster-aware AForce OS for small organizations, training groups, and developing programs.',
    priceMonthly: 49,
    priceLabel: priceLabel(49),
    userLimit: 25,
    rank: 4,
    ctaLabel: 'Start Team Core',
    features: [
      { id: 'roster_core',      label: 'Roster-aware Core',                flag: 'team_roster_enabled' },
      { id: 'group_reports',    label: 'Group reporting',                  flag: 'team_reporting_enabled' },
      { id: 'protocol_templates', label: 'Protocol templates' },
      { id: 'admin_console',    label: 'Admin console',                    flag: 'team_admin_enabled' },
      { id: 'invite_codes',     label: 'Invite codes' },
      { id: 'seat_basic',       label: 'Basic seat management' },
    ],
  },
  {
    id: 'team_growth',
    name: 'Team Core Growth',
    category: 'team',
    subcategory: 'team',
    positioning: 'Scale team performance',
    description:
      'Expanded team performance system for organizations that need deeper reporting and better operational visibility.',
    priceMonthly: 99,
    priceLabel: priceLabel(99),
    userLimit: 50,
    rank: 5,
    inheritsFromId: 'team_starter',
    ctaLabel: 'Upgrade to Growth',
    features: [
      { id: 'analytics_expanded', label: 'Expanded analytics' },
      { id: 'multi_group',        label: 'Multi-group segmentation' },
      { id: 'reporting_deep',     label: 'Deeper reporting' },
      { id: 'admin_enhanced',     label: 'Enhanced admin controls' },
    ],
  },
  {
    id: 'team_pro',
    name: 'Team Core Pro',
    category: 'team',
    subcategory: 'team',
    positioning: 'Operate at a higher level',
    description:
      'Advanced team management layer for larger organizations that want greater control, better insight, and stronger performance visibility.',
    priceMonthly: 149,
    priceLabel: priceLabel(149),
    userLimit: 100,
    rank: 6,
    inheritsFromId: 'team_growth',
    ctaLabel: 'Upgrade to Pro',
    features: [
      { id: 'team_insights_pro',  label: 'Advanced team performance insights', badge: 'PRO' },
      { id: 'priority_support',   label: 'Priority support placeholder' },
      { id: 'reporting_elevated', label: 'Elevated reporting tools' },
      { id: 'visibility_enhanced',label: 'Enhanced operational visibility' },
    ],
  },

  // ─── PERFORMANCE SYSTEMS — CLUTCH ACCESS ─────────────────────────────────
  {
    id: 'clutch_starter',
    name: 'Clutch Starter',
    category: 'performance',
    subcategory: 'clutch',
    positioning: 'Control performance in real time',
    description:
      'Entry point into the live team command environment for organizations that want real-time decision support.',
    priceMonthly: 1000,
    priceLabel: priceLabel(1000),
    rank: 7,
    ctaLabel: 'Get Clutch Starter',
    features: [
      { id: 'clutch_grid',     label: 'Clutch command grid',            flag: 'clutch_access_enabled' },
      { id: 'realtime_layer',  label: 'Real-time hydration command layer' },
      { id: 'heat_basic',      label: 'Basic Heat Mode',                flag: 'clutch_heat_mode_enabled' },
      { id: 'team_visibility', label: 'Team performance visibility' },
      { id: 'live_support',    label: 'Live command support' },
    ],
  },
  {
    id: 'clutch_pro',
    name: 'Clutch Pro',
    category: 'performance',
    subcategory: 'clutch',
    positioning: 'Advance live decision making',
    description:
      'Expanded game-time control system with stronger decision support, deeper team visibility, and operational execution.',
    priceMonthly: 2500,
    priceLabel: priceLabel(2500),
    rank: 8,
    inheritsFromId: 'clutch_starter',
    ctaLabel: 'Upgrade to Clutch Pro',
    features: [
      { id: 'heat_advanced',   label: 'Advanced Heat Mode',             badge: 'PRO' },
      { id: 'auto_replenish',  label: 'Auto-replenish logic',           flag: 'clutch_inventory_enabled' },
      { id: 'command_expanded',label: 'Expanded team command tools' },
      { id: 'live_mgmt',       label: 'Enhanced live team management' },
    ],
  },
  {
    id: 'clutch_elite',
    name: 'Clutch Elite',
    category: 'performance',
    subcategory: 'clutch',
    positioning: 'Elite team command system',
    description:
      'Full performance command system for elite organizations that want real-time operational control during competition and high-intensity environments.',
    priceMonthly: 5000,
    priceLabel: priceLabel(5000),
    rank: 9,
    inheritsFromId: 'clutch_pro',
    badge: 'ELITE',
    ctaLabel: 'Get Clutch Elite',
    features: [
      { id: 'clutch_clip',     label: 'CLUTCH Clip hardware support placeholder', flag: 'clutch_clip_enabled', badge: 'ELITE' },
      { id: 'command_full',    label: 'Full team command environment' },
      { id: 'control_elite',   label: 'Elite real-time performance control tools' },
      { id: 'support_premium', label: 'Premium support placeholder' },
    ],
  },

  // ─── PERFORMANCE SYSTEMS — GUARDIAN ──────────────────────────────────────
  {
    id: 'guardian_core',
    name: 'Guardian Core',
    category: 'performance',
    subcategory: 'guardian',
    positioning: 'Protect athletes before breakdown',
    description:
      'Foundational injury risk reduction and roster protection system for serious organizations that want proactive visibility into athlete stress and risk patterns.',
    priceMonthly: 5000,
    setupFee: 7500,
    minimumTermMonths: 6,
    priceLabel: priceLabel(5000),
    rank: 10,
    ctaLabel: 'Get Guardian Core',
    valueNote: 'Prevent one major incident and the system can pay for itself.',
    features: [
      { id: 'risk_score',     label: 'Roster-wide risk score',           flag: 'guardian_intelligence_enabled' },
      { id: 'risk_basic',     label: 'Basic body risk modeling' },
      { id: 'early_warning',  label: 'Early warning alerts',             flag: 'guardian_alerts_enabled' },
      { id: 'team_risk_mon',  label: 'Team risk monitoring' },
      { id: 'recovery_escal', label: 'Recovery escalation visibility' },
    ],
  },
  {
    id: 'guardian_elite',
    name: 'Guardian Elite',
    category: 'performance',
    subcategory: 'guardian',
    positioning: 'Elite roster protection system',
    description:
      'Advanced roster protection system for elite organizations that need deeper intelligence, higher confidence alerts, and coordinated intervention paths.',
    priceMonthly: 8000,
    setupFee: 12500,
    minimumTermMonths: 12,
    priceLabel: priceLabel(8000),
    rank: 11,
    inheritsFromId: 'guardian_core',
    badge: 'ELITE',
    ctaLabel: 'Get Guardian Elite',
    valueNote: 'The cost of one serious injury event can exceed the cost of Guardian.',
    features: [
      { id: 'body_map',          label: 'Body Risk Map',                       flag: 'guardian_body_map_enabled', badge: 'ELITE' },
      { id: 'critical_alert',    label: 'Critical injury alerts' },
      { id: 'medical_escal',     label: 'Coach + medical escalation paths' },
      { id: 'risk_advanced',     label: 'Advanced risk modeling' },
      { id: 'deployment_elite',  label: 'Elite deployment and support placeholder' },
    ],
  },
];

export const PLAN_BY_ID: Record<SubscriptionPlanId, SubscriptionPlan> =
  SUBSCRIPTION_PLANS.reduce((acc, p) => {
    acc[p.id] = p;
    return acc;
  }, {} as Record<SubscriptionPlanId, SubscriptionPlan>);

/**
 * LAUNCH ALLOWLIST — the single source of truth for which tiers are live.
 * Only these render in-app (SubscriptionScreen filters `visiblePlans` and the
 * category tabs to this set) AND are checkout-eligible. The server mirrors this
 * exact set in api-server/src/routes/checkout.ts and rejects any other planId,
 * so a dark tier can never be purchased via a direct API call. Parity between
 * the two is enforced by subscriptionPlanParity.test.ts.
 *
 * To launch a tier later: add its id here and on the server — one change,
 * guarded by the parity test. Defaults to launch mode (core = Free, athlete).
 */
export const LAUNCHED_PLAN_IDS: ReadonlySet<SubscriptionPlanId> =
  new Set<SubscriptionPlanId>(['core', 'athlete']);

export function isPlanLaunched(id: SubscriptionPlanId): boolean {
  return LAUNCHED_PLAN_IDS.has(id);
}

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
