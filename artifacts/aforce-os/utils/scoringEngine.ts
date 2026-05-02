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
  ScorePrediction,
  SocialModeState,
} from '../types';
import { Colors } from '../theme/colors';
import { activeDecayMultiplier, socialIntakePoints, SOCIAL_INTAKE_MAX_PENALTY } from './hangoverRisk';
import { aggregateBiometrics } from './biometricsAggregator';
import { materializedIntakePoints } from '../services/hydrationScoreService';
import { depletionRatePerMinute } from './depletionRate';

function resolveState(score: number): PerformanceLevel {
  if (score >= 90) return 'PEAK';
  if (score >= 75) return 'BALANCED';
  if (score >= 60) return 'RECOVERING';
  return 'DEPLETED';
}

// ─── Score Breakdown ──────────────────────────────────────────────────────────
function buildBreakdown(state: UserState): { score: number; contributions: ScoreContribution[]; decayPerMinute: number; minutesSinceLast: number } {
  const minutesSinceLast = minutesSince(state.lastIntakeTime);

  // Per-event hydration scoring (replaces the old running-aggregate
  // baseIntake + aforceBonus model). Each event carries its own
  // pre-computed impact decomposition; the materializer ramps the
  // delayed portion in linearly over the absorption window so the orb
  // keeps moving for ~10–25 min after a log — feels like the body
  // absorbing in real time. When `intakeEvents` is empty (legacy
  // state pre-migration), we fall back to the running-aggregate so
  // the score still renders.
  // TODO(remove): legacy baseIntake/aforceBonus running-aggregate
  // fallback. Safe to delete once we've confirmed no production rows
  // are missing `intakeEvents` (migration shipped 2026-Q1).
  const events = state.intakeEvents ?? [];
  let baseIntake: number;
  let aforceBonus: number;
  if (events.length > 0) {
    const m = materializedIntakePoints(events, new Date());
    baseIntake = Math.round(m.waterPoints);
    aforceBonus = Math.round(m.aforcePoints);
  } else {
    const ozRatio = Math.min(1, state.ozConsumedToday / state.ozTarget);
    baseIntake = Math.round(45 * ozRatio);
    aforceBonus = Math.min(50, Math.max(0, (state.aforceUnitsToday ?? 0) * 12));
  }

  // Per spec: continuous decay model (replaces the old tiered "recency").
  // Score(t) = previous − decay × time + inputs. We translate that into
  // a single contribution called "decay since last intake" so the
  // breakdown UI keeps its bar-and-label shape while the score itself
  // honors the spec formula.
  const decayPerMinute = computeDecayPerMinute(state);
  // Continuous decay — no artificial cap. The final score is clamped
  // to 0..100 below, so a long deficit naturally pins the user at 0
  // (DEPLETED) instead of plateauing inside the band.
  const decayMagnitude = computeDecayPoints(state, minutesSinceLast);
  const decayContribution = -Math.round(decayMagnitude);
  // Stored under id="recency" so any saved rows / tests that key off
  // that id continue to work — the label and meaning have been
  // upgraded to match the spec.
  const recency = decayContribution;

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
  const confirmation = computeConfirmationDelta(state);

  // Per-event social-mode penalty: each logged alcohol drink moves the
  // score immediately (alcohol diuresis ≈ 5 oz of net water loss per
  // standard drink), with `/social/hydrate` confirmations cutting the
  // penalty by 60 %. See `socialIntakePoints` for the time profile.
  const socialDrinks = state.socialMode?.drinks ?? [];
  const socialIntake = socialIntakePoints(socialDrinks);

  const raw = baseIntake + aforceBonus + recency + consistency + context + recoveryMomentum
            + symptomPenalty + urinePenalty + outputStress + sleepCarry
            + recovery.delta + confirmation + socialIntake.penalty;
  const score = Math.max(0, Math.min(100, Math.round(raw)));

  const aforceUnits = state.aforceUnitsToday ?? 0;
  const contributions: ScoreContribution[] = [
    { id: 'base', label: 'Base intake (oz vs target)', delta: baseIntake, maxMagnitude: 45,
      hint: `${state.ozConsumedToday} of ${state.ozTarget} oz` },
    { id: 'aforce_bonus', label: 'AForce protocol bonus', delta: aforceBonus, maxMagnitude: 50,
      hint: aforceUnits === 0
        ? 'Log an AForce stick or RTD'
        : `${aforceUnits} AForce intake${aforceUnits === 1 ? '' : 's'} today` },
    { id: 'recency', label: 'Decay since last intake', delta: recency, maxMagnitude: 35,
      hint: `${minutesSinceLast} min · ${decayPerMinute.toFixed(2)} pts/min${state.clutchActive ? ' (clutch ×1.3)' : ''}` },
    { id: 'confirmation', label: 'Last command confirmation', delta: confirmation, maxMagnitude: 3,
      hint: confirmation > 0 ? 'Followed last recheck' : confirmation < 0 ? 'Missed last recheck' : 'No recent recheck' },
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
    { id: 'health_signals', label: recovery.label, delta: recovery.delta, maxMagnitude: 10,
      hint: recovery.hint },
  ];

  // Only surface the Social-mode row when there is something to show —
  // an empty row at delta 0 is just visual noise on the breakdown sheet.
  if (socialIntake.activeDrinks > 0) {
    const hydratedNote = socialIntake.hydratedDrinks > 0
      ? ` · ${socialIntake.hydratedDrinks} hydrated (-60 %)`
      : '';
    contributions.push({
      id: 'social_intake',
      label: 'Social mode intake',
      delta: Math.round(socialIntake.penalty),
      maxMagnitude: SOCIAL_INTAKE_MAX_PENALTY,
      hint: `${socialIntake.activeDrinks} drink${socialIntake.activeDrinks === 1 ? '' : 's'} active${hydratedNote}`,
    });
  }

  return { score, contributions, decayPerMinute, minutesSinceLast };
}

/**
 * Continuous decay (points / minute) — physiologically grounded.
 *
 * The previous formula (`BaseDecay = 0.4×weight/150 + 0.1×activity`,
 * additive heat/humidity terms) was ~5× too aggressive at rest and
 * catastrophic in heat (sitting in 35 °C depleted PEAK→DEPLETED in
 * 17 minutes). The math has been re-grounded against ACSM/IOM/ISO 7933
 * sources and lives in `utils/depletionRate.ts` so it can be unit-
 * tested in plain node/vitest. See that file's header for the full
 * physiology references and anchor scenarios.
 *
 * This wrapper just adapts UserState → DepletionInputs and folds in
 * the social-mode multiplier (which depends on the drinks list, kept
 * outside the pure helper so the helper stays zero-dep).
 */
function computeDecayPerMinute(state: UserState): number {
  const socialDecayMultiplier = state.socialMode?.active
    ? activeDecayMultiplier(state.socialMode.drinks)
    : 1;

  // Multi-provider activity floor: when any connected health platform
  // (WHOOP strain, Strava workout minutes, Garmin GPS workout, Apple
  // Health steps, etc.) shows the user has been more active than the
  // manual `activityLevel` slider, use the inferred level as a FLOOR.
  // This way a heavy training day automatically depletes faster even
  // if the user never bumped the activity axis themselves.
  let activityLevel = state.activityLevel;
  if (state.biometrics && Object.keys(state.biometrics).length > 0) {
    const agg = aggregateBiometrics(state.biometrics);
    if (agg.inferredActivityLevel > activityLevel) {
      activityLevel = agg.inferredActivityLevel;
    }
  }

  // NOTE: the +0.5 missed-command boost is NOT folded into the per-min
  // rate here, because the rate is reported to the prediction strip and
  // multiplied by elapsed time in `computeDecayPoints`. Folding it in
  // would (a) misreport the steady-state rate after the 10-min window
  // expires and (b) retroactively apply the boost to time the user
  // spent before they ever missed the recheck. The boost is integrated
  // separately in `computeDecayPoints` over its true active overlap.
  return depletionRatePerMinute({
    bodyWeightLbs: state.bodyWeightLbs,
    activityLevel,
    weatherTempC: state.weatherTempC,
    weatherHumidity: state.weatherHumidity,
    heatLoad: state.heatLoad,
    isAwake: state.isAwake,
    clutchActive: state.clutchActive,
    socialDecayMultiplier,
  });
}

/**
 * Total decay (in score points) accumulated over `minutesSinceLast`
 * minutes since the last intake. Splits into:
 *   - Baseline: `decayPerMinute × minutesSinceLast`
 *   - Boost overlap: `0.5 × (overlap minutes between the active 10-min
 *     missed-command window and the [lastIntake, now] interval)`.
 *
 * Boost integration only counts the slice of the boost window that
 * actually fell after the last intake — anything before the intake has
 * no remaining decay to apply (intake reset the score).
 */
function computeDecayPoints(state: UserState, minutesSinceLast: number): number {
  const baseline = computeDecayPerMinute(state) * Math.max(0, minutesSinceLast);

  let boost = 0;
  if (state.clutchDecayBoostUntil) {
    const boostEndMs = state.clutchDecayBoostUntil.getTime();
    const boostStartMs = boostEndMs - 10 * 60 * 1000;
    const intakeMs = state.lastIntakeTime.getTime();
    const nowMs = Date.now();
    const overlapStart = Math.max(boostStartMs, intakeMs);
    const overlapEnd = Math.min(boostEndMs, nowMs);
    if (overlapEnd > overlapStart) {
      boost = 0.5 * ((overlapEnd - overlapStart) / 60000);
    }
  }
  return baseline + boost;
}

/**
 * ±3 swing from the post-recheck confirmation loop (T2). Stale entries
 * (older than 30 minutes) are ignored so the bonus / penalty does not
 * stick to the score forever.
 */
function computeConfirmationDelta(state: UserState): number {
  if (state.confirmationDelta == null) return 0;
  if (!state.confirmationDeltaSetAt) return 0;
  const ageMin = (Date.now() - state.confirmationDeltaSetAt.getTime()) / 60000;
  if (ageMin > 30) return 0;
  return Math.max(-3, Math.min(3, Math.round(state.confirmationDelta)));
}

function buildPrediction(score: number, decayPerMinute: number): ScorePrediction {
  if (score <= 40) {
    return { decayPerMinute, minutesToDepleted: 0, label: 'Already in DEPLETED zone' };
  }
  if (decayPerMinute <= 0) {
    return { decayPerMinute, minutesToDepleted: null, label: 'Holding stable — no decay' };
  }
  const minutes = Math.max(1, Math.round((score - 40) / decayPerMinute));
  if (minutes >= 240) {
    return { decayPerMinute, minutesToDepleted: minutes, label: `4+ hours to DEPLETED (${decayPerMinute.toFixed(2)} pts/min)` };
  }
  if (minutes >= 60) {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return { decayPerMinute, minutesToDepleted: minutes, label: `Drops to DEPLETED in ${h}h ${m}m` };
  }
  return { decayPerMinute, minutesToDepleted: minutes, label: `Drops to DEPLETED in ${minutes} min` };
}

/**
 * Translate the user's connected health platforms into a -10..+10
 * adjustment to the score. The previous version only read Apple Health;
 * the score now derives from any combination of the seven providers
 * in `data/healthProviders.ts` (Apple Health, Oura, Samsung Health,
 * Google Health Connect, Garmin, WHOOP, Strava).
 *
 * Aggregation lives in `utils/biometricsAggregator.ts`; this wrapper
 * just adapts UserState → that helper, with a fallback to the legacy
 * `appleHealth` field if `biometrics` was never populated.
 *
 * The ±10 clamp is preserved end-to-end so multi-provider data can
 * never dominate the score.
 */
function computeRecoverySignal(state: UserState): { delta: number; hint: string; label: string } {
  // Prefer the multi-provider record when present.
  if (state.biometrics && Object.keys(state.biometrics).length > 0) {
    const agg = aggregateBiometrics(state.biometrics);
    const label = agg.sources.length === 1
      ? 'Health platform (HRV / sleep / strain)'
      : `Health platforms (${agg.sources.length} connected)`;
    if (agg.recoveryDelta === 0 && agg.hint.startsWith('No') === false) {
      return { delta: 0, hint: agg.hint, label };
    }
    return { delta: agg.recoveryDelta, hint: agg.hint, label };
  }

  // Legacy fallback — preserved so existing callers / saved states
  // that only have `appleHealth` still get a recovery contribution.
  const snap = state.appleHealth;
  if (!snap) return { delta: 0, hint: 'Not connected', label: 'Health platforms (none connected)' };

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

  // Clamp to ±10 so a single platform can never dominate the score.
  delta = Math.max(-10, Math.min(10, delta));

  if (parts.length === 0) return { delta: 0, hint: 'Awaiting data', label: 'Apple Health (HRV + sleep)' };
  return { delta, hint: parts.join(' · '), label: 'Apple Health (HRV + sleep)' };
}

// ─── Score Calculation ────────────────────────────────────────────────────────
function calculateBaseScore(state: UserState): number {
  // Per-event hydration scoring — mirrors buildBreakdown so the score
  // and the prediction strip agree. Falls back to the legacy running-
  // aggregate when no events are present.
  // TODO(remove): legacy baseIntake/aforceBonus running-aggregate
  // fallback. Safe to delete once we've confirmed no production rows
  // are missing `intakeEvents` (migration shipped 2026-Q1).
  const events = state.intakeEvents ?? [];
  let baseIntake: number;
  let aforceBonus: number;
  if (events.length > 0) {
    const m = materializedIntakePoints(events, new Date());
    baseIntake = Math.round(m.waterPoints);
    aforceBonus = Math.round(m.aforcePoints);
  } else {
    const ozRatio = Math.min(1, state.ozConsumedToday / state.ozTarget);
    baseIntake = Math.round(45 * ozRatio);
    aforceBonus = Math.min(50, Math.max(0, (state.aforceUnitsToday ?? 0) * 12));
  }

  // Continuous decay (per spec) replaces the tiered recency tier.
  const minutesSinceLast = minutesSince(state.lastIntakeTime);
  const recency = -Math.round(computeDecayPoints(state, minutesSinceLast));

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

  const confirmation = computeConfirmationDelta(state);

  // Per-event social-mode penalty — must mirror buildBreakdown so that
  // ScoreEngineOutput.score and the contribution sum agree.
  const socialIntake = socialIntakePoints(state.socialMode?.drinks ?? []);

  const raw = baseIntake + aforceBonus + recency + consistency + context + recoveryMomentum
            + symptomPenalty + urinePenalty + outputStress + sleepCarry
            + recovery.delta + confirmation + socialIntake.penalty;

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
// Localized via i18n.t() so the AI coach speaks (and reads) in the user's
// chosen language. Strings live under the `coach.*` namespace in
// `artifacts/aforce-os/locales/*.json`. The score engine stays sync /
// pure from the caller's perspective — i18next.t is itself sync.
import i18n from '../services/i18nService';

function generateSocialCommand(state: UserState, social: NonNullable<ScoreEngineOutput['social']>): Command | null {
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
    action: i18n.t('coach.social_slow_intake_action'),
    explanation: i18n.t('coach.social_slow_intake_explanation', { count: drinks.length }),
    urgencyLevel: 'medium',
    estimatedImpact: '+5 to score',
  };
}

// Rollup logic now lives in `services/socialModeEngine.ts` so the BAC
// estimator + legal-safety service have a single point of orchestration.
import { buildSocialRollup } from '../services/socialModeEngine';

function generateCommand(level: PerformanceLevel, state: UserState, score: number, social: ScoreEngineOutput['social']): Command {
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
  const { score, contributions, decayPerMinute } = buildBreakdown(userState);
  const level = resolveState(score);
  const performanceState = buildPerformanceState(level, score);
  const pulseConfig = buildPulseConfig(level);
  const reasons = generateReasons(userState);
  const riskTimer = calculateRiskTimer(userState, level);
  const social = buildSocialRollup(userState);
  const command = generateCommand(level, userState, score, social);
  const prediction = buildPrediction(score, decayPerMinute);

  return { score, performanceState, pulseConfig, reasons, riskTimer, command, breakdown: contributions, prediction, social };
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

// ─── Coach Recommendation Engine (Phase 2 + 3) ────────────────────────────────
/**
 * Per-athlete recommendation a coach can act on at the next dead ball.
 * Tone follows the AI command spec: WHAT + WHEN/HOW MUCH + OUTCOME, command
 * authority, no soft language ("consider / try / suggest").
 */
export type CoachAction = 'maintain' | 'top_off' | 'restore' | 'reduce_reps' | 'pull';

export interface ClutchRecommendation {
  tier: ClutchTier;
  action: CoachAction;
  fluidOz: number;
  sticks: number;
  recheckMinutes: number;
  command: string;
  detail: string;
}

export interface GuardianRecommendation {
  tier: 'OPTIMAL' | 'WATCH' | 'MODERATE' | 'CRITICAL';
  action: CoachAction;
  fluidOz: number;
  sticks: number;
  recheckMinutes: number;
  command: string;
  detail: string;
}

/**
 * Coach recommendation for a single player on the Clutch dashboard. Driven
 * purely by the player's hydration score (0–100), tier-banded so coaches can
 * scan the roster in a glance and execute at the next dead ball.
 */
export function clutchRecommendation(input: {
  hydrationScore: number;
  position?: string;
}): ClutchRecommendation {
  const tier = clutchTier(input.hydrationScore);
  switch (tier) {
    case 'PLATINUM':
      return {
        tier,
        action: 'maintain',
        fluidOz: 8,
        sticks: 0,
        recheckMinutes: 30,
        command: 'Maintain. 8 oz water at next break.',
        detail: 'Keep rotation. Recheck end of quarter.',
      };
    case 'STABLE':
      return {
        tier,
        action: 'top_off',
        fluidOz: 12,
        sticks: 1,
        recheckMinutes: 20,
        command: '12 oz + 1 stick at next dead ball.',
        detail: 'Hold rotation. Recheck in 20 min.',
      };
    case 'RECOVERY':
      return {
        tier,
        action: 'restore',
        fluidOz: 16,
        sticks: 2,
        recheckMinutes: 10,
        command: '16 oz + 2 sticks now.',
        detail: 'Move to shaded area. Recheck in 10 min.',
      };
    case 'DEPLETED':
    default:
      return {
        tier,
        action: 'pull',
        fluidOz: 24,
        sticks: 3,
        recheckMinutes: 5,
        command: 'PULL FROM ROTATION. 24 oz + 3 sticks.',
        detail: 'Cooling protocol. Recheck core temp in 5 min.',
      };
  }
}

/**
 * Coach recommendation for a single player on the Guardian dashboard. Driven
 * by the composite Guardian risk (0–100). At MODERATE / CRITICAL we escalate
 * to medical eval and pull the athlete from rotation.
 */
export function guardianRecommendation(input: {
  guardianRisk: number;
  position?: string;
}): GuardianRecommendation {
  const tier = guardianTier(input.guardianRisk);
  switch (tier) {
    case 'OPTIMAL':
      return {
        tier,
        action: 'maintain',
        fluidOz: 8,
        sticks: 0,
        recheckMinutes: 30,
        command: 'Continue play. 8 oz at next break.',
        detail: 'Standard recheck next series.',
      };
    case 'WATCH':
      return {
        tier,
        action: 'top_off',
        fluidOz: 15,
        sticks: 1,
        recheckMinutes: 15,
        command: '15 oz + 1 stick at next break.',
        detail: 'Monitor next series. Recheck in 15 min.',
      };
    case 'MODERATE':
      return {
        tier,
        action: 'reduce_reps',
        fluidOz: 20,
        sticks: 2,
        recheckMinutes: 8,
        command: 'Reduce reps 30%. 20 oz + 2 sticks.',
        detail: 'Cooling towel. Recheck core temp in 8 min.',
      };
    case 'CRITICAL':
    default:
      return {
        tier,
        action: 'pull',
        fluidOz: 24,
        sticks: 2,
        recheckMinutes: 5,
        command: 'PULL FROM ROTATION. Medical eval.',
        detail: 'Cooling protocol now. 24 oz + 2 sticks. Recheck in 5 min.',
      };
  }
}
