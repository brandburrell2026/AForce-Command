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
import type { SweatQualification } from '../types/sweat';
import { qualifySweat } from './sweatRateEngine';
import {
  oz, lb, ozToL, lbToKg, fraction01FromScale10, KG_PER_LB,
} from '../utils/quantities';
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
 * The drive inputs (`sweatRate`, `activityLevel`, `heatLoad`) are stored on
 * a 0–10 scale (realApi defaults 3/5/4). COR-001 close-out (founder-approved
 * with the typed-units layer): they normalize through the one sanctioned
 * bridge, `fraction01FromScale10` — the old `clamp01` read assumed 0–1 and
 * saturated every real-scale value to 1.0, the exact mechanism behind the
 * 600 oz / 30,000 mg LIVE card. At the top of the normalized scale
 * 1.0 ≈ ~1.5 L/hr (very heavy athletic sweat).
 */
const SWEAT_RATE_MAX_OZ_PER_HOUR = 50; // ~1.5 L/hr at top of scale
/** Average sodium concentration of human sweat (mg per fl oz). */
const SODIUM_MG_PER_OZ = 50;
/** Active hours/day used for the loss projection (waking window). */
const ACTIVE_HOURS_PER_DAY = 12;

export function deriveSweatLoss(user: UserState): SweatLossEstimate {
  const sweatRate = fraction01FromScale10(user.sweatRate ?? 0);
  const activity = fraction01FromScale10(user.activityLevel ?? 0);
  const heatLoad = fraction01FromScale10(user.heatLoad ?? 0);

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

// KG_PER_LB now imports from utils/units (COR-001 single source);
// 1 L sweat ≡ 1 kg unchanged.

/**
 * S2-14b — judge the home/calculator LIVE snapshot with the SAME S1-2
 * plausibility authority that judges a computed session. This introduces
 * NO new physiological threshold: units are converted and handed to
 * `qualifySweat`, and the deficit uses the engine's own estimate-mode
 * semantic (gross `sweatLossL / weightKg`, sweatRateEngine.ts:509).
 *
 * Evidence gate, not a threshold: without a member-set body weight the
 * S1-2 deficit check CANNOT run, and an unverifiable projection must not
 * pass by omission — it resolves to the honest `unavailable` posture.
 *
 * The projection window itself (ACTIVE_HOURS_PER_DAY = 12 h = 720 min)
 * exceeds S1-2's PROPOSED_LIMITED_DURATION_MIN, so even a fully plausible
 * projection is at most `limited` — a 12-hour model projection is never a
 * calibrated LIVE reading. The card renders accordingly.
 */
export function qualifySweatLossEstimate(
  est: SweatLossEstimate,
  bodyWeightLbs: number | null,
): SweatQualification {
  const sweatLossL = ozToL(oz(est.fluidLossOz));
  const sweatRateLh = sweatLossL / ACTIVE_HOURS_PER_DAY;
  if (bodyWeightLbs == null || !(bodyWeightLbs > 0)) {
    return { status: 'unavailable', reasons: ['deficit_unverifiable_no_weight'] };
  }
  const weightKg = lbToKg(lb(bodyWeightLbs));
  const deficitPct = (sweatLossL / weightKg) * 100;
  return qualifySweat({
    sweatLossL,
    sweatRateLh,
    deficitPct,
    sodiumLossMg: est.sodiumLossMg,
    durationMin: ACTIVE_HOURS_PER_DAY * 60,
  });
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

/**
 * Optional morning Voice Check-In self-report fed into the forecast. This is
 * COPY-ONLY: it can refine the headline wording but never changes the
 * trajectory math, projection timing, or deficit clock. When omitted the
 * forecast is byte-for-byte identical to the pre-check-in behaviour.
 */
export interface ForecastCheckIn {
  /** Reported morning energy 1–5. */
  energy: number;
  /** Reported morning stress 1–5. */
  stress: number;
}

export function derivePerformanceForecast(
  engine: ScoreEngineOutput,
  user: UserState,
  now: Date = new Date(),
  checkIn?: ForecastCheckIn,
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

  // Optional morning Voice Check-In refinement — COPY-ONLY. Gated entirely
  // behind `checkIn` so the forecast is byte-for-byte identical when it is
  // omitted (the trajectory/projection/deficit math below is untouched).
  if (checkIn) {
    const energy = clampScale(checkIn.energy);
    const stress = clampScale(checkIn.stress);
    if (stress >= 4) {
      headline = trajectory === 'rising'
        ? 'Recovery rising — manage reported stress'
        : 'Reported stress elevated — steady your inputs';
    } else if (energy <= 2 && trajectory !== 'declining') {
      headline = 'Low morning energy — rebuild with water';
    } else if (energy >= 4 && stress <= 2 && trajectory === 'stable') {
      headline = 'Strong calibration — readiness trending up';
    }
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
  // user-reported heat exposure load. Drives are the canonical 0–10
  // scale — bridged exactly like deriveSweatLoss above; read raw, the
  // clamp01 pegged heatImpact/exertion at 100%/1.0 for every member ≥2.
  const bandWeight =
    heatBand === 'CRITICAL' ? 1.0
    : heatBand === 'HIGH'   ? 0.75
    : heatBand === 'ELEVATED' ? 0.45
    : 0.1;
  const heatLoad01 = fraction01FromScale10(user.heatLoad ?? 0);
  const heatImpact = Math.round(clamp01(0.5 * heatLoad01 + 0.5 * bandWeight) * 100);

  // Sweat / exertion accumulation — biological cost of today's output.
  const sweatRate01 = fraction01FromScale10(user.sweatRate ?? 0);
  const activity01 = fraction01FromScale10(user.activityLevel ?? 0);
  const exertion = clamp01(0.6 * sweatRate01 + 0.4 * activity01);

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

/** Clamp + round a raw value onto the 1–5 self-report scale. */
function clampScale(n: number): number {
  if (!Number.isFinite(n)) return 1;
  return Math.min(5, Math.max(1, Math.round(n)));
}

function formatClock(d: Date): string {
  return new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  }).format(d);
}
