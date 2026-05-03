/**
 * AForce OS Feature Flags
 * Phase 1 (Core) is on by default.
 * Phase 2 (Clutch) and Phase 3 (Guardian) are gated behind flags but demo-ready.
 *
 * In production these would be driven by a remote config / entitlements service
 * (e.g. tied to subscription tier). For demo, an admin toggle in Profile flips them.
 */

import type { FeatureFlags } from '../types';

export const DEFAULT_FLAGS: FeatureFlags = {
  // Phase 2 — Clutch Access (Command the Team)
  clutch_access_enabled: false,
  clutch_heat_mode_enabled: false,
  clutch_inventory_enabled: false,
  clutch_clip_enabled: false,

  // Phase 3 — Guardian Intelligence (Protect the Roster)
  guardian_intelligence_enabled: false,
  guardian_body_map_enabled: false,
  guardian_alerts_enabled: false,

  // Hardware
  phantom_wearable_enabled: false,
  ring_enabled: false,

  // Future
  kids_world_enabled: false,

  // Competition (Sport mode) — on by default for the demo
  city_competition_enabled: true,
  state_competition_enabled: true,
  team_competition_enabled: true,
  global_leaderboard_enabled: true,

  // Enterprise — Cruise Mode (premium add-on)
  cruise_mode_enabled: false,
};

/**
 * Demo profile that lights everything up so investors / coaches can preview the
 * full Clutch + Guardian product stack.
 */
export const DEMO_ALL_ON_FLAGS: FeatureFlags = {
  clutch_access_enabled: true,
  clutch_heat_mode_enabled: true,
  clutch_inventory_enabled: true,
  clutch_clip_enabled: true,
  guardian_intelligence_enabled: true,
  guardian_body_map_enabled: true,
  guardian_alerts_enabled: true,
  phantom_wearable_enabled: true,
  ring_enabled: true,
  kids_world_enabled: false,
  city_competition_enabled: true,
  state_competition_enabled: true,
  team_competition_enabled: true,
  global_leaderboard_enabled: true,
  cruise_mode_enabled: true,
};

export function isFlagEnabled(flags: FeatureFlags, key: keyof FeatureFlags): boolean {
  return Boolean(flags[key]);
}
