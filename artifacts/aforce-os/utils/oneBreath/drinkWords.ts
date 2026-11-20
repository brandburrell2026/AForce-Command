/**
 * Drink words — which drink and how much a member named, for One Breath.
 *
 * The category comes from the app's own drink catalog (`data/drinkCatalog`),
 * the same list HydroScan and manual search use: one system for every drink.
 * Nothing here decides credit, and nothing guesses. A brand the catalog files
 * under two categories, a drink it does not list, or an amount without a unit
 * all come back as "not known", which becomes one question.
 */
import { CATALOG_DRINKS, type DrinkCategoryId } from '@/data/drinkCatalog';

export interface NamedDrink {
  categoryId: DrinkCategoryId;
  /** How the member's drink is shown back: the brand they said, or the plain word. */
  name: string;
}

/** Lower case, no apostrophes, and no full stops except a decimal point inside a number. */
const plain = (s: string) => s.toLowerCase().replace(/['’]/g, '').replace(/\.(?!\d)/g, '').replace(/\s+/g, ' ').trim();

const PLAIN_WORDS: readonly [RegExp, DrinkCategoryId, string][] = [
  [/\b(sparkling water)\b/, 'water', 'sparkling water'],
  [/\b(water|watr|h2o)\b/, 'water', 'water'],
  [/\b(cold brew|iced coffee|coffee|espresso)\b/, 'coffee', 'coffee'],
  [/\b(green tea|iced tea|tea)\b/, 'tea', 'tea'],
  [/\b(energy drink)\b/, 'energy_drink', 'energy drink'],
  [/\b(electrolytes?)\b/, 'electrolyte', 'electrolyte drink'],
  [/\b(smoothie)\b/, 'smoothie', 'smoothie'],
  [/\b(orange juice|juice)\b/, 'juice', 'juice'],
];

export function drinkNamed(words: string): NamedDrink | null {
  const t = plain(words);
  // A brand first: "Gatorade" must not be read as some other word inside it.
  const brands = new Map<string, typeof CATALOG_DRINKS>();
  for (const d of CATALOG_DRINKS) {
    if (!d.brand) continue;
    const key = plain(d.brand);
    brands.set(key, [...(brands.get(key) ?? []), d]);
  }
  for (const [brand, drinks] of brands) {
    if (!new RegExp(`\\b${brand.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(t)) continue;
    const categories = new Set(drinks.map((d) => d.categoryId));
    if (categories.size === 1) return { categoryId: drinks[0]!.categoryId, name: drinks[0]!.brand! };
    // Filed under two categories: use the entry named exactly as the brand, else do not choose.
    const exact = drinks.find((d) => plain(d.name) === brand);
    return exact ? { categoryId: exact.categoryId, name: exact.brand! } : null;
  }
  for (const [pattern, categoryId, name] of PLAIN_WORDS) if (pattern.test(t)) return { categoryId, name };
  return null;
}

const NUMBER_WORDS: Record<string, number> = { one: 1, a: 1, eight: 8, twelve: 12, sixteen: 16, twenty: 20, 'half a': 0.5 };
const TO_OZ: readonly [RegExp, number][] = [
  [/^(fl ?oz|oz|ounces?)$/, 1],
  [/^ml$/, 1 / 29.5735],
  [/^(liters?|litres?)$/, 33.814],
  [/^cups?$/, 8],
];

/** The amount said, in fluid ounces, or null when there is not exactly one clear amount. */
export function ouncesSaid(words: string): number | null {
  const t = plain(words);
  if (/ or /.test(t)) return null;
  const found = [...t.matchAll(/(\d+(?:\.\d+)?|\b(?:half a|sixteen|twenty|twelve|eight|one|a))\s*(fl ?oz|oz|ounces?|ml|liters?|litres?|cups?)\b/g)];
  // "a cup" and "a bottle" are not amounts; a bare "a" only counts with a metric unit ("a liter").
  const clear = found.filter((m) => !(m[1] === 'a' && !/^lit/.test(m[2]!)) && !(/^cups?$/.test(m[2]!) && !/^\d/.test(m[1]!)));
  if (clear.length !== 1) return null;
  const [, amount, unit] = clear[0]!;
  const n = /^\d/.test(amount!) ? Number(amount) : NUMBER_WORDS[amount!];
  const factor = TO_OZ.find(([p]) => p.test(unit!))?.[1];
  if (n === undefined || !factor || !(n > 0)) return null;
  const oz = Math.round(n * factor * 10) / 10;
  // Outside any single drink a person logs in one go: ask instead of logging it.
  return oz >= 1 && oz <= 128 ? oz : null;
}
