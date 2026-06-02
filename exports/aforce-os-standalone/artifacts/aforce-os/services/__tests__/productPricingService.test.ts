import { describe, it, expect } from 'vitest';
import {
  getSubscriptionPricing,
  getBundlePricing,
  getBundlesForSku,
  recommendedSkusForState,
  recommendedSkuFor,
} from '../productPricingService';
import { STORE_SKUS, STORE_BUNDLES, findSku } from '../../data/pricing';

describe('productPricingService — getSubscriptionPricing', () => {
  it('computes savings + percent label for a stick SKU (5/35 → 14%)', () => {
    const stick = findSku('sku_stick_berry')!;
    const p = getSubscriptionPricing(stick);
    expect(p.oneTimeCents).toBe(3499);
    expect(p.subscriptionCents).toBe(2999);
    expect(p.savingsCents).toBe(500);
    expect(p.discountLabel).toBe('Save 14%');
  });

  it('computes savings + percent label for a canister SKU (10/60 → 17%)', () => {
    const can = findSku('sku_can_berry')!;
    const p = getSubscriptionPricing(can);
    expect(p.oneTimeCents).toBe(5999);
    expect(p.subscriptionCents).toBe(4999);
    expect(p.savingsCents).toBe(1000);
    expect(p.discountLabel).toBe('Save 17%');
  });

  it('clamps savings at zero when sub price is greater than one-time (defensive)', () => {
    const synthetic = {
      ...findSku('sku_stick_berry')!,
      subscriptionPriceCents: 9999,
    };
    const p = getSubscriptionPricing(synthetic);
    expect(p.savingsCents).toBe(0);
    expect(p.discountFraction).toBe(0);
    expect(p.discountLabel).toBe('');
  });
});

describe('productPricingService — getBundlePricing', () => {
  it('computes savings vs N×base singles', () => {
    const stick = findSku('sku_stick_berry')!;
    const bundle3 = STORE_BUNDLES.find((b) => b.id === 'bundle_stick_3')!;
    const p = getBundlePricing(bundle3, stick);
    expect(p.singlesCents).toBe(3 * 3499);
    expect(p.bundlePriceCents).toBe(8999);
    expect(p.savingsCents).toBe(3 * 3499 - 8999);
    expect(p.savingsLabel).toMatch(/^Save \$\d/);
    expect(p.effectiveUnitCents).toBe(Math.round(8999 / 3));
  });

  it('throws on format mismatch (defensive)', () => {
    const stick = findSku('sku_stick_berry')!;
    const canBundle = STORE_BUNDLES.find((b) => b.id === 'bundle_can_2')!;
    expect(() => getBundlePricing(canBundle, stick)).toThrow(/does not match/);
  });

  it('every SKU + matching bundle returns at least one positive-savings bundle', () => {
    for (const sku of STORE_SKUS) {
      const bundles = getBundlesForSku(sku);
      // Sticks/RTD/canisters all have ≥1 bundle today; if a future format
      // ships without bundles, this should fail loudly so we audit copy.
      expect(bundles.length).toBeGreaterThan(0);
      for (const b of bundles) {
        expect(b.bundlePriceCents).toBeGreaterThan(0);
        // Bundles must price below the singles baseline — otherwise the
        // store would be lying to the user about "Save $X".
        expect(b.bundlePriceCents).toBeLessThan(b.singlesCents);
      }
    }
  });
});

describe('productPricingService — recommendation', () => {
  it('recommendedSkusForState filters by performance state', () => {
    const recovering = recommendedSkusForState('RECOVERING');
    expect(recovering.length).toBeGreaterThan(0);
    for (const s of recovering) {
      expect(s.recommendedFor).toContain('RECOVERING');
    }
  });

  it('recommendedSkusForState honors optional formatId scope', () => {
    const recoveringSticks = recommendedSkusForState('RECOVERING', 'aforce_stick');
    expect(recoveringSticks.length).toBeGreaterThan(0);
    for (const s of recoveringSticks) expect(s.formatId).toBe('aforce_stick');
  });

  it('recommendedSkuFor returns a SKU for every (state × format) combination', () => {
    const states = ['PEAK', 'BALANCED', 'RECOVERING', 'DEPLETED'] as const;
    const formats = ['aforce_stick', 'aforce_rtd', 'aforce_canister'] as const;
    for (const state of states) {
      for (const fmt of formats) {
        const sku = recommendedSkuFor(state, fmt, 'watermelon');
        expect(sku, `no recommendation for state=${state} format=${fmt}`).toBeDefined();
        expect(sku!.formatId).toBe(fmt);
      }
    }
  });
});
