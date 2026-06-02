/**
 * Heat Guard — types.
 *
 * Heat Guard is an early-warning intervention system that monitors heat-stress
 * SIGNALS and predicts rising risk. It is NOT a medical device, does NOT
 * diagnose heat stroke, and never claims to. It flags risk patterns and
 * triggers immediate hydration/cooling actions.
 */

// ─── Risk bands ─────────────────────────────────────────────────────────────
export type HeatRiskBand = "STABLE" | "ELEVATED" | "WARNING" | "HIGH_RISK" | "CRITICAL";

/** Coach-facing per-athlete alert state. */
export type TeamHeatAlertState = "WATCH" | "INTERVENE" | "PULL_NOW";

export type HeatTrendDirection = "rising" | "steady" | "falling";

export type HeatUrgency = "calm" | "moderate" | "high" | "extreme" | "imminent";

export type HeatVisualMode =
  | "subtle"
  | "warm_glow"
  | "amber_tension"
  | "red_tighten"
  | "red_collapse";

// ─── Inputs ─────────────────────────────────────────────────────────────────
export interface HeatSignalInput {
  /** Hydration score 0-100 (higher = better). */
  hydrationScore: number;
  /** Oz consumed in the last 60 min. */
  recentFluidOz: number;
  /** Minutes since last logged intake. */
  minutesSinceLastIntake: number;
  /** Ambient air temperature in Fahrenheit. */
  ambientTempF: number;
  /** Relative humidity 0-100. */
  humidityPct: number;
  /** Heat index in Fahrenheit (if not provided, derived from temp+humidity). */
  heatIndexF?: number;
  /** Sun exposure 0 (none) - 1 (direct, peak). */
  sunExposure: number;
  /** Continuous active minutes since last full rest. */
  continuousActiveMin: number;
  /** Activity intensity 0-1. */
  activityIntensity: number;
  /** Heart rate (bpm), latest. */
  heartRateBpm: number;
  /** HR recovery delay in seconds vs baseline (positive = slower recovery). */
  hrRecoveryDelaySec: number;
  /** Estimated sweat loss in oz over the last hour. */
  sweatLossOzPerHr: number;
  /** Body weight in lbs (for sweat loss % calc). */
  bodyWeightLbs: number;
  /** Recovery momentum 0-1 (1 = fully restored). */
  recoveryMomentum: number;
  /** Active symptom ids (subset). */
  symptoms: HeatSymptom[];
  /** Urine darkness signal 1 (clear) - 8 (very dark). */
  urineSignal: number;
  /** Energy state self-report. */
  energyState: "peak" | "steady" | "low" | "crashed";
  /** Sleep deficit in hours vs baseline (positive = deficit). */
  sleepDeficitHrs: number;
  /** Has the user had any heat events in the last 7 days? */
  recentHeatEvent: boolean;
}

export type HeatSymptom =
  | "dizziness"
  | "headache"
  | "nausea"
  | "cramping"
  | "chills"
  | "confusion"
  | "fatigue";

export const SYMPTOM_LABELS: Record<HeatSymptom, string> = {
  dizziness: "Dizziness",
  headache: "Headache",
  nausea: "Nausea",
  cramping: "Cramping",
  chills: "Chills",
  confusion: "Confusion",
  fatigue: "Fatigue",
};

// ─── Score breakdown ────────────────────────────────────────────────────────
export interface HeatRiskContribution {
  id: string;
  label: string;
  /** Points contributed to the heat risk score (higher = more risk). */
  points: number;
  /** Maximum points this driver can contribute, for bar scaling. */
  maxPoints: number;
  /** Short reason text shown in WHY THIS RISK panel. */
  reason: string;
}

export interface HeatRiskScore {
  /** Final clamped 0-100 score. */
  score: number;
  band: HeatRiskBand;
  trend: HeatTrendDirection;
  urgency: HeatUrgency;
  visualMode: HeatVisualMode;
  /** Top 3-5 reasons surfaced to the user. */
  topDrivers: HeatRiskContribution[];
  /** Full per-input breakdown. */
  breakdown: HeatRiskContribution[];
  /** Whole-number minutes until next mandatory recheck. */
  recheckMinutes: number;
  /** Cooldown timer for the active intervention, in minutes. */
  cooldownMinutes: number;
  /** AI command line shown on the alert card. */
  command: string;
  /** Sub-line / detail explanation shown beneath the command. */
  commandDetail: string;
}

// ─── Interventions / protocols ──────────────────────────────────────────────
export type HeatProtocolId =
  | "heat_reset"
  | "shade_recovery"
  | "emergency_cooldown"
  | "hydration_recovery"
  | "return_to_play_pending";

export interface CoolingAction {
  id: string;
  /** Short verb-led directive: "Move to shade", "Drink 16 oz", etc. */
  label: string;
  /** Optional supporting detail. */
  detail?: string;
}

export interface HeatProtocol {
  id: HeatProtocolId;
  title: string;
  /** Risk bands this protocol is appropriate for. */
  appliesTo: HeatRiskBand[];
  /** Ordered actions the user must take. */
  actions: CoolingAction[];
  /** Cooldown timer for this protocol in minutes. */
  durationMinutes: number;
  /** Tone marker drives card color. */
  tone: "info" | "warn" | "alert" | "critical";
  /** Optional return-to-activity gate. */
  returnGate?: ReturnGate;
}

export interface ReturnGate {
  /** Heat risk score must drop AT OR BELOW this value to clear. */
  maxScore: number;
  /** Hydration score must reach AT LEAST this value. */
  minHydrationScore: number;
  /** Must have zero active symptoms. */
  noSymptoms: boolean;
  /** Recovery timer must complete. */
  recoveryTimerComplete: boolean;
}

// ─── Recheck timer ──────────────────────────────────────────────────────────
export interface RecheckTimer {
  /** Total minutes for the current band's recheck window. */
  totalMinutes: number;
  /** Minutes remaining until forced recheck (counts down). */
  remainingMinutes: number;
  band: HeatRiskBand;
  urgency: HeatUrgency;
}

// ─── Team / Guardian roster ─────────────────────────────────────────────────
export interface TeamHeatAthlete {
  id: string;
  name: string;
  jerseyNumber: number;
  position: string;
  riskScore: number;
  band: HeatRiskBand;
  trend: HeatTrendDirection;
  hydrationScore: number;
  alertState: TeamHeatAlertState;
  /** Short coach-facing line (e.g. "Pull at next stoppage"). */
  coachAction: string;
  /** Minutes since last hydration log. */
  minutesSinceLastIntake: number;
}

export interface TeamHeatAlert {
  athleteId: string;
  athleteName: string;
  state: TeamHeatAlertState;
  band: HeatRiskBand;
  message: string;
  loggedAt: string;
}

// ─── Risk band display config ───────────────────────────────────────────────
export interface HeatBandDisplay {
  band: HeatRiskBand;
  label: string;
  range: [number, number];
  color: string;
  /** Whether this band's pulse should flash (CRITICAL only per spec). */
  flashing: boolean;
  /** Visual mode for HeatPulse. */
  visualMode: HeatVisualMode;
  urgency: HeatUrgency;
  recheckMinutes: number;
  shortDirective: string;
}
