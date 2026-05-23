/**
 * AForce Hydration Score Algorithm
 *
 * 0–100 score that drives the entire AForce OS experience: status
 * label, status color, AI Coach command, voice bars, CTA, pressure
 * mode, recheck timer, performance loop footer, and completion state.
 *
 * Score model (in order):
 *   1. Calculate personalized dailyWaterTargetOz from body profile,
 *      activity level, environment, workout.
 *   2. Start with base score of 100.
 *   3. Subtract negative risk penalty (thirst, energy, urine, steps,
 *      temp, humidity, workout, time-since-last-hydration, sleep prep).
 *   4. Add daily hydration progress boost (0–20).
 *   5. Add recent water boost (0–18).
 *   6. Add AForce product boost (0–18).
 *   7. Add hydration cycle bonus (0–15, with state amplifier).
 *   8. Cap total positive boost at 40.
 *   9. Clamp to [0, 100].
 *
 * This module is pure: no React, no store, no I/O. All side-effects
 * (animations, voice, persistence) belong to consumers.
 */

// ─── Types ────────────────────────────────────────────────────────────

export type HydrationStatus =
  | 'OPTIMAL'
  | 'STABLE'
  | 'DECLINING'
  | 'RISK'
  | 'CRITICAL';

export type RiskLevel =
  | 'LOW'
  | 'WATCH'
  | 'MODERATE'
  | 'HIGH'
  | 'CRITICAL';

export type Gender = 'male' | 'female' | 'non_binary' | 'prefer_not_to_say';

export type ActivityLevel =
  | 'sedentary'
  | 'light'
  | 'moderate'
  | 'high'
  | 'athlete';

export type WorkoutLoad = 'none' | 'light' | 'moderate' | 'hard' | 'extreme';

/** Status color tokens — consumed by theme/colors at the UI layer. */
export const STATUS_COLOR_TOKEN: Record<HydrationStatus, string> = {
  OPTIMAL:   'aforce.status.optimalGreen',
  STABLE:    'aforce.status.limeGreen',
  DECLINING: 'aforce.status.amber',
  RISK:      'aforce.status.orange',
  CRITICAL:  'aforce.status.red',
};

/** Recheck cadence in minutes per status. */
export const RECHECK_MINUTES: Record<HydrationStatus, number> = {
  OPTIMAL:   60,
  STABLE:    45,
  DECLINING: 30,
  RISK:      16,
  CRITICAL:  4,
};

export interface UserProfile {
  gender:        Gender;
  heightInches:  number;
  weightLbs:     number;
  age:           number;
  activityLevel: ActivityLevel;
}

export interface EnvironmentInputs {
  temperatureF?: number;
  humidityPct?:  number;
}

export interface IntakeInputs {
  waterOuncesLoggedToday?:        number;
  waterOuncesLoggedLast2Hours?:   number;
  waterOuncesLoggedLast4Hours?:   number;
  aforceSticksLoggedToday?:       number;
  aforceSticksLoggedLast2Hours?:  number;
  aforceRTDsLoggedToday?:         number;
  aforceRTDsLoggedLast2Hours?:    number;
  aforceCanisterServingsToday?:   number;
  aforceCanisterServingsLast2Hours?: number;
  aforceEnergyDrinksLast2Hours?:  number;
  /** Minutes since last AForce product log (any kind). */
  aforceMinutesSinceLast?:        number;
  /** Minutes since last water log. */
  minutesSinceLastWater?:         number;
}

export interface SymptomInputs {
  thirstLevel?:    number;   // 1–5
  energyLevel?:    number;   // 1–5
  urineColor?:     number;   // 1–8
  stepsToday?:     number;
  workout?:        WorkoutLoad;
  /** Minutes until bedtime (negative if already past). */
  minutesUntilBedtime?: number;
  /** Minutes since last hydration of any kind (water or AForce). */
  minutesSinceLastHydration?: number;
}

export interface HydrationScoreInputs
  extends EnvironmentInputs, IntakeInputs, SymptomInputs {
  profile: UserProfile;
}

export interface HydrationScoreOutput {
  score:                       number;
  status:                      HydrationStatus;
  riskLevel:                   RiskLevel;
  colorToken:                  string;
  dailyWaterTargetOz:          number;
  waterOuncesLoggedToday:      number;
  dailyHydrationProgress:      number;          // 0..1+
  dailyHydrationProgressBoost: number;
  recentWaterBoost:            number;
  aforceBoost:                 number;
  hydrationCycleBoost:         number;
  totalPositiveBoost:          number;
  riskPenalty:                 number;
  recheckMinutes:              number;
  pressureMode:                boolean;
  command:                     string;
  reason:                      string;
  confidence:                  number;          // 0..100
  signals:                     string[];
  recommendedFluidOz:          number;
  recommendedAForceProduct:    string;
  nextEvaluationTime:          string;          // ISO timestamp
}

// ─── Status / risk / color / recheck ──────────────────────────────────

export function getStatusFromScore(score: number): HydrationStatus {
  const s = clamp(score, 0, 100);
  if (s >= 85) return 'OPTIMAL';
  if (s >= 70) return 'STABLE';
  if (s >= 50) return 'DECLINING';
  if (s >= 30) return 'RISK';
  return 'CRITICAL';
}

export function getStatusColor(score: number): string {
  return STATUS_COLOR_TOKEN[getStatusFromScore(score)];
}

export function getRiskLevel(score: number): RiskLevel {
  const s = clamp(score, 0, 100);
  if (s >= 85) return 'LOW';
  if (s >= 70) return 'WATCH';
  if (s >= 50) return 'MODERATE';
  if (s >= 30) return 'HIGH';
  return 'CRITICAL';
}

export function getRecheckMinutes(score: number): number {
  return RECHECK_MINUTES[getStatusFromScore(score)];
}

// ─── Pressure Mode ────────────────────────────────────────────────────

export interface PressureModeContext {
  /** Current hydration score. */
  score:                number;
  /** Score at the previous evaluation. */
  previousScore?:       number;
  /** True if user has not acknowledged the current command. */
  ignoredCommand?:      boolean;
  /** Fraction of the recheck timer elapsed since last command (0..1). */
  elapsedTimerPercent?: number;
}

export function shouldActivatePressureMode(ctx: PressureModeContext): boolean {
  const { score, previousScore, ignoredCommand, elapsedTimerPercent } = ctx;
  if (score < 50) return true;
  const risk = getRiskLevel(score);
  if (risk === 'HIGH' || risk === 'CRITICAL') return true;
  if (ignoredCommand && (elapsedTimerPercent ?? 0) > 0.5) return true;
  if (typeof previousScore === 'number' && previousScore - score >= 15) return true;
  return false;
}

// ─── Personalized Daily Water Target ─────────────────────────────────

export function calculateDailyWaterTarget(
  profile: UserProfile,
  env: EnvironmentInputs = {},
  workout: WorkoutLoad = 'none',
): number {
  let target = profile.weightLbs * 0.5;

  // Gender adjustment
  if (profile.gender === 'male') target += 8;
  else if (profile.gender === 'female') target += 0;
  else target += 4;  // non_binary, prefer_not_to_say

  // Height adjustment
  if (profile.heightInches < 62) target -= 4;
  else if (profile.heightInches >= 75) target += 8;
  else if (profile.heightInches >= 69) target += 4;
  // 62–68 = +0

  // Activity adjustment
  switch (profile.activityLevel) {
    case 'sedentary': target += 0; break;
    case 'light':     target += 8; break;
    case 'moderate':  target += 16; break;
    case 'high':      target += 24; break;
    case 'athlete':   target += 32; break;
  }

  // Weather adjustment
  const t = env.temperatureF;
  if (typeof t === 'number') {
    if      (t >= 100) target += 24;
    else if (t >= 90)  target += 16;
    else if (t >= 80)  target += 8;
  }

  // Workout adjustment
  switch (workout) {
    case 'light':   target += 8;  break;
    case 'moderate':target += 16; break;
    case 'hard':    target += 24; break;
    case 'extreme': target += 32; break;
  }

  return clamp(Math.round(target), 64, 180);
}

// ─── Negative Risk Penalty ────────────────────────────────────────────

export function calculateNegativeRiskPenalty(inputs: HydrationScoreInputs, scoreSoFar: number): number {
  let p = 0;

  // Thirst
  switch (inputs.thirstLevel) {
    case 2: p += 4;  break;
    case 3: p += 9;  break;
    case 4: p += 16; break;
    case 5: p += 24; break;
  }

  // Energy
  switch (inputs.energyLevel) {
    case 4: p += 3;  break;
    case 3: p += 8;  break;
    case 2: p += 14; break;
    case 1: p += 20; break;
  }

  // Urine color
  switch (inputs.urineColor) {
    case 2: p += 2;  break;
    case 3: p += 5;  break;
    case 4: p += 10; break;
    case 5: p += 16; break;
    case 6: p += 22; break;
    case 7: p += 28; break;
    case 8: p += 35; break;
  }

  // Steps
  const steps = inputs.stepsToday ?? 0;
  if      (steps >= 15000) p += 18;
  else if (steps >= 10000) p += 12;
  else if (steps >= 7000)  p += 8;
  else if (steps >= 3000)  p += 4;

  // Temperature
  const t = inputs.temperatureF;
  if (typeof t === 'number') {
    if      (t >= 100) p += 18;
    else if (t >= 90)  p += 12;
    else if (t >= 80)  p += 7;
    else if (t >= 70)  p += 3;
  }

  // Humidity
  const h = inputs.humidityPct;
  if (typeof h === 'number') {
    if      (h >= 90) p += 12;
    else if (h >= 75) p += 8;
    else if (h >= 60) p += 5;
    else if (h >= 40) p += 2;
  }

  // Workout
  switch (inputs.workout) {
    case 'light':   p += 5;  break;
    case 'moderate':p += 10; break;
    case 'hard':    p += 16; break;
    case 'extreme': p += 22; break;
  }

  // Last hydration time
  const m = inputs.minutesSinceLastHydration;
  if (typeof m === 'number') {
    if      (m > 240) p += 22;
    else if (m > 180) p += 16;
    else if (m > 120) p += 10;
    else if (m > 60)  p += 5;
  }

  // Sleep prep window — uses the running score (after non-sleep penalties)
  const tilBed = inputs.minutesUntilBedtime;
  if (typeof tilBed === 'number' && tilBed >= 0) {
    const runningScore = scoreSoFar - p;
    if (tilBed <= 60 && runningScore < 65) p += 10;
    else if (tilBed <= 120 && runningScore < 75) p += 5;
  }

  return p;
}

// ─── Positive Boosts ──────────────────────────────────────────────────

const WATER_BOOST_CAP = 18;
const AFORCE_BOOST_CAP = 18;
const CYCLE_BOOST_CAP = 15;
const PROGRESS_BOOST_CAP = 20;
const TOTAL_BOOST_CAP = 40;

export function calculateDailyHydrationProgressBoost(
  waterOuncesLoggedToday: number,
  dailyWaterTargetOz: number,
): number {
  if (dailyWaterTargetOz <= 0) return 0;
  const pct = waterOuncesLoggedToday / dailyWaterTargetOz;
  if (pct >= 1.00) return 20;
  if (pct >= 0.75) return 15;
  if (pct >= 0.50) return 10;
  if (pct >= 0.25) return 5;
  return 0;
}

/** Per-bucket water boost from a single ounce volume. */
function waterOzToBoost(oz: number): number {
  if (oz >= 32) return 16;
  if (oz >= 24) return 12;
  if (oz >= 20) return 10;
  if (oz >= 16) return 8;
  if (oz >= 12) return 6;
  if (oz >= 8)  return 4;
  return 0;
}

export function calculateRecentWaterBoost(inputs: IntakeInputs): number {
  const oz2  = inputs.waterOuncesLoggedLast2Hours ?? 0;
  const oz4  = inputs.waterOuncesLoggedLast4Hours ?? 0;
  // The 2–4h bucket is whatever was in the 4h window but not the 2h window.
  const oz24 = Math.max(0, oz4 - oz2);

  const boost = waterOzToBoost(oz2) + waterOzToBoost(oz24) * 0.5;
  return Math.min(WATER_BOOST_CAP, Math.round(boost));
}

export function calculateAForceBoost(inputs: IntakeInputs): number {
  const sticks2 = inputs.aforceSticksLoggedLast2Hours ?? 0;
  const rtds2   = inputs.aforceRTDsLoggedLast2Hours ?? 0;
  const cans2   = inputs.aforceCanisterServingsLast2Hours ?? 0;
  const energy2 = inputs.aforceEnergyDrinksLast2Hours ?? 0;

  const recent = sticks2 * 12 + rtds2 * 14 + cans2 * 10 + energy2 * 8;

  // Approximate 2–4h window via today minus recent counts.
  const sticks24 = Math.max(0, (inputs.aforceSticksLoggedToday ?? 0) - sticks2);
  const rtds24   = Math.max(0, (inputs.aforceRTDsLoggedToday ?? 0) - rtds2);
  const cans24   = Math.max(0, (inputs.aforceCanisterServingsToday ?? 0) - cans2);
  // Older boost decays at 50% (and we have no >4h tracker; conservative).
  const aged = (sticks24 * 12 + rtds24 * 14 + cans24 * 10) * 0.5;

  return Math.min(AFORCE_BOOST_CAP, Math.round(recent + aged));
}

export function calculateHydrationCycleBoost(
  inputs: IntakeInputs,
  currentStatus: HydrationStatus,
): number {
  const water2 = inputs.waterOuncesLoggedLast2Hours ?? 0;
  const af2 = (inputs.aforceSticksLoggedLast2Hours ?? 0)
            + (inputs.aforceRTDsLoggedLast2Hours ?? 0)
            + (inputs.aforceCanisterServingsLast2Hours ?? 0)
            + (inputs.aforceEnergyDrinksLast2Hours ?? 0);

  // Cycle requires both a recent water log and a recent AForce log.
  if (water2 <= 0 || af2 <= 0) return 0;

  // 30-minute window proxy: both logged within the last 30 min.
  const wMins = inputs.minutesSinceLastWater ?? Number.POSITIVE_INFINITY;
  const aMins = inputs.aforceMinutesSinceLast ?? Number.POSITIVE_INFINITY;
  if (wMins > 30 || aMins > 30) return 0;

  let bonus = 8;
  if (currentStatus === 'DECLINING') bonus += 5;
  else if (currentStatus === 'RISK') bonus += 8;
  else if (currentStatus === 'CRITICAL') bonus += 12;

  return Math.min(CYCLE_BOOST_CAP, bonus);
}

// ─── Command Generation ──────────────────────────────────────────────

const RECOMMENDED_OZ: Record<HydrationStatus, number> = {
  OPTIMAL:   8,
  STABLE:    12,
  DECLINING: 16,
  RISK:      20,
  CRITICAL:  20,
};

const RECOMMENDED_PRODUCT: Record<HydrationStatus, string> = {
  OPTIMAL:   'none',
  STABLE:    'none',
  DECLINING: 'aforce_stick',
  RISK:      'aforce_stick',
  CRITICAL:  'aforce_rtd',
};

const STATUS_COMMANDS: Record<HydrationStatus, string> = {
  OPTIMAL:   'Flow state active. Hold your rhythm.',
  STABLE:    'Sip 12 oz of water within the next 45 minutes.',
  DECLINING: 'Open a water cycle: 16 oz of water with 1 AForce stick.',
  RISK:      'Recovery window open. Complete a water cycle with electrolytes.',
  CRITICAL:  'Recovery needed. Complete one water cycle now to reset.',
};

export function generateHydrationCommand(
  score: number,
  inputs: HydrationScoreInputs,
): string {
  // Sleep prep takes priority whenever bedtime is within 2 hours.
  const tilBed = inputs.minutesUntilBedtime;
  if (typeof tilBed === 'number' && tilBed >= 0 && tilBed <= 120) {
    return 'Drink 20 oz of water and take 1 AForce RTD before sleep.';
  }
  // Heat command — overrides STABLE/DECLINING when significant heat exposure.
  if ((inputs.temperatureF ?? 0) > 85 && score < 85) {
    return 'Heat exposure detected. Increase fluid intake now.';
  }
  // Workout command — moderate or higher when score is not OPTIMAL.
  if (
    (inputs.workout === 'moderate' || inputs.workout === 'hard' || inputs.workout === 'extreme')
    && score < 85
  ) {
    return 'Training load detected. Replace fluids and electrolytes now.';
  }
  return STATUS_COMMANDS[getStatusFromScore(score)];
}

// ─── Signals ──────────────────────────────────────────────────────────

export function generateSignals(
  score: number,
  inputs: HydrationScoreInputs,
  ctx?: { previousScore?: number },
): string[] {
  const out: string[] = [];

  if (typeof ctx?.previousScore === 'number' && score < ctx.previousScore - 4) {
    out.push('Hydration trend declining');
  }
  if ((inputs.urineColor ?? 0) >= 4) out.push('Urine color elevated');
  if ((inputs.stepsToday ?? 0) >= 10000) out.push('Activity load elevated');
  if ((inputs.temperatureF ?? 0) >= 85) out.push('Heat exposure detected');
  if (
    typeof inputs.minutesUntilBedtime === 'number'
    && inputs.minutesUntilBedtime >= 0
    && inputs.minutesUntilBedtime <= 120
  ) out.push('Sleep prep window open');

  if ((inputs.waterOuncesLoggedLast2Hours ?? 0) > 0) out.push('Water intake confirmed');

  const af2 = (inputs.aforceSticksLoggedLast2Hours ?? 0)
            + (inputs.aforceRTDsLoggedLast2Hours ?? 0)
            + (inputs.aforceCanisterServingsLast2Hours ?? 0)
            + (inputs.aforceEnergyDrinksLast2Hours ?? 0);
  if (af2 > 0) out.push('AForce intake confirmed');

  if (typeof ctx?.previousScore === 'number' && score > ctx.previousScore + 4) {
    out.push('Recent fluid intake improving score');
  }
  if (af2 > 0 && (inputs.waterOuncesLoggedLast2Hours ?? 0) > 0) {
    out.push('Hydration cycle completed');
  }
  if (af2 > 0) out.push('Electrolyte support active');

  // Boost-fading signal — water in 2–4h window but nothing in last 2h.
  const recentWater  = inputs.waterOuncesLoggedLast2Hours ?? 0;
  const oldishWater  = (inputs.waterOuncesLoggedLast4Hours ?? 0) - recentWater;
  if (recentWater === 0 && oldishWater > 0) out.push('Boost fading as intake ages');

  // Dedupe and clamp to 3–5 signals.
  const dedup = Array.from(new Set(out));
  return dedup.slice(0, 5);
}

// ─── Confidence ───────────────────────────────────────────────────────

export function calculateConfidence(inputs: HydrationScoreInputs): number {
  let c = 70;
  if (typeof inputs.urineColor === 'number')                c += 10;
  if (typeof inputs.thirstLevel === 'number')               c += 8;
  if (typeof inputs.temperatureF === 'number')              c += 8;
  if (typeof inputs.stepsToday === 'number')                c += 6;
  if (typeof inputs.minutesSinceLastHydration === 'number') c += 6;
  return Math.min(98, c);
}

// ─── Reason ───────────────────────────────────────────────────────────

function generateReason(
  status: HydrationStatus,
  signals: string[],
  riskPenalty: number,
  totalBoost: number,
): string {
  if (signals.length === 0) {
    return `Score is ${status.toLowerCase()} based on current readings.`;
  }
  const headline = signals[0];
  if (totalBoost > riskPenalty) return `${headline} — recent intake improving score.`;
  if (riskPenalty > 0) return `${headline} — hydration deficit detected.`;
  return headline;
}

// ─── Main Entry Point ────────────────────────────────────────────────

export interface GetHydrationScoreOptions {
  /** Score at last evaluation; enables trend signals + pressure-mode drop. */
  previousScore?: number;
  /** True if user dismissed/ignored the most recent command. */
  ignoredCommand?: boolean;
  /** Fraction of the previous recheck timer that has elapsed (0..1). */
  elapsedTimerPercent?: number;
  /** Used to compute nextEvaluationTime; defaults to Date.now. */
  now?: Date;
}

export function getHydrationScore(
  inputs: HydrationScoreInputs,
  opts: GetHydrationScoreOptions = {},
): HydrationScoreOutput {
  // 1. Personalized target
  const dailyWaterTargetOz = calculateDailyWaterTarget(
    inputs.profile, inputs, inputs.workout,
  );

  // 2. Base
  let score = 100;

  // 3. Risk penalty
  const riskPenalty = calculateNegativeRiskPenalty(inputs, score);
  score -= riskPenalty;

  // 4. Daily progress boost
  const waterOuncesLoggedToday = inputs.waterOuncesLoggedToday ?? 0;
  const dailyHydrationProgress = dailyWaterTargetOz > 0
    ? waterOuncesLoggedToday / dailyWaterTargetOz
    : 0;
  const rawDailyBoost = calculateDailyHydrationProgressBoost(
    waterOuncesLoggedToday, dailyWaterTargetOz,
  );
  const dailyHydrationProgressBoost = Math.min(PROGRESS_BOOST_CAP, rawDailyBoost);

  // 5. Recent water boost
  const recentWaterBoost = calculateRecentWaterBoost(inputs);

  // 6. AForce boost
  const aforceBoost = calculateAForceBoost(inputs);

  // 7. Cycle boost — uses the band derived from the score after risk only,
  //    so the bonus actually rewards completing a cycle while declining.
  const preCycleStatus = getStatusFromScore(score);
  const hydrationCycleBoost = calculateHydrationCycleBoost(inputs, preCycleStatus);

  // 8. Total boost cap
  const rawTotal =
    dailyHydrationProgressBoost
    + recentWaterBoost
    + aforceBoost
    + hydrationCycleBoost;
  const totalPositiveBoost = Math.min(TOTAL_BOOST_CAP, rawTotal);
  score += totalPositiveBoost;

  // 9. Clamp
  score = clamp(Math.round(score), 0, 100);

  const status = getStatusFromScore(score);
  const riskLevel = getRiskLevel(score);
  const colorToken = STATUS_COLOR_TOKEN[status];
  const recheckMinutes = RECHECK_MINUTES[status];
  const pressureMode = shouldActivatePressureMode({
    score,
    previousScore: opts.previousScore,
    ignoredCommand: opts.ignoredCommand,
    elapsedTimerPercent: opts.elapsedTimerPercent,
  });
  const command = generateHydrationCommand(score, inputs);
  const signals = generateSignals(score, inputs, { previousScore: opts.previousScore });
  const confidence = calculateConfidence(inputs);
  const reason = generateReason(status, signals, riskPenalty, totalPositiveBoost);

  const now = opts.now ?? new Date();
  const nextEvaluationTime = new Date(now.getTime() + recheckMinutes * 60_000).toISOString();

  return {
    score,
    status,
    riskLevel,
    colorToken,
    dailyWaterTargetOz,
    waterOuncesLoggedToday,
    dailyHydrationProgress,
    dailyHydrationProgressBoost,
    recentWaterBoost,
    aforceBoost,
    hydrationCycleBoost,
    totalPositiveBoost,
    riskPenalty,
    recheckMinutes,
    pressureMode,
    command,
    reason,
    confidence,
    signals,
    recommendedFluidOz: RECOMMENDED_OZ[status],
    recommendedAForceProduct: RECOMMENDED_PRODUCT[status],
    nextEvaluationTime,
  };
}

// ─── Utilities ────────────────────────────────────────────────────────

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}
