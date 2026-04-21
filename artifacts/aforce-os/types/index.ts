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

// ─── User / State ─────────────────────────────────────────────────────────────
export interface UserState {
  unitsConsumedToday: number;
  ozConsumedToday: number;
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

export interface ScoreEngineOutput {
  score: number;
  performanceState: PerformanceState;
  pulseConfig: PulseConfig;
  reasons: ScoreReason[];
  riskTimer: RiskTimer;
  command: Command;
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
  subscriptionTier: 'core' | 'core_team' | 'clutch' | 'guardian' | 'all_access';
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
