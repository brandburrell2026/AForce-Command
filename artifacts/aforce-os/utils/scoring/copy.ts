import type {
  UserState,
  PerformanceLevel,
  ScoreReason,
  RiskTimer,
  Command,
  ScoreEngineOutput,
  PerformanceState,
  PulseConfig,
} from '../../types';
import { Colors } from '../../theme/colors';
import i18n from '../../services/i18nService';
import { minutesSince } from './breakdown';
import {
  deriveCommandConfidence,
  commandConfidenceInputsFromState,
} from './commandConfidence';

// ─── Context-aware explanation overlay ────────────────────────────────────────
/**
 * Performance Command Engine — composes the final coach explanation by
 * stacking the band-specific base copy with up to two context-aware
 * overlays (heat / time-of-day / pattern / no-action consequence).
 *
 * Inputs are pure (state + score + decayPerMinute + level); no React,
 * no UI dependencies. Returns a single space-joined string the existing
 * AICommandCard can render unchanged.
 *
 * Order is intentional — base first, then immediate context (heat,
 * gap), then pattern reinforcement (streak, late-night), then the
 * "if you do nothing" consequence as the closer. We cap at three
 * overlays so the card never overflows its 2-3 line slot.
 */
export function composeExplanation(
  base: string,
  state: UserState,
  score: number,
  decayPerMinute: number,
  level: PerformanceLevel,
  socialActive: boolean,
  minutesSinceLast: number,
): string {
  // Social Mode owns its own copy lane — its commands are highly
  // context-tuned (impairment, transportation, recovery window) and
  // appending generic heat/streak overlays would dilute the safety
  // signal. Skip overlays when social rollup is active.
  if (socialActive) return base;

  const parts: string[] = [base];
  let overlays = 0;
  const MAX_OVERLAYS = 2;

  // Heat — single highest-priority context modifier. Two tiers so
  // copy escalates with depletion rate.
  if (overlays < MAX_OVERLAYS) {
    if (state.heatLoad >= 8) {
      parts.push(i18n.t('coach.context_heat_high'));
      overlays++;
    } else if (state.heatLoad >= 6) {
      parts.push(i18n.t('coach.context_heat_elevated'));
      overlays++;
    }
  }

  // Late-night recovery window (10 PM – 5 AM). Skip at PEAK so we
  // don't tell a perfectly-hydrated user they're in a recovery
  // window for no reason.
  if (overlays < MAX_OVERLAYS && level !== 'PEAK') {
    const hour = new Date().getHours();
    if (hour >= 22 || hour < 5) {
      parts.push(i18n.t('coach.context_late_night'));
      overlays++;
    }
  }

  // Pattern: compliance streak — only surfaced when the system is
  // actually performing (PEAK/BALANCED) so it lands as positive
  // reinforcement, not a contrast against a critical command.
  if (
    overlays < MAX_OVERLAYS &&
    state.complianceStreak >= 4 &&
    (level === 'PEAK' || level === 'BALANCED')
  ) {
    parts.push(i18n.t('coach.pattern_streak', { count: state.complianceStreak }));
    overlays++;
  }

  // No-action consequence — projects 30 minutes ahead. Only fires
  // when the projected drop is meaningful (≥5 pts) and we're already
  // trending down. Used sparingly per spec ("to maintain impact").
  if (
    overlays < MAX_OVERLAYS &&
    decayPerMinute > 0.05 &&
    (level === 'RECOVERING' || level === 'DEPLETED')
  ) {
    const minutesAhead = 30;
    const projected = Math.max(0, Math.round(score - decayPerMinute * minutesAhead));
    if (projected <= score - 5) {
      parts.push(i18n.t('coach.consequence_drop', { projected, minutes: minutesAhead }));
      overlays++;
    }
  }

  return parts.join(' ');
}

// ─── Reasons Generation ───────────────────────────────────────────────────────
export function generateReasons(state: UserState): ScoreReason[] {
  const reasons: ScoreReason[] = [];
  const minutesSinceLast = minutesSince(state.lastIntakeTime);

  if (minutesSinceLast > 60) {
    reasons.push({ id: 'intake-late', text: `Last intake ${minutesSinceLast} min ago.`, weight: 'negative' });
  } else if (minutesSinceLast < 25) {
    reasons.push({ id: 'intake-recent', text: 'Recent intake is active.', weight: 'positive' });
  }

  const ozRatio = state.ozConsumedToday / state.ozTarget;
  if (ozRatio < 0.5) {
    reasons.push({ id: 'pace-behind', text: 'You are behind your daily ounces pace.', weight: 'negative' });
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
    reasons.push({ id: 'overnight', text: `Overnight deficit ${state.overnightLossOz} ounces.`, weight: 'negative' });
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
export function calculateRiskTimer(state: UserState, level: PerformanceLevel): RiskTimer {
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

export function getBaseRiskMinutes(level: PerformanceLevel, minutesSinceLast: number): number {
  const remaining = Math.max(0, 60 - minutesSinceLast);
  switch (level) {
    case 'PEAK': return Math.max(20, remaining);
    case 'BALANCED': return Math.max(15, Math.floor(remaining * 0.7));
    case 'RECOVERING': return Math.max(10, Math.floor(remaining * 0.4));
    case 'DEPLETED': return Math.max(5, Math.floor(remaining * 0.2) + 1);
  }
}

// ─── AI Command Generation (WHAT + WHEN + OUTCOME) ────────────────────────────
// Localized via i18n.t() so the AI coach speaks (and reads) in the user's
// chosen language. Strings live under the `coach.*` namespace in
// `artifacts/aforce-os/locales/*.json`. The score engine stays sync /
// pure from the caller's perspective — i18next.t is itself sync.

export function generateSocialCommand(state: UserState, social: NonNullable<ScoreEngineOutput['social']>): Command | null {
  // Recovery Mode (drinking ended within 8h) — coach pivots to recovery
  // protocol. Calm, non-judgmental, never "don't drink".
  if (social.inRecoveryWindow && !social.active) {
    return {
      id: 'cmd-social-recovery',
      action: i18n.t('coach.social_recovery_action'),
      explanation: i18n.t('coach.social_recovery_explanation'),
      urgencyLevel: 'high',
      estimatedImpact: '+15 to score',
    };
  }
  if (!social.active) return null;
  const drinks = state.socialMode?.drinks ?? [];
  const lastDrink = drinks.length > 0 ? drinks[drinks.length - 1] : null;
  const minutesSinceDrink = lastDrink
    ? (Date.now() - lastDrink.loggedAt.getTime()) / 60000
    : Infinity;

  // CRITICAL impairment → strongest, most protective copy. Pulls rank
  // over hydration nudges because the safer next move is to stop and
  // arrange a ride. Never says "don't drink" — says "stop alcohol
  // intake. Recovery required." per the safety spec.
  if (social.impairment.level === 'CRITICAL') {
    return {
      id: 'cmd-social-stop-critical',
      action: i18n.t('coach.social_stop_action'),
      explanation: i18n.t('coach.social_do_not_drive_explanation'),
      urgencyLevel: 'critical',
      estimatedImpact: '+18 to score',
    };
  }
  // HIGH impairment → "do not drive" + transportation prompt. Still
  // calm, still protective.
  if (social.impairment.level === 'HIGH') {
    return {
      id: 'cmd-social-do-not-drive',
      action: i18n.t('coach.social_do_not_drive_action'),
      explanation: i18n.t('coach.social_do_not_drive_explanation'),
      urgencyLevel: 'critical',
      estimatedImpact: '+15 to score',
    };
  }
  // Just logged a drink → hydration command (within 5 min). Skip
  // when the user has already confirmed hydration for that drink so
  // we don't repeat ourselves.
  if (minutesSinceDrink <= 5 && lastDrink?.hydrated !== true) {
    return {
      id: 'cmd-social-hydrate',
      action: i18n.t('coach.social_drink_water_action'),
      explanation: i18n.t('coach.social_drink_water_explanation'),
      urgencyLevel: 'high',
      estimatedImpact: '+8 to score',
    };
  }
  // CRITICAL/HIGH hangover risk → push AForce RTD harder.
  if (social.hangoverRisk.level === 'CRITICAL' || social.hangoverRisk.level === 'HIGH') {
    return {
      id: 'cmd-social-rtd',
      action: i18n.t('coach.social_take_rtd_action'),
      explanation: i18n.t('coach.social_take_rtd_explanation', { score: social.hangoverRisk.score }),
      urgencyLevel: 'critical',
      estimatedImpact: '+12 to score',
    };
  }
  // Default in-mode prompt — slow the pace, alternate.
  return {
    id: 'cmd-social-pace',
    action: i18n.t('coach.social_slow_intake_action', { count: drinks.length }),
    explanation: i18n.t('coach.social_slow_intake_explanation', { count: drinks.length }),
    urgencyLevel: 'medium',
    estimatedImpact: '+5 to score',
  };
}

export function generateCommand(level: PerformanceLevel, state: UserState, score: number, social: ScoreEngineOutput['social']): Command {
  // Command Confidence™ — attach a data-completeness signal to every command
  // so the card can show how grounded the recommendation is. Derived ONLY
  // from real signals already in state; never fabricated and never touches
  // the score (Score-Protection).
  const confidence = deriveCommandConfidence(commandConfidenceInputsFromState(state));
  return { ...buildBaseCommand(level, state, score, social), confidence };
}

function buildBaseCommand(level: PerformanceLevel, state: UserState, score: number, social: ScoreEngineOutput['social']): Command {
  // Social Mode takes precedence over the standard PEAK/BALANCED/etc
  // protocol — the user is actively drinking (or just stopped) and the
  // coach must speak to that, not generic hydration math.
  if (social) {
    const social_cmd = generateSocialCommand(state, social);
    if (social_cmd) return social_cmd;
  }
  // Sleep mode: morning command if overnight deficit is significant
  if (state.overnightLossOz > 8 && !state.hasSeenMorningCommand) {
    const oz = Math.max(16, Math.round(state.overnightLossOz));
    return {
      id: 'cmd-morning',
      action: i18n.t('coach.morning_action', { oz }),
      explanation: i18n.t('coach.morning_explanation', { oz: state.overnightLossOz }),
      urgencyLevel: 'high',
      estimatedImpact: '+12 to score',
    };
  }

  switch (level) {
    case 'PEAK':
      return {
        id: 'cmd-peak',
        action: i18n.t('coach.peak_action', { score }),
        explanation: i18n.t('coach.peak_explanation'),
        urgencyLevel: 'low',
        estimatedImpact: '+2 to score',
      };
    case 'BALANCED':
      return {
        id: 'cmd-balanced',
        action: i18n.t('coach.balanced_action', { score }),
        explanation: i18n.t('coach.balanced_explanation'),
        urgencyLevel: 'medium',
        estimatedImpact: '+5 to score',
      };
    case 'RECOVERING':
      return {
        id: 'cmd-recovering',
        action: i18n.t('coach.recovering_action', { score }),
        explanation: i18n.t('coach.recovering_explanation'),
        urgencyLevel: 'high',
        estimatedImpact: '+10 to score',
      };
    case 'DEPLETED':
      return {
        id: 'cmd-depleted',
        action: i18n.t('coach.depleted_action', { score }),
        explanation: i18n.t('coach.depleted_explanation'),
        urgencyLevel: 'critical',
        estimatedImpact: '+18 to score',
      };
  }
}

// ─── Performance State Object ─────────────────────────────────────────────────
export function buildPerformanceState(level: PerformanceLevel, score: number): PerformanceState {
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
export function buildPulseConfig(level: PerformanceLevel, deltaMode: 'rising' | 'falling' | 'steady' = 'steady'): PulseConfig {
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
