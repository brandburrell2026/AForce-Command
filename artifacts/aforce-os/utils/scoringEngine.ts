/**
 * AForce OS Scoring Engine
 * Calculates performance score (0–100) from mock sensor and behavioral inputs.
 * Score drives state, urgency, command language, and risk timer.
 */

import type {
  UserState,
  PerformanceState,
  ScoreReason,
  RiskTimer,
  Command,
  ScoreEngineOutput,
  PerformanceLevel,
} from '../types';
import { Colors } from '../theme/colors';

// ─── Score Thresholds ─────────────────────────────────────────────────────────
const STATE_THRESHOLDS = {
  PEAK: { min: 90, max: 100 },
  BALANCED: { min: 75, max: 89 },
  RECOVERING: { min: 60, max: 74 },
  DEPLETED: { min: 0, max: 59 },
} as const;

function resolveState(score: number): PerformanceLevel {
  if (score >= 90) return 'PEAK';
  if (score >= 75) return 'BALANCED';
  if (score >= 60) return 'RECOVERING';
  return 'DEPLETED';
}

// ─── Score Calculation ────────────────────────────────────────────────────────
function calculateBaseScore(state: UserState): number {
  let score = 100;

  // Hydration pace penalty (most important factor)
  const minutesSinceLast = minutesSince(state.lastIntakeTime);
  if (minutesSinceLast > 90) score -= 30;
  else if (minutesSinceLast > 60) score -= 20;
  else if (minutesSinceLast > 45) score -= 12;
  else if (minutesSinceLast > 30) score -= 5;

  // Unit compliance (units vs target) — normalized to 6am–10pm window
  const hourOfDay = new Date().getHours();
  const clampedHour = Math.min(Math.max(hourOfDay, 6), 22); // clamp between 6am and 10pm
  const dayFraction = (clampedHour - 6) / 16;
  const expectedByNow = Math.floor(dayFraction * state.dailyTarget);
  const deficit = Math.max(0, expectedByNow - state.unitsConsumedToday);
  score -= deficit * 8;

  // Heat load stress
  if (state.heatLoad >= 8) score -= 15;
  else if (state.heatLoad >= 6) score -= 8;
  else if (state.heatLoad >= 4) score -= 3;

  // Sweat rate stress
  if (state.sweatRate >= 8) score -= 12;
  else if (state.sweatRate >= 6) score -= 6;
  else if (state.sweatRate >= 4) score -= 2;

  // Activity level (high activity = more demand)
  if (state.activityLevel >= 8) score -= 10;
  else if (state.activityLevel >= 5) score -= 4;

  // Symptom state
  if (state.symptomState === 'severe') score -= 20;
  else if (state.symptomState === 'moderate') score -= 12;
  else if (state.symptomState === 'mild') score -= 5;

  // Compliance streak bonus
  if (state.complianceStreak >= 7) score += 5;
  else if (state.complianceStreak >= 3) score += 3;

  return Math.max(0, Math.min(100, score));
}

// ─── Reasons Generation ───────────────────────────────────────────────────────
function generateReasons(state: UserState, score: number): ScoreReason[] {
  const reasons: ScoreReason[] = [];
  const minutesSinceLast = minutesSince(state.lastIntakeTime);

  // Intake timing
  if (minutesSinceLast > 60) {
    reasons.push({
      id: 'intake-late',
      text: `Your last unit was ${minutesSinceLast} minutes ago.`,
      weight: 'negative',
    });
  } else if (minutesSinceLast < 25) {
    reasons.push({
      id: 'intake-recent',
      text: 'Recent intake is active.',
      weight: 'positive',
    });
  }

  // Pace
  const hourOfDay = new Date().getHours();
  const clampedHour = Math.min(Math.max(hourOfDay, 6), 22);
  const expectedByNow = Math.floor(((clampedHour - 6) / 16) * state.dailyTarget);
  if (state.unitsConsumedToday < expectedByNow) {
    reasons.push({
      id: 'pace-behind',
      text: 'You are behind your daily pace.',
      weight: 'negative',
    });
  } else if (state.unitsConsumedToday >= expectedByNow) {
    reasons.push({
      id: 'pace-ahead',
      text: 'You are on pace for the day.',
      weight: 'positive',
    });
  }

  // Heat
  if (state.heatLoad >= 6) {
    reasons.push({
      id: 'heat-elevated',
      text: 'Heat load is elevated.',
      weight: 'negative',
    });
  }

  // Sweat
  if (state.sweatRate >= 6) {
    reasons.push({
      id: 'sweat-high',
      text: 'Output stress from sweat rate is high.',
      weight: 'negative',
    });
  }

  // Streak
  if (state.complianceStreak >= 3) {
    reasons.push({
      id: 'streak-good',
      text: `${state.complianceStreak}-day compliance streak active.`,
      weight: 'positive',
    });
  }

  // Symptoms
  if (state.symptomState === 'moderate' || state.symptomState === 'severe') {
    reasons.push({
      id: 'symptoms',
      text: 'Recovery momentum is reduced.',
      weight: 'negative',
    });
  }

  return reasons.slice(0, 4);
}

// ─── Risk Timer ───────────────────────────────────────────────────────────────
function calculateRiskTimer(state: UserState, level: PerformanceLevel, isSnoozed: boolean): RiskTimer {
  const minutesSinceLast = minutesSince(state.lastIntakeTime);
  const baseMinutes = isSnoozed ? 20 : getBaseRiskMinutes(level, minutesSinceLast);

  return {
    minutes: baseMinutes,
    seconds: 0,
    urgency: level === 'PEAK' ? 'low' : level === 'BALANCED' ? 'medium' : level === 'RECOVERING' ? 'high' : 'critical',
  };
}

function getBaseRiskMinutes(level: PerformanceLevel, minutesSinceLast: number): number {
  const remaining = Math.max(0, 60 - minutesSinceLast);
  switch (level) {
    case 'PEAK': return Math.max(16, remaining);
    case 'BALANCED': return Math.max(12, Math.floor(remaining * 0.7));
    case 'RECOVERING': return Math.max(8, Math.floor(remaining * 0.4));
    case 'DEPLETED': return Math.min(4, Math.floor(remaining * 0.2) + 1);
    default: return 15;
  }
}

// ─── Command Generation ───────────────────────────────────────────────────────
function generateCommand(level: PerformanceLevel, state: UserState): Command {
  const minutesSinceLast = minutesSince(state.lastIntakeTime);

  switch (level) {
    case 'PEAK':
      return {
        id: 'cmd-peak',
        action: 'Take 1 unit now. You are on pace.',
        explanation: `Stay on your ${state.dailyTarget}-unit target. Maintain momentum.`,
        urgencyLevel: 'low',
        estimatedImpact: '+3 to score',
      };
    case 'BALANCED':
      return {
        id: 'cmd-balanced',
        action: `Take 1 AForce stick now. Recheck in 20 minutes.`,
        explanation: `${minutesSinceLast} minutes since last intake. Keep your rhythm.`,
        urgencyLevel: 'medium',
        estimatedImpact: '+6 to score',
      };
    case 'RECOVERING':
      return {
        id: 'cmd-recovering',
        action: 'Take 1 unit now. Recheck in 15 minutes.',
        explanation: `You are behind pace. Heat load at ${state.heatLoad}/10. Act now.`,
        urgencyLevel: 'high',
        estimatedImpact: '+10 to score',
      };
    case 'DEPLETED':
      return {
        id: 'cmd-depleted',
        action: 'Take 2 units now. Critical. Recheck in 10 minutes.',
        explanation: `${minutesSinceLast} min since last intake. High deficit. Immediate action required.`,
        urgencyLevel: 'critical',
        estimatedImpact: '+18 to score',
      };
    default:
      return {
        id: 'cmd-default',
        action: 'Take 1 unit now.',
        explanation: 'Maintain your hydration protocol.',
        urgencyLevel: 'medium',
        estimatedImpact: '+6 to score',
      };
  }
}

// ─── Performance State Object ─────────────────────────────────────────────────
function buildPerformanceState(level: PerformanceLevel, score: number): PerformanceState {
  const stateColors = Colors.states[level];

  const configMap: Record<PerformanceLevel, Omit<PerformanceState, 'level' | 'score' | 'color' | 'glowColor'>> = {
    PEAK: { urgency: 'calm', pulseSpeed: 'medium', animationStyle: 'energize' },
    BALANCED: { urgency: 'moderate', pulseSpeed: 'slow', animationStyle: 'breathe' },
    RECOVERING: { urgency: 'high', pulseSpeed: 'medium', animationStyle: 'pulse' },
    DEPLETED: { urgency: 'critical', pulseSpeed: 'fast', animationStyle: 'tension' },
  };

  return {
    level,
    score,
    color: stateColors.primary,
    glowColor: stateColors.glow,
    ...configMap[level],
  };
}

// ─── Main Engine ──────────────────────────────────────────────────────────────
export function calculateScore(userState: UserState): ScoreEngineOutput {
  const score = calculateBaseScore(userState);
  const level = resolveState(score);
  const performanceState = buildPerformanceState(level, score);
  const reasons = generateReasons(userState, score);
  const riskTimer = calculateRiskTimer(userState, level, userState.isSnoozed);
  const command = generateCommand(level, userState);

  return {
    score,
    performanceState,
    reasons,
    riskTimer,
    command,
  };
}

// ─── Helper ───────────────────────────────────────────────────────────────────
export function minutesSince(date: Date): number {
  return Math.floor((Date.now() - date.getTime()) / 60000);
}

export function getStateLabel(level: PerformanceLevel): string {
  switch (level) {
    case 'PEAK': return 'PEAK';
    case 'BALANCED': return 'BALANCED';
    case 'RECOVERING': return 'RECOVERING';
    case 'DEPLETED': return 'DEPLETED';
  }
}

export function generateCycleIdentityMessage(level: PerformanceLevel): string {
  switch (level) {
    case 'PEAK': return "You're unstoppable.";
    case 'BALANCED': return "You're back in control.";
    case 'RECOVERING': return "Recovery momentum gained.";
    case 'DEPLETED': return "Deficit closed. Keep going.";
  }
}

export function generateNextCycleHint(level: PerformanceLevel): string {
  switch (level) {
    case 'PEAK': return 'Maintain pace. Next check in 20 min.';
    case 'BALANCED': return 'Stay consistent. Next check in 15 min.';
    case 'RECOVERING': return 'Monitor output. Next check in 10 min.';
    case 'DEPLETED': return 'Recheck urgently. Next check in 5 min.';
  }
}
