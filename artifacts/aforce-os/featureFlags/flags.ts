/**
 * AForce OS Feature Flags
 * Phase 1 (Core) is on by default.
 * Phase 2 (Clutch) and Phase 3 (Guardian) are gated behind flags but demo-ready.
 *
 * In production these would be driven by a remote config / entitlements service
 * (e.g. tied to subscription tier). For demo, an admin toggle in Profile flips them.
 */

import type { FeatureFlags, SpecFlagName } from '../types';

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

  // Enterprise — Cruise Mode (premium add-on). Per spec: master switch
  // is ON for internal builds, OFF for the public production binary.
  // Each Phase 2/3 sub-feature ships OFF by default and lights up on
  // its own staged release; see Release Plan in REPLIT.md / spec.
  cruise_mode_enabled: true,
  cruise_journey_pulse_enabled: false,
  cruise_commerce_enabled: false,
  cruise_inventory_enabled: false,
  cruise_stateroom_delivery_enabled: false,
  cruise_pre_port_enabled: false,
  cruise_excursion_readiness_enabled: false,

  // UX — on-screen Voice Engine status footer. Hidden by default while we
  // declutter the home surface; audio engine (ElevenLabs + Expo Speech),
  // score-band triggers, and InvestorDemoOverlay all keep functioning.
  voice_status_module_visible: false,

  // Sleep Mode — Phase 1. Internal: true, Public: false per spec. The
  // build switches this manually before cutting a public release.
  sleep_mode_enabled: true,

  // ─── Spec v18 (Rule #17) ─── Values match the spec verbatim. These
  // gate NEW architecture work added in later spec rules; existing
  // visible surfaces stay governed by their pre-existing flags above.
  spec_activation: true,
  spec_social: false,
  spec_sleep: false,
  spec_cruise: false,
  spec_coachV2: false,
  spec_premium: false,
  spec_inventory: false,
  spec_phantom: false,
  spec_enterprise: false,
  spec_language_ar: false,
  spec_language_zh: false,
  spec_language_ja: false,
  spec_language_ko: false,
  spec_language_hi: false,
  spec_recoveryCircle: false,
  spec_notifications: false,
  spec_orb: true,
  spec_timelineLock: true,
  spec_hydroJournal: true,
  spec_hydroScan: true,
  spec_profileSource: true,
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
  cruise_journey_pulse_enabled: true,
  cruise_commerce_enabled: true,
  cruise_inventory_enabled: true,
  cruise_stateroom_delivery_enabled: true,
  cruise_pre_port_enabled: true,
  cruise_excursion_readiness_enabled: true,
  voice_status_module_visible: true,
  sleep_mode_enabled: true,

  // Spec v18 — demo profile turns on every spec flag EXCEPT the hidden
  // languages. Those JSON resource files don't exist yet (Rule #16
  // creates them); flipping them on now would crash i18next on lookup.
  spec_activation: true,
  spec_social: true,
  spec_sleep: true,
  spec_cruise: true,
  spec_coachV2: true,
  spec_premium: true,
  spec_inventory: true,
  spec_phantom: true,
  spec_enterprise: true,
  spec_language_ar: false,
  spec_language_zh: false,
  spec_language_ja: false,
  spec_language_ko: false,
  spec_language_hi: false,
  spec_recoveryCircle: true,
  spec_notifications: true,
  spec_orb: true,
  spec_timelineLock: true,
  spec_hydroJournal: true,
  spec_hydroScan: true,
  spec_profileSource: true,
};

export function isFlagEnabled(flags: FeatureFlags, key: keyof FeatureFlags): boolean {
  return Boolean(flags[key]);
}

/**
 * Ergonomic read for spec v18 flags. Mirrors the spec document so
 * callers can write `getSpecFlag(flags, 'activation')` instead of
 * the prefixed `flags.spec_activation`. Useful when porting copy
 * directly from the 18-rule spec into code.
 */
export function getSpecFlag(flags: FeatureFlags, name: SpecFlagName): boolean {
  return Boolean(flags[`spec_${name}` as keyof FeatureFlags]);
}
