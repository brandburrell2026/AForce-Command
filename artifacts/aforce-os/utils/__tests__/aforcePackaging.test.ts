import { describe, expect, it } from 'vitest';
import { AFORCE_PACKAGING, aforcePackagingStatus } from '../../data/aforcePackaging';
import { COMPARE_PRODUCTS } from '../../data/productDatabase';
import { STORE_SKUS } from '../../data/pricing';

describe('AFORCE packaging facts', () => {
  it('every row points at a real AFORCE catalog product', () => {
    for (const p of AFORCE_PACKAGING) {
      const found = COMPARE_PRODUCTS.find((c) => c.id === p.catalogId);
      expect(found?.isAForce, p.catalogId).toBe(true);
    }
  });

  it('every store SKU has a packaging row', () => {
    const covered = new Set(AFORCE_PACKAGING.map((p) => p.skuId));
    for (const sku of STORE_SKUS) expect(covered.has(sku.id), sku.id).toBe(true);
  });

  it('a product is verified only with all three fields', () => {
    for (const p of AFORCE_PACKAGING) {
      const s = aforcePackagingStatus(p.catalogId);
      const complete = !!p.unitUpc && !!p.netContents && !!p.frontLabelText;
      expect(s.verified, p.catalogId).toBe(complete);
      expect(s.missing.length === 0).toBe(complete);
    }
  });

  it('no placeholder barcode is ever accepted as a unit UPC', () => {
    for (const p of AFORCE_PACKAGING) {
      if (p.unitUpc) expect(/^85000000\d{4}$/.test(p.unitUpc), p.catalogId).toBe(false);
    }
  });

  it('an AFORCE id with no packaging row is unverified with everything missing', () => {
    expect(aforcePackagingStatus('aforce_stick')).toEqual({ verified: false, missing: ['unitUpc', 'netContents', 'frontLabelText'] });
  });
});
