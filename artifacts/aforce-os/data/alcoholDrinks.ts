/**
 * Alcohol catalog for Social Mode.
 *
 * Each drink type carries a hydration-decay multiplier that the
 * scoring engine applies on top of the base decay rate while the
 * drink is still inside its "active" window (~30 min after logging).
 *
 * Multipliers come from the spec:
 *   Beer     +10–15% (mild)
 *   Wine     +15–20% (moderate)
 *   Cocktail +20–30% (sugar + alcohol)
 *   Liquor   +25–35% (strongest)
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
  /** Default oz of fluid attributed to one serving (informational, not a hydration credit). */
  defaultOz: number;
  /** Window during which this drink contributes to the active multiplier. */
  activeMinutes: number;
  /** Internal weight used by the hangover-risk model. */
  riskWeight: number;
}

export const ALCOHOL_DRINKS: Record<DrinkType, AlcoholDrink> = {
  beer:     { type: 'beer',     decayMultiplier: 1.15, defaultOz: 12, activeMinutes: 30, riskWeight: 1.0 },
  wine:     { type: 'wine',     decayMultiplier: 1.20, defaultOz: 5,  activeMinutes: 30, riskWeight: 1.3 },
  cocktail: { type: 'cocktail', decayMultiplier: 1.30, defaultOz: 8,  activeMinutes: 30, riskWeight: 1.6 },
  liquor:   { type: 'liquor',   decayMultiplier: 1.35, defaultOz: 1.5, activeMinutes: 30, riskWeight: 1.8 },
  custom:   { type: 'custom',   decayMultiplier: 1.25, defaultOz: 6,  activeMinutes: 30, riskWeight: 1.4 },
};

export const DRINK_TYPES_ORDER: DrinkType[] = ['beer', 'wine', 'cocktail', 'liquor', 'custom'];
