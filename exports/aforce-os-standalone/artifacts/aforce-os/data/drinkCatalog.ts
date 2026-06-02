/**
 * Drink Catalog — HydroScan "Personalized Hydration Intelligence"
 *
 * Slice 1 of the HydroScan final system: manual search + custom drinks.
 * Defines the 13 supported drink categories and a curated list of common
 * commercial drinks within each. Pure data + a small set of pure helpers
 * so the catalog can be unit-tested in isolation and reused by every
 * input mode that ships later (barcode scan, camera scan, Smart Capture).
 *
 * ── Hydration coefficients ────────────────────────────────────────────
 * Each category carries a `hydrationCoefficient` in [0, 1.1] that scales
 * the effective hydration credit relative to plain water (1.0). Values
 * are dietetics rules-of-thumb, not clinical claims:
 *   1.10  electrolyte drinks  (better than water — sodium/potassium aid uptake)
 *   1.05  sports drinks       (electrolytes + small sugar boost)
 *   1.00  water / bottled water (baseline)
 *   0.95  tea                 (mild diuretic; net positive)
 *   0.90  smoothies           (fiber + water bound in pulp)
 *   0.85  coffee / juice      (caffeine or sugar load)
 *   0.70  pre-workout         (high caffeine + stimulants)
 *   0.60  soda                (sugar/caffeine)
 *   0.50  energy drinks       (high caffeine + sugar)
 *   0.10  alcohol             (net diuretic — minimal credit; the social
 *                              mode engine handles actual dehydration
 *                              math in a separate flow)
 *   0.80  custom drinks       (conservative default — user may edit)
 *
 * Score impact = enteredOz × hydrationCoefficient, stored as ozOverride
 * on the existing IntakeEvent. Display name preserves the real drink so
 * history reads "Coffee · Starbucks Pike Place 16 oz" rather than
 * "Water — 13.6 ounces".
 */

import type { FluidType } from '../types';

// ─── Types ────────────────────────────────────────────────────────────

export type DrinkCategoryId =
  | 'water'
  | 'bottled_water'
  | 'coffee'
  | 'tea'
  | 'pre_workout'
  | 'energy_drink'
  | 'sports_drink'
  | 'alcohol'
  | 'smoothie'
  | 'juice'
  | 'soda'
  | 'electrolyte'
  | 'custom';

export interface DrinkCategory {
  id: DrinkCategoryId;
  label: string;          // user-facing display name
  shortLabel: string;     // chip / pill label (UPPERCASE-ish, ≤ 12 chars)
  icon: string;           // Icon name from the existing Icon set
  /** Score impact = oz × hydrationCoefficient. */
  hydrationCoefficient: number;
  /** Default serving size suggested when the user picks a custom oz value. */
  defaultOz: number;
  /** Underlying FluidType used for persistence + scoring engine compatibility. */
  fluidType: FluidType;
  /** One-line plain-English description shown beneath the category. */
  description: string;
  /**
   * Per-oz acidic contribution in [0, 1]. Sodas, citrus juices, energy
   * drinks, and pre-workout mixes carry the highest acid loads;
   * water/tea/electrolyte mixes are effectively zero. Drives the
   * "Acidic Load Elevated → Hydration support recommended" signal.
   */
  acidicWeight: number;
  /**
   * Per-oz stimulant (caffeine + ergogenic) contribution in [0, 1+].
   * Pre-workout > energy drink > coffee > soda > tea. Drives the
   * "Stimulant Load Elevated → Hydration support recommended" signal.
   * Coffee carries weight here so the system can suggest hydration
   * support WITHOUT framing the coffee itself as a problem.
   */
  stimulantWeight: number;
}

export interface CatalogDrink {
  id: string;             // stable kebab-case id
  categoryId: DrinkCategoryId;
  name: string;           // canonical product name (e.g. "Starbucks Pike Place")
  brand?: string;         // optional brand for typeahead match
  ozPerServing: number;   // canonical serving size for this product
  /**
   * Optional per-drink override. When undefined, the category's
   * hydrationCoefficient is used. Lets us mark, e.g., decaf coffee
   * closer to plain water (0.95) without polluting the whole category.
   */
  hydrationCoefficient?: number;
  /** Optional caffeine-mg / sugar-g hints for future Slices. Free-form. */
  notes?: string;
}

// ─── Categories ───────────────────────────────────────────────────────

export const DRINK_CATEGORIES: Record<DrinkCategoryId, DrinkCategory> = {
  water: {
    id: 'water',
    label: 'Water',
    shortLabel: 'WATER',
    icon: 'droplet',
    hydrationCoefficient: 1.0,
    defaultOz: 16,
    fluidType: 'water',
    description: 'Plain tap, filtered, or well water. Baseline hydration.',
    acidicWeight: 0,
    stimulantWeight: 0,
  },
  bottled_water: {
    id: 'bottled_water',
    label: 'Bottled Water',
    shortLabel: 'BOTTLED',
    icon: 'droplet',
    hydrationCoefficient: 1.0,
    defaultOz: 16.9,
    fluidType: 'water',
    description: 'Commercial bottled spring, mineral, or purified water.',
    acidicWeight: 0,
    stimulantWeight: 0,
  },
  coffee: {
    id: 'coffee',
    label: 'Coffee',
    shortLabel: 'COFFEE',
    icon: 'coffee',
    hydrationCoefficient: 0.85,
    defaultOz: 12,
    fluidType: 'water',
    description: 'Brewed, espresso, cold brew. Caffeine reduces net hydration.',
    // Moderately acidic (pH ~5), high caffeine per oz. A 12 oz coffee
    // alone lands the user in the "moderate" stimulant band, in line
    // with the messaging brief — never names coffee, only the load.
    acidicWeight: 0.5,
    stimulantWeight: 1.0,
  },
  tea: {
    id: 'tea',
    label: 'Tea',
    shortLabel: 'TEA',
    icon: 'coffee',
    hydrationCoefficient: 0.95,
    defaultOz: 12,
    fluidType: 'water',
    description: 'Black, green, herbal, oolong, matcha. Mostly hydrating.',
    acidicWeight: 0.1,
    stimulantWeight: 0.3,
  },
  pre_workout: {
    id: 'pre_workout',
    label: 'Pre-Workout',
    shortLabel: 'PRE-WORKOUT',
    icon: 'zap',
    hydrationCoefficient: 0.7,
    defaultOz: 16,
    fluidType: 'water',
    description: 'High-caffeine stimulant mixes. Hydrates less than water.',
    acidicWeight: 0.6,
    stimulantWeight: 1.2,
  },
  energy_drink: {
    id: 'energy_drink',
    label: 'Energy Drink',
    shortLabel: 'ENERGY',
    icon: 'zap',
    hydrationCoefficient: 0.5,
    defaultOz: 12,
    fluidType: 'water',
    description: 'Red Bull, Monster, Celsius, etc. High caffeine + sugar.',
    acidicWeight: 0.8,
    stimulantWeight: 1.1,
  },
  sports_drink: {
    id: 'sports_drink',
    label: 'Sports Drink',
    shortLabel: 'SPORTS',
    icon: 'activity',
    hydrationCoefficient: 1.05,
    defaultOz: 20,
    fluidType: 'water',
    description: 'Gatorade, Powerade, BodyArmor. Sugar + electrolytes.',
    acidicWeight: 0.3,
    stimulantWeight: 0,
  },
  alcohol: {
    id: 'alcohol',
    label: 'Alcohol',
    shortLabel: 'ALCOHOL',
    icon: 'alert-triangle',
    hydrationCoefficient: 0.1,
    defaultOz: 12,
    fluidType: 'water',
    description: 'Beer, wine, spirits, cocktails. Net diuretic — minimal credit.',
    // Wine/beer carry modest acid; no caffeine-style stimulant — alcohol
    // hits its own decay path via the social-mode helper.
    acidicWeight: 0.4,
    stimulantWeight: 0,
  },
  smoothie: {
    id: 'smoothie',
    label: 'Smoothie',
    shortLabel: 'SMOOTHIE',
    icon: 'droplet',
    hydrationCoefficient: 0.9,
    defaultOz: 16,
    fluidType: 'water',
    description: 'Fruit/veggie blends. Water + fiber + sugars.',
    acidicWeight: 0.2,
    stimulantWeight: 0,
  },
  juice: {
    id: 'juice',
    label: 'Juice',
    shortLabel: 'JUICE',
    icon: 'droplet',
    hydrationCoefficient: 0.85,
    defaultOz: 8,
    fluidType: 'water',
    description: 'OJ, apple, cranberry, vegetable juice. Sugar-heavy.',
    // Citrus / cranberry juices are highly acidic (pH ~3.5).
    acidicWeight: 0.9,
    stimulantWeight: 0,
  },
  soda: {
    id: 'soda',
    label: 'Soda',
    shortLabel: 'SODA',
    icon: 'droplet',
    hydrationCoefficient: 0.6,
    defaultOz: 12,
    fluidType: 'water',
    description: 'Coke, Sprite, Pepsi, Dr Pepper. Sugar/caffeine load.',
    // Phosphoric/citric acid drives a high acid load; caffeinated
    // colas contribute a meaningful stimulant share too.
    acidicWeight: 1.0,
    stimulantWeight: 0.4,
  },
  electrolyte: {
    id: 'electrolyte',
    label: 'Electrolyte Drink',
    shortLabel: 'ELECTROLYTE',
    icon: 'zap',
    hydrationCoefficient: 1.1,
    defaultOz: 16,
    fluidType: 'water',
    description: 'LMNT, Liquid IV, Pedialyte. Outperforms plain water.',
    acidicWeight: 0,
    stimulantWeight: 0,
  },
  custom: {
    id: 'custom',
    label: 'Custom Drink',
    shortLabel: 'CUSTOM',
    icon: 'plus-circle',
    hydrationCoefficient: 0.8,
    defaultOz: 12,
    fluidType: 'water',
    description: 'Anything not in the catalog. Conservative default.',
    acidicWeight: 0,
    stimulantWeight: 0,
  },
};

/**
 * Display order for the category strip / tab bar. Most-used first so
 * the common case (water, coffee, sports drink) is one tap away.
 */
export const CATEGORY_ORDER: DrinkCategoryId[] = [
  'water',
  'bottled_water',
  'coffee',
  'tea',
  'sports_drink',
  'electrolyte',
  'energy_drink',
  'pre_workout',
  'soda',
  'juice',
  'smoothie',
  'alcohol',
  'custom',
];

// ─── Curated drinks ───────────────────────────────────────────────────

export const CATALOG_DRINKS: CatalogDrink[] = [
  // Water (typed entries useful for "tap water" vs "filtered")
  { id: 'water-tap',       categoryId: 'water', name: 'Tap Water',                  ozPerServing: 16 },
  { id: 'water-filtered',  categoryId: 'water', name: 'Filtered Water',             ozPerServing: 16 },
  { id: 'water-spring',    categoryId: 'water', name: 'Spring Water',               ozPerServing: 16 },
  { id: 'water-sparkling', categoryId: 'water', name: 'Sparkling Water',            ozPerServing: 12 },

  // Bottled water
  { id: 'bw-fiji',     categoryId: 'bottled_water', brand: 'Fiji',     name: 'Fiji Natural Artesian',     ozPerServing: 16.9 },
  { id: 'bw-evian',    categoryId: 'bottled_water', brand: 'Evian',    name: 'Evian Natural Spring',      ozPerServing: 16.9 },
  { id: 'bw-smart',    categoryId: 'bottled_water', brand: 'Smartwater', name: 'Smartwater',              ozPerServing: 20 },
  { id: 'bw-poland',   categoryId: 'bottled_water', brand: 'Poland Spring', name: 'Poland Spring',         ozPerServing: 16.9 },
  { id: 'bw-essentia', categoryId: 'bottled_water', brand: 'Essentia', name: 'Essentia Alkaline 9.5 pH',  ozPerServing: 20 },

  // Coffee
  { id: 'coffee-drip',     categoryId: 'coffee', name: 'Drip Coffee',                                ozPerServing: 12 },
  { id: 'coffee-espresso', categoryId: 'coffee', name: 'Espresso (double shot)',                     ozPerServing: 2 },
  { id: 'coffee-latte',    categoryId: 'coffee', name: 'Latte',                                      ozPerServing: 16 },
  { id: 'coffee-cappuccino', categoryId: 'coffee', name: 'Cappuccino',                               ozPerServing: 12 },
  { id: 'coffee-cold-brew', categoryId: 'coffee', name: 'Cold Brew',                                 ozPerServing: 16 },
  { id: 'coffee-sbux-pike', categoryId: 'coffee', brand: 'Starbucks', name: 'Starbucks Pike Place',  ozPerServing: 16 },
  { id: 'coffee-dunkin',    categoryId: 'coffee', brand: 'Dunkin',    name: 'Dunkin Hot Coffee',     ozPerServing: 14 },
  { id: 'coffee-decaf',     categoryId: 'coffee', name: 'Decaf Coffee', ozPerServing: 12, hydrationCoefficient: 0.95 },

  // Tea
  { id: 'tea-black',  categoryId: 'tea', name: 'Black Tea',     ozPerServing: 12 },
  { id: 'tea-green',  categoryId: 'tea', name: 'Green Tea',     ozPerServing: 12 },
  { id: 'tea-herbal', categoryId: 'tea', name: 'Herbal Tea',    ozPerServing: 12, hydrationCoefficient: 1.0 },
  { id: 'tea-matcha', categoryId: 'tea', name: 'Matcha Latte',  ozPerServing: 12 },
  { id: 'tea-iced',   categoryId: 'tea', name: 'Iced Tea (unsweetened)', ozPerServing: 16 },
  { id: 'tea-chai',   categoryId: 'tea', name: 'Chai Latte',    ozPerServing: 12 },

  // Pre-workout
  { id: 'pw-c4',         categoryId: 'pre_workout', brand: 'C4',         name: 'C4 Original',          ozPerServing: 8 },
  { id: 'pw-bang-pre',   categoryId: 'pre_workout', brand: 'Bang',       name: 'Bang Pre-Workout',     ozPerServing: 16 },
  { id: 'pw-gorilla',    categoryId: 'pre_workout', brand: 'Gorilla Mode', name: 'Gorilla Mode',       ozPerServing: 10 },
  { id: 'pw-pre-jym',    categoryId: 'pre_workout', brand: 'JYM',        name: 'Pre JYM',              ozPerServing: 16 },
  { id: 'pw-generic',    categoryId: 'pre_workout', name: 'Generic Pre-Workout Mix', ozPerServing: 12 },

  // Energy drinks
  { id: 'ed-redbull',  categoryId: 'energy_drink', brand: 'Red Bull', name: 'Red Bull',           ozPerServing: 8.4 },
  { id: 'ed-monster',  categoryId: 'energy_drink', brand: 'Monster',  name: 'Monster Energy',     ozPerServing: 16 },
  { id: 'ed-celsius',  categoryId: 'energy_drink', brand: 'Celsius',  name: 'Celsius',            ozPerServing: 12 },
  { id: 'ed-bang',     categoryId: 'energy_drink', brand: 'Bang',     name: 'Bang Energy',        ozPerServing: 16 },
  { id: 'ed-alani',    categoryId: 'energy_drink', brand: 'Alani Nu', name: 'Alani Nu Energy',    ozPerServing: 12 },
  { id: 'ed-prime',    categoryId: 'energy_drink', brand: 'Prime',    name: 'Prime Energy',       ozPerServing: 12 },

  // Sports drinks
  { id: 'sd-gatorade',     categoryId: 'sports_drink', brand: 'Gatorade',  name: 'Gatorade Thirst Quencher', ozPerServing: 20 },
  { id: 'sd-powerade',     categoryId: 'sports_drink', brand: 'Powerade',  name: 'Powerade',                 ozPerServing: 20 },
  { id: 'sd-bodyarmor',    categoryId: 'sports_drink', brand: 'BodyArmor', name: 'BodyArmor SuperDrink',     ozPerServing: 16 },
  { id: 'sd-gatorade-zero', categoryId: 'sports_drink', brand: 'Gatorade', name: 'Gatorade Zero',            ozPerServing: 20 },
  { id: 'sd-pedialyte-sport', categoryId: 'sports_drink', brand: 'Pedialyte', name: 'Pedialyte Sport',       ozPerServing: 16 },

  // Alcohol
  { id: 'al-beer-light',   categoryId: 'alcohol', name: 'Light Beer',     ozPerServing: 12 },
  { id: 'al-beer-regular', categoryId: 'alcohol', name: 'Regular Beer',   ozPerServing: 12 },
  { id: 'al-wine-red',     categoryId: 'alcohol', name: 'Red Wine',       ozPerServing: 5 },
  { id: 'al-wine-white',   categoryId: 'alcohol', name: 'White Wine',     ozPerServing: 5 },
  { id: 'al-spirits',      categoryId: 'alcohol', name: 'Spirits (1.5 oz pour)', ozPerServing: 1.5 },
  { id: 'al-cocktail',     categoryId: 'alcohol', name: 'Cocktail',       ozPerServing: 6 },
  { id: 'al-seltzer',      categoryId: 'alcohol', name: 'Hard Seltzer',   ozPerServing: 12, hydrationCoefficient: 0.3 },

  // Smoothies
  { id: 'sm-fruit',        categoryId: 'smoothie', name: 'Fruit Smoothie',          ozPerServing: 16 },
  { id: 'sm-green',        categoryId: 'smoothie', name: 'Green Smoothie',          ozPerServing: 16 },
  { id: 'sm-protein',      categoryId: 'smoothie', name: 'Protein Smoothie',        ozPerServing: 16 },
  { id: 'sm-acai',         categoryId: 'smoothie', name: 'Açaí Smoothie',           ozPerServing: 16 },
  { id: 'sm-jamba',        categoryId: 'smoothie', brand: 'Jamba', name: 'Jamba Smoothie', ozPerServing: 22 },

  // Juices
  { id: 'jc-orange',       categoryId: 'juice', name: 'Orange Juice',           ozPerServing: 8 },
  { id: 'jc-apple',        categoryId: 'juice', name: 'Apple Juice',            ozPerServing: 8 },
  { id: 'jc-cranberry',    categoryId: 'juice', name: 'Cranberry Juice',        ozPerServing: 8 },
  { id: 'jc-grapefruit',   categoryId: 'juice', name: 'Grapefruit Juice',       ozPerServing: 8 },
  { id: 'jc-veg',          categoryId: 'juice', name: 'Vegetable Juice (V8)',   ozPerServing: 8 },
  { id: 'jc-cold-pressed', categoryId: 'juice', name: 'Cold-Pressed Juice',     ozPerServing: 12 },

  // Soda
  { id: 'sx-coke',         categoryId: 'soda', brand: 'Coca-Cola', name: 'Coca-Cola Classic', ozPerServing: 12 },
  { id: 'sx-coke-zero',    categoryId: 'soda', brand: 'Coca-Cola', name: 'Coke Zero',         ozPerServing: 12 },
  { id: 'sx-pepsi',        categoryId: 'soda', brand: 'Pepsi',     name: 'Pepsi',             ozPerServing: 12 },
  { id: 'sx-sprite',       categoryId: 'soda', brand: 'Sprite',    name: 'Sprite',            ozPerServing: 12 },
  { id: 'sx-dr-pepper',    categoryId: 'soda', brand: 'Dr Pepper', name: 'Dr Pepper',         ozPerServing: 12 },
  { id: 'sx-ginger-ale',   categoryId: 'soda', name: 'Ginger Ale',                            ozPerServing: 12 },
  { id: 'sx-mt-dew',       categoryId: 'soda', brand: 'Mountain Dew', name: 'Mountain Dew',   ozPerServing: 12 },

  // Electrolyte
  { id: 'el-lmnt',         categoryId: 'electrolyte', brand: 'LMNT',        name: 'LMNT Recharge',       ozPerServing: 16 },
  { id: 'el-liquid-iv',    categoryId: 'electrolyte', brand: 'Liquid IV',   name: 'Liquid IV Hydration', ozPerServing: 16 },
  { id: 'el-pedialyte',    categoryId: 'electrolyte', brand: 'Pedialyte',   name: 'Pedialyte',           ozPerServing: 16 },
  { id: 'el-nuun',         categoryId: 'electrolyte', brand: 'Nuun',        name: 'Nuun Sport Tablet',   ozPerServing: 16 },
  { id: 'el-drip-drop',    categoryId: 'electrolyte', brand: 'DripDrop',    name: 'DripDrop ORS',        ozPerServing: 16 },
  { id: 'el-skratch',      categoryId: 'electrolyte', brand: 'Skratch',     name: 'Skratch Labs Mix',    ozPerServing: 16 },
];

// ─── Pure helpers ─────────────────────────────────────────────────────

/**
 * Get the effective hydration coefficient for a drink. Per-drink override
 * takes precedence over the category default.
 */
export function getDrinkCoefficient(drink: CatalogDrink): number {
  if (typeof drink.hydrationCoefficient === 'number') {
    return drink.hydrationCoefficient;
  }
  return DRINK_CATEGORIES[drink.categoryId].hydrationCoefficient;
}

/**
 * Compute the score-equivalent ounces for a logged drink. This is the
 * value passed as `ozOverride` to the existing `logIntake` path so the
 * scoring engine treats the impact correctly relative to plain water.
 * Always non-negative; floors at 0 because negative oz break the engine.
 */
export function computeEffectiveOz(
  categoryId: DrinkCategoryId,
  enteredOz: number,
  perDrinkCoefficient?: number,
): number {
  const cat = DRINK_CATEGORIES[categoryId];
  const coef = typeof perDrinkCoefficient === 'number'
    ? perDrinkCoefficient
    : cat.hydrationCoefficient;
  const oz = Math.max(0, enteredOz) * Math.max(0, coef);
  // Round to 1 decimal place — the engine accepts fractional oz and we
  // want "12 oz coffee × 0.85 = 10.2 oz water-equiv" to be honest.
  return Math.round(oz * 10) / 10;
}

/**
 * Build the user-facing label persisted in the history feed and shown
 * in the success card. Includes category prefix so a glance tells the
 * user what they actually drank, not the underlying fluidType.
 *
 * Examples:
 *   formatDrinkDisplayName({ category: 'coffee', name: 'Starbucks Pike Place' })
 *   → "Coffee · Starbucks Pike Place"
 *   formatDrinkDisplayName({ category: 'custom', name: 'Mom\u2019s Lemonade' })
 *   → "Custom · Mom\u2019s Lemonade"
 */
export function formatDrinkDisplayName(args: {
  categoryId: DrinkCategoryId;
  name: string;
}): string {
  const cat = DRINK_CATEGORIES[args.categoryId];
  const trimmed = args.name.trim();
  if (!trimmed) return cat.label;
  // Avoid double-prefix if the user typed "Coffee" as the name.
  if (trimmed.toLowerCase() === cat.label.toLowerCase()) return cat.label;
  return `${cat.label} \u00b7 ${trimmed}`;
}

/**
 * Sanitize a free-form custom drink name. Trims, collapses whitespace,
 * strips control characters, and caps length so weird input can't break
 * history rendering. Returns null when the result is empty.
 */
export function sanitizeCustomDrinkName(input: string): string | null {
  // eslint-disable-next-line no-control-regex
  const stripped = (input ?? '').replace(/[\u0000-\u001f\u007f]/g, '');
  const collapsed = stripped.replace(/\s+/g, ' ').trim();
  if (!collapsed) return null;
  return collapsed.slice(0, 60);
}
