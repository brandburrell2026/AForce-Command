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

  // Phase 10 — Investor Demo. OFF in the production binary: the 60-second
  // cinematic overlay can NEVER mount in a public build. Flip ON only in
  // DEMO_ALL_ON / internal pitch builds. Seeded from data/demoProfile.ts;
  // Score-Protection (never mutates score or live store).
  demo_mode_enabled: false,

  // Competition (Sport mode) — on by default for the demo
  city_competition_enabled: true,
  state_competition_enabled: true,
  team_competition_enabled: true,
  global_leaderboard_enabled: true,

  // Athlete tier — Metabolic Readiness. Ships OFF in production; the
  // glucose lane stays OFF everywhere (engine-only, no UI yet).
  metabolic_readiness_enabled: false,
  metabolic_glucose_enabled: false,
  performance_age_enabled: false,
  voice_checkin_enabled: false,
  // Intent Capture™ — Ready / Recovering / Not Today after the Voice Check-In,
  // adjusting coach tone/intensity (copy only). Ships OFF in prod, ON in DEMO.
  // Score-Protection: never awards or mutates score.
  intent_capture_enabled: false,
  // Performance Statements™ — once-per-local-day voice-only coach identity
  // line. Ships OFF in prod, ON in DEMO. Score-Protection: audio-only.
  performance_statements_enabled: false,

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
  spec_social: true,
  spec_sleep: false,
  spec_cruise: false,
  spec_coachV2: true,
  spec_premium: false,
  spec_inventory: false,
  spec_phantom: false,
  spec_enterprise: false,
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
  spec_sharedContextLayer: true,
  spec_uiFreeze: true,

  // Recovery Layer — hidden engine. Phase 1 build, no visible surfaces.
  // Stays OFF in DEFAULT_FLAGS so the production binary cannot expose
  // it ahead of internal-preview readiness (Phase 2 in the spec).
  spec_recovery: false,

  // Hydration Demand Engine™ — pure module, not consumed by any
  // visible surface yet. Build 100%, show 0%. Flip ON in DEMO_ALL_ON
  // for internal inspection.
  spec_demand_engine: false,

  // HydroScan 2.0™ — profile-aware scan surfaces (Impact + Timing +
  // consumption prompt + unknown-product flow + local history). Build
  // 100% · Show 10%: OFF in the production binary, ON in DEMO_ALL_ON.
  hydro_scan_2_enabled: false,

  // Location Intelligence™ — headless location-context engine (GPS /
  // time zone / altitude / temperature / humidity / UV / air quality /
  // travel detection). Build 100% · Show 10%: OFF in the production
  // binary, ON in DEMO_ALL_ON. Advisory only (Score-Protection).
  location_intelligence_enabled: false,

  // Signal Hierarchy™ — deterministic per-source priority resolution
  // (Sleep / Heart Rate / Activity / Hydration Verification). Replaces
  // freshest-wins for source selection. Build 100% · Show 10%: OFF in the
  // production binary, ON in DEMO_ALL_ON. OFF ⇒ freshest-wins stays live.
  signal_hierarchy_enabled: false,

  // Weekly Performance Report™ — once-per-week (Sunday) shareable recap
  // (What improved / What needs attention / Performance Age movement /
  // Habit Velocity / Recovery trend / Top command / Next week focus).
  // Build 100% · Show 10%: OFF in the production binary, ON in DEMO_ALL_ON.
  // Score-Protection: read-only projection; sections without data render
  // explicit "collecting"/"awaiting", never fabricated trends.
  spec_weekly_report: false,

  // Score-from-Ledger Hybrid — Tier-1 score-integration seam (P2b). OFF in
  // prod AND demo: shadow-compare only until contribution-level parity is
  // proven. Currently a verified no-op (fails closed to live on every score
  // family). Score-Protection: projection of completed behaviour, never scores.
  scoreFromLedgerHybrid: false,

  // Evidence Engine™ — headless "Why this command" explainability layer.
  // Build 100% · Show 10%: OFF in the production binary so the AICommandCard
  // surface stays byte-identical, ON in DEMO_ALL_ON for internal inspection.
  // Score-Protection: read-only projection of the engine's own inputs; never
  // reads into / awards / mutates / fabricates score.
  evidence_engine_enabled: false,

  // Command Confidence™ — STEP 2 per-category adaptive learning. The ledger
  // always RECORDS real confirmations; this flag only gates whether the learned
  // per-category completion rate may influence command SELECTION / timing /
  // priority (never score, never ahead of Water-First). OFF in production, ON in
  // DEMO_ALL_ON. Score-Protection: selection-only, never awards/mutates score.
  command_confidence_adaptive_enabled: false,

  // Performance Memory™ — STEP 3 execution-memory expansion. Additive,
  // read-only command-completion recap (execution streak / recent follow-rate
  // + trend) read from the same ledger. OFF in the production binary so the
  // surface stays byte-identical, ON in DEMO_ALL_ON for internal inspection.
  // Score-Protection: surface-only — follow-rate is shown, never fed into
  // deriveCommandConfidence and never used to award/mutate score.
  performance_memory_execution_enabled: false,
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
  metabolic_readiness_enabled: true,
  metabolic_glucose_enabled: false,
  performance_age_enabled: true,
  voice_checkin_enabled: true,
  intent_capture_enabled: true,
  performance_statements_enabled: true,
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
  spec_sharedContextLayer: true,
  spec_uiFreeze: true,
  // Demo profile lights the hidden Recovery engine so internal viewers
  // can inspect outputs via dev tools even before any visible surface
  // consumes them.
  spec_recovery: true,
  spec_demand_engine: true,
  hydro_scan_2_enabled: true,
  location_intelligence_enabled: true,
  signal_hierarchy_enabled: true,
  spec_weekly_report: true,
  // Stays OFF even in the demo profile: enabling a "score from ledger" path
  // before contribution-level parity is proven could misrepresent the score.
  scoreFromLedgerHybrid: false,

  // Evidence Engine™ — ON in the demo profile so internal viewers can inspect
  // the "Why this command" explainability surface. Read-only / Score-Protected.
  evidence_engine_enabled: true,

  // Command Confidence™ — STEP 2 adaptive learning ON for internal inspection.
  command_confidence_adaptive_enabled: true,

  // Performance Memory™ — STEP 3 execution-memory recap ON for internal inspection.
  performance_memory_execution_enabled: true,

  // Phase 10 — Investor Demo overlay is ON in the internal/pitch profile.
  demo_mode_enabled: true,
};

export function isFlagEnabled(flags: FeatureFlags, key: keyof FeatureFlags): boolean {
  return Boolean(flags[key]);
}

/**
 * Phase 10 Investor Demo gate. The 60-second cinematic overlay is the ONLY
 * surface whose visibility is controlled solely by `demo_mode_enabled`.
 *
 * Pure predicate so the gate is unit-testable without React Native. It fails
 * closed: if `demo_mode_enabled` is falsy (the production default) the overlay
 * can never render, no matter what `active` is. `active` is the local
 * play/dismiss trigger (store `isInvestorDemoActive`).
 */
export function shouldShowInvestorDemo(flags: FeatureFlags, active: boolean): boolean {
  return Boolean(flags.demo_mode_enabled) && active;
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
