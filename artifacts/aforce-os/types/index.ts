// Core TypeScript types for AForce OS

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
  // numbers.
  appleHealth?: AppleHealthInputs;
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

export interface AppleHealthInputs {
  restingHeartRate: number | null;
  hrvSdnn: number | null;
  stepsToday: number | null;
  sleepHoursLastNight: number | null;
  /** When the snapshot was last refreshed (epoch ms). */
  fetchedAt: number;
}

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
    bac: BACEstimate;
    impairment: ImpairmentRiskState;
    transportation: TransportationSafetyPrompt;
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
}

// ─── Profile / Subscription ───────────────────────────────────────────────────
export interface UserProfile {
  name: string;
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
  clutch_clip_enabled: boolean;
  kids_world_enabled: boolean;

  // Phase 3+ — Competition (Sport mode)
  city_competition_enabled: boolean;
  state_competition_enabled: boolean;
  team_competition_enabled: boolean;
  global_leaderboard_enabled: boolean;

  // Enterprise — Cruise Mode (premium add-on for cruise lines & guests)
  cruise_mode_enabled: boolean;
}

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
