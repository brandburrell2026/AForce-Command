/**
 * biometricIntelligence — pure derivation layer for the home-screen
 * Biometric Intelligence stack (Sweat Loss / Performance Forecast /
 * Recovery Load).
 *
 * All three derivers are dependency-free and operate on existing
 * `UserState` + `ScoreEngineOutput` fields. No fake data: when an
 * input is missing the deriver returns conservative neutral values
 * and a `confidence` flag the cards use to dim their headline.
 *
 * Kept separate from the cards so the math is unit-testable and the
 * components stay purely presentational.
 */

import type { UserState, ScoreEngineOutput } from '../types';
import type { TempHeatBand } from '../utils/heatBand';

// ─── Sweat Loss ──────────────────────────────────────────────────────

export type SweatIntensity = 'low' | 'moderate' | 'high' | 'extreme';

export interface SweatLossEstimate {
  /** Projected fluid loss in fluid ounces over the active period. */
  fluidLossOz: number;
  /** Projected sodium loss in milligrams. */
  sodiumLossMg: number;
  /** Hydration efficiency — consumed vs lost, capped at 999%. */
  efficiencyPct: number;
  /** Activity / sweat intensity classification. */
  intensity: SweatIntensity;
  /** Whether the cards should soft-dim ("est." badge) — true when inputs are weak. */
  confidence: 'high' | 'low';
}

/**
 * Sweat rate in `UserState` is stored as a 0–1 normalized value where
 * 1.0 ≈ ~1.5 L/hr (very heavy athletic sweat). This converts back to
 * oz/hr for the user-facing card.
 */
const SWEAT_RATE_MAX_OZ_PER_HOUR = 50; // ~1.5 L/hr at top of scale
/** Average sodium concentration of human sweat (mg per fl oz). */
const SODIUM_MG_PER_OZ = 50;
/** Active hours/day used for the loss projection (waking window). */
const ACTIVE_HOURS_PER_DAY = 12;

export function deriveSweatLoss(user: UserState): SweatLossEstimate {
  const sweatRate = clamp01(user.sweatRate ?? 0);
  const activity = clamp01(user.activityLevel ?? 0);
  const heatLoad = clamp01(user.heatLoad ?? 0);

  // Combined intensity factor — sweat capacity weighted by how much
  // activity + heat is actually driving it right now.
  const drive = clamp01(0.4 * sweatRate + 0.4 * activity + 0.2 * heatLoad);

  const ozPerHour = drive * SWEAT_RATE_MAX_OZ_PER_HOUR;
  const fluidLossOz = round1(ozPerHour * ACTIVE_HOURS_PER_DAY);
  const sodiumLossMg = Math.round(fluidLossOz * SODIUM_MG_PER_OZ);

  const consumed = Math.max(0, user.ozConsumedToday ?? 0);
  const efficiencyPct = fluidLossOz > 0
    ? Math.min(999, Math.round((consumed / fluidLossOz) * 100))
    : 100;

  const intensity: SweatIntensity =
    drive >= 0.75 ? 'extreme'
    : drive >= 0.5  ? 'high'
    : drive >= 0.25 ? 'moderate'
    : 'low';

  // We only trust the readout when at least one of (sweat, activity,
  // heat) signal is non-trivial. Otherwise the math is essentially
  // zero × zero and we let the card flag it as low confidence.
  const confidence: 'high' | 'low' =
    sweatRate + activity + heatLoad > 0.15 ? 'high' : 'low';

  return { fluidLossOz, sodiumLossMg, efficiencyPct, intensity, confidence };
}

// ─── Performance Forecast ────────────────────────────────────────────

export type Trajectory = 'rising' | 'stable' | 'declining';

export interface PerformanceForecast {
  /** Headline AI-style sentence for the card hero line. */
  headline: string;
  /** Sub-line with the projected time/window. */
  projection: string;
  trajectory: Trajectory;
  /** Optional clock label (HH:MM) when a deficit is projected. */
  deficitAt: string | null;
}

export function derivePerformanceForecast(
  engine: ScoreEngineOutput,
  user: UserState,
  now: Date = new Date(),
): PerformanceForecast {
  const { score, prediction, performanceState } = engine;
  const decay = prediction.decayPerMinute ?? 0;
  const minutesToDepleted = prediction.minutesToDepleted;

  // Trajectory — recovery boost (Peak / fresh intake) reads as rising,
  // slow decay reads as stable, heavy decay reads as declining.
  const trajectory: Trajectory =
    decay <= 0.05 && score >= 75 ? 'rising'
    : decay >= 0.25 ? 'declining'
    : 'stable';

  // Headline copy — futuristic AI register per the brief.
  const level = performanceState.level;
  let headline: string;
  if (trajectory === 'rising') {
    headline = level === 'PEAK'
      ? 'Performance peak holding strong'
      : 'Recovery efficiency improving';
  } else if (trajectory === 'declining') {
    headline = level === 'DEPLETED'
      ? 'Output suppressed — correction required'
      : 'Decline forecast — schedule intake';
  } else {
    headline = 'System steady — readiness preserved';
  }

  // Projection sub-line — point to the next inflection.
  let projection: string;
  let deficitAt: string | null = null;
  if (minutesToDepleted != null && minutesToDepleted > 0 && minutesToDepleted < 6 * 60) {
    const at = new Date(now.getTime() + minutesToDepleted * 60_000);
    deficitAt = formatClock(at);
    projection = `Hydration deficit expected by ${deficitAt}`;
  } else if (trajectory === 'rising') {
    const peakIn = score >= 90 ? 1 : 2;
    projection = `Performance peak projected in ${peakIn}h`;
  } else if (trajectory === 'stable') {
    projection = 'Cognitive output holding · next checkpoint 2h';
  } else {
    projection = 'Decay rate elevated · act within 30 min';
  }

  return { headline, projection, trajectory, deficitAt };
}

// ─── Recovery Load ───────────────────────────────────────────────────

export type StrainLevel = 'low' | 'moderate' | 'elevated' | 'high';

export interface RecoveryLoad {
  /** 0–100 composite recovery-load score (higher = more strain). */
  loadScore: number;
  strain: StrainLevel;
  /** 0–100 share of load coming from ambient heat. */
  heatImpact: number;
  /** 0–100 share of load coming from environmental stressors. */
  environmentalLoad: number;
  /** 0–100 hydration-deficit contribution. */
  hydrationStress: number;
  /** Headline copy for the card hero line. */
  headline: string;
}

export function deriveRecoveryLoad(
  user: UserState,
  engine: ScoreEngineOutput,
  heatBand: TempHeatBand,
): RecoveryLoad {
  // Heat — combines ambient temp/humidity-derived heatBand with
  // user-reported heat exposure load.
  const bandWeight =
    heatBand === 'CRITICAL' ? 1.0
    : heatBand === 'HIGH'   ? 0.75
    : heatBand === 'ELEVATED' ? 0.45
    : 0.1;
  const heatImpact = Math.round(clamp01(0.5 * (user.heatLoad ?? 0) + 0.5 * bandWeight) * 100);

  // Sweat / exertion accumulation — biological cost of today's output.
  const exertion = clamp01(0.6 * (user.sweatRate ?? 0) + 0.4 * (user.activityLevel ?? 0));

  // Hydration stress — how far below target the user is right now.
  const target = Math.max(1, user.dailyTarget ?? 8);
  const compliance = clamp01((user.unitsConsumedToday ?? 0) / target);
  const hydrationStress = Math.round((1 - compliance) * 100);

  // Alcohol / social drinking — present and active means significant
  // overnight recovery cost.
  const alcoholMult = engine.social?.alcoholMultiplier ?? 1;
  const alcoholLoad = clamp01((alcoholMult - 1) / 1.5);

  // Environmental stressors — bundled into a single 0–100.
  const environmentalLoad = Math.round(clamp01(0.6 * bandWeight + 0.4 * alcoholLoad) * 100);

  // Composite — weighted toward heat + hydration since those drive
  // the felt-recovery cost the most for the AForce demographic.
  const loadScore = Math.round(
    clamp01(
      0.30 * (heatImpact / 100) +
      0.30 * (hydrationStress / 100) +
      0.25 * exertion +
      0.15 * alcoholLoad,
    ) * 100,
  );

  const strain: StrainLevel =
    loadScore >= 75 ? 'high'
    : loadScore >= 50 ? 'elevated'
    : loadScore >= 25 ? 'moderate'
    : 'low';

  let headline: string;
  if (heatImpact >= 60) {
    headline = 'Heat exposure impacting hydration recovery';
  } else if (alcoholLoad > 0.3) {
    headline = 'Social load extending recovery window';
  } else if (loadScore >= 75) {
    headline = 'Elevated recovery load detected';
  } else if (loadScore >= 50) {
    headline = 'Recovery strain moderate — monitor closely';
  } else if (hydrationStress >= 60) {
    headline = 'Hydration deficit raising recovery cost';
  } else {
    headline = 'Recovery load minimal — system clear';
  }

  return { loadScore, strain, heatImpact, environmentalLoad, hydrationStress, headline };
}

// ─── helpers ─────────────────────────────────────────────────────────

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function formatClock(d: Date): string {
  return new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  }).format(d);
}
