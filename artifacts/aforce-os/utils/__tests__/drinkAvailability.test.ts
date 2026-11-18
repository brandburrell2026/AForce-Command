/**
 * Stop-ship SS-26: alcohol has no age / regional eligibility check, so a
 * production build must not offer it for logging.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect } from 'vitest';

import { CATALOG_DRINKS, CATEGORY_ORDER } from '../../data/drinkCatalog';
import { searchDrinks } from '../drinkSearch';
import {
  AGE_RESTRICTED_DRINK_CATEGORIES,
  availableCategoryOrder,
  isDrinkCategoryAvailable,
  unavailableDrinkCategories,
} from '../hydration/drinkAvailability';

const PROD = { dev: false, internalTestflight: false };
const INTERNAL_TF = { dev: false, internalTestflight: true };
const LOCAL_DEV = { dev: true, internalTestflight: false };

describe('drink category availability by build', () => {
  it('alcohol is the age-restricted category', () => {
    expect(AGE_RESTRICTED_DRINK_CATEGORIES).toEqual(['alcohol']);
  });

  it('production offers every category except alcohol, in the same order', () => {
    expect(availableCategoryOrder(PROD)).toEqual(CATEGORY_ORDER.filter((id) => id !== 'alcohol'));
    expect(isDrinkCategoryAvailable('alcohol', PROD)).toBe(false);
    expect(isDrinkCategoryAvailable('water', PROD)).toBe(true);
    expect(unavailableDrinkCategories(PROD)).toEqual(['alcohol']);
  });

  it('internal TestFlight and local dev keep the full list', () => {
    for (const ctx of [INTERNAL_TF, LOCAL_DEV]) {
      expect(availableCategoryOrder(ctx)).toEqual(CATEGORY_ORDER);
      expect(unavailableDrinkCategories(ctx)).toEqual([]);
    }
  });
});

describe('search honours excluded categories', () => {
  const exclude = unavailableDrinkCategories(PROD);

  it('the catalog really contains alcohol entries to hide', () => {
    expect(CATALOG_DRINKS.some((d) => d.categoryId === 'alcohol')).toBe(true);
  });

  it('browse-all returns no alcohol in production', () => {
    const all = searchDrinks('', { limit: 500, excludeCategories: exclude });
    expect(all.length).toBeGreaterThan(0);
    expect(all.some((d) => d.categoryId === 'alcohol')).toBe(false);
  });

  it.each(['beer', 'wine', 'cocktail', 'hard seltzer', 'spirits', 'alcohol'])(
    'searching "%s" returns no alcohol in production',
    (q) => {
      expect(searchDrinks(q, { limit: 500, excludeCategories: exclude }).some((d) => d.categoryId === 'alcohol')).toBe(false);
    },
  );

  it('without the exclusion the same search still finds them (internal builds)', () => {
    expect(searchDrinks('beer', { limit: 500 }).some((d) => d.categoryId === 'alcohol')).toBe(true);
  });
});

describe('the picker uses the build-aware list', () => {
  const read = (rel: string) => readFileSync(resolve(__dirname, '..', '..', rel), 'utf8');

  it('AddDrinkModal never maps the raw CATEGORY_ORDER', () => {
    const src = read('components/AddDrinkModal.tsx');
    expect(src).not.toMatch(/\bCATEGORY_ORDER\b/);
    expect(src.match(/availableCategoryOrder\(\)/g)?.length).toBe(2);
    expect(src).toContain('excludeCategories: unavailableDrinkCategories()');
  });

  it('Smart Capture refuses to log an unavailable category', () => {
    expect(read('components/SmartCaptureModal.tsx')).toContain('if (!isDrinkCategoryAvailable(rec.drinkCategory)) return;');
  });
});
