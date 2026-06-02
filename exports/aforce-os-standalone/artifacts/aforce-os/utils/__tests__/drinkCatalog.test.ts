/**
 * drinkCatalog — integrity + helper coverage.
 *
 * Pins down the 13-category contract (spec: HydroScan final system) so
 * any accidental removal of a category, broken coefficient, or unsafe
 * custom-name input is caught immediately.
 */

import { describe, it, expect } from 'vitest';
import {
  DRINK_CATEGORIES,
  CATEGORY_ORDER,
  CATALOG_DRINKS,
  getDrinkCoefficient,
  computeEffectiveOz,
  formatDrinkDisplayName,
  sanitizeCustomDrinkName,
  type DrinkCategoryId,
} from '../../data/drinkCatalog';

const EXPECTED_CATEGORIES: DrinkCategoryId[] = [
  'water',
  'bottled_water',
  'coffee',
  'tea',
  'pre_workout',
  'energy_drink',
  'sports_drink',
  'alcohol',
  'smoothie',
  'juice',
  'soda',
  'electrolyte',
  'custom',
];

describe('drinkCatalog — categories', () => {
  it('defines exactly the 13 HydroScan categories', () => {
    expect(Object.keys(DRINK_CATEGORIES).sort()).toEqual(
      [...EXPECTED_CATEGORIES].sort(),
    );
  });

  it('CATEGORY_ORDER covers every category exactly once', () => {
    expect([...CATEGORY_ORDER].sort()).toEqual([...EXPECTED_CATEGORIES].sort());
    expect(new Set(CATEGORY_ORDER).size).toBe(CATEGORY_ORDER.length);
  });

  it('every category has sane defaults', () => {
    for (const id of EXPECTED_CATEGORIES) {
      const c = DRINK_CATEGORIES[id];
      expect(c.id).toBe(id);
      expect(c.label.length).toBeGreaterThan(0);
      expect(c.shortLabel.length).toBeGreaterThan(0);
      expect(c.icon.length).toBeGreaterThan(0);
      expect(c.defaultOz).toBeGreaterThan(0);
      expect(c.defaultOz).toBeLessThanOrEqual(64);
      expect(c.hydrationCoefficient).toBeGreaterThanOrEqual(0);
      expect(c.hydrationCoefficient).toBeLessThanOrEqual(1.2);
      expect(c.fluidType).toBe('water');
    }
  });

  it('coefficient ordering matches dietetic intuition', () => {
    const coef = (id: DrinkCategoryId) => DRINK_CATEGORIES[id].hydrationCoefficient;
    expect(coef('electrolyte')).toBeGreaterThanOrEqual(coef('water'));
    expect(coef('water')).toBeGreaterThanOrEqual(coef('coffee'));
    expect(coef('coffee')).toBeGreaterThanOrEqual(coef('soda'));
    expect(coef('soda')).toBeGreaterThanOrEqual(coef('energy_drink'));
    expect(coef('energy_drink')).toBeGreaterThanOrEqual(coef('alcohol'));
  });
});

describe('drinkCatalog — curated drinks', () => {
  it('contains at least one drink in every real category (custom is virtual)', () => {
    for (const id of EXPECTED_CATEGORIES) {
      if (id === 'custom') continue;
      const count = CATALOG_DRINKS.filter((d) => d.categoryId === id).length;
      expect(count).toBeGreaterThan(0);
    }
  });

  it('every catalog drink has a unique id and valid category', () => {
    const ids = new Set<string>();
    for (const d of CATALOG_DRINKS) {
      expect(ids.has(d.id)).toBe(false);
      ids.add(d.id);
      expect(DRINK_CATEGORIES[d.categoryId]).toBeDefined();
      expect(d.name.length).toBeGreaterThan(0);
      expect(d.ozPerServing).toBeGreaterThan(0);
    }
  });
});

describe('getDrinkCoefficient', () => {
  it('falls back to category coefficient when drink has no override', () => {
    const drip = CATALOG_DRINKS.find((d) => d.id === 'coffee-drip')!;
    expect(getDrinkCoefficient(drip)).toBe(DRINK_CATEGORIES.coffee.hydrationCoefficient);
  });

  it('uses per-drink coefficient when present', () => {
    const decaf = CATALOG_DRINKS.find((d) => d.id === 'coffee-decaf')!;
    expect(decaf.hydrationCoefficient).toBe(0.95);
    expect(getDrinkCoefficient(decaf)).toBe(0.95);
  });
});

describe('computeEffectiveOz', () => {
  it('scales by category coefficient', () => {
    // 12 oz coffee × 0.85 = 10.2
    expect(computeEffectiveOz('coffee', 12)).toBe(10.2);
  });

  it('honors per-drink coefficient override', () => {
    // 12 oz × 0.95 = 11.4
    expect(computeEffectiveOz('coffee', 12, 0.95)).toBe(11.4);
  });

  it('water passes through unchanged', () => {
    expect(computeEffectiveOz('water', 16)).toBe(16);
  });

  it('electrolyte boosts above the entered amount', () => {
    expect(computeEffectiveOz('electrolyte', 16)).toBe(17.6);
  });

  it('alcohol logs minimal hydration credit (≤ entered × 0.1)', () => {
    expect(computeEffectiveOz('alcohol', 12)).toBe(1.2);
  });

  it('floors negative input at 0 (never negative oz)', () => {
    expect(computeEffectiveOz('water', -10)).toBe(0);
    expect(computeEffectiveOz('water', 10, -1)).toBe(0);
  });

  it('rounds to one decimal place', () => {
    // 8.3 × 0.85 = 7.055 → 7.1
    expect(computeEffectiveOz('coffee', 8.3)).toBe(7.1);
  });
});

describe('formatDrinkDisplayName', () => {
  it('prefixes category label', () => {
    expect(formatDrinkDisplayName({ categoryId: 'coffee', name: 'Starbucks Pike Place' }))
      .toBe('Coffee \u00b7 Starbucks Pike Place');
  });

  it('avoids double prefix when name matches category', () => {
    expect(formatDrinkDisplayName({ categoryId: 'water', name: 'Water' }))
      .toBe('Water');
    expect(formatDrinkDisplayName({ categoryId: 'water', name: '  water  ' }))
      .toBe('Water');
  });

  it('falls back to category label when name is empty', () => {
    expect(formatDrinkDisplayName({ categoryId: 'coffee', name: '   ' }))
      .toBe('Coffee');
  });

  it('handles custom drinks', () => {
    expect(formatDrinkDisplayName({ categoryId: 'custom', name: 'Mom\u2019s Lemonade' }))
      .toBe('Custom Drink \u00b7 Mom\u2019s Lemonade');
  });
});

describe('sanitizeCustomDrinkName', () => {
  it('returns null for empty / whitespace input', () => {
    expect(sanitizeCustomDrinkName('')).toBeNull();
    expect(sanitizeCustomDrinkName('   ')).toBeNull();
    expect(sanitizeCustomDrinkName('\t\n  \r')).toBeNull();
  });

  it('trims and collapses whitespace', () => {
    expect(sanitizeCustomDrinkName('  Cold   Brew  ')).toBe('Cold Brew');
  });

  it('strips control characters', () => {
    expect(sanitizeCustomDrinkName('Coke\u0000\u0007Zero')).toBe('CokeZero');
  });

  it('caps length at 60', () => {
    const long = 'a'.repeat(200);
    expect(sanitizeCustomDrinkName(long)?.length).toBe(60);
  });

  it('preserves unicode (emoji, accents)', () => {
    expect(sanitizeCustomDrinkName('Caf\u00e9 au lait \u2615'))
      .toBe('Caf\u00e9 au lait \u2615');
  });
});
