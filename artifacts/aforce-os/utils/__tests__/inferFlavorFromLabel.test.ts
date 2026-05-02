/**
 * inferFlavorFromLabel — locks in the label → flavor mapping that
 * gates the Heat Guard / Soursop bonuses inside `computeEventImpact`.
 *
 * If this mapping ever silently breaks, every voice-logged or picker-
 * logged AForce stick falls back to "unflavored" (+10 only) and users
 * stop seeing the contextual bonuses. These tests cover every label
 * shape the FlavorPickerModal (`${name} ${oz} oz`) and the
 * `data/products.ts` / `data/flavors.ts` source-of-truth tables
 * actually emit.
 *
 * NOTE: We hardcode the production label strings here instead of
 * importing them from `data/*.ts`, because those modules use
 * React Native's `require('../assets/...')` for image bundling which
 * is unparseable in the node-based vitest environment. This test file
 * acts as the contract — if the labels in `data/products.ts` or
 * `data/flavors.ts` ever change, update both there and here.
 */

import { describe, it, expect } from 'vitest';
import { inferFlavorFromLabel } from '../inferFlavorFromLabel';
import type { ProductFlavor } from '../../types';

// Source of truth: data/products.ts PRODUCT_FLAVORS[*].label
const PRODUCT_FLAVOR_LABELS: Array<[string, ProductFlavor]> = [
  ['Berry Blast + Dulse', 'berry'],
  ['Watermelon Surge + Chlorella', 'watermelon'],
  ['Soursop Edge + Seamoss', 'soursop'],
];

// Source of truth: data/flavors.ts FLAVOR_VARIANTS[*].name
const FLAVOR_VARIANT_NAMES: Array<[string, ProductFlavor]> = [
  ['Berry Blast', 'berry'],
  ['Watermelon Surge', 'watermelon'],
  ['Soursop Edge', 'soursop'],
];

describe('inferFlavorFromLabel — production label shapes', () => {
  it('maps short variant names', () => {
    expect(inferFlavorFromLabel('Berry Blast')).toBe('berry');
    expect(inferFlavorFromLabel('Watermelon Surge')).toBe('watermelon');
    expect(inferFlavorFromLabel('Soursop Edge')).toBe('soursop');
  });

  it('maps full PRODUCT_FLAVORS labels (with " + " functional ingredient)', () => {
    expect(inferFlavorFromLabel('Berry Blast + Dulse')).toBe('berry');
    expect(inferFlavorFromLabel('Watermelon Surge + Chlorella')).toBe('watermelon');
    expect(inferFlavorFromLabel('Soursop Edge + Seamoss')).toBe('soursop');
  });

  it('maps the FlavorPickerModal label format `${name} ${oz} oz`', () => {
    // FlavorPickerModal.tsx line 148: label: `${fullLabel} ${oz} oz`
    expect(inferFlavorFromLabel('Berry Blast 12 oz')).toBe('berry');
    expect(inferFlavorFromLabel('Watermelon Surge 12 oz')).toBe('watermelon');
    expect(inferFlavorFromLabel('Soursop Edge 12 oz')).toBe('soursop');
    expect(inferFlavorFromLabel('Berry Blast + Dulse 12 oz')).toBe('berry');
  });

  it('is case-insensitive', () => {
    expect(inferFlavorFromLabel('berry blast')).toBe('berry');
    expect(inferFlavorFromLabel('WATERMELON')).toBe('watermelon');
    expect(inferFlavorFromLabel('SoUrSoP eDgE')).toBe('soursop');
  });

  it('returns undefined for empty / unknown labels (so caller falls back to product default)', () => {
    expect(inferFlavorFromLabel(undefined)).toBeUndefined();
    expect(inferFlavorFromLabel('')).toBeUndefined();
    expect(inferFlavorFromLabel('Mystery Flavor')).toBeUndefined();
    expect(inferFlavorFromLabel('Water 16 oz')).toBeUndefined();
  });

  it('every PRODUCT_FLAVORS label is recognised', () => {
    for (const [label, expected] of PRODUCT_FLAVOR_LABELS) {
      expect(inferFlavorFromLabel(label)).toBe(expected);
    }
  });

  it('every FLAVOR_VARIANTS short name is recognised', () => {
    for (const [name, expected] of FLAVOR_VARIANT_NAMES) {
      expect(inferFlavorFromLabel(name)).toBe(expected);
    }
  });
});
