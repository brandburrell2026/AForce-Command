/**
 * AForce OS Scoring Engine
 *
 * Score formula (per spec):
 *   hydration_score = base_intake_score + recency_score + consistency_score
 *                   + context_modifier + recovery_momentum + symptom_penalty
 *                   + urine_signal_penalty + output_stress_penalty
 *   score = max(0, min(100, round(score)))
 *
 * State classification:
 *   PEAK 90–100 / BALANCED 75–89 / RECOVERING 60–74 / DEPLETED 0–59
 *
 * AI command rules:
 *   WHAT to do + WHEN/HOW MUCH + OUTCOME, 1–2 sentences, command authority.
 *   No "consider / try / suggest / great job / stay hydrated".
 */

import type {
  UserState,
  PerformanceState,
  ScoreReason,
  RiskTimer,
  Command,
  ScoreEngineOutput,
  ScoreContribution,
  PerformanceLevel,
  PulseConfig,
  PulseStateName,
  PulseWaveBehavior,
  PulseColorMode,
} from '../types';
import { Colors } from '../theme/colors';

function resolveState(score: number): PerformanceLevel {
  if (score >= 90) return 'PEAK';
  if (score >= 75) return 'BALANCED';
  if (score >= 60) return 'RECOVERING';
  return 'DEPLETED';
}

// ─── Score Breakdown ──────────────────────────────────────────────────────────
function buildBreakdown(state: UserState): { score: number; contributions: ScoreContribution[] } {
  const minutesSinceLast = minutesSince(state.lastIntakeTime);

  const ozRatio = Math.min(1, state.ozConsumedToday / state.ozTarget);
  const baseIntake = Math.round(45 * ozRatio);

  let recency = 20;
  if (minutesSinceLast > 90) recency = 0;
  else if (minutesSinceLast > 60) recency = 4;
  else if (minutesSinceLast > 45) recency = 9;
  else if (minutesSinceLast > 30) recency = 14;

  const consistency = Math.min(15, state.complianceStreak * 2);

  let context = 5;
  if (state.heatLoad >= 8) context -= 12;
  else if (state.heatLoad >= 6) context -= 7;
  else if (state.heatLoad >= 4) context -= 3;
  if (state.sweatRate >= 6) context -= 4;
  if (state.activityLevel >= 8) context -= 5;
  else if (state.activityLevel >= 5) context -= 2;

  const recoveryMomentum = Math.min(15, Math.max(0, 15 - minutesSinceLast / 4));

  let symptomPenalty = 0;
  if (state.symptomState === 'severe') symptomPenalty = -22;
  else if (state.symptomState === 'moderate') symptomPenalty = -14;
  else if (state.symptomState === 'mild') symptomPenalty = -6;
  symptomPenalty -= Math.min(8, state.symptoms.length * 2);

  const urinePenalty = -Math.max(0, (state.urineSignal - 3)) * 4;
  const outputStress = -Math.min(10, Math.floor(state.sweatRate * state.activityLevel / 12));
  const sleepCarry = state.overnightLossOz > 8 && !state.hasSeenMorningCommand
    ? -Math.min(10, Math.floor((state.overnightLossOz - 8) * 0.8))
    : 0;

  const recovery = computeRecoverySignal(state);

  const raw = baseIntake + recency + consistency + context + recoveryMomentum
            + symptomPenalty + urinePenalty + outputStress + sleepCarry
            + recovery.delta;
  const score = Math.max(0, Math.min(100, Math.round(raw)));

  const contributions: ScoreContribution[] = [
    { id: 'base', label: 'Base intake (oz vs target)', delta: baseIntake, maxMagnitude: 45,
      hint: `${state.ozConsumedToday} of ${state.ozTarget} oz` },
    { id: 'recency', label: 'Recency of last intake', delta: recency, maxMagnitude: 20,
      hint: `${minutesSinceLast} min since last intake` },
    { id: 'consistency', label: 'Compliance streak', delta: consistency, maxMagnitude: 15,
      hint: `${state.complianceStreak}-day streak` },
    { id: 'context', label: 'Context (heat / sweat / activity)', delta: context, maxMagnitude: 20,
      hint: `Heat ${state.heatLoad} · Sweat ${state.sweatRate} · Activity ${state.activityLevel}` },
    { id: 'recovery', label: 'Recovery momentum', delta: Math.round(recoveryMomentum), maxMagnitude: 15,
      hint: 'Aggressive restoration after deficit' },
    { id: 'symptom', label: 'Performance signals', delta: symptomPenalty, maxMagnitude: 30,
      hint: state.symptoms.length ? `${state.symptoms.length} active` : 'None active' },
    { id: 'urine', label: 'Hydration signal (1-8)', delta: urinePenalty, maxMagnitude: 20,
      hint: `Level ${state.urineSignal}/8` },
    { id: 'output', label: 'Output stress', delta: outputStress, maxMagnitude: 10,
      hint: 'Sweat × activity load' },
    { id: 'sleep', label: 'Overnight carryover', delta: sleepCarry, maxMagnitude: 10,
      hint: state.overnightLossOz > 8 ? `${state.overnightLossOz} oz loss` : 'No deficit carry' },
    { id: 'apple_health', label: 'Apple Health (HRV + sleep)', delta: recovery.delta, maxMagnitude: 10,
      hint: recovery.hint },
  ];

  return { score, contributions };
}

/**
 * Translate the most recent Apple Health snapshot into a -10..+10
 * adjustment. Each signal (HRV, sleep) contributes independently and
 * is dropped if the field is null. When no Apple Health data is
 * available we return delta=0 so the score is unchanged — never
 * substituted with a placeholder.
 */
function computeRecoverySignal(state: UserState): { delta: number; hint: string } {
  const snap = state.appleHealth;
  if (!snap) return { delta: 0, hint: 'Not connected' };

  const parts: string[] = [];
  let delta = 0;

  if (snap.hrvSdnn != null) {
    if (snap.hrvSdnn >= 60) { delta += 5; parts.push(`HRV ${Math.round(snap.hrvSdnn)}ms (high)`); }
    else if (snap.hrvSdnn >= 40) { delta += 2; parts.push(`HRV ${Math.round(snap.hrvSdnn)}ms`); }
    else if (snap.hrvSdnn >= 30) { parts.push(`HRV ${Math.round(snap.hrvSdnn)}ms`); }
    else { delta -= 5; parts.push(`HRV ${Math.round(snap.hrvSdnn)}ms (low)`); }
  }

  if (snap.sleepHoursLastNight != null) {
    const h = snap.sleepHoursLastNight;
    if (h >= 7 && h <= 9) { delta += 5; parts.push(`Sleep ${h.toFixed(1)}h`); }
    else if (h >= 6) { delta += 2; parts.push(`Sleep ${h.toFixed(1)}h`); }
    else if (h >= 4) { delta -= 3; parts.push(`Sleep ${h.toFixed(1)}h (short)`); }
    else { delta -= 5; parts.push(`Sleep ${h.toFixed(1)}h (deficit)`); }
  }

  // Clamp to ±10 so Apple Health can never dominate the score.
  delta = Math.max(-10, Math.min(10, delta));

  if (parts.length === 0) return { delta: 0, hint: 'Awaiting data' };
  return { delta, hint: parts.join(' · ') };
}

// ─── Score Calculation ────────────────────────────────────────────────────────
function calculateBaseScore(state: UserState): number {
  // base_intake_score: 0–45 from oz consumed vs target
  const ozRatio = Math.min(1, state.ozConsumedToday / state.ozTarget);
  const baseIntake = Math.round(45 * ozRatio);

  // recency_score: 0–20 based on minutes since last intake
  const minutesSinceLast = minutesSince(state.lastIntakeTime);
  let recency = 20;
  if (minutesSinceLast > 90) recency = 0;
  else if (minutesSinceLast > 60) recency = 4;
  else if (minutesSinceLast > 45) recency = 9;
  else if (minutesSinceLast > 30) recency = 14;

  // consistency_score: 0–15 based on streak
  const consistency = Math.min(15, state.complianceStreak * 2);

  // context_modifier: -15..+5 from heat/sweat/activity
  let context = 5;
  if (state.heatLoad >= 8) context -= 12;
  else if (state.heatLoad >= 6) context -= 7;
  else if (state.heatLoad >= 4) context -= 3;
  if (state.sweatRate >= 6) context -= 4;
  if (state.activityLevel >= 8) context -= 5;
  else if (state.activityLevel >= 5) context -= 2;

  // recovery_momentum: 0–15 — how aggressively recent intake is restoring deficit
  const recoveryMomentum = Math.min(15, Math.max(0, 15 - minutesSinceLast / 4));

  // symptom_penalty
  let symptomPenalty = 0;
  if (state.symptomState === 'severe') symptomPenalty = -22;
  else if (state.symptomState === 'moderate') symptomPenalty = -14;
  else if (state.symptomState === 'mild') symptomPenalty = -6;
  symptomPenalty -= Math.min(8, state.symptoms.length * 2);

  // urine_signal_penalty: 1 = optimal, 8 = critical
  const urinePenalty = -Math.max(0, (state.urineSignal - 3)) * 4;

  // output_stress_penalty (sweat × activity)
  const outputStress = -Math.min(10, Math.floor(state.sweatRate * state.activityLevel / 12));

  // Sleep mode carryover deficit
  const sleepCarry = state.overnightLossOz > 8 && !state.hasSeenMorningCommand
    ? -Math.min(10, Math.floor((state.overnightLossOz - 8) * 0.8))
    : 0;

  const recovery = computeRecoverySignal(state);

  const raw = baseIntake + recency + consistency + context + recoveryMomentum
            + symptomPenalty + urinePenalty + outputStress + sleepCarry
            + recovery.delta;

  return Math.max(0, Math.min(100, Math.round(raw)));
}

// ─── Reasons Generation ───────────────────────────────────────────────────────
function generateReasons(state: UserState): ScoreReason[] {
  const reasons: ScoreReason[] = [];
  const minutesSinceLast = minutesSince(state.lastIntakeTime);

  if (minutesSinceLast > 60) {
    reasons.push({ id: 'intake-late', text: `Last intake ${minutesSinceLast} min ago.`, weight: 'negative' });
  } else if (minutesSinceLast < 25) {
    reasons.push({ id: 'intake-recent', text: 'Recent intake is active.', weight: 'positive' });
  }

  const ozRatio = state.ozConsumedToday / state.ozTarget;
  if (ozRatio < 0.5) {
    reasons.push({ id: 'pace-behind', text: 'You are behind your daily oz pace.', weight: 'negative' });
  } else if (ozRatio >= 0.75) {
    reasons.push({ id: 'pace-ahead', text: 'On pace for daily target.', weight: 'positive' });
  }

  if (state.urineSignal >= 5) {
    reasons.push({ id: 'urine', text: `Hydration signal at ${state.urineSignal}/8 — concentrated.`, weight: 'negative' });
  } else if (state.urineSignal <= 2) {
    reasons.push({ id: 'urine-clear', text: 'Hydration signal optimal.', weight: 'positive' });
  }

  if (state.heatLoad >= 6) {
    reasons.push({ id: 'heat', text: 'Heat load is elevated.', weight: 'negative' });
  }
  if (state.sweatRate >= 6) {
    reasons.push({ id: 'sweat', text: 'Output stress from sweat is high.', weight: 'negative' });
  }
  if (state.symptoms.length > 0) {
    reasons.push({ id: 'symptoms', text: `${state.symptoms.length} performance signal${state.symptoms.length > 1 ? 's' : ''} active.`, weight: 'negative' });
  }
  if (state.complianceStreak >= 3) {
    reasons.push({ id: 'streak', text: `${state.complianceStreak}-day compliance streak.`, weight: 'positive' });
  }
  if (state.overnightLossOz > 8 && !state.hasSeenMorningCommand) {
    reasons.push({ id: 'overnight', text: `Overnight deficit ${state.overnightLossOz} oz.`, weight: 'negative' });
  }

  const ah = state.appleHealth;
  if (ah) {
    if (ah.hrvSdnn != null && ah.hrvSdnn < 30) {
      reasons.push({ id: 'ah-hrv-low', text: `Apple Health: HRV ${Math.round(ah.hrvSdnn)} ms (low recovery).`, weight: 'negative' });
    } else if (ah.hrvSdnn != null && ah.hrvSdnn >= 60) {
      reasons.push({ id: 'ah-hrv-high', text: `Apple Health: HRV ${Math.round(ah.hrvSdnn)} ms (recovered).`, weight: 'positive' });
    }
    if (ah.sleepHoursLastNight != null && ah.sleepHoursLastNight < 6) {
      reasons.push({ id: 'ah-sleep-short', text: `Apple Health: ${ah.sleepHoursLastNight.toFixed(1)} h sleep last night.`, weight: 'negative' });
    } else if (ah.sleepHoursLastNight != null && ah.sleepHoursLastNight >= 7 && ah.sleepHoursLastNight <= 9) {
      reasons.push({ id: 'ah-sleep-good', text: `Apple Health: ${ah.sleepHoursLastNight.toFixed(1)} h sleep — well rested.`, weight: 'positive' });
    }
  }

  return reasons.slice(0, 4);
}

// ─── Risk Timer ───────────────────────────────────────────────────────────────
function calculateRiskTimer(state: UserState, level: PerformanceLevel): RiskTimer {
  const minutesSinceLast = minutesSince(state.lastIntakeTime);
  const baseMinutes = state.isSnoozed ? 20 : getBaseRiskMinutes(level, minutesSinceLast);
  return {
    minutes: baseMinutes,
    seconds: 0,
    urgency:
      level === 'PEAK' ? 'low' :
      level === 'BALANCED' ? 'medium' :
      level === 'RECOVERING' ? 'high' : 'critical',
  };
}

function getBaseRiskMinutes(level: PerformanceLevel, minutesSinceLast: number): number {
  const remaining = Math.max(0, 60 - minutesSinceLast);
  switch (level) {
    case 'PEAK': return Math.max(20, remaining);
    case 'BALANCED': return Math.max(15, Math.floor(remaining * 0.7));
    case 'RECOVERING': return Math.max(10, Math.floor(remaining * 0.4));
    case 'DEPLETED': return Math.max(5, Math.floor(remaining * 0.2) + 1);
  }
}

// ─── AI Command Generation (WHAT + WHEN + OUTCOME) ────────────────────────────
function generateCommand(level: PerformanceLevel, state: UserState, score: number): Command {
  // Sleep mode: morning command if overnight deficit is significant
  if (state.overnightLossOz > 8 && !state.hasSeenMorningCommand) {
    return {
      id: 'cmd-morning',
      action: `Drink ${Math.max(16, Math.round(state.overnightLossOz))} oz now. Recheck in 25 minutes. You are starting in deficit.`,
      explanation: `Overnight loss: ${state.overnightLossOz} oz. Reset your baseline before training.`,
      urgencyLevel: 'high',
      estimatedImpact: '+12 to score',
    };
  }

  switch (level) {
    case 'PEAK':
      return {
        id: 'cmd-peak',
        action: `Score ${score}. Peak. Drink 8 oz before next session. Hold the line.`,
        explanation: 'Maintain pace. Stick during exertion if heat or output rises.',
        urgencyLevel: 'low',
        estimatedImpact: '+2 to score',
      };
    case 'BALANCED':
      return {
        id: 'cmd-balanced',
        action: `Score ${score}. Balanced. Drink 12 oz now. Recheck in 45 minutes.`,
        explanation: 'You are on pace. Stay ahead of the next deficit window.',
        urgencyLevel: 'medium',
        estimatedImpact: '+5 to score',
      };
    case 'RECOVERING':
      return {
        id: 'cmd-recovering',
        action: `Score ${score}. Recovering. Take 1 AForce stick with 16 oz now. Recheck in 20 minutes.`,
        explanation: 'You are trending down. Reverse the curve before it accelerates.',
        urgencyLevel: 'high',
        estimatedImpact: '+10 to score',
      };
    case 'DEPLETED':
      return {
        id: 'cmd-depleted',
        action: `Score ${score}. Depleted. Drink 20 oz and take 2 sticks now. Recheck in 10 minutes.`,
        explanation: 'Critical deficit. Electrolytes required. Performance is compromised.',
        urgencyLevel: 'critical',
        estimatedImpact: '+18 to score',
      };
  }
}

// ─── Performance State Object ─────────────────────────────────────────────────
function buildPerformanceState(level: PerformanceLevel, score: number): PerformanceState {
  const stateColors = Colors.states[level];
  const config: Record<PerformanceLevel, Pick<PerformanceState, 'urgency' | 'pulseSpeed' | 'animationStyle'>> = {
    PEAK: { urgency: 'calm', pulseSpeed: 'fast', animationStyle: 'energize' },
    BALANCED: { urgency: 'moderate', pulseSpeed: 'slow', animationStyle: 'breathe' },
    RECOVERING: { urgency: 'high', pulseSpeed: 'medium', animationStyle: 'pulse' },
    DEPLETED: { urgency: 'critical', pulseSpeed: 'slow', animationStyle: 'tension' },
  };
  return {
    level,
    score,
    color: stateColors.primary,
    glowColor: stateColors.glow,
    ...config[level],
  };
}

// ─── Pulse Config (driven by service layer per spec) ──────────────────────────
function buildPulseConfig(level: PerformanceLevel, deltaMode: 'rising' | 'falling' | 'steady' = 'steady'): PulseConfig {
  // Per spec table: speed/glow/wave per state.
  const map: Record<PerformanceLevel, Omit<PulseConfig, 'deltaMode' | 'animations'>> = {
    PEAK: {
      pulseState: 'PEAK',
      pulseIntensity: 0.92,
      pulseSpeed: 0.70,
      glowStrength: 0.92,
      waveBehavior: 'sharp_outward',
      colorMode: 'lime',
    },
    BALANCED: {
      pulseState: 'BALANCED',
      pulseIntensity: 0.74,
      pulseSpeed: 0.30,
      glowStrength: 0.74,
      waveBehavior: 'steady_outward',
      colorMode: 'teal',
    },
    RECOVERING: {
      pulseState: 'RECOVERING',
      pulseIntensity: 0.55,
      pulseSpeed: 0.55,
      glowStrength: 0.50,
      waveBehavior: 'uneven_outward',
      colorMode: 'amber',
    },
    DEPLETED: {
      pulseState: 'DEPLETED',
      pulseIntensity: 0.40,
      pulseSpeed: 0.40,
      glowStrength: 0.30,
      waveBehavior: 'collapsing',
      colorMode: 'red',
    },
  };
  return {
    ...map[level],
    deltaMode,
    animations: {
      burstOnIntake: true,
      flareOnPeak: level === 'PEAK',
      collapseOnDepletion: level === 'DEPLETED',
    },
  };
}

// ─── Main Engine ──────────────────────────────────────────────────────────────
export function calculateScore(userState: UserState): ScoreEngineOutput {
  const { score, contributions } = buildBreakdown(userState);
  const level = resolveState(score);
  const performanceState = buildPerformanceState(level, score);
  const pulseConfig = buildPulseConfig(level);
  const reasons = generateReasons(userState);
  const riskTimer = calculateRiskTimer(userState, level);
  const command = generateCommand(level, userState, score);

  return { score, performanceState, pulseConfig, reasons, riskTimer, command, breakdown: contributions };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
export function minutesSince(date: Date): number {
  return Math.floor((Date.now() - date.getTime()) / 60000);
}

export function getStateLabel(level: PerformanceLevel): string {
  return level;
}

export function generateCycleIdentityMessage(level: PerformanceLevel): string {
  switch (level) {
    case 'PEAK': return 'Locked at peak.';
    case 'BALANCED': return 'Back in control.';
    case 'RECOVERING': return 'Recovery momentum gained.';
    case 'DEPLETED': return 'Deficit closing. Keep moving.';
  }
}

export function generateNextCycleHint(level: PerformanceLevel): string {
  switch (level) {
    case 'PEAK': return 'Next check in 20 minutes.';
    case 'BALANCED': return 'Next check in 15 minutes.';
    case 'RECOVERING': return 'Next check in 10 minutes.';
    case 'DEPLETED': return 'Recheck in 5 minutes.';
  }
}

// ─── Phase 2 Clutch Hydration Engine (mocked, weight-based) ───────────────────
/**
 * Per spec:
 *   daily_baseline_oz = 0.5 × body_weight_lbs
 *   game_target_oz    = 0.25 × body_weight_lbs + (12 × active_30_min_windows)
 *   sticks_needed     = ceil(game_target_oz / 20)
 */
export function clutchHydrationPlan(bodyWeightLbs: number, active30MinWindows: number) {
  const dailyBaselineOz = Math.round(0.5 * bodyWeightLbs);
  const gameTargetOz = Math.round(0.25 * bodyWeightLbs + 12 * active30MinWindows);
  const sticksNeeded = Math.ceil(gameTargetOz / 20);
  return { dailyBaselineOz, gameTargetOz, sticksNeeded };
}

export type ClutchTier = 'PLATINUM' | 'STABLE' | 'RECOVERY' | 'DEPLETED';
export function clutchTier(percent: number): ClutchTier {
  if (percent >= 90) return 'PLATINUM';
  if (percent >= 70) return 'STABLE';
  if (percent >= 50) return 'RECOVERY';
  return 'DEPLETED';
}

// ─── Phase 3 Guardian Risk Engine (mocked) ────────────────────────────────────
/**
 * Guardian thresholds:
 *   0–24 OPTIMAL / 25–49 WATCH / 50–74 MODERATE / 75–100 CRITICAL
 */
export function guardianRiskScore(input: {
  hydrationPercent: number;
  bodyWeightLbs: number;
  activeMinutes: number;
  heatIndex: number;
  sweatRate: number;
  coreTempEstimate: number;
  quarter: number;
  pH: number;
}): number {
  const dehydrationContribution = (100 - input.hydrationPercent) * 0.45;
  const heatContribution = Math.min(30, Math.max(0, (input.heatIndex - 75) * 0.8));
  const exertionContribution = Math.min(20, input.activeMinutes * 0.18);
  const coreTempContribution = Math.min(20, Math.max(0, (input.coreTempEstimate - 99) * 12));
  const phContribution = Math.min(10, Math.max(0, (7.0 - input.pH) * 6));
  const quarterContribution = input.quarter > 2 ? 4 : 0;
  return Math.max(0, Math.min(100, Math.round(
    dehydrationContribution + heatContribution + exertionContribution +
    coreTempContribution + phContribution + quarterContribution
  )));
}

export function guardianTier(score: number): 'OPTIMAL' | 'WATCH' | 'MODERATE' | 'CRITICAL' {
  if (score >= 75) return 'CRITICAL';
  if (score >= 50) return 'MODERATE';
  if (score >= 25) return 'WATCH';
  return 'OPTIMAL';
}
