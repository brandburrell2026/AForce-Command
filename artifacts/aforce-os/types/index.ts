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

export interface Command {
  id: string;
  // WHAT+WHEN+OUTCOME format. Single decisive sentence.
  action: string;
  explanation: string;
  urgencyLevel: 'low' | 'medium' | 'high' | 'critical';
  estimatedImpact: string;
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

  // Phase 3+ — Competition (Sport mode)
  city_competition_enabled: boolean;
  state_competition_enabled: boolean;
  team_competition_enabled: boolean;
  global_leaderboard_enabled: boolean;

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
  | 'timelineLock';

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
