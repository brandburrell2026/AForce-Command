/**
 * Hangover Risk engine.
 *
 * Pure function so the scoring engine can call it on every recompute
 * without touching the network. Inputs are deliberately small — the
 * caller passes the SocialModeState slice plus a couple of context
 * signals already available on UserState.
 *
 * Risk score (0–100) factors, from heaviest to lightest:
 *   1. Drink count + drink-type weight (cocktails/liquor cost more)
 *   2. Hydration compliance ratio (water/RTD responses ÷ drinks)
 *   3. Average gap between drinks (faster pacing → higher risk)
 *   4. Body weight (lighter = higher per-drink load)
 *   5. Heat band (already on UserState — heat dehydrates)
 *
 * Bands:
 *   LOW       < 25
 *   MODERATE  25–49
 *   HIGH      50–74
 *   CRITICAL  ≥ 75
 *
 * Reasons are short tokens (e.g. "low_hydration_response") that the
 * UI can localize via i18n. The engine never returns localized text.
 */

import type {
  DrinkLog,
  HangoverRisk,
  HangoverRiskLevel,
} from '../types';
import { ALCOHOL_DRINKS } from '../data/alcoholDrinks';

export interface HangoverRiskInputs {
  drinks: DrinkLog[];
  /** Body weight in lbs (UserState.bodyWeightLbs). Defaults to 170 if missing. */
  bodyWeightLbs?: number;
  /** 0–10 heat axis (UserState.heatLoad). 0 if missing. */
  heatLoad?: number;
  /** "now" for tests; defaults to Date.now(). */
  now?: number;
}

function levelFor(score: number): HangoverRiskLevel {
  if (score >= 75) return 'CRITICAL';
  if (score >= 50) return 'HIGH';
  if (score >= 25) return 'MODERATE';
  return 'LOW';
}

/**
 * Compliance = fraction of drinks the user followed up with hydration.
 * A drink whose `hydrated === null` is still pending — counts as
 * neither compliant nor non-compliant (treated as 0.5 so a single
 * outstanding drink doesn't whiplash the badge).
 */
function complianceRatio(drinks: DrinkLog[]): number {
  if (drinks.length === 0) return 1;
  let credit = 0;
  for (const d of drinks) {
    if (d.hydrated === true) credit += 1;
    else if (d.hydrated == null) credit += 0.5;
  }
  return credit / drinks.length;
}

export function calculateHangoverRisk(inputs: HangoverRiskInputs): HangoverRisk {
  const drinks = inputs.drinks ?? [];
  const weight = Math.max(80, inputs.bodyWeightLbs ?? 170);
  const heat = Math.max(0, Math.min(10, inputs.heatLoad ?? 0));
  const now = inputs.now ?? Date.now();

  const reasons: string[] = [];
  let score = 0;

  // 1) Drink load. Each drink contributes its riskWeight × 7 points,
  //    so 4 cocktails (≈ 4 × 1.6 × 7 ≈ 45) is HIGH territory before
  //    any other factor lands. Capped at 50 so a single really long
  //    night can't pin the badge to CRITICAL on count alone.
  const loadRaw = drinks.reduce((sum, d) => {
    const w = ALCOHOL_DRINKS[d.type]?.riskWeight ?? 1.2;
    return sum + w * 7;
  }, 0);
  const load = Math.min(50, loadRaw);
  score += load;
  if (drinks.length >= 4) reasons.push('high_drink_count');
  if (drinks.some((d) => d.type === 'liquor' || d.type === 'cocktail')) reasons.push('strong_drinks');

  // 2) Hydration compliance — missing hydration is the single biggest
  //    correctable factor. A 0% ratio adds 25; 100% adds 0.
  const compliance = complianceRatio(drinks);
  const complianceCost = Math.round((1 - compliance) * 25);
  score += complianceCost;
  if (compliance < 0.6 && drinks.length > 0) reasons.push('low_hydration_response');

  // 3) Pacing — average gap between drinks. Tight pacing (<20 min)
  //    pushes risk up by 10; long gaps (>60 min) actively reduce it.
  if (drinks.length >= 2) {
    const sorted = [...drinks].sort((a, b) => a.loggedAt.getTime() - b.loggedAt.getTime());
    const gaps: number[] = [];
    for (let i = 1; i < sorted.length; i += 1) {
      gaps.push((sorted[i].loggedAt.getTime() - sorted[i - 1].loggedAt.getTime()) / 60000);
    }
    const avgGap = gaps.reduce((s, g) => s + g, 0) / gaps.length;
    if (avgGap < 20) {
      score += 10;
      reasons.push('fast_pacing');
    } else if (avgGap > 60) {
      score = Math.max(0, score - 5);
    }
  }

  // 4) Body weight — lighter folks process the same load harder.
  //    Reference weight is 170 lbs. ±5 points per ±50 lbs delta.
  const weightFactor = (170 - weight) / 50;
  score += weightFactor * 5;

  // 5) Heat — adds linearly with the heat axis (max +5 at heat=10).
  if (heat >= 6) {
    score += (heat - 5) * 1.5;
    reasons.push('high_heat');
  }

  // Recent activity boost — drinks logged in the last 60 min get a
  //    small additional weight because the alcohol is still being
  //    metabolized when the badge is read.
  const recent = drinks.filter((d) => now - d.loggedAt.getTime() < 60 * 60 * 1000).length;
  if (recent >= 2) score += 5;

  const finalScore = Math.max(0, Math.min(100, Math.round(score)));
  return {
    score: finalScore,
    level: levelFor(finalScore),
    reasons,
  };
}

/**
 * Per-event alcohol penalty applied directly to the hydration score.
 *
 * The decay multiplier (`activeDecayMultiplier` below) only changes the
 * RATE at which the score drops going forward — it does not move the
 * score the moment a drink is logged. That doesn't match user
 * expectations: if you're at PEAK 100 and pound four cocktails in five
 * minutes, the orb should obviously plummet immediately, not just
 * "decay slightly faster from now on".
 *
 * Physiological grounding (alcohol diuresis):
 *   - Each ~14 g standard drink causes the kidneys to excrete an extra
 *     ~10 mL of urine per gram of ethanol over the next ~60 min
 *     (Eggleton 1942, Hobson & Maughan 2010). That's ~140 mL of net
 *     water loss per drink — roughly equivalent to losing ~5 oz of
 *     ingested water in score terms.
 *   - Liquor and cocktails carry more ethanol per serving (and cocktails
 *     add osmotic sugar load), so their per-drink penalty is larger.
 *   - Hard seltzer / beer are at the low end (~5 % ABV).
 *   - Confirming hydration (the `/social/hydrate` confirm action sets
 *     `drink.hydrated = true`) materially blunts the diuresis cost
 *     because the matching water bolus offsets the kidney response.
 *
 * Time profile (per drink):
 *   0–5 min     ramp in linearly (alcohol absorption from the gut)
 *   5–60 min    full penalty (peak diuresis window)
 *   60–180 min  fade linearly to zero (alcohol metabolized at
 *               ~1 standard drink / hour, complete clearance ~3 h)
 *   > 180 min   zero — the lasting cost now lives in the hangover risk
 *               score, the decay multiplier, and the recovery window.
 *
 * Returns a NEGATIVE delta (or zero) so the scoring engine can fold it
 * straight into the contribution sum. Magnitude clamped to MAX_PENALTY
 * so a marathon session can't single-handedly drive the orb to zero —
 * the decay multiplier and hangover risk continue to do their work.
 */
export const SOCIAL_INTAKE_MAX_PENALTY = 30;
const HYDRATED_MITIGATION_FACTOR = 0.4; // 60 % of the penalty cancelled
const PER_DRINK_WEIGHT = 5; // pts per riskWeight unit at peak window
const RAMP_IN_MIN = 5;
const PEAK_END_MIN = 60;
const FADE_END_MIN = 180;

export interface SocialIntakePoints {
  /** Negative or zero — points to add to the score contribution sum. */
  penalty: number;
  /** Drinks currently inside the 0–180 min penalty window. */
  activeDrinks: number;
  /** Drinks at full peak penalty (5–60 min old). */
  peakDrinks: number;
  /** Drinks whose user has confirmed hydration response. */
  hydratedDrinks: number;
}

export function socialIntakePoints(
  drinks: DrinkLog[],
  now: number = Date.now(),
): SocialIntakePoints {
  if (!drinks || drinks.length === 0) {
    return { penalty: 0, activeDrinks: 0, peakDrinks: 0, hydratedDrinks: 0 };
  }
  let raw = 0;
  let activeDrinks = 0;
  let peakDrinks = 0;
  let hydratedDrinks = 0;
  for (const d of drinks) {
    const meta = ALCOHOL_DRINKS[d.type];
    if (!meta) continue;
    const ageMin = (now - d.loggedAt.getTime()) / 60000;
    if (ageMin < 0 || ageMin > FADE_END_MIN) continue;

    let envelope: number;
    if (ageMin < RAMP_IN_MIN) {
      envelope = ageMin / RAMP_IN_MIN; // 0 → 1 (ramp-in, exclusive of t=5)
    } else if (ageMin <= PEAK_END_MIN) {
      envelope = 1; // full penalty (t=5 to t=60 inclusive)
      peakDrinks += 1;
    } else {
      envelope = 1 - (ageMin - PEAK_END_MIN) / (FADE_END_MIN - PEAK_END_MIN); // 1 → 0
    }
    activeDrinks += 1;
    let perDrink = meta.riskWeight * PER_DRINK_WEIGHT * envelope;
    if (d.hydrated === true) {
      perDrink *= HYDRATED_MITIGATION_FACTOR;
      hydratedDrinks += 1;
    }
    raw += perDrink;
  }
  const clamped = Math.min(SOCIAL_INTAKE_MAX_PENALTY, raw);
  // Normalize -0 → 0 so callers don't have to deal with JS negative zero.
  const penalty = clamped === 0 ? 0 : -clamped;
  return {
    penalty,
    activeDrinks,
    peakDrinks,
    hydratedDrinks,
  };
}

/**
 * Average decay multiplier from the active drink window. Used by the
 * scoring engine to amplify base decay while social mode is active.
 * Drinks older than their `activeMinutes` window contribute nothing
 * to the live multiplier (their hangover cost still lingers in the
 * risk score above).
 */
export function activeDecayMultiplier(drinks: DrinkLog[], now: number = Date.now()): number {
  if (drinks.length === 0) return 1;
  const active = drinks.filter((d) => {
    const meta = ALCOHOL_DRINKS[d.type];
    if (!meta) return false;
    const ageMin = (now - d.loggedAt.getTime()) / 60000;
    return ageMin >= 0 && ageMin <= meta.activeMinutes;
  });
  if (active.length === 0) return 1;
  const sum = active.reduce((s, d) => s + (ALCOHOL_DRINKS[d.type]?.decayMultiplier ?? 1.2), 0);
  return sum / active.length;
}
