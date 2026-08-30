import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';

/**
 * E6-B0 — D5 at the SOURCE layer: OpenFoodFacts must propagate UNKNOWN.
 *
 * `services/__tests__/scanTruthCorrections.test.ts` proves the comparison
 * engine handles `null` correctly. This file proves the OFF service actually
 * PRODUCES `null` — the layer where the defect lived.
 *
 * The original code read `off.nutriments?.sugars_100g ?? 0`, substituting a
 * finite zero for absent data before the declared fallback could fire. Because
 * sugar is inverted and sodium is not, the same absence rewarded one product
 * (+19 on a typical match) and penalized another (−30). Without this file the
 * `?? 0` mutation is invisible to every behavioural test in the repo.
 */

vi.mock('react-native', () => ({ Platform: { OS: 'ios' } }));

function stubOFF(nutriments: Record<string, number> | undefined) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        status: 1,
        product: {
          product_name: 'Test Drink',
          brands: 'TestCo',
          categories_tags: ['en:sports-drinks'],
          ...(nutriments ? { nutriments } : {}),
        },
      }),
    })) as unknown as typeof fetch,
  );
}

async function lookup(barcode: string) {
  vi.resetModules();
  const { lookupBarcode } = await import('../openFoodFactsService');
  return lookupBarcode(barcode);
}

describe('E6-B0 · D5 — OpenFoodFacts propagates UNKNOWN, never a substituted zero', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('ABSENT sugar yields null — not the best-possible sugar score', () => {
    stubOFF({ sodium_100g: 0.3 });
    return lookup('1000000000001').then((p) => {
      expect(p).toBeTruthy();
      // The defect: absent sugar became 0, which the card renders as
      // "Sugar load 100" — the most favourable value available.
      expect(p!.sugarLevel).toBeNull();
    });
  });

  it('ABSENT sodium yields null — not the worst-possible electrolyte score', () => {
    stubOFF({ sugars_100g: 6 });
    return lookup('1000000000002').then((p) => {
      expect(p!.electrolyteDensity).toBeNull();
    });
  });

  it('NO nutrition at all yields all-null, not a fully-scored product', () => {
    stubOFF(undefined);
    return lookup('1000000000003').then((p) => {
      expect(p!.sugarLevel).toBeNull();
      expect(p!.electrolyteDensity).toBeNull();
      // Derived values are only as known as their inputs.
      expect(p!.recoveryFit).toBeNull();
      expect(p!.performanceFit).toBeNull();
    });
  });

  it('a MEASURED zero survives as zero and stays distinguishable from unknown', () => {
    stubOFF({ sugars_100g: 0, sodium_100g: 0.4 });
    return lookup('1000000000004').then((p) => {
      // "Contains no sugar" is data and must not be laundered into "unknown".
      expect(p!.sugarLevel).toBe(0);
      expect(p!.electrolyteDensity).toBe(100);
    });
  });

  it('UNKNOWN and MEASURED-ZERO sugar produce different products', () => {
    stubOFF({ sodium_100g: 0.3 });
    return lookup('1000000000005').then(async (unknownSugar) => {
      stubOFF({ sugars_100g: 0, sodium_100g: 0.3 });
      const measuredZero = await lookup('1000000000006');
      expect(unknownSugar!.sugarLevel).not.toBe(measuredZero!.sugarLevel);
      expect(unknownSugar!.sugarLevel).toBeNull();
      expect(measuredZero!.sugarLevel).toBe(0);
    });
  });

  it('an ABSENT caffeine reading is unknown, not a measured zero stimulant load', () => {
    stubOFF({ sugars_100g: 6, sodium_100g: 0.3 });
    return lookup('1000000000007').then((p) => {
      expect(p!.stimulantLevel).toBeNull();
    });
  });
});
