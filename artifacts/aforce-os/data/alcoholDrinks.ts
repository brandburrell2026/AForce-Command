/**
 * Alcohol catalog for Social Mode.
 *
 * Each drink type carries:
 *   - decayMultiplier: applied to base hydration decay while the drink
 *     is in its `activeMinutes` window (~30 min after logging).
 *   - defaultOz: serving volume baseline (used by the BAC engine when
 *     the user doesn't override it).
 *   - defaultAbv: catalog midpoint for that category (used by BAC).
 *   - sugarLoad: 0–10 internal weight read by the hangover engine —
 *     cocktails carry the most sugar load and therefore the worst
 *     next-morning cost per ml of alcohol.
 *   - riskWeight: per-drink hangover-score contribution (kept for
 *     backwards compatibility with the existing hangover engine).
 *
 * Multipliers come from the Social Mode spec:
 *   Beer         +10–15% (mild)
 *   Wine         +15–20% (moderate)
 *   Cocktail     +20–30% (sugar + alcohol)
 *   Liquor       +25–35% (strongest)
 *   Hard Seltzer +10–15% (mild, low-sugar)
 *
 * We pick the high end of each range because the user is opting INTO
 * Social Mode — they want the system to err on the protective side,
 * not flatter them.
 */

import type { DrinkType } from '../types';

export interface AlcoholDrink {
  type: DrinkType;
  /** Multiplier applied to base hydration decay (1.15 = +15%). */
  decayMultiplier: number;
  /** Default oz of the drink itself (not pure alcohol). */
  defaultOz: number;
  /** Default ABV (%) for the catalog midpoint. */
  defaultAbv: number;
  /** Window during which this drink contributes to the active multiplier. */
  activeMinutes: number;
  /** Internal weight used by the hangover-risk model. */
  riskWeight: number;
  /** 0–10 sugar load, read by the hangover engine for next-day weight. */
  sugarLoad: number;
}

export const ALCOHOL_DRINKS: Record<DrinkType, AlcoholDrink> = {
  beer:         { type: 'beer',         decayMultiplier: 1.15, defaultOz: 12,  defaultAbv: 5.0,  activeMinutes: 30, riskWeight: 1.0, sugarLoad: 3 },
  wine:         { type: 'wine',         decayMultiplier: 1.20, defaultOz: 5,   defaultAbv: 12.5, activeMinutes: 30, riskWeight: 1.3, sugarLoad: 4 },
  cocktail:     { type: 'cocktail',     decayMultiplier: 1.30, defaultOz: 8,   defaultAbv: 14.0, activeMinutes: 30, riskWeight: 1.6, sugarLoad: 8 },
  liquor:       { type: 'liquor',       decayMultiplier: 1.35, defaultOz: 1.5, defaultAbv: 40.0, activeMinutes: 30, riskWeight: 1.8, sugarLoad: 1 },
  hard_seltzer: { type: 'hard_seltzer', decayMultiplier: 1.15, defaultOz: 12,  defaultAbv: 5.0,  activeMinutes: 30, riskWeight: 1.0, sugarLoad: 1 },
  custom:       { type: 'custom',       decayMultiplier: 1.25, defaultOz: 6,   defaultAbv: 12.0, activeMinutes: 30, riskWeight: 1.4, sugarLoad: 4 },
};

export const DRINK_TYPES_ORDER: DrinkType[] = [
  'beer', 'wine', 'cocktail', 'liquor', 'hard_seltzer', 'custom',
];
