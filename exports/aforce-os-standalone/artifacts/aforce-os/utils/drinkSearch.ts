/**
 * drinkSearch — Pure typeahead search over the drink catalog.
 *
 * Used by the AddDrinkModal and (later slices) by Smart Capture and
 * barcode-lookup fallbacks. Pure, dependency-free, exhaustively tested
 * so we can swap the underlying ranking later without breaking callers.
 *
 * Ranking (highest first):
 *   1. Exact name match
 *   2. Name starts with query
 *   3. Brand starts with query
 *   4. Name contains query as a word
 *   5. Brand contains query
 *   6. Category label contains query
 *
 * Ties broken by the catalog's natural order so deterministic snapshots
 * stay stable.
 */

import {
  CATALOG_DRINKS,
  DRINK_CATEGORIES,
  type CatalogDrink,
  type DrinkCategoryId,
} from '../data/drinkCatalog';

const MAX_RESULTS = 30;

export interface SearchOptions {
  /** Restrict results to a single category. Useful for the category tab UX. */
  categoryId?: DrinkCategoryId;
  /** Cap on returned results; defaults to 30. */
  limit?: number;
}

interface Scored {
  drink: CatalogDrink;
  score: number;
  order: number;
}

function normalize(s: string): string {
  return s.trim().toLowerCase();
}

function scoreDrink(drink: CatalogDrink, q: string): number {
  const name = normalize(drink.name);
  const brand = drink.brand ? normalize(drink.brand) : '';
  const catLabel = normalize(DRINK_CATEGORIES[drink.categoryId].label);
  if (!q) return 1; // empty query → keep all in natural order

  if (name === q) return 1000;
  if (name.startsWith(q)) return 800;
  if (brand && brand.startsWith(q)) return 700;
  // Word boundary match in name (e.g. "cold" matches "Iced Coffee — Cold").
  const nameWords = name.split(/[\s\-\u2014\u2013\u00b7]+/);
  if (nameWords.includes(q)) return 600;
  if (name.includes(q)) return 500;
  if (brand && brand.includes(q)) return 400;
  if (catLabel.includes(q)) return 200;
  return 0;
}

/**
 * Search the catalog for drinks matching `query`.
 *
 * Empty / whitespace-only query returns the natural-order catalog
 * (filtered by category when set). The `custom` category is excluded
 * from results — it's a UI-level entry point, not a real drink.
 */
export function searchDrinks(
  query: string,
  options: SearchOptions = {},
): CatalogDrink[] {
  const q = normalize(query);
  const limit = options.limit ?? MAX_RESULTS;

  const pool: Scored[] = [];
  CATALOG_DRINKS.forEach((drink, order) => {
    if (drink.categoryId === 'custom') return;
    if (options.categoryId && drink.categoryId !== options.categoryId) return;
    const score = scoreDrink(drink, q);
    if (score <= 0) return;
    pool.push({ drink, score, order });
  });

  pool.sort((a, b) => {
    if (a.score !== b.score) return b.score - a.score;
    return a.order - b.order;
  });

  return pool.slice(0, Math.max(0, limit)).map((s) => s.drink);
}
