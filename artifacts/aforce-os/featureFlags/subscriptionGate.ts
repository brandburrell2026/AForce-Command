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
  // ─── Core (free tier) ──────────────────────────────────────────────────
  home:               { plan: 'core',     label: 'Hydration Control Center' },
  pulse:              { plan: 'core',     label: 'Status Pulse' },
  protocol:           { plan: 'core',     label: 'Basic Protocol Guidance' },
  ai_basic:           { plan: 'core',     label: 'Basic AI Commands' },
  logging:            { plan: 'core',     label: 'Quick Intake Logging' },
  reminders:          { plan: 'core',     label: 'Smart Reminders' },

  // ─── Recovery+ (standalone add-on) ─────────────────────────────────────
  recovery_mode_enabled: { plan: 'recovery_plus', label: 'Recovery Mode' },

  // ─── AForce Athlete ────────────────────────────────────────────────────
  ai_pro:             { plan: 'athlete',  label: 'Enhanced AI Decisioning' },
  protocol_pro:       { plan: 'athlete',  label: 'Personalized Hydration Protocol' },
  recovery_pro:       { plan: 'athlete',  label: 'Advanced Recovery Guidance' },
  trends:             { plan: 'athlete',  label: 'Expanded Trends + History' },
  competition:        { plan: 'athlete',  label: 'Community Competition' },
  city_compete:       { plan: 'athlete',  label: 'City + State Leaderboards' },
  team_compete:       { plan: 'athlete',  label: 'Team Leaderboards' },
  premium_notif:      { plan: 'athlete',  label: 'Premium Notifications' },
  metabolic_readiness: { plan: 'athlete', label: 'Metabolic Readiness' },

  // ─── AForce System (flagship consumer) ────────────────────────────────
  product_sub:        { plan: 'system',   label: 'AForce Product Subscription' },
  preferred_pricing:  { plan: 'system',   label: 'Preferred Member Pricing' },
  priority_ai:        { plan: 'system',   label: 'Priority AI Optimization' },
  protocol_tune:      { plan: 'system',   label: 'Advanced Protocol Tuning' },
  premium_insights:   { plan: 'system',   label: 'Premium Performance Insights' },
  system_recs:        { plan: 'system',   label: 'Full System-Level Recommendations' },

  // ─── Elite (Consumer ELITE tier) ───────────────────────────────────────
  guardian_consumer:  { plan: 'elite',    label: 'Guardian Mode for Individuals' },
  analytics_premium:  { plan: 'elite',    label: 'Premium Analytics' },
  full_bundle:        { plan: 'elite',    label: 'Full Monthly Product Bundle' },
  early_access:       { plan: 'elite',    label: 'Early Access to New Features' },
  concierge:          { plan: 'elite',    label: 'Priority Concierge Support' },

  // ─── Team / Program ────────────────────────────────────────────────────
  roster_core:        { plan: 'team_starter', label: 'Roster-Aware Core' },
  group_reports:      { plan: 'team_starter', label: 'Group Reporting' },
  protocol_templates: { plan: 'team_starter', label: 'Protocol Templates' },
  admin_console:      { plan: 'team_starter', label: 'Admin Console' },
  invite_codes:       { plan: 'team_starter', label: 'Invite Codes' },
  seat_basic:         { plan: 'team_starter', label: 'Basic Seat Management' },
  analytics_expanded: { plan: 'team_growth',  label: 'Expanded Analytics' },
  multi_group:        { plan: 'team_growth',  label: 'Multi-Group Segmentation' },
  reporting_deep:     { plan: 'team_growth',  label: 'Deeper Reporting' },
  admin_enhanced:     { plan: 'team_growth',  label: 'Enhanced Admin Controls' },
  team_insights_pro:  { plan: 'team_pro',     label: 'Advanced Team Performance Insights' },
  priority_support:   { plan: 'team_pro',     label: 'Priority Support' },
  reporting_elevated: { plan: 'team_pro',     label: 'Elevated Reporting Tools' },
  visibility_enhanced:{ plan: 'team_pro',     label: 'Enhanced Operational Visibility' },

  // ─── Clutch (Performance Systems) ──────────────────────────────────────
  clutch_grid:        { plan: 'clutch_starter', label: 'Clutch Command Grid' },
  realtime_layer:     { plan: 'clutch_starter', label: 'Real-Time Command Layer' },
  heat_basic:         { plan: 'clutch_starter', label: 'Basic Heat Mode' },
  team_visibility:    { plan: 'clutch_starter', label: 'Team Performance Visibility' },
  live_support:       { plan: 'clutch_starter', label: 'Live Command Support' },
  heat_advanced:      { plan: 'clutch_pro',     label: 'Advanced Heat Mode' },
  auto_replenish:     { plan: 'clutch_pro',     label: 'Auto-Replenish Logic' },
  command_expanded:   { plan: 'clutch_pro',     label: 'Expanded Team Command Tools' },
  live_mgmt:          { plan: 'clutch_pro',     label: 'Enhanced Live Team Management' },
  clutch_clip:        { plan: 'clutch_elite',   label: 'CLUTCH Clip Hardware' },
  command_full:       { plan: 'clutch_elite',   label: 'Full Team Command Environment' },
  control_elite:      { plan: 'clutch_elite',   label: 'Elite Real-Time Performance Control' },
  support_premium:    { plan: 'clutch_elite',   label: 'Premium Support' },

  // ─── Guardian (Performance Systems) ────────────────────────────────────
  risk_score:         { plan: 'guardian_core',  label: 'Roster-Wide Risk Score' },
  risk_basic:         { plan: 'guardian_core',  label: 'Basic Body Risk Modeling' },
  early_warning:      { plan: 'guardian_core',  label: 'Early Warning Alerts' },
  team_risk_mon:      { plan: 'guardian_core',  label: 'Team Risk Monitoring' },
  recovery_escal:     { plan: 'guardian_core',  label: 'Recovery Escalation Visibility' },
  body_map:           { plan: 'guardian_elite', label: 'Body Risk Map' },
  critical_alert:     { plan: 'guardian_elite', label: 'Critical Injury Alerts' },
  medical_escal:      { plan: 'guardian_elite', label: 'Coach + Medical Escalation Paths' },
  risk_advanced:      { plan: 'guardian_elite', label: 'Advanced Risk Modeling' },
  deployment_elite:   { plan: 'guardian_elite', label: 'Elite Deployment & Support' },
};

/**
 * Dev-time invariant: every feature id present in the plan catalog must have
 * a gate entry. We log a single warning rather than throwing so a missing
 * mapping never bricks the app — the gate itself falls open by default.
 */
if (typeof __DEV__ !== 'undefined' && __DEV__) {
  // Lazy import to avoid a cycle at module-eval.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { SUBSCRIPTION_PLANS } = require('../data/subscriptionPlans');
  const allFeatureIds = new Set<string>();
  for (const p of SUBSCRIPTION_PLANS) for (const f of p.features) allFeatureIds.add(f.id);
  const missing = [...allFeatureIds].filter((id) => !(id in FEATURE_REQUIREMENTS));
  if (missing.length) {
    // eslint-disable-next-line no-console
    console.warn('[subscriptionGate] Missing FEATURE_REQUIREMENTS entries:', missing);
  }
}

/**
 * Statuses that actually entitle (Wave-1 P0): a plan id alone is not
 * entitlement. `past_due` keeps access during Stripe's dunning grace;
 * `canceled`/`paused` do not.
 */
const ENTITLING_STATUSES: ReadonlySet<UserSubscription['status']> = new Set([
  'active',
  'trialing',
  'past_due',
]);

/** Strict has-feature check — entitling status AND plan inheritance chain. */
export function hasFeature(sub: UserSubscription, featureId: string): boolean {
  if (!ENTITLING_STATUSES.has(sub.status)) return false;
  const features = getEffectiveFeatures(sub.planId);
  return features.some((f) => f.id === featureId);
}

/** Returns a structured gate result usable by UpgradePrompt. */
export function gate(sub: UserSubscription, featureId: string): GateCheck {
  const req = FEATURE_REQUIREMENTS[featureId];
  const label = req?.label ?? featureId;
  if (!req) {
    // Wave-1 P0: gated features FAIL CLOSED — an unknown/unconfigured
    // feature id is never an entitlement bypass. (Previously fell open.)
    return { allowed: false, featureLabel: label };
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
