import { describe, expect, it } from 'vitest';
import { candidateFromProduct } from '../hydroscan/barcodeCandidate';
import type { ScannedProduct } from '../../types/scan';

const base = {
  hydrationSpeed: null, electrolyteDensity: null, sugarLevel: null, stimulantLevel: null,
  recoveryFit: null, performanceFit: null, isAForce: false,
} as const;

describe('barcode candidate', () => {
  it('no product: the barcode is still recorded, with no match', () => {
    expect(candidateFromProduct('123', undefined)).toEqual({ candidate: { code: '123', product: null }, handOff: null });
  });

  it('a loggable catalog product hands off to the existing flow', () => {
    const p: ScannedProduct = { ...base, productId: 'aforce_rtd', productName: 'AForce RTD', brand: 'AForce', category: 'electrolyte_mix', isAForce: true, fluidType: 'aforce_rtd' };
    const r = candidateFromProduct('860014045004', p);
    expect(r.handOff).toEqual({ kind: 'barcode', rawValue: '860014045004' });
    expect(r.candidate.product).toMatchObject({ reliable: true, category: 'electrolyte' });
  });

  it('a catalog rival with no logging flow is a reliable candidate for the label reader', () => {
    const p: ScannedProduct = { ...base, productId: 'gatorade', productName: 'Gatorade', brand: 'Gatorade', category: 'sports_drink' };
    const r = candidateFromProduct('052000338874', p);
    expect(r.handOff).toBeNull();
    expect(r.candidate.product).toMatchObject({ reliable: true, category: 'sports_drink' });
  });

  it('a public record is unreliable, and its default category is not trusted', () => {
    const p: ScannedProduct = { ...base, productId: 'off_1', productName: 'Some Drink', brand: 'Acme', category: 'sports_drink' };
    const r = candidateFromProduct('1', p);
    expect(r.candidate.product).toMatchObject({ reliable: false, category: null });
    expect(r.handOff).toBeNull();
  });
});
