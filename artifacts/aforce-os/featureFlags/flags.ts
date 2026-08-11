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
  // Offline Intake Outbox — durable offline log queue + replay. Ships OFF in
  // prod so logIntake keeps its exact online-only path (byte-identical no-op),
  // ON in DEMO. Score-Protection: replays frozen scores, server dedupes.
  offline_intake_outbox_enabled: false,
  // Lock §7 / RC-L11 — profile server rehydration + reconnect flush. OFF
  // until the physical-device reinstall gate passes (PASS-3 plan, slice 2).
  profile_server_hydration_enabled: false,
  // App Store 3.1.1 posture — iOS in-app Stripe checkout OFF until counsel
  // clears the external-purchase-link path; iOS points to drinkaforce.com
  // (the web->app entitlement bridge unlocks the account automatically).
  ios_direct_checkout_enabled: false,

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
  // Night Out Protocol — Founder/Internal Preview only (NO-10). OFF in prod.
  night_out_enabled: false,
  spec_sleep: false,
  // Sleep Mode premium redesign — LAUNCHED (go-live flip 2026-08-03, PR #455
  // hardening complete). Legacy screen remains reachable by forcing this
  // flag false; it is deleted in a separate post-soak cleanup PR.
  spec_sleep_v2: true,
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

  // Section 58 — Command Confidence Display™: the badge on the NEW surfaces.
  // LIVE (founder release 2026-07-18): shows the (display-only, non-tappable)
  // Command Confidence badge on the Recovery Window / Social banner
  // (SocialModeBanner) and Cruise (CruiseModeScreen). HydroScan Fit's badge is
  // already lit + tappable via spec_confidenceDetailSheet; this flag is redundant
  // there (no change). Today's Command shows confidence unflagged.
  spec_commandConfidenceDisplay: true,

  // §55/Show-10 — Profile Strength section (completeness chip). Additive,
  // presentational, OFF by default. Show-10.
  spec_profileStrengthSection: false,

  // Show-10 — DATA BEHIND THIS tap-through sheet (§53/§54/§58 rows, no §56).
  // LIVE on HydroScan Fit (founder release 2026-07-18): flipping this ON makes
  // ProductFitCard's Command Confidence badge tappable → the sheet, WITHOUT
  // touching the shared spec_commandConfidenceDisplay (so Social/Cruise stay
  // dark). Today's Command's trigger is unmounted, so it's unaffected here.
  spec_confidenceDetailSheet: true,

  // Recovery Layer — hidden engine. Phase 1 build, no visible surfaces.
  // Stays OFF in DEFAULT_FLAGS so the production binary cannot expose
  // it ahead of internal-preview readiness (Phase 2 in the spec).
  spec_recovery: false,
  spec_hydration: true,
  spec_recoveryCoach: false,
  spec_protocol: true,

  // Hydration Demand Engine™ — pure module, not consumed by any
  // visible surface yet. Build 100%, show 0%. Flip ON in DEMO_ALL_ON
  // for internal inspection.
  spec_demand_engine: false,

  // §56/§20 — route the §20 Body Recalibration targets into the Demand Engine
  // snapshot. Build 100 / Show 0. Default OFF; the flip to live is gated on
  // performance-scientist coefficient sign-off (sodium ceiling, under_18, copy).
  spec_section20_calibration: false,

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

  // Home V2 switch — ON in production: HomeScreenV2 is the shipped Home
  // (app/(tabs)/index.tsx renders V2 XOR legacy on this flag; the legacy
  // zones are unreachable while this is true — see HomeScreenV2's header).
  // RC-1 r3 note: the Weekly-recap doc comment that previously sat here
  // described a different flag and was re-homed above spec_weekly_report.
  spec_home: true,
  // Elite Home (E1) — presentation-only elevation of HomeScreenV2. OFF in the
  // production binary, ON in DEMO_ALL_ON. Score-Protection: band-tint / reveal /
  // count-up / ordering only; never reads into or mutates score, command,
  // eligibility, timing, or safety. Reduced-motion → static Home.
  elite_home_experience_enabled: false,
  // Home V3 dashboard (founder comps, 2026-08-10) — flag-gated ADDITIVE
  // sections inside HomeScreenV2: health-connection chip, four live-signal
  // tiles (Hydration / Recovery / Sleep / HRV), the derived Completed-today
  // protocol list, and streak/trend stat tiles. Honest-data rules: every value
  // comes from existing store state (engine, userState, biometrics arbitration
  // via explainFieldArbitration — the scoring path's own winner); tiles with no
  // data show an em dash, never an invented number; protocol rows show period
  // labels (Morning/Midday/Evening), never fabricated clock times. Presentation
  // only — no new store hooks, no scoring/command/timing reads beyond what
  // HomeScreenV2 already performs. OFF in production; ON in DEMO_ALL_ON.
  // Production flip is a founder release decision by precedent.
  home_v3_dashboard_enabled: false,
  // Protocol V3 dashboard (founder comps, 2026-08-11) — flag-gated ADDITIVE
  // sections inside ProtocolScreenV2: stage hero (protocol-completion ring +
  // streak + next recheck), hydration progress (real oz), completed-today
  // list (derived steps, window labels — never fabricated amounts), and
  // HR/HRV recovery signals via the scoring path's own arbitration winner.
  // Honest-data rules identical to home_v3_dashboard_enabled. Presentation
  // only. OFF in production; ON in DEMO_ALL_ON. Production flip is a founder
  // release decision by precedent.
  protocol_v3_dashboard_enabled: false,
  // Weekly Report V2 switch — ON in production: routes /weekly-report to
  // ReadinessInsightsV2. When OFF, the legacy once-per-week shareable recap
  // renders (What improved / What needs attention / Performance Age movement /
  // Habit Velocity / Recovery trend / Top command / Next week focus).
  // Score-Protection: read-only projection; sections without data render
  // explicit "collecting"/"awaiting", never fabricated trends.
  spec_weekly_report: true,
  // Elite Weekly Report (E2) — editorial elevation of Readiness Insights. OFF in
  // production, ON in DEMO_ALL_ON. Score-Protection: reuses the honest
  // buildWeeklyReport model; sections without data render explicit
  // calibrating/awaiting states, never a fabricated trend.
  elite_weekly_report_enabled: false,
  // Elite Motion (E3) — premium press-feel + shimmer skeletons where adopted.
  // OFF in production, ON in DEMO_ALL_ON. Presentation-only; every motion has a
  // static reduced-motion alternative (Score-Protection unaffected).
  elite_motion_enabled: false,
  // Elite Voice Coach (E4) — coach eyebrow/tone on the command + trust copy.
  // OFF in production, ON in DEMO_ALL_ON. Delivery-only: the phrasing adapter is
  // fail-safe + §64-guarded and never touches command/dose/timing/evidence.
  elite_voice_coach_enabled: false,
  // ── Phase 3 redesign — one flag per redesigned screen, default OFF until go-live ──
  spec_community: true,
  spec_store: true,
  spec_share: true,
  spec_urine: true,
  spec_scan: true,
  spec_sweat: true,
  spec_profile: true,
  spec_onboarding: true,
  spec_cart: true,
  spec_subscription: true,
  spec_manageSub: true,
  spec_leaderboard: true,
  spec_achievements: true,
  spec_notifScreen: true,
  spec_science: true,
  spec_legal: true,
  spec_sensors: true,
  spec_auth: true,

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

  // Section 59 — Adaptive Response Engine™. Personal Response Library exposure.
  // OFF in production; the engine always derives (pure, observational). ON in DEMO.
  adaptive_response_enabled: false,

  // Section 60 — Response Timeline™ query layer. OFF in production; also
  // data-gated (~60–90 days of history) before any consumer surfaces it.
  response_timeline_enabled: false,

  // Section 61 — Living Performance Model™ daily-lesson exposure. OFF in
  // production; the model always derives (pure, observational). ON in DEMO.
  living_performance_enabled: false,

  // Section 64 — Conversational Intelligence™ policy activation for the AI Coach.
  // OFF in production; the policy is pure/observational and always safe to run.
  conversational_intelligence_enabled: false,

  // Performance Memory™ — STEP 3 execution-memory expansion. Additive,
  // read-only command-completion recap (execution streak / recent follow-rate
  // + trend) read from the same ledger. OFF in the production binary so the
  // surface stays byte-identical, ON in DEMO_ALL_ON for internal inspection.
  // Score-Protection: surface-only — follow-rate is shown, never fed into
  // deriveCommandConfidence and never used to award/mutate score.
  performance_memory_execution_enabled: false,

  // Performance Memory™ — governance VIEW (Profile card + real delete).
  // OFF in production so the surface stays byte-identical; capture itself is
  // always-on and unaffected by this flag. Score-Protection: display + delete
  // only, never awards/reads-into/mutates score.
  performance_memory_governance_enabled: false,

  // Performance Identity™ — Phase 2 foundation. Internal raw-signal readout
  // (the behavioural signals a future archetype classifier would read). The
  // classifier is INERT: archetype + confidence are always null, ZERO
  // archetype-assignment logic. OFF in the production binary; ON in
  // DEMO_ALL_ON for internal inspection. Score-Protection: read-only.
  performance_identity_enabled: false,

  // HealthKit native module gate — OFF in the production binary for the iOS
  // launch-crash isolation build. RULING B PREREQUISITE (RC-2) fixed this
  // comment's stale claim: @kingstinct/react-native-healthkit (package.json:83)
  // and react-native-nitro-modules (package.json:101) ARE present as JS
  // dependencies — they were re-added as the first step of the HealthKit
  // bridge re-enable (see services/appleHealth.ts's loadHealthKit() header).
  // What's still true is that the NATIVE side is unlinked in shipped
  // binaries: no pod install / native build has wired the Nitro module into
  // a production binary, so even with the deps present, the dynamic import
  // in appleHealth.ts never resolves unless a native build actually links
  // them. `healthkit_native_enabled` is the compile-time/runtime gate that
  // keeps this OFF regardless of dep presence. Native linking + activation
  // is tracked separately as D-6 (pending) — flipping this flag alone is
  // not sufficient; a native build with the module actually linked is
  // required first. Independent of metabolic_readiness_enabled.
  healthkit_native_enabled: false,

  // Health-platform integration gates — all OFF in the production binary until
  // each provider's credentials/approval land. When OFF (or not yet available)
  // the HEALTH PLATFORMS screen shows an honest status, never a fake connection.
  health_apple_enabled: false,
  health_google_connect_enabled: false,
  health_whoop_enabled: false,
  health_oura_enabled: false,
  health_strava_enabled: false,
  health_garmin_enabled: false,
  health_samsung_direct_enabled: false,
  health_demo_data_enabled: false,
  health_canonical_consumers: false,

  // Native Liquid Glass tabs gate — OFF. On iOS 26 the native tab bar
  // (expo-router/unstable-native-tabs -> RNScreens RNSTabBarController) throws
  // a void NSException at startup, crashing Release/TestFlight builds
  // (react-native-screens #3940). False routes iOS 26 to the JS ClassicTabLayout.
  // Flip true to restore native tabs once the upstream fix is confirmed.
  native_tabs_enabled: false,

  // Native screens master gate — OFF. When false the app calls
  // enableScreens(false) at init, bypassing the entire react-native-screens
  // native surface (the maintainer-documented #3940 workaround for the iOS 26
  // startup void NSException), keeping Release/TestFlight builds launchable at
  // the cost of native-screen perf. Flip true once the upstream fix lands.
  native_screens_enabled: false,

  // Crash-safe Clerk token cache — ON by default (the guard is engaged). When
  // true the app passes a fully-guarded custom tokenCache to ClerkProvider
  // (every expo-secure-store call wrapped, no keychainAccessible:
  // AFTER_FIRST_UNLOCK) so the iOS keychain read at launch can't throw a native
  // NSException and crash the production build. Flip false to revert to
  // @clerk/expo's default tokenCache.
  secure_store_startup_guard: true,
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
  offline_intake_outbox_enabled: true,
  // Hydration restore is safe to demo (deterministic, never overwrites), but
  // keep it OFF here too until the reinstall release-gate passes — demo builds
  // must never be the first place a persistence path runs.
  profile_server_hydration_enabled: false,
  // Demo builds show the full checkout flow (no real purchase possible —
  // the API 401s in demo); the App Store posture applies to store builds.
  ios_direct_checkout_enabled: true,
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
  // Night Out Protocol (NO-10) is a RESTRICTED internal-preview flag: it is
  // deliberately OFF even in the generic demo "unlock all" set. `DEMO_ALL_ON_FLAGS`
  // is demo *presentation* capability, NOT authorization — it must never grant
  // Night Out. The generic client unlock applies `demoUnlockAllFlags()` (below),
  // which force-clamps every INTERNAL_PREVIEW_RESTRICTED_FLAGS entry to false.
  // Night Out is enabled only through an approved internal-preview context
  // (env-driven DEMO_MODE) via `services/nightOut/access.ts`.
  night_out_enabled: false,
  spec_sleep: true,
  spec_sleep_v2: true,
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
  spec_commandConfidenceDisplay: true,
  spec_profileStrengthSection: true,
  spec_confidenceDetailSheet: true,
  // Demo profile lights the hidden Recovery engine so internal viewers
  // can inspect outputs via dev tools even before any visible surface
  // consumes them.
  spec_recovery: true,
  spec_recoveryCoach: true,
  spec_protocol: true,
  spec_hydration: true,
  spec_demand_engine: true,
  spec_section20_calibration: true,
  hydro_scan_2_enabled: true,
  location_intelligence_enabled: true,
  signal_hierarchy_enabled: true,
  spec_home: true,
  elite_home_experience_enabled: true,
  home_v3_dashboard_enabled: true,
  protocol_v3_dashboard_enabled: true,
  spec_weekly_report: true,
  elite_weekly_report_enabled: true,
  elite_motion_enabled: true,
  elite_voice_coach_enabled: true,
  // ── Phase 3 redesign ──
  spec_community: true,
  spec_store: true,
  spec_share: true,
  spec_urine: true,
  spec_scan: true,
  spec_sweat: true,
  spec_profile: true,
  spec_onboarding: true,
  spec_cart: true,
  spec_subscription: true,
  spec_manageSub: true,
  spec_leaderboard: true,
  spec_achievements: true,
  spec_notifScreen: true,
  spec_science: true,
  spec_legal: true,
  spec_sensors: true,
  spec_auth: true,
  // Stays OFF even in the demo profile: enabling a "score from ledger" path
  // before contribution-level parity is proven could misrepresent the score.
  scoreFromLedgerHybrid: false,

  // Evidence Engine™ — ON in the demo profile so internal viewers can inspect
  // the "Why this command" explainability surface. Read-only / Score-Protected.
  evidence_engine_enabled: true,

  // Command Confidence™ — STEP 2 adaptive learning ON for internal inspection.
  command_confidence_adaptive_enabled: true,

  // Section 59 — Adaptive Response Engine™ ON for internal inspection.
  adaptive_response_enabled: true,

  // Section 60 — Response Timeline™ ON for internal inspection.
  response_timeline_enabled: true,

  // Section 61 — Living Performance Model™ ON for internal inspection.
  living_performance_enabled: true,

  // Section 64 — Conversational Intelligence™ ON for internal inspection.
  conversational_intelligence_enabled: true,

  // Performance Memory™ — STEP 3 execution-memory recap ON for internal inspection.
  performance_memory_execution_enabled: true,

  // Performance Memory™ — governance VIEW ON for internal inspection.
  performance_memory_governance_enabled: true,

  // Performance Identity™ — Phase 2 raw-signal readout ON for internal
  // inspection. Classifier stays INERT (archetype + confidence always null).
  performance_identity_enabled: true,

  // Phase 10 — Investor Demo overlay is ON in the internal/pitch profile.
  demo_mode_enabled: true,

  // Stays OFF even in the demo profile for this isolation build. RULING B
  // PREREQUISITE (RC-2) fixed this comment's stale claim: the HealthKit/Nitro
  // deps are NOT removed from package.json — @kingstinct/react-native-healthkit
  // (package.json:83) and react-native-nitro-modules (package.json:101) are
  // both present. The native side is unlinked in shipped binaries (no native
  // build has wired the module in), which is what actually keeps this
  // inert regardless of profile; `healthkit_native_enabled` is the
  // compile-time/runtime gate on top of that. Native linking + activation is
  // tracked separately as D-6 (pending).
  healthkit_native_enabled: false,

  // Health-platform gates in the investor/demo build: the per-provider ENABLE
  // gates stay OFF (they aren't really credentialed — an honest demo never
  // claims a live connection), but the LABELED demo-data flag is ON so the
  // wearable cards populate with clearly-marked "DEMO DATA" snapshots.
  health_apple_enabled: false,
  health_google_connect_enabled: false,
  health_whoop_enabled: false,
  health_oura_enabled: false,
  health_strava_enabled: false,
  health_garmin_enabled: false,
  health_samsung_direct_enabled: false,
  health_demo_data_enabled: true,
  health_canonical_consumers: false,

  // Stays OFF even in the demo profile: native tabs are crash-disabled on
  // iOS 26 (react-native-screens #3940), not a demo toggle.
  native_tabs_enabled: false,

  // Stays OFF even in the demo profile: native screens are crash-disabled on
  // iOS 26 (react-native-screens #3940), not a demo toggle.
  native_screens_enabled: false,

  // Crash-safe Clerk token cache stays ON in the demo profile too — it's a
  // launch-safety guard, not a demo toggle.
  secure_store_startup_guard: true,
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

/**
 * Restricted internal-preview flags (NO-10 · founder decision). These are
 * Founder/Internal Preview only and MUST NOT be enabled by the generic
 * client-side "unlock all" developer action — that action is production-reachable
 * (Phase-0 SS-01) and is not an authorization boundary. Enablement happens only
 * through an approved internal-preview context (`services/nightOut/access.ts`),
 * and ultimately server-side authorization.
 */
export const INTERNAL_PREVIEW_RESTRICTED_FLAGS = ['night_out_enabled'] as const;

/**
 * Payload for the developer "unlock all" control. Returns the demo-presentation
 * flag set with every restricted internal-preview flag force-clamped to `false`,
 * so the generic client unlock can NEVER enable a restricted capability —
 * regardless of what `DEMO_ALL_ON_FLAGS` contains. Pure + testable; the `base`
 * param lets tests prove the clamp holds even against a base that (incorrectly)
 * sets a restricted flag true.
 */
export function demoUnlockAllFlags(base: FeatureFlags = DEMO_ALL_ON_FLAGS): FeatureFlags {
  const out: FeatureFlags = { ...base };
  for (const k of INTERNAL_PREVIEW_RESTRICTED_FLAGS) {
    out[k] = false;
  }
  return out;
}
