/**
 * featureEntitlements — the server's copy of the client entitlement
 * semantics (Wave-2 PR1: server-side entitlement enforcement).
 *
 * The client's feature→plan mapping lives in
 * `artifacts/aforce-os/featureFlags/subscriptionGate.ts` (FEATURE_REQUIREMENTS)
 * and the plan catalog with its inheritance chains in
 * `artifacts/aforce-os/data/subscriptionPlans.ts` (getEffectiveFeatures).
 * The api-server build cannot import app modules at runtime, so the
 * resolved per-plan feature sets are duplicated here as literals —
 * kept in lockstep by `lib/__tests__/entitlementFeatureParity.test.ts`,
 * which cross-imports the app catalog (same pattern as
 * `subscriptionPlanParity.test.ts`) and fails CI on any drift.
 *
 * Semantics mirror the client gate exactly:
 *   entitled(featureId) = status ∈ ENTITLING_STATUSES
 *                       AND featureId ∈ PLAN_FEATURES[planId]
 * Unknown plan ids and unknown feature ids FAIL CLOSED.
 */

/**
 * Statuses that actually entitle. `past_due` keeps access during
 * Stripe's dunning grace; `canceled` / `paused` / `none` do not.
 * Mirrors ENTITLING_STATUSES in the client subscriptionGate and
 * ACTIVE_STATUSES in lib/entitlementResolver.
 */
export const ENTITLING_STATUSES: ReadonlySet<string> = new Set([
  "active",
  "trialing",
  "past_due",
]);

/**
 * Effective feature set per plan — the client's getEffectiveFeatures()
 * (inheritance chain already walked), resolved to sorted id arrays.
 */
export const PLAN_FEATURES: Readonly<Record<string, readonly string[]>> = {
  core: ["ai_basic", "home", "logging", "protocol", "pulse", "reminders"],
  recovery_plus: ["recovery_mode_enabled"],
  athlete: [
    "ai_basic", "ai_pro", "city_compete", "competition", "home", "logging",
    "metabolic_readiness", "premium_notif", "protocol", "protocol_pro",
    "pulse", "recovery_pro", "reminders", "team_compete", "trends",
  ],
  system: [
    "ai_basic", "ai_pro", "city_compete", "competition", "home", "logging",
    "metabolic_readiness", "preferred_pricing", "premium_insights",
    "premium_notif", "priority_ai", "product_sub", "protocol",
    "protocol_pro", "protocol_tune", "pulse", "recovery_pro", "reminders",
    "system_recs", "team_compete", "trends",
  ],
  elite: [
    "ai_basic", "ai_pro", "analytics_premium", "city_compete", "competition",
    "concierge", "early_access", "full_bundle", "guardian_consumer", "home",
    "logging", "metabolic_readiness", "preferred_pricing", "premium_insights",
    "premium_notif", "priority_ai", "product_sub", "protocol", "protocol_pro",
    "protocol_tune", "pulse", "recovery_pro", "reminders", "system_recs",
    "team_compete", "trends",
  ],
  team_starter: [
    "admin_console", "group_reports", "invite_codes", "protocol_templates",
    "roster_core", "seat_basic",
  ],
  team_growth: [
    "admin_console", "admin_enhanced", "analytics_expanded", "group_reports",
    "invite_codes", "multi_group", "protocol_templates", "reporting_deep",
    "roster_core", "seat_basic",
  ],
  team_pro: [
    "admin_console", "admin_enhanced", "analytics_expanded", "group_reports",
    "invite_codes", "multi_group", "priority_support", "protocol_templates",
    "reporting_deep", "reporting_elevated", "roster_core", "seat_basic",
    "team_insights_pro", "visibility_enhanced",
  ],
  clutch_starter: [
    "clutch_grid", "heat_basic", "live_support", "realtime_layer",
    "team_visibility",
  ],
  clutch_pro: [
    "auto_replenish", "clutch_grid", "command_expanded", "heat_advanced",
    "heat_basic", "live_mgmt", "live_support", "realtime_layer",
    "team_visibility",
  ],
  clutch_elite: [
    "auto_replenish", "clutch_clip", "clutch_grid", "command_expanded",
    "command_full", "control_elite", "heat_advanced", "heat_basic",
    "live_mgmt", "live_support", "realtime_layer", "support_premium",
    "team_visibility",
  ],
  guardian_core: [
    "early_warning", "recovery_escal", "risk_basic", "risk_score",
    "team_risk_mon",
  ],
  guardian_elite: [
    "body_map", "critical_alert", "deployment_elite", "early_warning",
    "medical_escal", "recovery_escal", "risk_advanced", "risk_basic",
    "risk_score", "team_risk_mon",
  ],
};

/**
 * Feature id → minimum plan that grants it (the client's
 * FEATURE_REQUIREMENTS, plan field only). Used for the structured
 * denial payload so the client can render the correct upgrade prompt.
 */
export const FEATURE_MIN_PLAN: Readonly<Record<string, string>> = {
  home: "core", pulse: "core", protocol: "core", ai_basic: "core",
  logging: "core", reminders: "core",
  recovery_mode_enabled: "recovery_plus",
  ai_pro: "athlete", protocol_pro: "athlete", recovery_pro: "athlete",
  trends: "athlete", competition: "athlete", city_compete: "athlete",
  team_compete: "athlete", premium_notif: "athlete",
  metabolic_readiness: "athlete",
  product_sub: "system", preferred_pricing: "system", priority_ai: "system",
  protocol_tune: "system", premium_insights: "system", system_recs: "system",
  guardian_consumer: "elite", analytics_premium: "elite", full_bundle: "elite",
  early_access: "elite", concierge: "elite",
  roster_core: "team_starter", group_reports: "team_starter",
  protocol_templates: "team_starter", admin_console: "team_starter",
  invite_codes: "team_starter", seat_basic: "team_starter",
  analytics_expanded: "team_growth", multi_group: "team_growth",
  reporting_deep: "team_growth", admin_enhanced: "team_growth",
  team_insights_pro: "team_pro", priority_support: "team_pro",
  reporting_elevated: "team_pro", visibility_enhanced: "team_pro",
  clutch_grid: "clutch_starter", realtime_layer: "clutch_starter",
  heat_basic: "clutch_starter", team_visibility: "clutch_starter",
  live_support: "clutch_starter",
  heat_advanced: "clutch_pro", auto_replenish: "clutch_pro",
  command_expanded: "clutch_pro", live_mgmt: "clutch_pro",
  clutch_clip: "clutch_elite", command_full: "clutch_elite",
  control_elite: "clutch_elite", support_premium: "clutch_elite",
  risk_score: "guardian_core", risk_basic: "guardian_core",
  early_warning: "guardian_core", team_risk_mon: "guardian_core",
  recovery_escal: "guardian_core",
  body_map: "guardian_elite", critical_alert: "guardian_elite",
  medical_escal: "guardian_elite", risk_advanced: "guardian_elite",
  deployment_elite: "guardian_elite",
};

/**
 * Strict server-side has-feature check. Unknown plan, unknown feature,
 * or non-entitling status all return false — never fall open.
 */
export function planGrantsFeature(
  planId: string,
  status: string,
  featureId: string,
): boolean {
  if (!ENTITLING_STATUSES.has(status)) return false;
  const features = PLAN_FEATURES[planId];
  if (!features) return false;
  return features.includes(featureId);
}
