/**
 * drinkSearch — typeahead ranking coverage.
 *
 * Pins down the ranking order so future tweaks are deliberate. Also
 * verifies category-scoped search (used by the tab UX) and the
 * "custom is excluded from search results" rule.
 */

import { describe, it, expect } from 'vitest';
import { searchDrinks } from '../drinkSearch';
import { CATALOG_DRINKS } from '../../data/drinkCatalog';

describe('searchDrinks', () => {
  it('empty query returns the natural catalog order (filtered of custom)', () => {
    const out = searchDrinks('', { limit: 1000 });
    const expected = CATALOG_DRINKS.filter((d) => d.categoryId !== 'custom');
    expect(out.map((d) => d.id)).toEqual(expected.map((d) => d.id));
  });

  it('ranks startsWith above word-includes above contains', () => {
    // Query "pre" against pre-workout names:
    //   "Pre JYM"           → name startsWith "pre"      (score 800)
    //   "Bang Pre-Workout"  → name word-includes "pre"   (score 600)
    //   "Generic Pre-Workout Mix" → word-includes "pre"  (score 600)
    const ids = searchDrinks('pre').map((d) => d.id);
    const jym = ids.indexOf('pw-pre-jym');
    const bang = ids.indexOf('pw-bang-pre');
    expect(jym).toBeGreaterThanOrEqual(0);
    expect(bang).toBeGreaterThanOrEqual(0);
    expect(jym).toBeLessThan(bang);
  });

  it('matches by brand', () => {
    const out = searchDrinks('starbucks');
    expect(out.some((d) => d.id === 'coffee-sbux-pike')).toBe(true);
  });

  it('matches by category label as last-resort', () => {
    const out = searchDrinks('sports');
    // All sports_drink entries should surface (category label match).
    const sportsIds = CATALOG_DRINKS.filter((d) => d.categoryId === 'sports_drink')
      .map((d) => d.id);
    for (const id of sportsIds) {
      expect(out.some((d) => d.id === id)).toBe(true);
    }
  });

  it('restricts to a single category when categoryId is set', () => {
    const out = searchDrinks('', { categoryId: 'coffee', limit: 1000 });
    expect(out.length).toBeGreaterThan(0);
    expect(out.every((d) => d.categoryId === 'coffee')).toBe(true);
  });

  it('honors limit', () => {
    expect(searchDrinks('', { limit: 3 }).length).toBe(3);
    expect(searchDrinks('', { limit: 0 }).length).toBe(0);
  });

  it('excludes virtual custom category', () => {
    const out = searchDrinks('', { limit: 1000 });
    expect(out.some((d) => d.categoryId === 'custom')).toBe(false);
  });

  it('is case + whitespace insensitive', () => {
    const a = searchDrinks('RED BULL');
    const b = searchDrinks('  red bull  ');
    expect(a.map((d) => d.id)).toEqual(b.map((d) => d.id));
    expect(a[0]?.id).toBe('ed-redbull');
  });

  it('returns empty array when nothing matches', () => {
    expect(searchDrinks('zzznonexistentzzz')).toEqual([]);
  });
});
