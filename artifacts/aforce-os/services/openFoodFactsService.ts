/**
 * Open Food Facts integration — turns ANY US beverage barcode into a
 * scannable, comparable product.
 *
 * Why: the local product catalog only carries AForce + a handful of
 * named competitors. Real users in the field will scan thousands of
 * SKUs (Coke, Powerade, Body Armor, Vitamin Water, store-brands…).
 * We hit the public Open Food Facts API (no key required) and
 * synthesize a CompareProduct on the fly so the comparison engine can
 * score it against the user's current state — no database edits needed.
 *
 * Synthesis is conservative: when a nutrition field is missing, we
 * pick a category-typical default and continue. The resulting fit
 * scores are clearly labelled in the UI so users understand they came
 * from public data, not AForce's lab panel.
 *
 * Cache: synthesized products are kept in memory for the session so
 * subsequent reads (e.g. recommendation lookup in hydrationScanService)
 * resolve instantly without a second network round-trip.
 */

import type { CompareProduct } from '../types/comparison';
import type { ScannedProduct } from '../types/scan';

const OFF_BASE = 'https://world.openfoodfacts.org/api/v2/product';
/** Limit total wait so a flaky network never wedges the scanner. */
const REQUEST_TIMEOUT_MS = 4500;

/** Session cache of synthesized CompareProducts, keyed by productId. */
const dynamicCatalog = new Map<string, CompareProduct>();

/** Lookup a CompareProduct synthesized from Open Food Facts. */
export function getDynamicCompareProduct(productId: string): CompareProduct | undefined {
  return dynamicCatalog.get(productId);
}

interface OFFProduct {
  product_name?: string;
  product_name_en?: string;
  brands?: string;
  categories_tags?: string[];
  nutriments?: {
    sugars_100g?: number;
    'sugars_serving'?: number;
    sodium_100g?: number;
    salt_100g?: number;
    carbohydrates_100g?: number;
    energy_kcal_100g?: number;
    caffeine_100g?: number;
  };
  serving_size?: string;
  ingredients_text?: string;
}

interface OFFResponse {
  status?: number;
  product?: OFFProduct;
}

/** Tiny fetch-with-timeout helper (RN-safe; uses AbortController). */
async function fetchWithTimeout(url: string, ms: number): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, {
      signal: ctrl.signal,
      headers: { Accept: 'application/json' },
    });
  } finally {
    clearTimeout(t);
  }
}

/** Coerce undefined/NaN → fallback. Clamp to [min, max]. */
function num(value: unknown, fallback: number, min = 0, max = 100): number {
  const n = typeof value === 'number' && Number.isFinite(value) ? value : fallback;
  return Math.max(min, Math.min(max, n));
}

/** Map OFF category tags → our coarse category. Defaults to sports_drink. */
function inferCategory(tags: string[] = []): CompareProduct['category'] {
  const joined = tags.join(' ').toLowerCase();
  if (joined.includes('water') && !joined.includes('sport')) return 'plain_water';
  if (joined.includes('oral-rehydration') || joined.includes('pedialyte')) {
    return 'medical_oral_rehydration';
  }
  if (joined.includes('electrolyte') || joined.includes('isotonic') || joined.includes('mix')) {
    return 'electrolyte_mix';
  }
  return 'sports_drink';
}

/**
 * Translate raw nutrition (per 100g) into our 0-100 sub-scores.
 * Heuristics, intentionally simple — they only need to be directionally
 * correct so AForce vs scanned comparisons are believable.
 */
function synthesizeScores(off: OFFProduct, category: CompareProduct['category']) {
  // UNKNOWN ≠ ZERO (founder ruling D5, 2026-08-30).
  //
  // These three lines used to read `?? 0`, which substituted a finite zero for
  // ABSENT data before `num()`'s fallback could ever fire — so the declared
  // defaults (30, 25) were unreachable dead code and the file documented a
  // behaviour it did not have. The consequence was directional and asymmetric:
  // a missing sugar reading scored sugarImpact 100 (the BEST possible, +19 on
  // a typical match) while a missing sodium reading scored electrolytes 0 (the
  // WORST, -30), because sugar is inverted and sodium is not. Absence moved
  // the number in opposite directions depending on which field was missing,
  // and "no data" was indistinguishable from "measured zero".
  //
  // Absent now stays absent. A measured 0 is still 0 and still counts as data.
  const sugars100 = off.nutriments?.sugars_100g ?? null;
  const salt100 = off.nutriments?.salt_100g;
  const sodium100 =
    off.nutriments?.sodium_100g ?? (typeof salt100 === 'number' ? salt100 * 0.4 : null);

  const sugar = sugars100 == null ? null : clamp01to100(Math.round((sugars100 / 10) * 100));
  const electrolytes =
    sodium100 == null ? null : clamp01to100(Math.round((sodium100 / 0.4) * 100));
  // hydration speed: water is fast; high-sugar sports drinks slower.
  // A derived value is only as known as its inputs. Where an input is absent
  // the derived score is absent too — it is not computed from a substituted
  // zero, which would launder the same defect one layer down.
  const hydrationSpeed =
    category === 'plain_water'
      ? 80
      : category === 'medical_oral_rehydration'
        ? 88
        : sugar == null
          ? null
          : Math.round(Math.max(35, 80 - sugar * 0.45));
  const absorptionRate =
    electrolytes == null || sugar == null
      ? null
      : Math.round(Math.max(35, Math.min(95, 50 + electrolytes * 0.4 - sugar * 0.25)));
  const recoveryEfficiency =
    electrolytes == null || sugar == null
      ? null
      : Math.round(Math.max(30, Math.min(95, 40 + electrolytes * 0.5 - sugar * 0.2)));

  return { sugar, electrolytes, hydrationSpeed, absorptionRate, recoveryEfficiency };
}

/** Clamp a synthesized 0-100 score. Only ever called with a real number. */
function clamp01to100(n: number): number {
  return Math.max(0, Math.min(100, n));
}

function dynamicId(barcode: string): string {
  return `off_${barcode}`;
}

/** Build CompareProduct + ScannedProduct from an OFF payload. */
function build(barcode: string, off: OFFProduct): { compare: CompareProduct; scanned: ScannedProduct } {
  const name = (off.product_name_en || off.product_name || 'Unknown beverage').trim();
  const brand = (off.brands || 'Unknown').split(',')[0].trim();
  const category = inferCategory(off.categories_tags);
  const scores = synthesizeScores(off, category);
  const id = dynamicId(barcode);

  const compare: CompareProduct = {
    id,
    name,
    brand,
    category,
    hydrationSpeed: scores.hydrationSpeed,
    electrolytes: scores.electrolytes,
    sugar: scores.sugar,
    absorptionRate: scores.absorptionRate,
    recoveryEfficiency: scores.recoveryEfficiency,
    // Most off-the-shelf beverages fit maintenance; sport drinks cover heat too.
    compatibleProtocols:
      category === 'sports_drink' || category === 'electrolyte_mix'
        ? ['maintenance', 'heat_stress']
        : category === 'medical_oral_rehydration'
          ? ['depletion_correction', 'recovery']
          : ['maintenance'],
    factualNote: `Public-data nutrition: ~${scores.sugar}% sugar load, ~${scores.electrolytes}% electrolyte density.`,
    isAForce: false,
  };

  const scanned: ScannedProduct = {
    productId: id,
    productName: name,
    brand,
    category,
    hydrationSpeed: scores.hydrationSpeed,
    electrolyteDensity: scores.electrolytes,
    sugarLevel: scores.sugar,
    // A caffeine reading present means 50; ABSENT means unknown, not zero (D5).
    stimulantLevel:
      off.nutriments?.caffeine_100g == null ? null : off.nutriments.caffeine_100g ? 50 : 0,
    recoveryFit: scores.recoveryEfficiency,
    // Derived: UNKNOWN when either input is unknown (D5).
    performanceFit:
      scores.hydrationSpeed == null || scores.absorptionRate == null
        ? null
        : Math.round((scores.hydrationSpeed + scores.absorptionRate) / 2),
    isAForce: false,
  };

  return { compare, scanned };
}

/** Fetch + synthesize. Returns undefined if not found / network error. */
export async function lookupBarcode(barcode: string): Promise<ScannedProduct | undefined> {
  if (!/^[0-9]{6,14}$/.test(barcode)) return undefined;
  // Cache hit — return a ScannedProduct view of the cached CompareProduct.
  const cached = dynamicCatalog.get(dynamicId(barcode));
  if (cached) {
    return {
      productId: cached.id,
      productName: cached.name,
      brand: cached.brand,
      category: cached.category,
      hydrationSpeed: cached.hydrationSpeed,
      electrolyteDensity: cached.electrolytes,
      sugarLevel: cached.sugar,
      // The session cache stores a CompareProduct, which carries no stimulant
      // field — so a cache hit genuinely does not know it (D5). It previously
      // reported a measured zero, meaning the SAME barcode scanned twice
      // produced two different products.
      stimulantLevel: null,
      recoveryFit: cached.recoveryEfficiency,
      // Derived: UNKNOWN when either input is unknown (D5).
    performanceFit:
      cached.hydrationSpeed == null || cached.absorptionRate == null
        ? null
        : Math.round((cached.hydrationSpeed + cached.absorptionRate) / 2),
      isAForce: false,
    };
  }

  try {
    const res = await fetchWithTimeout(
      `${OFF_BASE}/${barcode}.json?fields=product_name,product_name_en,brands,categories_tags,nutriments,serving_size,ingredients_text`,
      REQUEST_TIMEOUT_MS,
    );
    if (!res.ok) return undefined;
    const json = (await res.json()) as OFFResponse;
    if (json.status !== 1 || !json.product) return undefined;
    const { compare, scanned } = build(barcode, json.product);
    dynamicCatalog.set(compare.id, compare);
    return scanned;
  } catch {
    return undefined;
  }
}
