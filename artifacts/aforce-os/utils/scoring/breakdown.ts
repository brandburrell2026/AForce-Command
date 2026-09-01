import type {
  UserState,
  PerformanceLevel,
  ScoreContribution,
  ScorePrediction,
} from '../../types';
import { activeDecayMultiplier, socialIntakePoints, SOCIAL_INTAKE_MAX_PENALTY } from '../hangoverRisk';
import { aggregateBiometrics } from '../biometricsAggregator';
import { materializedIntakePoints, HYDRATION_PTS_PER_OZ } from '../../services/hydrationScoreService';
import {
  HYDROSTATE_V1_VOLUME_CEILING,
  HYDROSTATE_V1_COVERAGE_CAP,
} from '../../config/hydroStateModel';
import { urineContribution, evaluateEvidence, resolveStateV1 } from './hydroStateV1';
import type { EvidenceVerdict } from './hydroStateV1';
import { depletionRatePerMinute } from '../depletionRate';
import { HEALTH_PROVIDERS } from '../../data/healthProviders';

export function resolveState(score: number): PerformanceLevel {
  if (score >= 90) return 'PEAK';
  if (score >= 75) return 'BALANCED';
  if (score >= 60) return 'RECOVERING';
  return 'DEPLETED';
}

// ─── Score Breakdown ──────────────────────────────────────────────────────────
//
// `now` (epoch ms) is injectable so the score is a pure function of (state, now)
// — deterministic in tests and shareable by the ledger-hybrid input projection.
// It defaults to `Date.now()`, so every existing caller is behaviourally
// unchanged. Score-Protection is untouched: the clock only decides how much
// time has elapsed for decay/recency, never what behaviour counts.
export function buildBreakdown(state: UserState, now: number = Date.now()): {
  score: number;
  contributions: ScoreContribution[];
  decayPerMinute: number;
  minutesSinceLast: number;
  factorDeltas: Record<string, number>;
  /**
   * HydroState v1.0 — the physiological evidence behind the number, and the
   * band that evidence supports. `level` is the v1.0 band: it is the ONLY
   * place PEAK eligibility is decided, because PEAK is a claim about the
   * member's physiology and volume alone must never be able to assert it.
   *
   * NOT YET CONSUMED BY THE ENGINE. `utils/scoringEngine.ts` still derives its
   * level from `resolveState(score)`, which is score-only. That file is
   * OFF-LIMITS under CLAUDE.md, so the one-line change that would consume this
   * is flagged for founder approval rather than made here. See the PR body.
   */
  evidence: EvidenceVerdict;
  level: PerformanceLevel;
} {
  const minutesSinceLast = minutesSince(state.lastIntakeTime, now);

  // Per-event hydration scoring (replaces the old running-aggregate
  // running-aggregate model). Each event carries its own
  // pre-computed impact decomposition; the materializer ramps the
  // delayed portion in linearly over the absorption window so the orb
  // keeps moving for ~10–25 min after a log — feels like the body
  // absorbing in real time. When `intakeEvents` is empty (legacy
  // state pre-migration), we fall back to the running-aggregate so
  // the score still renders.
  // TODO(remove): legacy running-aggregate fallback. Safe to delete once
  // we've confirmed no production rows are missing `intakeEvents`
  // (migration shipped 2026-Q1). Since RP-8b this branch is volume-only —
  // it no longer carries a brand term either.
  // HydroState v1.0 — intake is TARGET-RELATIVE and SATURATING.
  //
  // v0 credited absolute ounces on a flat per-ounce curve, so the intake side
  // could only ever restore ~48 of the 100 points the loss side is documented
  // to represent; the brand bonus was numerically bridging that gap. With the
  // commercial term gone the gap has to close honestly. Coverage is measured
  // against the member's OWN requirement and saturates there, so the top of the
  // scale is reached by MEETING the target rather than by drinking the most.
  // The ceiling sits one point below PEAK, which is what makes "volume alone
  // cannot reach PEAK" arithmetic rather than policy.
  //
  // VOLUME PARITY (RP-8b): water and product points ride the identical
  // per-ounce curve, so they are ONE physiological term. The split survives
  // inside the materializer for provenance reporting only.
  const events = state.intakeEvents ?? [];
  const targetPoints = state.ozTarget > 0 ? state.ozTarget * HYDRATION_PTS_PER_OZ : 0;
  const materialized = events.length > 0
    ? materializedIntakePoints(events, new Date(now)).total
    : state.ozConsumedToday * HYDRATION_PTS_PER_OZ;
  // No invented denominator: an unset target yields zero coverage rather than
  // a divide-by-zero or a fabricated 100%.
  const coverage = targetPoints > 0
    ? Math.min(HYDROSTATE_V1_COVERAGE_CAP, materialized / targetPoints)
    : 0;
  const baseIntake = HYDROSTATE_V1_VOLUME_CEILING * coverage;

  // Per spec: continuous decay model (replaces the old tiered "recency").
  // Score(t) = previous − decay × time + inputs. We translate that into
  // a single contribution called "decay since last intake" so the
  // breakdown UI keeps its bar-and-label shape while the score itself
  // honors the spec formula.
  const decayPerMinute = computeDecayPerMinute(state, now);
  // Read-only echo of the same floor `computeDecayPerMinute` already
  // applied internally — see `resolveEffectiveActivityLevel`'s doc
  // comment. Used only to disclose the floor on the 'recency' hint below;
  // does not change `decayPerMinute` or the score.
  const effectiveActivity = resolveEffectiveActivityLevel(state);
  // Continuous decay — no artificial cap. The final score is clamped
  // to 0..100 below, so a long deficit naturally pins the user at 0
  // (DEPLETED) instead of plateauing inside the band.
  const decayMagnitude = computeDecayPoints(state, minutesSinceLast, now);
  const decayContribution = -Math.round(decayMagnitude);
  // Stored under id="recency" so any saved rows / tests that key off
  // that id continue to work — the label and meaning have been
  // upgraded to match the spec.
  const recency = decayContribution;




  let symptomPenalty = 0;
  if (state.symptomState === 'severe') symptomPenalty = -22;
  else if (state.symptomState === 'moderate') symptomPenalty = -14;
  else if (state.symptomState === 'mild') symptomPenalty = -6;
  symptomPenalty -= Math.min(8, state.symptoms.length * 2);

  // Observed-gated Variant C (founder ruling 1). Symmetric around neutral, so a
  // genuinely clear reading is positive corroboration rather than merely the
  // absence of a penalty — but ONLY for a value production could have emitted.
  // An unobserved signal contributes nothing: UNKNOWN is not FAVOURABLE.
  const urine = urineContribution(state.urineSignal);
  const urinePoints = urine.points;

  const recovery = computeRecoverySignal(state);

  // Per-event social-mode penalty: each logged alcohol drink moves the
  // score immediately (alcohol diuresis ≈ 5 oz of net water loss per
  // standard drink), with `/social/hydrate` confirmations cutting the
  // penalty by 60 %. See `socialIntakePoints` for the time profile.
  const socialDrinks = state.socialMode?.drinks ?? [];
  const socialIntake = socialIntakePoints(socialDrinks, now);

  // HydroState v1.0 — PHYSIOLOGY ONLY.
  //
  // Gone from the score: `consistency` (compliance streak), `confirmation`
  // (did you obey the last command) and `recoveryMomentum` (drank recently).
  // Those measure conduct, not hydration, and together they supplied 33 of the
  // 48 available non-intake positive points in v0 — a member could look
  // physiologically strong for being obedient. Adherence remains a real
  // product concept; it is simply not a physiological measurement and no
  // longer moves HydroState.
  //
  // Also folded out: `context` and `outputStress` (heat / sweat / activity are
  // already priced by `computeDecayPoints`, so a separate term double-counted
  // them) and `sleepCarry` (overnight loss is priced by the same decay model's
  // sleep multiplier).
  const raw = baseIntake + recency + symptomPenalty + urinePoints
            + recovery.delta + socialIntake.penalty;
  const score = Math.max(0, Math.min(100, Math.round(raw)));

  // Instrumentation vector (founder-approved 2026-08-18): the EXACT unrounded
  // terms summed into `raw` above, captured so a persisted snapshot can answer
  // "why did this score change?" without a device test or code audit. The
  // contribution rows below round some values for display (`recovery`,
  // `social_intake`), so they cannot be reused here — the vector must sum to
  // `raw` exactly or it explains nothing. `clamped` records what the 0-100
  // clamp absorbed. Deltas only: labels and maxMagnitude (the proprietary
  // weights) are deliberately excluded, here and at every consumer.
  // `+ 0` normalises negative zero (e.g. the urine term at signal <= 3) so
  // JSON never carries `-0`.
  const factorDeltas: Record<string, number> = {
    base: baseIntake + 0,
    recency: recency + 0,
    symptom: symptomPenalty + 0,
    urine: urinePoints + 0,
    health_signals: recovery.delta + 0,
    social_intake: socialIntake.penalty + 0,
    raw: raw + 0,
    clamped: score - Math.round(raw) + 0,
  };

  const contributions: ScoreContribution[] = [
    // ONE hydration term (RP-8b). The old second row, "Protocol bonus",
    // named a brand premium as a physiological contributor — and because it
    // carried the largest positive weight in the whole vector, the weekly
    // report's "biggest lift" line picked it structurally more often than
    // any real driver. Volume is the contributor; the product is not.
    { id: 'base', label: 'Hydration (vs your target)', delta: Math.round(baseIntake),
      maxMagnitude: HYDROSTATE_V1_VOLUME_CEILING,
      hint: state.ozTarget > 0
        ? `${state.ozConsumedToday} of ${state.ozTarget} ounces · ${Math.round(coverage * 100)}% of target`
        : 'No target set' },
    { id: 'recency', label: 'Decay since last intake', delta: recency, maxMagnitude: 35,
      hint: `${minutesSinceLast} min · ${decayPerMinute.toFixed(2)} pts/min${state.clutchActive ? ' (clutch ×1.3)' : ''}${effectiveActivity.flooredByHealthPlatform ? ` · Activity floor ${effectiveActivity.level.toFixed(1)} (connected platform)` : ''}` },
    { id: 'symptom', label: 'Performance signals', delta: symptomPenalty, maxMagnitude: 30,
      hint: state.symptoms.length ? `${state.symptoms.length} active` : 'None active' },
    { id: 'urine', label: 'Hydration signal (1-8)', delta: urinePoints, maxMagnitude: 20,
      hint: urine.observed ? `Level ${state.urineSignal}/8` : 'Not recorded' },
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

  const evidence = evaluateEvidence({
    urine,
    // Presence is read from the STATE, not from the delta: a connected device
    // reporting a neutral reading is still an observed source, and must not be
    // mistaken for "no wearable". Ruling 5 — absence of hardware may lower
    // confidence, never HydroState.
    biometricsPresent: hasBiometricSource(state),
    biometricsFavourable: recovery.delta > 0,
    biometricsAdverse: recovery.delta < 0,
    symptomState: state.symptomState,
    minutesSinceLastIntake: minutesSinceLast,
  });
  const level = resolveStateV1(score, evidence);

  return { score, contributions, decayPerMinute, minutesSinceLast, factorDeltas, evidence, level };
}

/**
 * Multi-provider activity floor: when any connected health platform
 * (WHOOP strain, Strava workout minutes, Garmin GPS workout, Apple Health
 * steps, etc.) shows the user has been more active than the manual
 * `activityLevel` slider, the inferred level is used as a FLOOR for decay
 * — so a heavy training day depletes faster even if the user never bumped
 * the activity axis themselves. Extracted to its own function (previously
 * inlined only in `computeDecayPerMinute`) so `buildBreakdown` can also
 * read `flooredByHealthPlatform` and disclose the floor on the "recency"
 * row's hint (Build-50 Gate 2, item 3): the visible 'context' row and its
 * hint always read the raw, un-floored `state.activityLevel` — by design,
 * `context`'s own delta uses that same raw value, so that row is
 * internally consistent — but the "Decay since last intake" row's rate
 * silently used this floored value with no disclosure anywhere in the UI,
 * and `stepsToday` (the most common signal behind the floor) never
 * appeared in any breakdown row at all. A user with the manual slider at
 * a low setting but heavy step count would see a decay rate that doesn't
 * match anything else on screen with no way to explain it. This does NOT
 * change what the floor does or its threshold — purely a read of an
 * already-computed value for display purposes.
 */
function resolveEffectiveActivityLevel(state: UserState): { level: number; flooredByHealthPlatform: boolean } {
  let level = state.activityLevel;
  let flooredByHealthPlatform = false;
  if (state.biometrics && Object.keys(state.biometrics).length > 0) {
    const agg = aggregateBiometrics(state.biometrics);
    if (agg.inferredActivityLevel > level) {
      level = agg.inferredActivityLevel;
      flooredByHealthPlatform = true;
    }
  }
  return { level, flooredByHealthPlatform };
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
function computeDecayPerMinute(state: UserState, now: number = Date.now()): number {
  const socialDecayMultiplier = state.socialMode?.active
    ? activeDecayMultiplier(state.socialMode.drinks, now)
    : 1;

  const { level: activityLevel } = resolveEffectiveActivityLevel(state);

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
function computeDecayPoints(state: UserState, minutesSinceLast: number, now: number = Date.now()): number {
  const baseline = computeDecayPerMinute(state, now) * Math.max(0, minutesSinceLast);

  let boost = 0;
  if (state.clutchDecayBoostUntil) {
    const boostEndMs = state.clutchDecayBoostUntil.getTime();
    const boostStartMs = boostEndMs - 10 * 60 * 1000;
    const intakeMs = state.lastIntakeTime.getTime();
    const nowMs = now;
    const overlapStart = Math.max(boostStartMs, intakeMs);
    const overlapEnd = Math.min(boostEndMs, nowMs);
    if (overlapEnd > overlapStart) {
      boost = 0.5 * ((overlapEnd - overlapStart) / 60000);
    }
  }
  return baseline + boost;
}


export function buildPrediction(score: number, decayPerMinute: number): ScorePrediction {
  // System-language prediction copy (Performance Command Engine spec).
  // Reads as telemetry: decisive, time-bound, no soft hedging.
  if (score <= 40) {
    return { decayPerMinute, minutesToDepleted: 0, label: 'Performance compromised. Correction required.' };
  }
  if (decayPerMinute <= 0) {
    return { decayPerMinute, minutesToDepleted: null, label: 'System holding. No decay detected.' };
  }
  const minutes = Math.max(1, Math.round((score - 40) / decayPerMinute));
  if (minutes >= 240) {
    return { decayPerMinute, minutesToDepleted: minutes, label: `Stable. Degradation outside 4-hour window.` };
  }
  if (minutes >= 60) {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return { decayPerMinute, minutesToDepleted: minutes, label: `Performance degradation in ${h}h ${m}m.` };
  }
  return { decayPerMinute, minutesToDepleted: minutes, label: `Performance degradation in ${minutes} min. Correction required.` };
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
/**
 * Did any biometric source actually report? Distinct from whether it was
 * FAVOURABLE — a connected wearable showing a neutral night is still evidence
 * coverage, and a member with no wearable at all is a different situation that
 * must never be scored as a bad reading.
 */
export function hasBiometricSource(state: UserState): boolean {
  if (state.biometrics && Object.keys(state.biometrics).length > 0) return true;
  return state.appleHealth != null;
}

export function computeRecoverySignal(state: UserState): { delta: number; hint: string; label: string } {
  // Prefer the multi-provider record when present.
  if (state.biometrics && Object.keys(state.biometrics).length > 0) {
    const agg = aggregateBiometrics(state.biometrics);
    // Build-50 Gate 2, item 2: this used to read the generic
    // 'Health platform (HRV / sleep / strain)' for EVERY single-provider
    // case, regardless of which provider it was — a user with only Apple
    // Health connected, scanning the breakdown sheet for "Apple Health",
    // found nothing by that name (the literal string only ever appeared on
    // the legacy `state.appleHealth`-only fallback below, which never runs
    // once `biometrics` is populated). It also implied HRV, sleep, AND
    // strain were all being read, which is false whenever the connected
    // platform doesn't report one of those (e.g. Apple Health has no
    // strain metric at all). Attributing to the actual connected
    // provider's catalog name (`data/healthProviders.ts` — the same
    // display names shown on the Profile connect screen) is both
    // findable and accurate; the hint below already lists only the
    // fields that are actually present, so no per-provider capability
    // string is invented here.
    const label = agg.sources.length === 1
      ? (HEALTH_PROVIDERS.find((p) => p.id === agg.sources[0])?.name ?? 'Health platform')
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
    if (snap.hrvSdnn >= 60) { delta += 5; parts.push(`HRV ${Math.round(snap.hrvSdnn)} ms (high)`); }
    else if (snap.hrvSdnn >= 40) { delta += 2; parts.push(`HRV ${Math.round(snap.hrvSdnn)} ms`); }
    else if (snap.hrvSdnn >= 30) { parts.push(`HRV ${Math.round(snap.hrvSdnn)} ms`); }
    else { delta -= 5; parts.push(`HRV ${Math.round(snap.hrvSdnn)} ms (low)`); }
  }

  if (snap.sleepHoursLastNight != null) {
    const h = snap.sleepHoursLastNight;
    if (h >= 7 && h <= 9) { delta += 5; parts.push(`Sleep ${h.toFixed(1)} h`); }
    else if (h >= 6) { delta += 2; parts.push(`Sleep ${h.toFixed(1)} h`); }
    else if (h >= 4) { delta -= 3; parts.push(`Sleep ${h.toFixed(1)} h (short)`); }
    else { delta -= 5; parts.push(`Sleep ${h.toFixed(1)} h (deficit)`); }
  }

  // Clamp to ±10 so a single platform can never dominate the score.
  delta = Math.max(-10, Math.min(10, delta));

  if (parts.length === 0) return { delta: 0, hint: 'Awaiting data', label: 'Apple Health (HRV + sleep)' };
  return { delta, hint: parts.join(' · '), label: 'Apple Health (HRV + sleep)' };
}

// ─── Score Calculation ────────────────────────────────────────────────────────
export function calculateBaseScore(state: UserState, now: number = Date.now()): number {
  // Per-event hydration scoring — mirrors buildBreakdown so the score
  // and the prediction strip agree. Falls back to the legacy running-
  // aggregate when no events are present.
  // TODO(remove): legacy running-aggregate fallback. Safe to delete once
  // we've confirmed no production rows are missing `intakeEvents`
  // (migration shipped 2026-Q1). Since RP-8b this branch is volume-only —
  // it no longer carries a brand term either.
  // HydroState v1.0 — intake is TARGET-RELATIVE and SATURATING.
  //
  // v0 credited absolute ounces on a flat per-ounce curve, so the intake side
  // could only ever restore ~48 of the 100 points the loss side is documented
  // to represent; the brand bonus was numerically bridging that gap. With the
  // commercial term gone the gap has to close honestly. Coverage is measured
  // against the member's OWN requirement and saturates there, so the top of the
  // scale is reached by MEETING the target rather than by drinking the most.
  // The ceiling sits one point below PEAK, which is what makes "volume alone
  // cannot reach PEAK" arithmetic rather than policy.
  //
  // VOLUME PARITY (RP-8b): water and product points ride the identical
  // per-ounce curve, so they are ONE physiological term. The split survives
  // inside the materializer for provenance reporting only.
  const events = state.intakeEvents ?? [];
  const targetPoints = state.ozTarget > 0 ? state.ozTarget * HYDRATION_PTS_PER_OZ : 0;
  const materialized = events.length > 0
    ? materializedIntakePoints(events, new Date(now)).total
    : state.ozConsumedToday * HYDRATION_PTS_PER_OZ;
  // No invented denominator: an unset target yields zero coverage rather than
  // a divide-by-zero or a fabricated 100%.
  const coverage = targetPoints > 0
    ? Math.min(HYDROSTATE_V1_COVERAGE_CAP, materialized / targetPoints)
    : 0;
  const baseIntake = HYDROSTATE_V1_VOLUME_CEILING * coverage;

  // Continuous decay (per spec) replaces the tiered recency tier.
  const minutesSinceLast = minutesSince(state.lastIntakeTime, now);
  const recency = -Math.round(computeDecayPoints(state, minutesSinceLast, now));



  // recovery_momentum: 0–15 — how aggressively recent intake is restoring deficit

  // symptom_penalty
  let symptomPenalty = 0;
  if (state.symptomState === 'severe') symptomPenalty = -22;
  else if (state.symptomState === 'moderate') symptomPenalty = -14;
  else if (state.symptomState === 'mild') symptomPenalty = -6;
  symptomPenalty -= Math.min(8, state.symptoms.length * 2);

  // urine_signal_penalty: 1 = optimal, 8 = critical
  // Observed-gated Variant C (founder ruling 1). Symmetric around neutral, so a
  // genuinely clear reading is positive corroboration rather than merely the
  // absence of a penalty — but ONLY for a value production could have emitted.
  // An unobserved signal contributes nothing: UNKNOWN is not FAVOURABLE.
  const urine = urineContribution(state.urineSignal);
  const urinePoints = urine.points;

  // output_stress_penalty (sweat × activity)

  // Sleep mode carryover deficit

  const recovery = computeRecoverySignal(state);


  // Per-event social-mode penalty — must mirror buildBreakdown so that
  // ScoreEngineOutput.score and the contribution sum agree.
  const socialIntake = socialIntakePoints(state.socialMode?.drinks ?? [], now);

  // HydroState v1.0 — PHYSIOLOGY ONLY.
  //
  // Gone from the score: `consistency` (compliance streak), `confirmation`
  // (did you obey the last command) and `recoveryMomentum` (drank recently).
  // Those measure conduct, not hydration, and together they supplied 33 of the
  // 48 available non-intake positive points in v0 — a member could look
  // physiologically strong for being obedient. Adherence remains a real
  // product concept; it is simply not a physiological measurement and no
  // longer moves HydroState.
  //
  // Also folded out: `context` and `outputStress` (heat / sweat / activity are
  // already priced by `computeDecayPoints`, so a separate term double-counted
  // them) and `sleepCarry` (overnight loss is priced by the same decay model's
  // sleep multiplier).
  const raw = baseIntake + recency + symptomPenalty + urinePoints
            + recovery.delta + socialIntake.penalty;

  return Math.max(0, Math.min(100, Math.round(raw)));
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
export function minutesSince(date: Date, now: number = Date.now()): number {
  return Math.floor((now - date.getTime()) / 60000);
}
