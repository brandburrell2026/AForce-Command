import { describe, expect, it, vi } from 'vitest';

const lookupBarcode = vi.fn(async (_code: string) => undefined);
vi.mock('../openFoodFactsService', () => ({ lookupBarcode: (code: string) => lookupBarcode(code) }));

import { recognize, listSimulatableBarcodes } from '../productRecognitionService';
import { AFORCE_PACKAGING, aforcePackagingStatus } from '../../data/aforcePackaging';

/**
 * The registered AFORCE UPCs supplied by the founder on 2026-11-25.
 * Copied here by hand, apart from the service, so a typo in either place fails.
 */
const REAL: readonly (readonly [code: string, productId: string, what: string])[] = [
  ['860014045011', 'aforce_sku_berry_stick', 'Berry Blast 20-count stick carton'],
  ['860014380716', 'aforce_sku_watermelon_stick', 'Watermelon Surge 20-count stick carton'],
  ['860014045028', 'aforce_sku_soursop_stick', 'Soursop Edge 20-count stick carton'],
  ['860014380709', 'aforce_sku_berry_rtd', 'Berry Blast single can'],
  ['860014045004', 'aforce_sku_watermelon_rtd', 'Watermelon Surge single can'],
  ['860014045042', 'aforce_sku_soursop_rtd', 'Soursop Edge single can'],
  ['860014045066', 'aforce_sku_berry_rtd', 'Berry Blast can six-pack'],
  ['860014380723', 'aforce_sku_watermelon_rtd', 'Watermelon Surge can six-pack'],
  ['860014045073', 'aforce_sku_soursop_rtd', 'Soursop Edge can six-pack'],
];

const validUpcA = (code: string) => {
  if (!/^\d{12}$/.test(code)) return false;
  const d = [...code].map(Number);
  const sum = d.slice(0, 11).reduce((s, n, i) => s + n * (i % 2 ? 1 : 3), 0);
  return (10 - (sum % 10)) % 10 === d[11];
};

describe('AFORCE registered barcodes', () => {
  it.each(REAL)('%s is a valid UPC-A and resolves to %s (%s)', async (code, productId) => {
    expect(validUpcA(code)).toBe(true);
    const p = await recognize({ kind: 'barcode', rawValue: code });
    expect(p?.productId).toBe(productId);
    expect(p?.isAForce).toBe(true);
  });

  it('the same code read as a 13-digit EAN resolves to the same product', async () => {
    const p = await recognize({ kind: 'barcode', rawValue: '0860014045004' });
    expect(p?.productId).toBe('aforce_sku_watermelon_rtd');
  });

  it('no two products share a code, and a six-pack is the same can', () => {
    expect(new Set(REAL.map(([c]) => c)).size).toBe(REAL.length);
  });

  it('the old placeholder codes no longer resolve to an AFORCE product', async () => {
    lookupBarcode.mockClear();
    for (const code of ['850000000017', '850000000024', '850000000062', '850000000123']) {
      const p = await recognize({ kind: 'barcode', rawValue: code });
      expect(p, code).toBeUndefined();
    }
    expect(lookupBarcode).toHaveBeenCalledTimes(4);
  });

  it('the packaging record carries the unit code for sticks and cans, and none for a six-pack', () => {
    for (const [code, productId, what] of REAL) {
      const row = AFORCE_PACKAGING.find((p) => p.catalogId === productId);
      if (what.includes('six-pack')) expect(AFORCE_PACKAGING.some((p) => p.unitUpc === code), what).toBe(false);
      else expect(row?.unitUpc, what).toBe(code);
    }
  });

  it('a barcode alone does not verify a product: net contents and label text are still missing', () => {
    for (const [, productId] of REAL) {
      expect(aforcePackagingStatus(productId)).toEqual({ verified: false, missing: ['netContents', 'frontLabelText'] });
    }
  });

  it('the developer preview lists each product once', () => {
    const ids = listSimulatableBarcodes().map((b) => b.productId);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('Store price list carries only registered codes', () => {
  it('stick packs carry the 20-count carton codes and say 20', async () => {
    const { STORE_SKUS } = await import('../../data/pricing');
    const sticks = STORE_SKUS.filter((s) => s.formatId === 'aforce_stick');
    expect(sticks.map((s) => [s.flavor, s.upc])).toEqual([
      ['berry', '860014045011'],
      ['watermelon', '860014380716'],
      ['soursop', '860014045028'],
    ]);
    for (const s of sticks) {
      expect(s.servingsPerPack).toBe(20);
      expect(s.formatLabel).toContain('20 ct');
    }
  });

  it('no pack carries a placeholder, and packs without a registered code carry none', async () => {
    const { STORE_SKUS } = await import('../../data/pricing');
    for (const s of STORE_SKUS) {
      if (s.upc) expect(/^85000000\d{4}$/.test(s.upc), s.id).toBe(false);
      if (s.formatId !== 'aforce_stick') expect(s.upc, s.id).toBeUndefined();
    }
  });
});
