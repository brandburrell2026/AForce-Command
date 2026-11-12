/**
 * Which rail a confirmed drink takes (hydrostate-v2.0, founder decision C1,
 * 2026-11-12; spec v1.8.2 register #40, Part 6.3).
 *
 * - Plain water (still, tap, filtered, spring, bottled) counts toward
 *   HydroState 1:1 on the scored `/intake` rail.
 * - Everything else (coffee, tea, soda, juice, energy, sports, electrolyte,
 *   alcohol, smoothie, custom, and sparkling or mineral water) is saved to
 *   the member's drink log on the `/drinks` rail. It never changes HydroState,
 *   today's ounces or the decay clock until its own reviewed rule exists.
 *
 * AFORCE products (counted as their mixing water) and Phantom Band sips are
 * logged on their own surfaces and do not pass through here.
 */
export type DrinkRoute =
  | { kind: 'water'; oz: number }
  | { kind: 'recorded'; categoryId: string; oz: number };

const PLAIN_WATER_CATEGORIES = new Set(['water', 'bottled_water']);
const NOT_PLAIN = /\b(sparkling|seltzer|carbonated|mineral|club soda|tonic|flavou?red)\b/i;

export function drinkRoute(args: {
  categoryId: string;
  name?: string;
  displayName?: string;
  enteredOz: number;
}): DrinkRoute {
  const label = `${args.name ?? ''} ${args.displayName ?? ''}`;
  if (PLAIN_WATER_CATEGORIES.has(args.categoryId)) {
    return NOT_PLAIN.test(label)
      ? { kind: 'recorded', categoryId: 'sparkling_water', oz: args.enteredOz }
      : { kind: 'water', oz: args.enteredOz };
  }
  return { kind: 'recorded', categoryId: args.categoryId, oz: args.enteredOz };
}

/** True when a category (with this drink name) moves HydroState today. */
export const countsAsWater = (categoryId: string, name?: string) =>
  drinkRoute({ categoryId, name, enteredOz: 0 }).kind === 'water';

/** The confirmation for a drink saved without changing HydroState. */
export const RECORDED_DRINK_TITLE = 'Saved to your log';
export const RECORDED_DRINK_DETAIL = 'It moves HydroState once its drink rule is approved.';
