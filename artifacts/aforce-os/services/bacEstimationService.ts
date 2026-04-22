/**
 * BAC estimation service — Widmark approximation.
 *
 * SAFETY:
 *   This module produces ONE number kind: an **approximate** Blood
 *   Alcohol Concentration range (e.g. 0.06–0.08). It is **never** a
 *   medical, legal, or breathalyzer-grade value. Every UI surface that
 *   renders these numbers MUST pair them with the
 *   `social.not_legal_medical` disclaimer copy.
 *
 * Formula (Widmark, simplified):
 *   gramsAlcohol = sum( drink.oz * (drink.abv/100) * 0.789 * 29.5735 )
 *   bodyMassG    = bodyWeightLbs * 453.592
 *   bacRaw       = (gramsAlcohol / (bodyMassG * r)) * 100
 *     where r = 0.68 (default / male) or 0.55 (female)
 *   elapsedH     = hours since first drink
 *   bacCurrent   = max(0, bacRaw - 0.015 * elapsedH)
 *
 * We then widen by ±0.01 to produce a range (Widmark is ±15-20% in the
 * literature). Confidence comes from how many inputs were defaults vs
 * user-provided. Trend compares current BAC to the BAC value 15 minutes
 * ago using the same drink list (a positive delta = "rising").
 */

import { ALCOHOL_DRINKS } from '../data/alcoholDrinks';
import type {
  BACEstimate,
  DrinkLog,
  SocialContextSex,
} from '../types/socialMode';

export interface BACInputs {
  drinks: DrinkLog[];
  bodyWeightLbs?: number;
  sex?: SocialContextSex;
  ateRecently?: boolean;
  /** Test seam — defaults to Date.now(). */
  now?: number;
}

const ETHANOL_DENSITY_G_PER_ML = 0.789;
const ML_PER_OZ = 29.5735;
const LBS_TO_G = 453.592;
const ELIMINATION_PER_HOUR = 0.015; // BAC %/hour
/** Below this BAC the engine treats the user as effectively cleared. */
const CLEAR_THRESHOLD = 0.005;

function widmarkR(sex: SocialContextSex | undefined): number {
  if (sex === 'female') return 0.55;
  // Male / unspecified — same conservative midpoint as the original
  // Widmark constant. We err on the side of slightly underestimating
  // BAC for unspecified users; pairing with the disclaimer keeps that
  // honest.
  return 0.68;
}

function gramsAlcoholFor(drink: DrinkLog): number {
  const meta = ALCOHOL_DRINKS[drink.type] ?? ALCOHOL_DRINKS.custom;
  const oz = drink.oz ?? meta.defaultOz;
  const abv = drink.abv ?? meta.defaultAbv;
  return oz * ML_PER_OZ * (abv / 100) * ETHANOL_DENSITY_G_PER_ML;
}

interface BACPoint {
  bac: number;
  /** True when at least one drink has actually contributed by this time. */
  anyDrinks: boolean;
}

function bacAt(timeMs: number, drinks: DrinkLog[], bodyMassG: number, r: number, ateRecently: boolean): BACPoint {
  // Food in stomach → typically ~10-15% lower peak BAC. We apply a
  // conservative -8% multiplier so the estimate doesn't overstate.
  const foodFactor = ateRecently ? 0.92 : 1;
  let totalG = 0;
  let anyDrinks = false;
  for (const d of drinks) {
    if (d.loggedAt.getTime() > timeMs) continue;
    totalG += gramsAlcoholFor(d);
    anyDrinks = true;
  }
  if (!anyDrinks) return { bac: 0, anyDrinks: false };
  const firstMs = drinks.reduce(
    (min, d) => (d.loggedAt.getTime() < min ? d.loggedAt.getTime() : min),
    drinks[0].loggedAt.getTime(),
  );
  const elapsedHours = Math.max(0, (timeMs - firstMs) / (60 * 60 * 1000));
  const bacRaw = (totalG / (bodyMassG * r)) * 100 * foodFactor;
  const bac = Math.max(0, bacRaw - ELIMINATION_PER_HOUR * elapsedHours);
  return { bac, anyDrinks: true };
}

export function estimateBAC(inputs: BACInputs): BACEstimate {
  const drinks = inputs.drinks ?? [];
  const now = inputs.now ?? Date.now();
  const weightLbs = Math.max(80, inputs.bodyWeightLbs ?? 170);
  const r = widmarkR(inputs.sex);
  const bodyMassG = weightLbs * LBS_TO_G;
  const ateRecently = inputs.ateRecently === true;

  const current = bacAt(now, drinks, bodyMassG, r, ateRecently);
  const past = bacAt(now - 15 * 60 * 1000, drinks, bodyMassG, r, ateRecently);

  // ±0.01 widening — Widmark is roughly ±15-20% in the literature, and
  // 0.01 is also the rounding step the UI displays.
  const rangeLow = Math.max(0, Math.round((current.bac - 0.01) * 1000) / 1000);
  const rangeHigh = Math.max(rangeLow, Math.round((current.bac + 0.01) * 1000) / 1000);

  // Trend compares current to 15 min ago. We treat |Δ| < 0.005 as steady
  // so a single user doesn't see "rising/falling" flicker every refresh.
  let trend: BACEstimate['trend'];
  const delta = current.bac - past.bac;
  if (Math.abs(delta) < 0.005) trend = 'steady';
  else if (delta > 0) trend = 'rising';
  else trend = 'falling';

  // Time-to-clear at standard elimination rate. Conservative: rounded
  // UP to the nearest 5 minutes so the user doesn't think they cleared
  // earlier than they did.
  const overshoot = Math.max(0, current.bac - CLEAR_THRESHOLD);
  const minutesToClear = (overshoot / ELIMINATION_PER_HOUR) * 60;
  const timeToClearMinutes = Math.ceil(minutesToClear / 5) * 5;

  // Confidence — degraded when defaults dominated the math.
  const explicitFields = drinks.reduce((n, d) => n + (d.abv != null ? 1 : 0) + (d.oz != null ? 1 : 0), 0);
  const totalFields = drinks.length * 2;
  const explicitRatio = totalFields === 0 ? 0 : explicitFields / totalFields;
  const sexProvided = inputs.sex === 'male' || inputs.sex === 'female';
  let confidence: BACEstimate['confidence'];
  if (sexProvided && explicitRatio >= 0.5 && drinks.length <= 8) confidence = 'high';
  else if (drinks.length <= 8) confidence = 'medium';
  else confidence = 'low';

  const notes: string[] = [];
  if (!sexProvided) notes.push('default_sex');
  if (explicitRatio < 0.5 && drinks.length > 0) notes.push('default_strength');
  if (ateRecently) notes.push('food_factored');
  if (drinks.length > 8) notes.push('many_drinks');

  return {
    rangeLow,
    rangeHigh,
    trend,
    confidence,
    timeToClearMinutes,
    notes,
  };
}
