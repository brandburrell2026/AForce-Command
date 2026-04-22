/**
 * storeCatalog — pins the server-side cart pricing chokepoint.
 *
 * The whole point of `priceCart` is that the client can NEVER influence
 * unit prices. These tests pin: catalog lookup, qty bounds, duplicate
 * rejection, the shipping threshold, the tax rate, and exact cent-level
 * totals so any catalog drift breaks loudly.
 */

import { describe, it, expect } from 'vitest';
import {
  priceCart,
  STORE_CATALOG,
  SHIPPING_THRESHOLD_CENTS,
  SHIPPING_FLAT_CENTS,
  TAX_RATE,
} from '../storeCatalog';

describe('storeCatalog — catalog shape', () => {
  it('every entry has a non-empty name and a positive integer price', () => {
    for (const [skuId, entry] of Object.entries(STORE_CATALOG)) {
      expect(
        skuId.startsWith('sku_') || skuId.startsWith('bundle_'),
        `catalog id "${skuId}" must start with sku_ or bundle_`,
      ).toBe(true);
      expect(entry.name.length).toBeGreaterThan(0);
      expect(Number.isInteger(entry.unitAmountCents)).toBe(true);
      expect(entry.unitAmountCents).toBeGreaterThan(0);
    }
  });
});

describe('priceCart — input validation', () => {
  it('rejects non-array', () => {
    expect(() => priceCart(null)).toThrow();
    expect(() => priceCart(undefined)).toThrow();
    expect(() => priceCart({} as unknown)).toThrow();
    expect(() => priceCart('nope' as unknown)).toThrow();
  });

  it('rejects empty array', () => {
    expect(() => priceCart([])).toThrow(/non-empty/);
  });

  it('rejects unknown skuId', () => {
    expect(() => priceCart([{ skuId: 'sku_does_not_exist', qty: 1 }]))
      .toThrow(/unknown skuId/);
  });

  it('rejects missing skuId', () => {
    expect(() => priceCart([{ qty: 1 } as unknown])).toThrow(/skuId is required/);
  });

  it('rejects qty < 1, > 99, non-integer, or non-number', () => {
    expect(() => priceCart([{ skuId: 'sku_stick_berry', qty: 0 }])).toThrow(/qty/);
    expect(() => priceCart([{ skuId: 'sku_stick_berry', qty: 100 }])).toThrow(/qty/);
    expect(() => priceCart([{ skuId: 'sku_stick_berry', qty: 1.5 }])).toThrow(/qty/);
    expect(() => priceCart([{ skuId: 'sku_stick_berry', qty: '3' as unknown as number }]))
      .toThrow(/qty/);
    expect(() => priceCart([{ skuId: 'sku_stick_berry', qty: -1 }])).toThrow(/qty/);
  });

  it('rejects duplicate skuId in same cart', () => {
    expect(() =>
      priceCart([
        { skuId: 'sku_stick_berry', qty: 1 },
        { skuId: 'sku_stick_berry', qty: 2 },
      ]),
    ).toThrow(/duplicate/);
  });

  it('ignores any unit price the client tries to send (price comes only from catalog)', () => {
    const priced = priceCart([
      { skuId: 'sku_stick_berry', qty: 1, unitAmountCents: 1 } as unknown,
    ]);
    // Catalog price is $34.99 — never $0.01.
    expect(priced.lines[0]!.unitAmountCents).toBe(STORE_CATALOG.sku_stick_berry!.unitAmountCents);
  });
});

describe('priceCart — totals', () => {
  it('single stick: $34.99 + shipping $5.99 + 8.75% tax', () => {
    const priced = priceCart([{ skuId: 'sku_stick_berry', qty: 1 }]);
    expect(priced.subtotalCents).toBe(3499);
    expect(priced.shippingCents).toBe(SHIPPING_FLAT_CENTS); // under $50 threshold
    expect(priced.taxCents).toBe(Math.round(3499 * TAX_RATE));
    expect(priced.totalCents).toBe(priced.subtotalCents + priced.shippingCents + priced.taxCents);
  });

  it('crosses the free-shipping threshold exactly at $50', () => {
    // 2 sticks @ $34.99 = $69.98 → free shipping
    const priced = priceCart([{ skuId: 'sku_stick_berry', qty: 2 }]);
    expect(priced.subtotalCents).toBe(6998);
    expect(priced.subtotalCents).toBeGreaterThanOrEqual(SHIPPING_THRESHOLD_CENTS);
    expect(priced.shippingCents).toBe(0);
  });

  it('mixed multi-line cart sums correctly across SKUs', () => {
    // 1 berry stick ($34.99) + 1 watermelon canister ($59.99) = $94.98
    const priced = priceCart([
      { skuId: 'sku_stick_berry', qty: 1 },
      { skuId: 'sku_can_watermelon', qty: 1 },
    ]);
    expect(priced.subtotalCents).toBe(3499 + 5999);
    expect(priced.shippingCents).toBe(0); // over $50
    expect(priced.lines).toHaveLength(2);
    expect(priced.lines[0]!.lineSubtotalCents).toBe(3499);
    expect(priced.lines[1]!.lineSubtotalCents).toBe(5999);
  });

  it('qty multiplier is applied per line', () => {
    const priced = priceCart([{ skuId: 'sku_stick_berry', qty: 3 }]);
    expect(priced.lines[0]!.qty).toBe(3);
    expect(priced.lines[0]!.lineSubtotalCents).toBe(3499 * 3);
  });
});
