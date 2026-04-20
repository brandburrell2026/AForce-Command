// Core TypeScript types for AForce OS

export type PerformanceLevel = 'PEAK' | 'BALANCED' | 'RECOVERING' | 'DEPLETED';

export interface UserState {
  unitsConsumedToday: number;
  lastIntakeTime: Date;
  symptomState: 'none' | 'mild' | 'moderate' | 'severe';
  heatLoad: number; // 0-10 scale
  sweatRate: number; // 0-10 scale
  activityLevel: number; // 0-10 scale
  complianceStreak: number; // consecutive days on target
  dailyTarget: number; // target units per day
  isSnoozed: boolean;
  snoozeUntil: Date | null;
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

export interface ScoreReason {
  id: string;
  text: string;
  weight: 'positive' | 'negative' | 'neutral';
}

export interface Command {
  id: string;
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

export interface CycleResult {
  id: string;
  timestamp: Date;
  scoreBefore: number;
  scoreAfter: number;
  gainDisplay: string; // "+6"
  identityMessage: string; // "You're back in control"
  nextCycleHint: string;
  state: PerformanceLevel;
}

export interface NotificationItem {
  id: string;
  scheduledFor: Date;
  message: string;
  state: PerformanceLevel;
  delivered: boolean;
}

export interface ScoreEngineInput {
  userState: UserState;
}

export interface ScoreEngineOutput {
  score: number;
  performanceState: PerformanceState;
  reasons: ScoreReason[];
  riskTimer: RiskTimer;
  command: Command;
}

export interface HistoryEntry {
  id: string;
  timestamp: Date;
  score: number;
  state: PerformanceLevel;
  action: string;
  unitsTaken: number;
}

export interface UserProfile {
  name: string;
  subscriptionTier: 'free' | 'pro' | 'elite';
  dailyTarget: number;
  remindersEnabled: boolean;
  connectedDevices: string[];
}
