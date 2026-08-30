/**
 * HydroScan 2.0™ — Hydration Impact engine (pure, dependency-free).
 *
 * Turns ONE scanned product into a 4-level Hydration Impact headline that
 * is PROFILE-AWARE: the same product can land on different levels for
 * different users because body weight, biological sex, activity level,
 * current performance state, and environment all feed the computation.
 *
 * Score-Protection: this module is advisory only. It returns a display
 * score + level; it never awards, mutates, or fabricates a hydration
 * point, performance band, or recovery score. The sole score path remains
 * the explicit "Log Intake" tap.
 *
 * Water-First: plain water can never read below NEUTRAL — water always
 * supports hydration regardless of profile or environment.
 *
 * Inputs use NORMALIZED units so the helper stays scale-agnostic and
 * trivially testable:
 *   - product sub-scores are 0..100 (mirrors the comparison-engine model)
 *   - environment.heat01 / humidity01 are 0..1 (the service normalizes
 *     UserState.heatLoad and weatherHumidity/100 before calling)
 *   - profile.activityLevel is 0..10 (matches ProfileIdentity)
 */

import type {
  HydrationImpactDriver,
  HydrationImpactLevel,
  HydrationImpactResult,
} from '../../types/scan';
import type { PerformanceLevel } from '../../types';
import type { BiologicalSex } from '../profileIdentity';

export interface HydrationImpactProduct {
  /** 0..100 — water-availability / hydration-speed proxy. `null` = UNKNOWN (D5). */
  hydrationSpeed: number | null;
  /** 0..100 — mineral / electrolyte content. `null` = UNKNOWN (D5). */
  electrolyteDensity: number | null;
  /** 0..100 — sugar load (higher = more osmotic load). `null` = UNKNOWN. */
  sugarLevel: number | null;
  /** 0..100 — stimulant load. A measured `0` means none; `null` = UNKNOWN. */
  stimulantLevel: number | null;
  /**
   * Retained for the driver chips only. Since founder ruling D6 this no longer
   * moves the score — see the note above `AFORCE_SUPPORT_BUMP`'s removal.
   */
  isAForce: boolean;
  /**
   * True when the item is plain water. Forces the result to never read
   * below NEUTRAL (Water-First). The service sets this from the product
   * category / fluid type.
   */
  isWater?: boolean;
}

export interface HydrationImpactProfile {
  /** Body weight in lbs (60..500), or null when not set. */
  bodyWeightLbs: number | null;
  biologicalSex: BiologicalSex;
  /** Activity level 0..10, or null when not set. */
  activityLevel: number | null;
}

export interface HydrationImpactEnvironment {
  /** 0..1 heat load (UserState.heatLoad). */
  heat01: number;
  /** 0..1 humidity (weatherHumidity / 100), or null/undefined when unknown. */
  humidity01?: number | null;
  /** Ambient °C, or null/undefined when unknown. */
  tempC?: number | null;
}

export interface HydrationImpactInput {
  product: HydrationImpactProduct;
  profile: HydrationImpactProfile;
  state: PerformanceLevel;
  environment: HydrationImpactEnvironment;
}

/** Score thresholds (0..100) → 4-level headline. Higher = more supportive. */
export const IMPACT_THRESHOLDS = {
  highSupport: 70,
  neutral: 50,
  moderateImpact: 30,
} as const;

/** Product-intrinsic support / load weights (applied to 0..1 sub-scores). */
const PRODUCT_WEIGHTS = {
  water: 0.45,
  minerals: 0.4,
  sugar: 0.65,
  stimulant: 0.55,
} as const;

/** AForce intrinsic mineral-support bump. */
// COMMERCIAL NEUTRALITY — founder ruling D6, 2026-08-30. A brand flag used to
// add 0.15 to `support` here, worth up to ~10.5 points on the member-visible
// 0-100 impact score (the amplifier is driven by the member's own body weight,
// sex, activity and heat, so the bump's leverage GREW with member need). The
// arithmetic is otherwise brand-blind; this was the one place ownership moved
// the number. AForce may receive premium presentation, not privileged
// decision authority.
/** Plain water support floor (before demand amplification). */
const WATER_SUPPORT_FLOOR = 0.85;

/** Demand blend weights (sum to 1.0, excluding the small sex nudge). */
export const DEMAND_WEIGHTS = {
  weight: 0.25,
  activity: 0.25,
  heat: 0.25,
  humidity: 0.1,
  state: 0.15,
} as const;

export function computeHydrationImpact(
  input: HydrationImpactInput,
): HydrationImpactResult {
  const { product, profile, state, environment } = input;

  // ── Product intrinsic support vs load (0..1 sub-scores) ──────────
  // UNKNOWN contributes nothing rather than a substituted zero (D5). A zero
  // here is a real reading — "contains none" — and must stay distinguishable
  // from "we have no reading", which is why each term is weighed only when its
  // input is known and the weights are renormalized over what remains.
  const known = (v: number | null): number | null => (v == null ? null : clamp01(v / 100));
  const water = known(product.hydrationSpeed);
  const minerals = known(product.electrolyteDensity);
  const sugar = known(product.sugarLevel);
  const stim = known(product.stimulantLevel);

  const isWater = product.isWater === true;

  const blend = (terms: { v: number | null; w: number }[]): number => {
    const present = terms.filter((t): t is { v: number; w: number } => t.v != null);
    if (present.length === 0) return 0;
    const wSum = present.reduce((a, t) => a + t.w, 0);
    const total = terms.reduce((a, t) => a + t.w, 0);
    // Renormalize onto the full weight span so a partially-known product is
    // not silently scaled down for what it does not report.
    return (present.reduce((a, t) => a + t.v * t.w, 0) / wSum) * total;
  };

  let support = blend([
    { v: water, w: PRODUCT_WEIGHTS.water },
    { v: minerals, w: PRODUCT_WEIGHTS.minerals },
  ]);
  if (isWater) support = Math.max(support, WATER_SUPPORT_FLOOR);
  support = clamp(support, 0, 1.2);

  const load = clamp(
    blend([
      { v: sugar, w: PRODUCT_WEIGHTS.sugar },
      { v: stim, w: PRODUCT_WEIGHTS.stimulant },
    ]),
    0,
    1.2,
  );

  const netRaw = clamp(support - load, -1, 1);

  // ── Demand from profile + environment + state (0..1) ─────────────
  // This is what makes the SAME product read differently per user: a
  // higher-demand user amplifies the read in whichever direction the
  // product already leans (supportive → more supportive; loading →
  // more loading).
  const weightFactor = weightDemand(profile.bodyWeightLbs);
  const activityFactor = activityDemand(profile.activityLevel);
  const tempFactor = tempDemand(environment.tempC);
  const heatFactor = Math.max(clamp01(environment.heat01), tempFactor);
  const humidityFactor =
    environment.humidity01 == null ? 0 : clamp01(environment.humidity01);
  const stateFactor = stateDemand(state);
  const sexNudge = 0.05 * (sexDemand(profile.biologicalSex) - 0.6);

  const demand = clamp01(
    DEMAND_WEIGHTS.weight * weightFactor +
      DEMAND_WEIGHTS.activity * activityFactor +
      DEMAND_WEIGHTS.heat * heatFactor +
      DEMAND_WEIGHTS.humidity * humidityFactor +
      DEMAND_WEIGHTS.state * stateFactor +
      sexNudge,
  );

  // Demand amplifies magnitude in both directions: 0.6× .. 1.4×.
  const amplifier = 0.6 + 0.8 * demand;
  const score = clampScore(50 + 50 * netRaw * amplifier);

  let level = levelForScore(score);
  // Water-First: water can never read below NEUTRAL.
  if (isWater && isWorseThanNeutral(level)) level = 'NEUTRAL';

  const drivers = buildDrivers({
    water,
    minerals,
    sugar,
    stim,
    isWater,
    isAForce: product.isAForce,
    netSupportive: netRaw >= 0,
    weightFactor,
    activityFactor,
    heatFactor,
    humidityFactor,
    stateFactor,
    profile,
  });

  const lowConfidence = profile.bodyWeightLbs == null || profile.activityLevel == null;

  return { level, score, drivers, lowConfidence };
}

/** Map a 0..100 score to its 4-level headline. */
export function levelForScore(score: number): HydrationImpactLevel {
  if (score >= IMPACT_THRESHOLDS.highSupport) return 'HIGH_SUPPORT';
  if (score >= IMPACT_THRESHOLDS.neutral) return 'NEUTRAL';
  if (score >= IMPACT_THRESHOLDS.moderateImpact) return 'MODERATE_IMPACT';
  return 'HIGH_IMPACT';
}

// ─── demand factor helpers ─────────────────────────────────────────

/** Heavier athletes carry more fluid turnover. null → neutral 0.5. */
function weightDemand(lbs: number | null): number {
  if (lbs == null) return 0.5;
  return clamp01((lbs - 120) / 140);
}

/** Activity 0..10 → 0..1. null → neutral 0.5. */
function activityDemand(a: number | null): number {
  if (a == null) return 0.5;
  return clamp01(a / 10);
}

/** Ambient °C → 0..1 (20°C → 0, 40°C → 1). Unknown → 0 contribution. */
function tempDemand(c: number | null | undefined): number {
  if (c == null || !Number.isFinite(c)) return 0;
  return clamp01((c - 20) / 20);
}

/** Current state → demand. DEPLETED highest, PEAK lowest. */
function stateDemand(state: PerformanceLevel): number {
  switch (state) {
    case 'DEPLETED':
      return 1;
    case 'RECOVERING':
      return 0.7;
    case 'BALANCED':
      return 0.4;
    case 'PEAK':
      return 0.25;
    default:
      return 0.4;
  }
}

/** Small biological-sex nudge (avg sweat/fluid turnover). Neutral ≈ 0.6. */
function sexDemand(sex: BiologicalSex): number {
  switch (sex) {
    case 'male':
      return 1;
    case 'female':
      return 0.4;
    case 'non-binary':
      return 0.6;
    case 'unspecified':
    default:
      return 0.6;
  }
}

// ─── drivers ───────────────────────────────────────────────────────

interface DriverInputs {
  water: number | null;
  minerals: number | null;
  sugar: number | null;
  stim: number | null;
  isWater: boolean;
  isAForce: boolean;
  netSupportive: boolean;
  weightFactor: number;
  activityFactor: number;
  heatFactor: number;
  humidityFactor: number;
  stateFactor: number;
  profile: HydrationImpactProfile;
}

/**
 * Build the dominant drivers, most significant first. Product factors
 * carry their own direction; demand/context factors take the sign of the
 * net product lean (a hot day makes a supportive product more valuable
 * and a loading product more costly).
 */
function buildDrivers(i: DriverInputs): HydrationImpactDriver[] {
  const contextDir: 'support' | 'load' = i.netSupportive ? 'support' : 'load';
  const candidates: { key: string; direction: 'support' | 'load'; weight: number }[] = [];

  // An UNKNOWN term cannot cross a threshold it has no value for, so it never
  // becomes a driver (D5). `over()` is false for null by construction.
  const over = (v: number | null, bar: number): v is number => v != null && v >= bar;

  if (i.isWater) candidates.push({ key: 'water', direction: 'support', weight: 1 });
  if (!i.isWater && over(i.water, 0.5))
    candidates.push({ key: 'water', direction: 'support', weight: i.water });
  if (over(i.minerals, 0.4))
    candidates.push({ key: 'electrolytes', direction: 'support', weight: i.minerals });
  // COMMERCIAL NEUTRALITY (D6): brand ownership was also a named DRIVER of the
  // member-facing score, weighted 0.6 — the attribution half of the support
  // bump removed above. Both are gone; drivers are product characteristics.
  if (over(i.sugar, 0.3))
    candidates.push({ key: 'sugar', direction: 'load', weight: i.sugar });
  if (over(i.stim, 0.2))
    candidates.push({ key: 'stimulant', direction: 'load', weight: i.stim });

  // Context drivers — only meaningful when they reinforce the net lean.
  if (i.heatFactor >= 0.5)
    candidates.push({ key: 'heat', direction: contextDir, weight: i.heatFactor * 0.9 });
  if (i.humidityFactor >= 0.5)
    candidates.push({
      key: 'humidity',
      direction: contextDir,
      weight: i.humidityFactor * 0.6,
    });
  if (i.profile.activityLevel != null && i.activityFactor >= 0.5)
    candidates.push({ key: 'activity', direction: contextDir, weight: i.activityFactor * 0.8 });
  if (i.profile.bodyWeightLbs != null && i.weightFactor >= 0.6)
    candidates.push({ key: 'weight', direction: contextDir, weight: i.weightFactor * 0.7 });
  if (i.stateFactor >= 0.7)
    candidates.push({ key: 'state', direction: contextDir, weight: i.stateFactor * 0.7 });

  return candidates
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 4)
    .map(({ key, direction }) => ({ key, direction }));
}

// ─── primitives ────────────────────────────────────────────────────

function isWorseThanNeutral(level: HydrationImpactLevel): boolean {
  return level === 'MODERATE_IMPACT' || level === 'HIGH_IMPACT';
}

function clampScore(n: number): number {
  return Math.round(clamp(n, 0, 100));
}

function clamp01(n: number): number {
  return clamp(n, 0, 1);
}

function clamp(n: number, lo: number, hi: number): number {
  if (!Number.isFinite(n)) return lo;
  return Math.min(hi, Math.max(lo, n));
}
