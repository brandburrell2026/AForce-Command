// Core TypeScript types for AForce OS

import type { RecoveryCapacityScore } from '../services/recoveryCapacity';

export type PerformanceLevel = 'PEAK' | 'BALANCED' | 'RECOVERING' | 'DEPLETED';

// ─── Products ─────────────────────────────────────────────────────────────────
export type FluidType =
  | 'water'
  | 'aforce_stick'
  | 'aforce_rtd'
  | 'aforce_canister'
  | 'aforce_bulk_bag';

export type ProductFlavor = 'watermelon' | 'berry' | 'soursop' | 'unflavored';

export interface ProductType {
  fluidType: FluidType;
  name: string;
  shortName: string;
  ozPerServing: number;
  hydrationImpact: number; // score impact per unit logged
  description: string;
  image?: any; // require()'d image
  flavor?: ProductFlavor;
}

// ─── Intake Events ────────────────────────────────────────────────────────────
/**
 * A single intake log used by the hydration scoring engine. Persisted
 * in `aforce_user_state.intake_events` JSONB (rolling 24h window).
 * Each event carries its own pre-computed impact decomposition so the
 * materialized score is reproducible without re-running the scoring
 * service over the full history.
 */
export interface IntakeEvent {
  id: string;
  fluidType: FluidType;
  flavor?: ProductFlavor;
  /**
   * Optional drink-catalog category (e.g. 'coffee', 'soda', 'juice'). When
   * present, drives the Acidic Load / Stimulant Load personalization
   * signals — the engine can't otherwise tell coffee from water because
   * the underlying FluidType is the same. Backward-compatible: events
   * persisted before this field existed simply contribute zero load.
   */
  categoryId?: string;
  oz: number;
  loggedAt: Date;
  /** Raw flavor / oz score before the 20-min absorption cap. */
  baseImpact: number;
  /** After cap. immediate + delayed = capAdjusted. */
  capAdjusted: number;
  immediate: number;
  delayed: number;
  delayedDurationMin: number;
  /** True if Heat Guard band was WARNING+ when logged (audit trail). */
  heatGuardActiveAtLog: boolean;
  /** Score before the event — used for Soursop bonus reproducibility. */
  scoreBeforeAtLog: number;
}

// ─── User / State ─────────────────────────────────────────────────────────────
export interface UserState {
  unitsConsumedToday: number;
  ozConsumedToday: number;
  /**
   * AForce-format intakes today (stick / RTD / canister / bulk_bag).
   * Drives the "AForce protocol bonus" in the scoring engine so picking
   * an AForce product visibly out-scores plain water.
   */
  aforceUnitsToday: number;
  /**
   * Per-event intake history (rolling 24h). Drives the new hydration
   * scoring engine — flavor-aware impacts, 20-min absorption cap,
   * delayed absorption curves. When empty (legacy state), the engine
   * falls back to the running-aggregate baseIntake formula.
   */
  intakeEvents?: IntakeEvent[];
  lastIntakeTime: Date;
  lastIntakeType: FluidType;
  symptomState: 'none' | 'mild' | 'moderate' | 'severe';
  symptoms: string[]; // active symptom ids
  urineSignal: number; // 1 (clear/optimal) - 8 (very dark)
  energyState: 'peak' | 'steady' | 'low' | 'crashed';
  heatLoad: number;
  sweatRate: number;
  activityLevel: number;
  complianceStreak: number;
  dailyTarget: number; // unit target
  ozTarget: number;
  isSnoozed: boolean;
  snoozeUntil: Date | null;
  bodyWeightLbs: number;
  // Sleep mode
  isAwake: boolean;
  wakeTime: Date | null;
  overnightLossOz: number;
  hasSeenMorningCommand: boolean;
  // Optional biometrics from Apple Health (only present after the
  // user grants permission on a native iOS build). Any null field is
  // ignored by the scoring engine — never substituted with placeholder
  // numbers. Also mirrored into `biometrics.apple_health` so the
  // multi-provider aggregator sees it alongside the other 6 platforms.
  appleHealth?: AppleHealthInputs;
  /**
   * Per-provider biometric snapshots from any of the 7 health
   * platforms in `data/healthProviders.ts` (Apple Health, Oura,
   * Samsung Health, Google Health Connect, Garmin, WHOOP, Strava).
   * Aggregated by `utils/biometricsAggregator.ts` into a single
   * recovery delta + inferred activity level that feed the score.
   */
  biometrics?: ProviderBiometrics;
  /**
   * Transient ±3 from the post-recheck "Did you follow the command?"
   * confirmation loop. Stale entries (>30 min old) are ignored by the
   * engine.
   */
  confirmationDelta?: number;
  confirmationDeltaSetAt?: Date;
  /**
   * When the user said "No" while in Clutch mode, decay gets a +0.5
   * pts/min boost until this time.
   */
  clutchDecayBoostUntil?: Date;
  /**
   * Mirrored from feature flags by the store. The engine itself can't
   * read flags, so the store sets this each time clutch_access_enabled
   * changes — it lets `computeDecayPerMinute` apply the ×1.3 spec
   * multiplier without drilling flags into the engine API.
   */
  clutchActive?: boolean;
  /**
   * Real-world weather (T6) — populated by the api-server's OpenWeather
   * lookup. When present the scoring engine uses these values instead of
   * the heatLoad-derived placeholders. Never substituted with placeholder
   * numbers when missing — the engine falls back gracefully.
   */
  weatherTempC?: number | null;
  weatherHumidity?: number | null;
  weatherCity?: string | null;
  weatherFetchedAt?: number | null;
  /**
   * Preferred UI language (ISO 639-1: en/es/fr/de/pt/it). Persisted
   * server-side; defaults to 'en' if absent. Drives both the i18next
   * resource bundle and the BCP-47 locale used for TTS.
   */
  language?: 'en' | 'es' | 'fr' | 'de' | 'pt' | 'it';
  /**
   * Social Mode — real-time alcohol mitigation + hydration control.
   * When `active` is true the engine swaps in the social coach command
   * set, applies an alcohol decay multiplier, and exposes a Hangover
   * Risk score in `engineOutput`. When inactive but `endedAt` is set
   * within the last 8h, the engine sits in Recovery Mode.
   */
  socialMode?: SocialModeState;
  /**
   * On-hand AForce inventory — gates the Sweat Intelligence Recovery
   * Protocol card so we only ever recommend what the user can actually
   * pour. When all three are zero the protocol surface flips to a
   * "restock" command. See services/recoveryProtocolService.ts.
   */
  inventory?: InventoryState;
}

/** ── Inventory ─────────────────────────────────────────────────────── */
export interface InventoryState {
  /** Single-serving sticks on hand. */
  sticks: number;
  /** Ready-to-drink cans on hand. */
  rtd: number;
  /** Canister scoops on hand. */
  canister: number;
}

// ─── Social Mode ──────────────────────────────────────────────────────────────
// All Social Mode types live in `./socialMode.ts` so the BAC engine,
// legal-safety service, and UI can import from a smaller surface.
// Re-exported here so existing call sites keep working.
export type {
  DrinkType,
  DrinkLog,
  SocialModeState,
  SocialContextSex,
  HangoverRiskLevel,
  HangoverRisk,
  BACEstimate,
  BACTrend,
  BACConfidence,
  ImpairmentRiskLevel,
  ImpairmentRiskState,
  TransportationSafetyPrompt,
  TransportationSeverity,
  RecoveryRecommendation,
} from './socialMode';
import type {
  HangoverRisk,
  BACEstimate,
  ImpairmentRiskState,
  TransportationSafetyPrompt,
  SocialModeState,
} from './socialMode';
import type { ProviderBiometrics } from './biometrics';

export interface AppleHealthInputs {
  restingHeartRate: number | null;
  hrvSdnn: number | null;
  stepsToday: number | null;
  sleepHoursLastNight: number | null;
  /** When the snapshot was last refreshed (epoch ms). */
  fetchedAt: number;
}

export type { ProviderSnapshot, ProviderBiometrics } from './biometrics';

export interface PerformanceState {
  level: PerformanceLevel;
  score: number;
  color: string;
  glowColor: string;
  urgency: 'calm' | 'moderate' | 'high' | 'critical';
  pulseSpeed: 'slow' | 'medium' | 'fast' | 'rapid';
  animationStyle: 'breathe' | 'pulse' | 'tension' | 'energize';
}

// ─── Pulse config (driven by mock API per spec) ───────────────────────────────
export type PulseStateName = 'PEAK' | 'BALANCED' | 'RECOVERING' | 'DEPLETED';
export type PulseWaveBehavior = 'sharp_outward' | 'steady_outward' | 'uneven_outward' | 'collapsing';
export type PulseColorMode = 'lime' | 'teal' | 'amber' | 'red';

export interface PulseConfig {
  pulseState: PulseStateName;
  pulseIntensity: number;   // 0-1
  pulseSpeed: number;       // 0.0 (slow) - 1.0 (fast)
  glowStrength: number;     // 0-1
  waveBehavior: PulseWaveBehavior;
  colorMode: PulseColorMode;
  deltaMode: 'rising' | 'falling' | 'steady';
  animations: {
    burstOnIntake: boolean;
    flareOnPeak: boolean;
    collapseOnDepletion: boolean;
  };
}

// ─── Score / Reasons / Command ────────────────────────────────────────────────
export interface ScoreReason {
  id: string;
  text: string;
  weight: 'positive' | 'negative' | 'neutral';
}

/**
 * Command Confidence™ — how grounded a command is, based purely on how much
 * real data backs it. Display-only; never affects the score.
 */
export type CommandConfidenceLevel = 'high' | 'medium' | 'low';

export interface Command {
  id: string;
  // WHAT+WHEN+OUTCOME format. Single decisive sentence.
  action: string;
  explanation: string;
  urgencyLevel: 'low' | 'medium' | 'high' | 'critical';
  estimatedImpact: string;
  /**
   * Command Confidence™ — set by the command engine from real-signal
   * completeness (logged behavior, fresh biometrics, fresh weather).
   * Optional so legacy / raw commands still type-check.
   */
  confidence?: CommandConfidenceLevel;
}

export interface RiskTimer {
  minutes: number;
  seconds: number;
  urgency: 'low' | 'medium' | 'high' | 'critical';
}

export interface ScoreContribution {
  id: string;
  label: string;
  // Negative = penalty. Positive = boost. Zero = neutral.
  delta: number;
  // Maximum possible magnitude this contribution can produce, for bar scaling.
  maxMagnitude: number;
  hint: string;
}

export interface ScoreEngineOutput {
  score: number;
  performanceState: PerformanceState;
  pulseConfig: PulseConfig;
  reasons: ScoreReason[];
  riskTimer: RiskTimer;
  command: Command;
  /** Full per-input contributions to the score. Drives the breakdown drill-in. */
  breakdown: ScoreContribution[];
  /** Continuous decay model output (per spec). */
  prediction: ScorePrediction;
  /**
   * Social Mode rollup. `null` when neither active nor in recovery
   * window — the UI hides every social surface in that case.
   *
   * `bac`, `impairment`, and `transportation` are always populated when
   * the rollup itself is non-null so the UI can render the BAC card,
   * impairment badge, and (conditionally) the legal-safety card without
   * having to build them from raw inputs.
   */
  social: {
    active: boolean;
    inRecoveryWindow: boolean;
    drinkCount: number;
    hangoverRisk: HangoverRisk;
    /** Alcohol decay multiplier currently applied (1 when none active). */
    alcoholMultiplier: number;
    /**
     * @deprecated BAC / impairment / transportation fields are scheduled
     * for removal in chunk #3c of the Master Update. The new
     * `recoveryCapacity` field below is the canonical replacement.
     * Kept temporarily so existing UI surfaces (BACEstimateCard,
     * SocialSafetyCard, ImpairmentRiskBadge) continue to render until
     * they are repurposed.
     */
    bac: BACEstimate;
    /** @deprecated see `recoveryCapacity`. */
    impairment: ImpairmentRiskState;
    /** @deprecated see `recoveryCapacity`. */
    transportation: TransportationSafetyPrompt;
    /**
     * Recovery Capacity Score — the AForce replacement for BAC math.
     * Always populated when the social rollup itself is non-null.
     * Computed by `services/recoveryCapacity.ts` from AutoPilot score,
     * hydration compliance, and environmental stress (60 / 25 / 15
     * weighting). See `services/recoveryCapacity.ts` for the formula.
     */
    recoveryCapacity: RecoveryCapacityScore;
    /**
     * Chunk #5: Cruise Mode currently active. While true, the post-
     * session recovery window is 24h instead of the default 8h.
     */
    cruiseActive: boolean;
    /**
     * Chunk #5: Voyage Shield currently active. While true, the
     * `recoveryCapacity.score` is floored at 60 (top of Stable band).
     * The underlying `contributions` still reflect the true components.
     */
    voyageShieldActive: boolean;
    /**
     * Effective recovery-window length in ms — equal to either
     * RECOVERY_WINDOW_MS (8h) or CRUISE_WINDOW_MS (24h) depending on
     * whether Cruise is active. The UI uses this to render an accurate
     * "time remaining" countdown.
     */
    windowMs: number;
  } | null;
}

export interface ScorePrediction {
  /** Points lost per minute at current weight / activity / heat / humidity. */
  decayPerMinute: number;
  /** Estimated minutes until score crosses into DEPLETED (≤40), or null if already there or decay is zero. */
  minutesToDepleted: number | null;
  /** Human-readable summary used by the prediction strip on Home. */
  label: string;
}

// ─── Intake / History / Cycle ─────────────────────────────────────────────────
export interface IntakeLog {
  id: string;
  fluidType: FluidType;
  ozAmount: number;
  loggedAt: Date;
  scoreBefore: number;
  scoreAfter: number;
}

export interface CycleResult {
  id: string;
  timestamp: Date;
  scoreBefore: number;
  scoreAfter: number;
  gainDisplay: string;
  identityMessage: string;
  nextCycleHint: string;
  state: PerformanceLevel;
}

export interface HistoryEntry {
  id: string;
  timestamp: Date;
  score: number;
  state: PerformanceLevel;
  action: string;
  unitsTaken: number;
  fluidType?: FluidType;
  /**
   * True for the synthetic baseline entry seeded on the first
   * `confirmStatus()` call so the journal chart has a "yesterday" anchor.
   * Excluded from PDF exports and the Protocol screen command history.
   */
  isSynthetic?: boolean;
  /**
   * Offline Intake Outbox marker (flag-gated). True for an intake that was
   * completed while the device was offline and is durably queued for replay —
   * the behaviour is real and counted, it just hasn't reached the server yet.
   * Always undefined on the online path, so online history entries stay
   * byte-identical. The outbox replay reconciles state without re-adding a
   * second entry, so this flag's only job is to drive the optional UI marker.
   */
  pending?: boolean;
}

// ─── Notifications (Settings) ─────────────────────────────────────────────────
export interface NotificationSettings {
  recheckReminders: boolean;
  scoreDecayAlerts: boolean;
  morningKickoff: boolean;
  circleActivity: boolean;
  challengeDeadlines: boolean;
  lowInventoryAlert: boolean;
}

export const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  recheckReminders: true,
  scoreDecayAlerts: true,
  morningKickoff: true,
  circleActivity: false,
  challengeDeadlines: true,
  lowInventoryAlert: false,
};

/** Key-of helper so the store + UI can iterate / address toggles by name. */
export type NotificationSettingKey = keyof NotificationSettings;

// ─── Profile / Subscription ───────────────────────────────────────────────────
/**
 * Auras express the user's current "energy mode" — a soft identity
 * signal shown on the premium profile card alongside their streak and
 * territory badge. Distinct from the engine's hydration state band
 * (PEAK / BALANCED / RECOVERING / DEPLETED), which is computed and
 * not user-selectable.
 */
export type AuraState = 'IGNITE' | 'FLOW' | 'STORM' | 'CALM' | 'APEX';

export interface UserProfile {
  /** Legal / display name (may be a real name or an alias the user picked). */
  name: string;
  /**
   * Short alias / handle shown under the display name on the premium
   * identity card. Examples from the brief: MiamiPulse, ApexFlow,
   * SurgeKing. Optional — the card falls back to just the name.
   */
  nickname?: string;
  /** City or territory the user reps (e.g. "Miami", "Brooklyn"). */
  city?: string;
  /** Country (2-letter code or display name, e.g. "USA"). */
  country?: string;
  /** Team / Circle affiliation shown as a chip on the identity card. */
  teamCircle?: string;
  /** Current consecutive-day streak — drives the flame chip. */
  streakDays?: number;
  /** Short territory badge label (e.g. "MIAMI HEAT ZONE", "BAY APEX"). */
  territoryBadge?: string;
  /** User-selected aura mode — see AuraState for the canonical set. */
  auraState?: AuraState;
  subscriptionTier:
    | 'core' | 'athlete' | 'system'
    | 'team_starter' | 'team_growth' | 'team_pro'
    | 'clutch_starter' | 'clutch_pro' | 'clutch_elite'
    | 'guardian_core' | 'guardian_elite'
    | 'all_access';
  dailyTarget: number;
  bodyWeightLbs: number;
  remindersEnabled: boolean;
  connectedDevices: string[];
  wakeTimeHHMM: string;
  activityType: string;
}

// ─── Feature Flags ────────────────────────────────────────────────────────────
export interface FeatureFlags {
  clutch_access_enabled: boolean;
  clutch_heat_mode_enabled: boolean;
  clutch_inventory_enabled: boolean;
  guardian_intelligence_enabled: boolean;
  guardian_body_map_enabled: boolean;
  guardian_alerts_enabled: boolean;
  phantom_wearable_enabled: boolean;
  ring_enabled: boolean;
  clutch_clip_enabled: boolean;
  kids_world_enabled: boolean;

  // Phase 10 — Investor Demo. SOLE control for the 60-second cinematic
  // overlay (`InvestorDemoOverlay`). Ships OFF in DEFAULT_FLAGS so the
  // overlay can never mount in a public/production build, ON in
  // DEMO_ALL_ON_FLAGS. The overlay is seeded entirely from
  // `data/demoProfile.ts` and never mutates score or live store
  // (Score-Protection).
  demo_mode_enabled: boolean;

  // Phase 3+ — Competition (Sport mode)
  city_competition_enabled: boolean;
  state_competition_enabled: boolean;
  team_competition_enabled: boolean;
  global_leaderboard_enabled: boolean;

  // Athlete tier — Metabolic Readiness (muscle + cognitive estimates).
  // Master switch for the Home surface; gated to the Athlete plan in the
  // entitlements layer. The glucose lane is engine-only (no UI yet).
  metabolic_readiness_enabled: boolean;
  metabolic_glucose_enabled: boolean;

  // Performance Age™ — derived, display-only headline ESTIMATE (in years)
  // of recent performance behaviour vs. actual age. Master switch for the
  // additive Home zone; ships OFF in prod (Build 100% · Show 10%). NOT
  // entitlement-gated — it is the primary consumer headline metric.
  performance_age_enabled: boolean;

  // Voice Check-In™ — Morning Calibration. Master switch for the
  // once-per-morning, coach-led 3-question ritual overlay and the two
  // additive Home surfaces it feeds (Brain Energy + Performance Memory).
  // Ships OFF in prod (Build 100% · Show 10%); ON in the demo profile.
  // Score-Protection: every consumer is a read-only projection of the
  // captured answers — nothing here awards or mutates score.
  voice_checkin_enabled: boolean;

  // Intent Capture™ — after the Voice Check-In the user declares Ready /
  // Recovering / Not Today; the selection adjusts the coach's tone & intensity
  // (display + spoken copy only). Ships OFF in prod (Build 100% · Show 10%);
  // ON in the demo profile. Score-Protection: the captured intent only varies
  // coaching copy — it never awards or mutates score.
  intent_capture_enabled: boolean;

  // Performance Statements™ — a single short, spoken coach IDENTITY line
  // delivered once per local day (voice-only: no quote card, no text, no
  // archive, no replay). Master switch; ships OFF in prod (Build 100% · Show
  // 10%), ON in the demo profile. Score-Protection: audio-only projection —
  // never awards, mutates, or fabricates score.
  performance_statements_enabled: boolean;

  // Offline Intake Outbox — durable local queue so an intake logged while the
  // device is offline survives a force-close/restart and replays once the
  // server is reachable. Master switch; ships OFF in prod (Build 100% · Show
  // 10% — flag-off is a byte-identical no-op: logIntake takes the unchanged
  // online path), ON in the demo profile. Score-Protection: queued items carry
  // the FROZEN scoreBefore/scoreAfter computed from the completed action and
  // are replayed verbatim; the outbox never recomputes or fabricates score, and
  // the server's idempotency key prevents any double-apply.
  offline_intake_outbox_enabled: boolean;

  // Lock §7 / RC-L11 — server rehydration of the Adaptive Profile on a fresh
  // install / new device, plus reconnect flush of a pending profile sync.
  // OFF by default until physical-device reinstall verification passes
  // (PASS-3 build plan, slice 2 release gate). Deterministic: never
  // overwrites a calibrated local profile or a pending unsynced change.
  profile_server_hydration_enabled: boolean;

  // Enterprise — Cruise Mode (premium add-on for cruise lines & guests).
  // Master switch. Phase 1 public release lights up Journey Pulse,
  // Guest Readiness Signal, Today's Flow, and Port Signal. Phases 2/3
  // are gated independently by the per-feature flags below.
  cruise_mode_enabled: boolean;
  /** Block 6 — itinerary/weather/time-of-day pulse summary. */
  cruise_journey_pulse_enabled: boolean;
  /** Phase 3 — DELIVER TO STATEROOM / ADD TO JOURNEY CTAs. */
  cruise_commerce_enabled: boolean;
  /** Phase 3 — in-stateroom product inventory + restock prompts. */
  cruise_inventory_enabled: boolean;
  /** Phase 3 — stateroom delivery scheduling for water/AForce product. */
  cruise_stateroom_delivery_enabled: boolean;
  /** Block 7 — 8pm–10pm evening-before-port water command. */
  cruise_pre_port_enabled: boolean;
  /** Block 8 — 6am–9am morning-of-port READY / RESET FIRST signal. */
  cruise_excursion_readiness_enabled: boolean;

  // UX — Voice Engine on-screen status module (audio engine itself is unaffected)
  voice_status_module_visible: boolean;

  // Sleep Mode — Phase 1 (water-only pre-sleep protocol + morning trend
  // sentence). Internal-only flag: ships ON for internal builds and OFF
  // for the public production binary so we can dogfood before launch.
  sleep_mode_enabled: boolean;

  // ─── Spec v18 flags (Rule #17) ───────────────────────────────────────
  // These gate NEW architecture work being built per the 18-rule spec.
  // They are ADDITIVE: they do not override the existing tab-visibility
  // or feature flags above. Existing visible surfaces (Social V2, Sleep
  // tab, Cruise tab, Coach voice, etc.) remain governed by their
  // pre-existing flags. The `spec_*` flags only gate the new builds
  // added in later spec rules (Activation flow, Recovery Circle, Coach
  // V2 mode triad, hidden languages, Phantom/Premium/Enterprise stubs).
  //
  // Default values follow the spec exactly:
  //   spec_activation       = true   (Rule #9)
  //   spec_social           = false  (Rule #13 — build, hide future iterations)
  //   spec_sleep            = false  (Rule #14 — build, hide future iterations)
  //   spec_cruise           = false  (Rule #15 — build, hide future iterations)
  //   spec_coachV2          = false  (Rule #12 — new Silent/Ambient/Spoken triad)
  //   spec_premium          = false  (Rule #18 — future stub)
  //   spec_inventory        = false  (Rule #8 — product peek; no store/buy)
  //   spec_phantom          = false  (Rule #18 — BLE Phantom hardware stub)
  //   spec_enterprise       = false  (Rule #18 — Meridian enterprise stub)
  //   spec_language_{ar,zh,ja,ko,hi} = false (Rule #16 — built, not selectable)
  spec_activation: boolean;
  spec_social: boolean;
  spec_sleep: boolean;
  spec_cruise: boolean;
  spec_coachV2: boolean;
  spec_premium: boolean;
  spec_inventory: boolean;
  spec_phantom: boolean;
  spec_enterprise: boolean;
  spec_language_ar: boolean;
  spec_language_zh: boolean;
  spec_language_ja: boolean;
  spec_language_ko: boolean;
  spec_language_hi: boolean;
  /** Rule #11 — Recovery Circle (Day 0/1/3/7/30, max 3, no feed). */
  spec_recoveryCircle: boolean;
  /** Rule #10 — Welcome cadence notifications (Day 0/1/3/7, 1/day). */
  spec_notifications: boolean;
  /** Rule #7 — Orb tap → Score Reasons + Replay. */
  spec_orb: boolean;
  /** Rule #6 — Timeline Lock invariant (protected fields + allowed actions). */
  spec_timelineLock: boolean;
  /** Rule #5 — HydroJournal memory (sources + recovery contributors). */
  spec_hydroJournal: boolean;
  /** Rule #4 — HydroScan flow + Current Moment classifier + water-first order. */
  spec_hydroScan: boolean;
  /** Rule #3 — Profile is source of truth (10 domains + unit auto/override). */
  spec_profileSource: boolean;
  /** Rule #2 — Shared Context Layer manifest (13 inputs / 5 outputs / One Orb). */
  spec_sharedContextLayer: boolean;
  /** Rule #1 — UI Freeze keystone (14 frozen surfaces + 3 prohibitions). */
  spec_uiFreeze: boolean;
  /**
   * Section 58 — Command Confidence Display™. Gates the confidence badge on the
   * NEW surfaces (HydroScan Performance Fit, Recovery Window, Sun Recovery Mode).
   * Today's Command shows confidence unflagged. Default OFF: build, do not
   * release ("Build 100% · Show 10%").
   */
  spec_commandConfidenceDisplay: boolean;
  /**
   * §55/Show-10 — the Profile Strength section (profile-completeness chip) in
   * the Profile screen. Additive, presentational; OFF by default. No copy beyond
   * the structural RICH/PARTIAL/SPARSE token ships until it's flipped.
   */
  spec_profileStrengthSection: boolean;
  /**
   * Show-10 slice ① — the tap-through DATA BEHIND THIS bottom sheet. Makes
   * Today's Command's confidence badge tappable; the sheet lists the per-signal
   * §54 quality ⊓ §53 freshness chips behind the read (§53/§54/§58 content only —
   * NO §56 personalization rows, which are CR-1-gated). Additive, presentational,
   * copy-independent; OFF by default ("Build 100% · Show 10%").
   */
  spec_confidenceDetailSheet: boolean;
  /**
   * Recovery Layer (post-v18 architecture update) — hidden engine that
   * feeds existing surfaces (Orb, Coach, Timeline, HydroJournal,
   * Social, Guardian, Clutch). Phase 1 ships the engine only with no
   * visible UI; later phases route the outputs into the existing
   * surfaces. Default OFF: build, do not release.
   */
  spec_recovery: boolean;
  /**
   * Recovery Coach — the full-screen premium focused mode (spec:
   * docs/specs/recovery-coach-premium-spec.md). Net-new surface driven entirely
   * by the normalized RecoveryCommand. Default OFF: built dormant, no entry wired
   * into the frozen home; the launch is flipped on deliberately. Score-Protection:
   * display only — dose comes solely from the validated command, never fabricated.
   */
  spec_recoveryCoach: boolean;
  /**
   * Protocol premium redesign (Phase 2 · S2) — the redesigned Protocol tab
   * (large active step, ordered upcoming timeline, "Why this plan" disclosure).
   * Default OFF: the legacy Protocol screen renders until flipped. Same data
   * (deriveProtocol); presentation only.
   */
  spec_protocol: boolean;
  /**
   * Hydration premium redesign (Phase 2 · S5) — live hydration dashboard
   * (ring, scan/log CTAs, recent intake). Default OFF: the Performance Timeline
   * renders until flipped. Same store data; presentation only.
   */
  spec_hydration: boolean;
  /**
   * Hydration Demand Engine™ — pure module that replaces generic
   * 8-glasses logic with an input-driven daily target. Phase 1 ships
   * the module only; outputs are NOT consumed by any visible surface
   * yet. Default OFF; flip in DEMO_ALL_ON for internal preview.
   */
  spec_demand_engine: boolean;
  /**
   * §56/§20 — route the Body Recalibration Engine's §20 targets (Training /
   * Sweat / Goal / Age-personalized hydration, electrolyte, recovery timing)
   * into the Demand Engine snapshot. Build 100 / Show 0: the targets are
   * computed and carried, NOT yet shown by any surface. Default OFF; the flip
   * to live is gated on performance-scientist coefficient sign-off (CR-1).
   */
  spec_section20_calibration: boolean;
  /**
   * HydroScan 2.0™ — profile-aware scan output (Hydration Impact +
   * Timing Guidance), the "Did you consume this?" prompt, the
   * never-dead-end unknown-product flow, and the local HydroScan
   * History. Master switch for the additive scan-screen surfaces.
   * Ships OFF in prod (Build 100% · Show 10%); ON in the demo profile.
   * Score-Protection: every surface is advisory — recording consumption
   * writes only to local history and the explicit Log Intake tap remains
   * the sole score path.
   */
  hydro_scan_2_enabled: boolean;

  // Location Intelligence™ — headless location-context engine. Turns
  // GPS / time zone / altitude / temperature / humidity / UV / air
  // quality / travel detection into a normalized context the
  // performance engines consume (Hydration Demand, Brain Energy,
  // Recovery, Fuel Timing, Forecasting, Performance Memory, Command
  // Confidence). Master switch; Build 100% · Show 10% — OFF in the
  // production binary, ON in DEMO_ALL_ON. Score-Protection: advisory
  // only — feeds the demand (target) side, additive + capped, and
  // never awards or mutates score.
  location_intelligence_enabled: boolean;

  // Signal Hierarchy™ — headless, deterministic per-source priority
  // resolution (Sleep / Heart Rate / Activity / Hydration Verification).
  // Replaces freshest-wins for source SELECTION with a fixed ladder
  // (e.g. Phantom → WHOOP → Apple Health …). Build 100% · Show 10%:
  // OFF in the production binary, ON in DEMO_ALL_ON. Phase 1 wires only
  // the SLEEP ladder into the (already headless) Hydration Demand read
  // path. Score-Protection: only changes which source feeds an advisory
  // input — never awards or mutates score. OFF ⇒ freshest-wins stays live.
  signal_hierarchy_enabled: boolean;

  // Weekly Performance Report™ — once-per-week (Sunday) shareable recap
  // screen (non-tab route + Modules + flag-gated Profile row). Build 100% ·
  // Show 10%: OFF in the production binary, ON in DEMO_ALL_ON. Every section
  // is a read-only projection — Score-Protection: never awards or fabricates
  // a trend; sections without data render explicit "collecting"/"awaiting".
  /**
   * Home premium redesign (Phase 2 · S3) — reduced readiness-arc Home.
   * Default OFF: legacy Home renders until flipped. Same engine data.
   */
  spec_home: boolean;
  spec_weekly_report: boolean;
  // Phase 3 redesign flags (one per redesigned screen; default OFF). Presentation-only.
  spec_community: boolean;
  spec_store: boolean;
  spec_share: boolean;
  spec_urine: boolean;
  spec_scan: boolean;
  spec_sweat: boolean;
  spec_profile: boolean;
  spec_onboarding: boolean;
  spec_cart: boolean;
  spec_subscription: boolean;
  spec_manageSub: boolean;
  spec_leaderboard: boolean;
  spec_achievements: boolean;
  spec_notifScreen: boolean;
  spec_science: boolean;
  spec_legal: boolean;
  spec_sensors: boolean;
  spec_auth: boolean;

  // Score-from-Ledger Hybrid — Tier-1 score-integration seam (P2b). When ON,
  // the hydration score reads its INPUTS from a ledger-projected UserState
  // (`projectScoreStateFromLedgerHybrid`) instead of live state, WITHOUT
  // changing the score formula. Build 100% · Show 0%: OFF in DEFAULT_FLAGS
  // AND in DEMO_ALL_ON — shadow-compare-only until contribution-level parity
  // is proven, and currently a verified no-op (fails closed to live on every
  // family; no score family is losslessly ledger-derivable yet). Score-
  // Protection: a projection of already-completed behaviour, never scores.
  scoreFromLedgerHybrid: boolean;

  // Evidence Engine™ — headless explainability layer. For the AForce Command
  // that fired (from generateCommand), derives WHY it was issued by linking
  // each evidence item to the underlying REAL signal (value + freshness +
  // provenance), in lockstep with the actual command branch (integrity check
  // fails closed on any mismatch). Master switch for the additive "Why this
  // command" surface. Build 100% · Show 10%: OFF in the production binary, ON
  // in DEMO_ALL_ON. Score-Protection: read-only projection of inputs already
  // used by the engine — never reads into, awards, mutates, or fabricates
  // score; stale/missing signals are shown honestly, never invented.
  evidence_engine_enabled: boolean;
  /**
   * Command Confidence™ — STEP 2 per-category adaptive learning. Gates ONLY
   * whether the learned per-category completion rate may influence command
   * SELECTION / timing / priority. The ledger records confirmations regardless.
   * Score-Protection: selection-only — never reads into, awards, mutates, or
   * fabricates score, and never demotes the Water-First command.
   */
  command_confidence_adaptive_enabled: boolean;
  /**
   * Performance Memory™ — STEP 3 execution-memory expansion. Gates the
   * additive, READ-ONLY command-completion recap (execution streak, recent
   * follow-rate + trend) derived from the same ledger Command Confidence
   * writes. Build 100% · Show 10%: OFF in the production binary, ON in
   * DEMO_ALL_ON. Score-Protection: a SURFACE primitive only — it describes
   * already-recorded behaviour, never reads into / awards / mutates /
   * fabricates score, and the follow-rate never feeds Command Confidence.
   */
  performance_memory_execution_enabled: boolean;
  /**
   * Performance Memory™ — governance surface. When ON, the Profile screen
   * shows a read-only Performance Memory card (summarized observational
   * streams + per-source coverage) with a real "Delete" that clears the
   * capture store. Capture itself is ALWAYS-ON and unaffected by this flag;
   * this only gates the VIEW + delete control. OFF in the production binary.
   * Score-Protection: display + delete only — never reads into / awards /
   * mutates / fabricates score.
   */
  performance_memory_governance_enabled: boolean;
  /**
   * Performance Identity™ — FOUNDATION + raw signal capture only (Phase 2).
   * When ON, the Profile screen shows an INTERNAL raw-signal readout (the
   * behavioural signals a future archetype classifier would read) plus an
   * explicit "not assigned (inert)" classification banner. The classifier is
   * deliberately INERT: archetype + confidence are ALWAYS null and there is
   * ZERO archetype-assignment logic. OFF in the production binary.
   * Score-Protection: read-only projection — never reads into / awards /
   * mutates / fabricates score.
   */
  performance_identity_enabled: boolean;
  /**
   * Section 59 — Adaptive Response Engine™. Gates whether the Personal Response
   * Library (What Worked / Confidence After Action) may surface. The engine is
   * pure + observational and always safe to derive; this flag governs exposure
   * only. OFF in the production binary. Score-Protection: read-only, never scores.
   */
  adaptive_response_enabled: boolean;
  /**
   * Section 60 — Response Timeline™. Gates the Phase-2 query layer that buckets
   * response activity over time. Additionally data-gated: a consumer surfaces it
   * only when this is ON *and* ~60–90 days of personal history exist
   * (isResponseTimelineReady). OFF in the production binary. Score-Protection:
   * read-only projection, never scores.
   */
  response_timeline_enabled: boolean;
  /**
   * Section 61 — Living Performance Model™. Gates the daily-lesson surface. The
   * model is pure + observational and always safe to derive; this flag governs
   * exposure only. OFF in the production binary. Score-Protection: read-only,
   * never scores.
   */
  living_performance_enabled: boolean;
  /**
   * Section 64 — Conversational Intelligence Architecture™. Gates whether the AI
   * Coach's proactive, context-loaded behavior (the speak-first / stay-silent
   * policy) drives the voice layer. The policy is pure + observational; this flag
   * governs activation only. OFF in the production binary. Score-Protection:
   * read-only, never scores.
   */
  conversational_intelligence_enabled: boolean;

  // HealthKit native module load gate. Controls whether the native
  // Nitro/HealthKit module (@kingstinct/react-native-healthkit) is loaded
  // at all. OFF in the production binary for the iOS launch-crash isolation
  // build (the native dep is removed); when false the Apple Health wrapper
  // resolves to the same "unavailable" shape an Android user gets. Independent
  // of metabolic_readiness_enabled (which gates the readiness feature/UI).
  // Score-Protection: biometrics feed Readiness only, never the Score.
  healthkit_native_enabled: boolean;

  // ─── Health-platform integrations (per-provider enable gates) ───
  // One master gate per provider on the HEALTH PLATFORMS screen. A provider
  // only offers a real, actionable Connect when its gate is ON **and** the
  // integration is actually available (creds/health-check for OAuth, native
  // module for device providers, external approval where required) — see
  // utils/health/healthProviderStatus.ts. OFF by default in the production
  // binary until each provider's credentials/approval land; when OFF (or not
  // yet available) the screen shows an honest non-interactive status
  // (Coming Soon / Approval Pending / Unsupported), never a fake "connected".
  // Score-Protection: these gate DISPLAY + connection only; real biometrics
  // still flow solely through setProviderBiometrics + the existing clamps.
  health_apple_enabled: boolean;
  health_google_connect_enabled: boolean;
  health_whoop_enabled: boolean;
  health_oura_enabled: boolean;
  health_strava_enabled: boolean;
  health_garmin_enabled: boolean;
  health_samsung_direct_enabled: boolean;
  // Labeled DEMO data for the health screen (investor/DEMO_ALL_ON builds only).
  // When ON, providers render a clearly-labeled "DEMO DATA — not from your
  // account, does not affect your score" snapshot. NEVER surfaces as a real
  // connection and NEVER reaches the score (Score-Protection).
  health_demo_data_enabled: boolean;

  // Native Liquid Glass tabs gate. Controls whether iOS 26 uses the native
  // tab bar (expo-router/unstable-native-tabs -> RNScreens RNSTabBarController)
  // instead of the JS ClassicTabLayout. OFF everywhere: the native tab
  // controller throws a void NSException at startup on iOS 26, crashing
  // Release/TestFlight builds (react-native-screens #3940). Flip true to
  // re-enable once the upstream fix is confirmed.
  native_tabs_enabled: boolean;

  // Native screens master gate (react-native-screens enableScreens). When
  // false the app calls enableScreens(false) at init, falling back to plain
  // RN views for the WHOLE navigation surface (not just tabs) — the
  // maintainer-documented #3940 workaround for the iOS 26 startup void
  // NSException. OFF everywhere as a crash kill-switch (at the cost of
  // native-screen perf). Flip true to restore native screens once the
  // upstream fix lands.
  native_screens_enabled: boolean;

  // Crash-safe Clerk token cache gate. When true (default, guard ON) the app
  // passes a custom expo-secure-store-backed tokenCache to ClerkProvider that
  // fully guards every keychain call and drops the throw-prone
  // keychainAccessible: AFTER_FIRST_UNLOCK option — preventing the production
  // launch crash (native NSException on the startup keychain read ->
  // RCTTurboModule convertNSExceptionToJSError -> Hermes corruption). False
  // reverts to @clerk/expo's default tokenCache.
  secure_store_startup_guard: boolean;
}

/**
 * Stable string union of the spec v18 flag names (without `spec_`
 * prefix). Use with `getSpecFlag(flags, 'activation')` for ergonomic
 * reads that mirror the spec document.
 */
export type SpecFlagName =
  | 'activation'
  | 'social'
  | 'sleep'
  | 'cruise'
  | 'coachV2'
  | 'premium'
  | 'inventory'
  | 'phantom'
  | 'enterprise'
  | 'language_ar'
  | 'language_zh'
  | 'language_ja'
  | 'language_ko'
  | 'language_hi'
  | 'recoveryCircle'
  | 'notifications'
  | 'orb'
  | 'timelineLock'
  | 'hydroJournal'
  | 'hydroScan'
  | 'profileSource'
  | 'sharedContextLayer'
  | 'uiFreeze'
  | 'recovery'
  | 'demand_engine'
  | 'weekly_report'
  | 'commandConfidenceDisplay';

// ─── Hydration Journal ────────────────────────────────────────────────────────
/**
 * One row from `aforce_score_snapshots` — written client-side after
 * each engine refresh (debounced ~5 min, or on band change). Drives
 * the longitudinal chart on the Journal tab.
 */
export interface JournalSnapshot {
  type: 'snapshot';
  at: string; // ISO
  score: number;
  level: PerformanceLevel;
  ozConsumedToday: number;
  aforceUnitsToday: number;
  unitsConsumedToday: number;
  sodiumDeliveredMg: number;
  sodiumLostMg: number;
  deficitPct: number;
  clutchActive: boolean;
  socialActive: boolean;
  autopilotActive: boolean;
  reason: string;
  /** Recovery Layer — null/undefined on rows written before `spec_recovery`. */
  recoveryScore?: number | null;
  pressureScore?: number | null;
  recoveryTrend?: 'rising' | 'stable' | 'declining' | null;
  recoveryFingerprint?: string | null;
  recoveryStory?: string | null;
}

/** One row from `aforce_intake_logs` flattened into the timeline. */
export interface JournalIntake {
  type: 'intake';
  at: string; // ISO
  fluidType: string;
  ozAmount: number;
  scoreBefore: number;
  scoreAfter: number;
}

export type JournalTimelineEntry = JournalSnapshot | JournalIntake;

/** Per-day rollup served by `GET /aforce/journal/rollups`. */
export interface JournalRollup {
  date: string; // YYYY-MM-DD
  snapshotsCount: number;
  avgScore: number;
  minScore: number;
  maxScore: number;
  endOzConsumed: number;
  endAforceUnits: number;
  endUnitsConsumed: number;
  endSodiumDelivered: number;
  endSodiumLost: number;
  endDeficitPct: number;
  pctTimePeak: number;
  pctTimeBalanced: number;
  pctTimeRecovering: number;
  pctTimeDepleted: number;
  intakeCount: number;
  autopilotSessions: number;
  socialSessions: number;
}

// ─── Notifications / Hardware ─────────────────────────────────────────────────
export interface NotificationItem {
  id: string;
  scheduledFor: Date;
  message: string;
  state: PerformanceLevel;
  delivered: boolean;
}

export type HardwareKind = 'phantom_band' | 'clutch_clip';
export interface HardwareDevice {
  id: string;
  kind: HardwareKind;
  name: string;
  paired: boolean;
  ledState: 'platinum' | 'stable' | 'recovery' | 'depleted';
  lastSyncSecondsAgo: number;
}

// ─── Phase 3 Guardian ─────────────────────────────────────────────────────────
export type GuardianRiskTier = 'OPTIMAL' | 'WATCH' | 'MODERATE' | 'CRITICAL';
export interface GuardianRiskState {
  riskScore: number; // 0-100
  tier: GuardianRiskTier;
  drivers: string[];
}

export interface RosterPlayer {
  id: string;
  name: string;
  position: string;
  hydrationScore: number;
  state: PerformanceLevel;
  guardianRisk: number;
}
