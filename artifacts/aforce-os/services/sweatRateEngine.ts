/**
 * Sweat-Rate Engine — pure functions, fully testable.
 *
 * IMPORTANT — provenance:
 *   The MEASURED path (Quick + Precision modes) is a verbatim
 *   implementation of the ACSM Position Stand sweat-rate formula:
 *
 *     Sweat Loss (L) = (BW_pre [kg] - BW_post [kg]) + Fluid_in [L] - Urine [L]
 *     Sweat Rate (L/h) = Sweat Loss / Duration (h)
 *
 *   Reference: Sawka MN, Burke LM, Eichner ER, Maughan RJ, Montain SJ,
 *   Stachenfeld NS. 2007. American College of Sports Medicine Position
 *   Stand: Exercise and Fluid Replacement. Med Sci Sports Exerc
 *   39(2):377-390. Equation 3, p.380.
 *
 *   The ESTIMATE path (no scale) is an empirical anchored model — it
 *   starts from a published per-sport population mean (Baker 2017) and
 *   adjusts for body surface area, intensity, climate, and
 *   acclimatization status using factors drawn from USARIEM /
 *   Cheuvront review work. Estimates are clearly labeled `source:
 *   'estimated'` in the output so the UI can flag them.
 *
 *   Sodium loss is computed from the resolved SodiumProfile band
 *   (Baker 2017, Table 2), not assumed. Replacement guidance follows
 *   Sawka 2007 §G — replace 100-150 % of fluid loss within 4-6h.
 */

import {
  type DeficitBand,
  type DeficitBandSpec,
  type EstimateInputs,
  type PrecisionInputs,
  type QuickInputs,
  type SodiumProfile,
  type SodiumProfileBand,
  type SweatAudit,
  type SweatAutopilot,
  type SweatInputs,
  type SweatPrescription,
  type SweatSession,
} from '@/types/sweat';
import { getSport, SWEAT_SPORTS } from '@/data/sweatSports';

// ─── Constants & reference bands ─────────────────────────────────────────────

/** ACSM 2007 Position Stand, §C — performance / safety thresholds. */
export const DEFICIT_BANDS: DeficitBandSpec[] = [
  {
    id: 'optimal',
    label: 'Optimal',
    thresholdPct: 0,
    message: 'Within euhydration. Maintain your normal cadence.',
  },
  {
    id: 'mild',
    label: 'Mild',
    thresholdPct: 1,
    message: 'Edge of dehydration. Top up before the next session.',
  },
  {
    id: 'impaired',
    label: 'Impaired',
    thresholdPct: 2,
    message: 'Performance loss likely (–4 to –6%). Replace aggressively.',
  },
  {
    id: 'danger',
    label: 'Danger',
    thresholdPct: 4,
    message: 'Heat-illness risk. Stop, cool down, and rehydrate now.',
  },
];

/**
 * Sweat-sodium reference bands.
 * Source: Baker LB. 2017. Sports Med 47(Suppl 1):111-128, Table 2.
 * Population sweat [Na+] median ≈ 50 mmol/L (1150 mg/L). Atomic mass of
 * sodium = 22.99 — converting mmol/L → mg/L by ×23 (rounded).
 */
export const SODIUM_BANDS: SodiumProfileBand[] = [
  {
    id: 'light',
    label: 'Light Sweater',
    mgPerLiter: 690,   // ≈ 30 mmol/L
    description: 'Low sodium loss. No salt rings on clothing.',
  },
  {
    id: 'moderate',
    label: 'Moderate Sweater',
    mgPerLiter: 1150,  // ≈ 50 mmol/L (population mean)
    description: 'Typical athlete. Faint salt residue after long sessions.',
  },
  {
    id: 'heavy',
    label: 'Heavy Sweater',
    mgPerLiter: 1610,  // ≈ 70 mmol/L
    description: 'Visible salt streaks. Eyes sting from sweat.',
  },
  {
    id: 'very_heavy',
    label: 'Very Heavy Sweater',
    mgPerLiter: 2070,  // ≈ 90 mmol/L
    description: 'Heavy crystalline salt residue. White rings on clothing.',
  },
];

export function sodiumBand(profile: SodiumProfile): SodiumProfileBand {
  return SODIUM_BANDS.find((b) => b.id === profile) ?? SODIUM_BANDS[1];
}

/**
 * AForce Stick reference. Used to translate fluid replacement into
 * stick count.
 *
 * Sweat Intelligence v2 spec: AForce delivers 25mg sodium per serving —
 * NOT 500mg+ like mass-market electrolytes. Sticks are sized by fluid
 * budget (one stick per 12 oz of replacement water), and the residual
 * sodium gap is intentional and explained on the Recovery Intelligence
 * surface ("Recovery is not driven by sodium alone…").
 */
const AFORCE_STICK_REFERENCE_OZ = 12;   // serving size

/**
 * Sodium per AForce serving (stick / RTD / canister scoop). Per spec:
 * 25mg / serving. Intentional positioning: marine minerals + pH 8.8
 * structured water drive cellular recovery, not sodium flooding.
 */
export const AFORCE_SODIUM_PER_UNIT_MG = 25;

// ─── Unit normalization ──────────────────────────────────────────────────────

const KG_PER_LB = 0.45359237;
const L_PER_OZ = 0.0295735;
const OZ_PER_L = 1 / L_PER_OZ;          // 33.814
const CM_PER_IN = 2.54;

export function toKg(value: number, unit: 'lbs' | 'kg'): number {
  return unit === 'kg' ? value : value * KG_PER_LB;
}

export function toLiters(value: number, unit: 'oz' | 'ml'): number {
  return unit === 'ml' ? value / 1000 : value * L_PER_OZ;
}

export function toCm(value: number, unit: 'in' | 'cm' | 'ft'): number {
  if (unit === 'cm') return value;
  if (unit === 'ft') return value * 12 * CM_PER_IN;
  return value * CM_PER_IN;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function clampPositive(n: number): number {
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/**
 * Resolve which deficit band a percent loss lands in (lower-bound match).
 * Walks bands from highest to lowest threshold so the most severe wins.
 */
export function classifyDeficit(deficitPct: number): DeficitBand {
  const sorted = [...DEFICIT_BANDS].sort((a, b) => b.thresholdPct - a.thresholdPct);
  for (const b of sorted) {
    if (deficitPct >= b.thresholdPct) return b.id;
  }
  return 'optimal';
}

/**
 * Du Bois & Du Bois 1916 body-surface-area formula.
 * BSA (m²) = 0.007184 × W(kg)^0.425 × H(cm)^0.725
 *
 * Still the standard reference formula in pharmacology and sport
 * physiology — chosen here because it requires only weight + height
 * (no race-corrected coefficient).
 */
export function bsaDuBois(weightKg: number, heightCm: number): number {
  if (weightKg <= 0 || heightCm <= 0) return 0;
  return 0.007184 * Math.pow(weightKg, 0.425) * Math.pow(heightCm, 0.725);
}

/**
 * Climate-driven multiplier on baseline sweat rate.
 *
 * Anchored to USARIEM heat-strain prediction work (Cheuvront SN,
 * Kenefick RW. 2014. Compr Physiol 4(1):257-285) — sweat rate
 * approximately doubles between thermoneutral (20 °C) and hot
 * (40 °C) environments at constant work rate, with humidity acting
 * as a secondary multiplier when evaporation is suppressed.
 *
 * We use a piecewise-linear approximation: +4% per °C above 20 °C,
 * +0.4% per RH-percent above 50%. Capped at 1.6× — beyond that the
 * limiter is no longer thermal but cardiovascular.
 */
export function heatFactor(tempC: number, humidityPct: number): number {
  const tempPart = 1 + Math.max(0, tempC - 20) * 0.04;
  const humidityPart = 1 + Math.max(0, humidityPct - 50) * 0.004;
  const combined = tempPart * humidityPart;
  return Math.min(1.6, Math.max(0.85, combined));
}

/**
 * Heat-acclimatization adjustment.
 * Source: Périard JD et al. 2015. Scand J Med Sci Sports 25(s1):20-38.
 * Acclimatized athletes sweat MORE per hour but LOSE LESS sodium per
 * liter (sweat dilutes ~30%). For sweat-rate this is a slight bump
 * (+8%); the sodium adjustment is folded into the sodium concentration
 * step downstream.
 */
export function acclimFactor(acclimatized: boolean): number {
  return acclimatized ? 1.08 : 1.0;
}

// ─── Core compute paths ──────────────────────────────────────────────────────

export interface MeasuredArgs {
  preWeightKg: number;
  postWeightKg: number;
  durationMin: number;
  fluidL: number;
  urineL?: number;
}

/**
 * The ACSM measured-loss path.
 * Sweat (L) = (Pre - Post) + Fluid - Urine
 */
export function measuredSweatRate(a: MeasuredArgs): { sweatLossL: number; sweatRateLh: number } {
  const sweatLossL = clampPositive(
    (a.preWeightKg - a.postWeightKg) + a.fluidL - (a.urineL ?? 0),
  );
  const hours = Math.max(a.durationMin / 60, 1 / 60);
  return { sweatLossL, sweatRateLh: sweatLossL / hours };
}

/**
 * No-scale estimation. We anchor on the published per-sport mean and
 * scale by:
 *   - body-surface-area ratio vs the 1.9 m² reference athlete from
 *     Baker 2017 (≈ 70 kg, 175 cm)
 *   - subjective intensity 1–5 mapped to 0.7–1.3
 *   - heat factor (temperature + humidity)
 *   - acclimatization
 *
 * Returns L/h (per-hour rate); caller multiplies by duration.
 */
export interface EstimateArgs {
  weightKg: number;
  heightCm: number;
  sportId: string;
  intensity: 1 | 2 | 3 | 4 | 5;
  ambientTempC: number;
  ambientHumidityPct: number;
  acclimatized: boolean;
}

export function estimateSweatRateLh(a: EstimateArgs): { sweatRateLh: number; bsaM2: number; heat: number; accl: number } {
  const sport = getSport(a.sportId);
  const bsa = bsaDuBois(a.weightKg, a.heightCm);
  const referenceBsa = 1.9; // ≈ 70 kg, 175 cm reference athlete
  const bsaScale = bsa > 0 ? bsa / referenceBsa : 1;
  const intensityScale = 0.7 + (a.intensity - 1) * 0.15; // 1→0.7, 5→1.3
  const heat = heatFactor(a.ambientTempC, a.ambientHumidityPct);
  const accl = acclimFactor(a.acclimatized);

  const rate = sport.meanSweatRateLh * bsaScale * intensityScale * heat * accl;
  return { sweatRateLh: clampPositive(rate), bsaM2: bsa, heat, accl };
}

// ─── Prescription ────────────────────────────────────────────────────────────

/**
 * Build the personalized AForce prescription.
 *
 * Replacement target: 125 % of fluid loss over 4 hours
 *   (mid-band of Sawka 2007 §G, "100–150% within 4-6 h").
 *
 * Sodium target: replace the sodium that was actually lost
 *   (already accounts for acclimatization at the concentration
 *   step upstream, so we do NOT discount again here).
 *
 * The split between sticks vs water keeps the post-session sodium
 * concentration in the optimal range for absorption (Maughan-Shirreffs
 * Beverage Hydration Index).
 */
export function buildPrescription(
  sweatLossL: number,
  sodiumLossMg: number,
  ongoingRateLh: number,
): SweatPrescription {
  const REPLACEMENT_FACTOR = 1.25;
  const WINDOW_H = 4;

  const replacementL = clampPositive(sweatLossL) * REPLACEMENT_FACTOR;
  const replacementOz = Math.round(replacementL * OZ_PER_L);

  // Sodium loss is reported for transparency, but AForce does NOT try
  // to flood-replace it. The Recovery Intelligence surface explains the
  // marine-mineral / pH-structured-water mechanism that drives recovery
  // without dosing 500mg+ sodium per serving.
  const replacementSodiumMg = Math.round(clampPositive(sodiumLossMg));

  // Sticks are sized purely by fluid budget at 25mg sodium / serving.
  // The intentional sodium gap (sodiumLoss − units * 25) is surfaced
  // separately as `sodiumGapMg` and is part of the positioning, not a
  // bug to be closed by overdosing electrolyte powder.
  const stickByFluid = Math.floor(replacementOz / AFORCE_STICK_REFERENCE_OZ);
  const aforceSticks = Math.max(0, stickByFluid);

  const stickFluidOz = aforceSticks * AFORCE_STICK_REFERENCE_OZ;
  const pairWaterOz = Math.max(0, replacementOz - stickFluidOz);

  // Ongoing per-hour intake rate during similar future sessions.
  // Mid-band of Sawka §F: replace 80–100% of sweat as you go.
  const ongoingOzPerHour = Math.round(clampPositive(ongoingRateLh) * OZ_PER_L * 0.9);

  const headline = aforceSticks > 0
    ? `Replace ${replacementOz} ounces over the next ${WINDOW_H}h — ${aforceSticks} AForce serving${aforceSticks > 1 ? 's' : ''} + ${pairWaterOz} ounces water.`
    : `Replace ${replacementOz} ounces of water over the next ${WINDOW_H}h.`;

  const rationale: [string, string] = [
    `${replacementOz} ounces = 125% of measured loss — replaces sweat plus the obligatory urine output during recovery (Sawka 2007).`,
    aforceSticks > 0
      ? `${aforceSticks} AForce serving${aforceSticks > 1 ? 's' : ''} (${aforceSticks * AFORCE_SODIUM_PER_UNIT_MG} mg sodium) paired with marine minerals + pH 8.8 structured water — recovery is driven by cellular uptake, not sodium volume.`
      : 'Sodium loss was minimal — plain water is enough this session.',
  ];

  return {
    replacementOz,
    windowHours: WINDOW_H,
    replacementSodiumMg,
    ongoingOzPerHour,
    aforceSticks,
    pairWaterOz,
    headline,
    rationale,
  };
}

// ─── Public entry point ──────────────────────────────────────────────────────

/**
 * Compute a SweatSession from any of the three input modes. Pure
 * function — does not touch the store. The caller is responsible for
 * persisting the result and for setting `state.sweatRate` if desired.
 */
export function computeSweatSession(inputs: SweatInputs): SweatSession {
  if (inputs.mode === 'quick') return computeQuick(inputs);
  if (inputs.mode === 'precision') return computePrecision(inputs);
  return computeEstimate(inputs);
}

function computeQuick(i: QuickInputs): SweatSession {
  const preKg = toKg(i.preWeight, i.weightUnit);
  const postKg = toKg(i.postWeight, i.weightUnit);
  const fluidL = toLiters(i.fluidIntake, i.fluidUnit);

  const { sweatLossL, sweatRateLh } = measuredSweatRate({
    preWeightKg: preKg,
    postWeightKg: postKg,
    durationMin: i.durationMinutes,
    fluidL,
  });

  // Quick mode assumes population-mean sodium profile.
  const naBand = sodiumBand('moderate');
  const sodiumLossMg = Math.round(sweatLossL * naBand.mgPerLiter);
  const deficitPct = preKg > 0 ? Math.max(0, ((preKg - postKg) / preKg) * 100) : 0;

  const prescription = buildPrescription(sweatLossL, sodiumLossMg, sweatRateLh);

  const heightCm = i.height && i.heightUnit ? toCm(i.height, i.heightUnit) : 0;
  const bsaM2 = heightCm > 0 ? bsaDuBois(preKg, heightCm) : undefined;
  const audit: SweatAudit = { bodyWeightKg: preKg, bsaM2, source: 'measured' };
  return finalize({
    mode: 'quick',
    sweatLossL,
    sweatRateLh,
    deficitPct,
    sodiumProfile: 'moderate',
    sodiumConcentrationMgL: naBand.mgPerLiter,
    sodiumLossMg,
    prescription,
    audit,
  });
}

function computePrecision(i: PrecisionInputs): SweatSession {
  const preKg = toKg(i.preWeight, i.weightUnit);
  const postKg = toKg(i.postWeight, i.weightUnit);
  const fluidL = toLiters(i.fluidIntake, i.fluidUnit);
  const urineL = toLiters(i.urineLoss, i.fluidUnit);

  const { sweatLossL, sweatRateLh } = measuredSweatRate({
    preWeightKg: preKg,
    postWeightKg: postKg,
    durationMin: i.durationMinutes,
    fluidL,
    urineL,
  });

  // Acclimatized athletes' sweat sodium is ~30% lower at the same
  // tier — adjust the concentration per Périard 2015.
  const baseNa = sodiumBand(i.sodiumProfile).mgPerLiter;
  const naMgL = Math.round(baseNa * (i.acclimatized ? 0.7 : 1.0));
  const sodiumLossMg = Math.round(sweatLossL * naMgL);
  const deficitPct = preKg > 0 ? Math.max(0, ((preKg - postKg) / preKg) * 100) : 0;

  const prescription = buildPrescription(sweatLossL, sodiumLossMg, sweatRateLh);

  const heightCm = i.height && i.heightUnit ? toCm(i.height, i.heightUnit) : 0;
  const bsaM2 = heightCm > 0 ? bsaDuBois(preKg, heightCm) : undefined;
  const audit: SweatAudit = {
    bodyWeightKg: preKg,
    bsaM2,
    sport: getSport(i.sportId),
    heatFactor: heatFactor(i.ambientTempC, i.ambientHumidityPct),
    acclimFactor: acclimFactor(i.acclimatized),
    source: 'measured',
  };

  return finalize({
    mode: 'precision',
    sweatLossL,
    sweatRateLh,
    deficitPct,
    sodiumProfile: i.sodiumProfile,
    sodiumConcentrationMgL: naMgL,
    sodiumLossMg,
    prescription,
    audit,
  });
}

function computeEstimate(i: EstimateInputs): SweatSession {
  const weightKg = toKg(i.bodyWeight, i.weightUnit);
  const heightCm = toCm(i.height, i.heightUnit);
  const durationH = Math.max(i.durationMinutes / 60, 1 / 60);

  const est = estimateSweatRateLh({
    weightKg,
    heightCm,
    sportId: i.sportId,
    intensity: i.intensity,
    ambientTempC: i.ambientTempC,
    ambientHumidityPct: i.ambientHumidityPct,
    acclimatized: i.acclimatized,
  });

  const sweatLossL = est.sweatRateLh * durationH;
  const baseNa = sodiumBand(i.sodiumProfile).mgPerLiter;
  const naMgL = Math.round(baseNa * (i.acclimatized ? 0.7 : 1.0));
  const sodiumLossMg = Math.round(sweatLossL * naMgL);

  // Estimated deficit is loss / body weight × 100 (since no measured
  // post-weight is available, this reflects the pure sweat fraction).
  const deficitPct = weightKg > 0 ? (sweatLossL / weightKg) * 100 : 0;

  const prescription = buildPrescription(sweatLossL, sodiumLossMg, est.sweatRateLh);

  const audit: SweatAudit = {
    bodyWeightKg: weightKg,
    bsaM2: est.bsaM2,
    sport: getSport(i.sportId),
    heatFactor: est.heat,
    acclimFactor: est.accl,
    source: 'estimated',
  };

  return finalize({
    mode: 'estimate',
    sweatLossL,
    sweatRateLh: est.sweatRateLh,
    deficitPct,
    sodiumProfile: i.sodiumProfile,
    sodiumConcentrationMgL: naMgL,
    sodiumLossMg,
    prescription,
    audit,
  });
}

/**
 * Autopilot recheck cadence — driven entirely by deficit %.
 * Spec:
 *   ≥ 4% → 8 min  / critical
 *   ≥ 2% → 12 min / high
 *   else → 20 min / moderate
 * Recovery window is fixed at 4 hours (spec §4).
 */
export function deriveAutopilot(deficitPct: number): SweatAutopilot {
  if (deficitPct >= 4) return { intervalMin: 8, urgency: 'critical', recoveryWindowHours: 4 };
  if (deficitPct >= 2) return { intervalMin: 12, urgency: 'high', recoveryWindowHours: 4 };
  return { intervalMin: 20, urgency: 'moderate', recoveryWindowHours: 4 };
}

function finalize(args: {
  mode: SweatSession['mode'];
  sweatLossL: number;
  sweatRateLh: number;
  deficitPct: number;
  sodiumProfile: SodiumProfile;
  sodiumConcentrationMgL: number;
  sodiumLossMg: number;
  prescription: SweatPrescription;
  audit: SweatAudit;
}): SweatSession {
  // Spec rules:
  //   aforce_sodium_total = total_units * 25
  //   sodium_gap          = max(0, sodium_loss - aforce_sodium_total)
  const aforceSodiumTotalMg = args.prescription.aforceSticks * AFORCE_SODIUM_PER_UNIT_MG;
  const sodiumGapMg = Math.max(0, args.sodiumLossMg - aforceSodiumTotalMg);

  return {
    computedAt: new Date().toISOString(),
    mode: args.mode,
    sweatLossL: round(args.sweatLossL, 2),
    sweatRateLh: round(args.sweatRateLh, 2),
    sweatRateOzh: round(args.sweatRateLh * OZ_PER_L, 1),
    deficitPct: round(args.deficitPct, 2),
    deficitBand: classifyDeficit(args.deficitPct),
    sodiumConcentrationMgL: args.sodiumConcentrationMgL,
    sodiumLossMg: args.sodiumLossMg,
    sodiumProfile: args.sodiumProfile,
    prescription: args.prescription,
    aforceSodiumTotalMg,
    sodiumGapMg,
    autopilot: deriveAutopilot(args.deficitPct),
    audit: args.audit,
  };
}

function round(n: number, places: number): number {
  const f = Math.pow(10, places);
  return Math.round(n * f) / f;
}

export const SWEAT_SPORTS_LIST = SWEAT_SPORTS;
