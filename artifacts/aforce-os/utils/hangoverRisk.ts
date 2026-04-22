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
