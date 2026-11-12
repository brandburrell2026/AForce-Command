import { describe, it, expect } from 'vitest';

import { countsAsWater, drinkRoute } from '../hydration/drinkRoute';
import { DRINK_CATEGORIES } from '../../data/drinkCatalog';
import { RECORDED_DRINK_CATEGORY_IDS } from '../../../api-server/src/routes/aforce/recordedDrinksContract';

describe('drinkRoute (hydrostate-v2.0, decision C1)', () => {
  it('plain water counts 1:1, whatever the coefficient used to be', () => {
    expect(drinkRoute({ categoryId: 'water', name: 'Tap Water', enteredOz: 16 })).toEqual({ kind: 'water', oz: 16 });
    expect(drinkRoute({ categoryId: 'bottled_water', name: 'Fiji Natural Artesian', enteredOz: 16.9 })).toEqual({ kind: 'water', oz: 16.9 });
  });
  it('sparkling or mineral water is saved, not counted', () => {
    expect(drinkRoute({ categoryId: 'water', name: 'Sparkling Water', enteredOz: 12 })).toEqual({ kind: 'recorded', categoryId: 'sparkling_water', oz: 12 });
    expect(countsAsWater('bottled_water', 'Mineral water')).toBe(false);
  });
  it('every other catalog category is saved with its entered ounces, never a water-equivalent', () => {
    for (const id of Object.keys(DRINK_CATEGORIES)) {
      if (id === 'water' || id === 'bottled_water') continue;
      expect(drinkRoute({ categoryId: id, name: 'Anything', enteredOz: 12 })).toEqual({ kind: 'recorded', categoryId: id, oz: 12 });
    }
  });
  it('every recorded category is accepted by the server contract', () => {
    const accepted = new Set<string>(RECORDED_DRINK_CATEGORY_IDS);
    for (const id of Object.keys(DRINK_CATEGORIES)) {
      const route = drinkRoute({ categoryId: id, name: 'x', enteredOz: 1 });
      if (route.kind === 'recorded') expect(accepted.has(route.categoryId)).toBe(true);
    }
    expect(accepted.has('sparkling_water')).toBe(true);
    expect(accepted.has('water')).toBe(false);
  });
});
