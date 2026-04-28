/**
 * Sweat Calculator types.
 *
 * Two distinct concerns kept separate:
 *  1. Inputs the user provides (per mode: quick / precision / estimate).
 *  2. The fully-resolved SweatSession the engine returns — sweat rate,
 *     sodium loss, deficit %, classification, and personalized AForce
 *     replacement prescription.
 *
 * The engine is in services/sweatRateEngine.ts and is anchored to:
 *   - Sawka MN et al. 2007. ACSM Position Stand: Exercise and Fluid
 *     Replacement. Med Sci Sports Exerc 39(2):377-390.
 *   - Baker LB. 2017. Sweating Rate and Sweat Sodium Concentration in
 *     Athletes. Sports Med 47(Suppl 1):111-128.
 *   - Maughan RJ, Shirreffs SM. 2010. Development of a hydration
 *     strategy for athletes. Scand J Med Sci Sports 20(s2):31-42.
 *   - Cheuvront SN, Kenefick RW. 2014. Dehydration: Physiology,
 *     Assessment, and Performance Effects. Compr Physiol 4(1):257-285.
 */

export type SweatInputMode = 'quick' | 'precision' | 'estimate';
export type WeightUnit = 'lbs' | 'kg';
export type FluidUnit = 'oz' | 'ml';
export type HeightUnit = 'in' | 'cm';

/** ── Sweat-sodium classification (Baker 2017, Table 2) ─────────────── */
export type SodiumProfile = 'light' | 'moderate' | 'heavy' | 'very_heavy';

export interface SodiumProfileBand {
  id: SodiumProfile;
  label: string;
  /** Sodium concentration in mg / L of sweat — population reference ranges. */
  mgPerLiter: number;
  description: string;
}

/** ── Hydration-deficit band (ACSM 2007 thresholds) ────────────────── */
export type DeficitBand = 'optimal' | 'mild' | 'impaired' | 'danger';

export interface DeficitBandSpec {
  id: DeficitBand;
  label: string;
  /** Deficit % of body weight at which this band kicks in (lower bound). */
  thresholdPct: number;
  message: string;
}

/** ── Sport defaults ───────────────────────────────────────────────── */
export interface SportDefault {
  id: string;
  label: string;
  emoji: string;
  /** Mean sweat rate from published athlete-population studies (L/h). */
  meanSweatRateLh: number;
  /** Metabolic equivalent — Compendium of Physical Activities 2011. */
  met: number;
  /** Short citation pointer for the UI. */
  citation: string;
}

/** ── Inputs — Quick mode (just weight delta) ──────────────────────── */
export interface QuickInputs {
  mode: 'quick';
  preWeight: number;
  postWeight: number;
  weightUnit: WeightUnit;
  durationMinutes: number;
  /** Optional: fluid the athlete drank during the session. */
  fluidIntake: number;
  fluidUnit: FluidUnit;
  /** Optional: height — used only for Du Bois BSA in the audit panel. */
  height?: number;
  heightUnit?: HeightUnit;
}

/** ── Inputs — Precision mode (full ACSM protocol) ─────────────────── */
export interface PrecisionInputs {
  mode: 'precision';
  /** Optional: height — used only for Du Bois BSA in the audit panel. */
  height?: number;
  heightUnit?: HeightUnit;
  preWeight: number;
  postWeight: number;
  weightUnit: WeightUnit;
  durationMinutes: number;
  fluidIntake: number;
  fluidUnit: FluidUnit;
  /** Urine void mass (collected post-session) — same unit as fluid. */
  urineLoss: number;
  sportId: string;
  ambientTempC: number;
  ambientHumidityPct: number;
  /** Whether the athlete is heat-acclimatized (≥10 days of heat exposure). */
  acclimatized: boolean;
  /** Self-reported sweat-sodium tier — refines the prescription. */
  sodiumProfile: SodiumProfile;
}

/** ── Inputs — Estimate mode (no scale required) ───────────────────── */
export interface EstimateInputs {
  mode: 'estimate';
  bodyWeight: number;
  weightUnit: WeightUnit;
  height: number;
  heightUnit: HeightUnit;
  sportId: string;
  durationMinutes: number;
  /** Subjective intensity 1 (light) – 5 (max) — scales the MET. */
  intensity: 1 | 2 | 3 | 4 | 5;
  ambientTempC: number;
  ambientHumidityPct: number;
  acclimatized: boolean;
  sodiumProfile: SodiumProfile;
}

export type SweatInputs = QuickInputs | PrecisionInputs | EstimateInputs;

/** ── Output — the resolved session ─────────────────────────────────── */
export interface SweatSession {
  /** ISO timestamp when computed. */
  computedAt: string;
  mode: SweatInputMode;

  /** Total sweat loss across the session, in liters. */
  sweatLossL: number;
  /** Sweat rate, in liters per hour. */
  sweatRateLh: number;
  /** Sweat rate, in fluid ounces per hour (UI convenience). */
  sweatRateOzh: number;

  /** Hydration deficit as % of pre-session body weight (post-fluid intake). */
  deficitPct: number;
  /** Deficit band (ACSM thresholds). */
  deficitBand: DeficitBand;

  /** Sweat-sodium concentration assumed (mg / L). */
  sodiumConcentrationMgL: number;
  /** Total sodium lost across the session (mg). */
  sodiumLossMg: number;
  /** Resolved sodium classification. */
  sodiumProfile: SodiumProfile;

  /** Personalized AForce prescription. */
  prescription: SweatPrescription;

  /** Per-input audit trail — what we computed from what. */
  audit: SweatAudit;
}

export interface SweatPrescription {
  /** Total fluid (oz) to replace within the recovery window. */
  replacementOz: number;
  /** Recovery window length in hours (typically 2-4h post-session). */
  windowHours: number;
  /** Total sodium (mg) to replace. */
  replacementSodiumMg: number;
  /** Per-hour intake target during the next session of similar intensity (oz/h). */
  ongoingOzPerHour: number;
  /** Suggested AForce stick count for the recovery window. */
  aforceSticks: number;
  /** Plain water (oz) to pair with the sticks for full replacement. */
  pairWaterOz: number;
  /** Headline copy — single sentence the OS speaks aloud. */
  headline: string;
  /** Two short bullet rationales. */
  rationale: [string, string];
}

export interface SweatAudit {
  /** Effective body weight in kg (always normalized). */
  bodyWeightKg: number;
  /** Body surface area (m²) — Du Bois formula, when available. */
  bsaM2?: number;
  /** Heat factor applied (1.0 thermoneutral, >1 hot). */
  heatFactor?: number;
  /**
   * Acclimatization adjustment factor applied to the sweat-rate estimate.
   * Acclimatized athletes sweat ~8% more (factor = 1.08) but at ~30% lower
   * sodium concentration — Périard 2015. The sodium-side discount is
   * applied separately at the [Na+] step, not here.
   */
  acclimFactor?: number;
  /** Sport context resolved. */
  sport?: SportDefault;
  /** Source of the calculation — useful for testing + telemetry. */
  source: 'measured' | 'estimated';
}
