import { describe, expect, it } from 'vitest';

import { COMPARE_PRODUCTS } from '../../data/productDatabase';
import {
  computeComparison,
  attributeProvenance,
  knownAttributes,
} from '../comparisonEngine';
import {
  buildRecommendation,
  bestAlternativeFor,
  eligibleAlternatives,
} from '../hydrationScanService';
import type { CompareInputs, CompareProduct } from '../../types/comparison';
import type { ScannedProduct } from '../../types/scan';

/**
 * E6-B0 — SCAN TRUTH CORRECTIONS (founder rulings D3–D6, 2026-08-30).
 *
 * Planted BEFORE implementation. This lane corrects production truth defects
 * on the LIVE Scan surface; it is not the Editorial migration. The presentation
 * of these facts is E6-B and is deliberately not asserted here.
 *
 *  D3 PROVENANCE — attributes carry VERIFIED / ESTIMATED / UNKNOWN at field
 *     granularity. No row is VERIFIED without a canonical source, and brand
 *     ownership confers no provenance privilege.
 *  D4 CLAIM      — "Current intake may increase hydration demand." is retired
 *     and not replaced by another physiological assertion.
 *  D5 UNKNOWN    — missing data stays UNKNOWN. It may never become a measured
 *     zero, never reward, never silently penalize; explicit zero survives.
 *  D6 NEUTRALITY — the alternative pool is the whole catalog, identical
 *     deterministic outcomes get identical copy, water is discoverable, and
 *     NO CHANGE NEEDED is a real outcome.
 */

const INPUTS: CompareInputs = {
  protocol: 'maintenance',
  state: 'BALANCED',
  score: 75,
  goal: 'daily',
  heatLoad: 0,
  sweatRate: 0,
};

function productById(id: string): CompareProduct {
  const p = COMPARE_PRODUCTS.find((x) => x.id === id);
  if (!p) throw new Error(`fixture product missing: ${id}`);
  return p;
}

/** A CompareProduct with every attribute known — the control. */
function known(over: Partial<CompareProduct> = {}): CompareProduct {
  return {
    id: 'test_known',
    name: 'Test Known',
    brand: 'Test',
    category: 'sports_drink',
    hydrationSpeed: 70,
    electrolytes: 70,
    sugar: 30,
    absorptionRate: 70,
    recoveryEfficiency: 70,
    compatibleProtocols: [],
    factualNote: '',
    isAForce: false,
    ...over,
  };
}

function scannedFrom(p: CompareProduct): ScannedProduct {
  return {
    productId: p.id,
    productName: p.name,
    brand: p.brand,
    category: p.category,
    hydrationSpeed: p.hydrationSpeed,
    electrolyteDensity: p.electrolytes,
    sugarLevel: p.sugar,
    stimulantLevel: null,
    recoveryFit: p.recoveryEfficiency,
    performanceFit: p.absorptionRate,
    isAForce: p.isAForce,
  };
}

function fitOf(p: CompareProduct, inputs: CompareInputs = INPUTS): number {
  const { results } = computeComparison({ inputs, catalog: [p] });
  const fit = results[0]!.fitScore;
  if (fit == null) throw new Error('fixture produced no comparable attribute');
  return fit;
}

// ───────────────────────────────────────────────── D3 · provenance

describe('D3 — provenance exists at field granularity, with no brand privilege', () => {
  it('every catalog attribute resolves to a provenance state', () => {
    for (const p of COMPARE_PRODUCTS) {
      for (const attr of knownAttributes.ALL) {
        expect(
          ['verified', 'estimated', 'unknown'],
          `${p.id}.${attr}`,
        ).toContain(attributeProvenance(p, attr));
      }
    }
  });

  it('ALL 22 catalog rows are ESTIMATED — nothing is fabricated as VERIFIED', () => {
    // The catalog header says so itself: "Tuned for relative ranking, not for
    // clinical claims." No lab panel, COA or published label backs any row.
    for (const p of COMPARE_PRODUCTS) {
      for (const attr of knownAttributes.ALL) {
        expect(attributeProvenance(p, attr), `${p.id}.${attr}`).toBe('estimated');
      }
    }
  });

  it('AForce receives no provenance privilege — the two sides are indistinguishable', () => {
    const aforce = COMPARE_PRODUCTS.filter((p) => p.isAForce);
    const rivals = COMPARE_PRODUCTS.filter((p) => !p.isAForce);
    expect(aforce.length).toBeGreaterThan(0);
    expect(rivals.length).toBeGreaterThan(0);
    const states = (list: CompareProduct[]) =>
      new Set(list.flatMap((p) => knownAttributes.ALL.map((a) => attributeProvenance(p, a))));
    expect([...states(aforce)]).toEqual([...states(rivals)]);
  });

  it('provenance is PER ATTRIBUTE, so one product can carry mixed evidence quality', () => {
    // The schema must already support the eventual case where one attribute
    // acquires a source and its siblings have not.
    const mixed = known({ provenance: { electrolytes: 'unknown' } });
    expect(attributeProvenance(mixed, 'electrolytes')).toBe('unknown');
    expect(attributeProvenance(mixed, 'sugar')).toBe('estimated');
  });
});

// ───────────────────────────────────────────────── D5 · unknown ≠ zero

describe('D5 — UNKNOWN is never a measured zero', () => {
  it('an unknown attribute carries NO numeric value', () => {
    const p = known({ sugar: null, provenance: { sugar: 'unknown' } });
    expect(p.sugar).toBeNull();
    expect(attributeProvenance(p, 'sugar')).toBe('unknown');
  });

  it('UNKNOWN sugar and MEASURED-ZERO sugar produce DIFFERENT matches', () => {
    // The defect this lane exists to kill: before the fix these were
    // byte-identical, so the surface could not tell "no data" from "no sugar".
    const unknownSugar = known({ sugar: null, provenance: { sugar: 'unknown' } });
    const measuredZero = known({ sugar: 0 });
    expect(fitOf(unknownSugar)).not.toBe(fitOf(measuredZero));
  });

  it('UNKNOWN never REWARDS — it cannot beat the same product with data', () => {
    // Missing sugar previously scored sugarImpact 100, the best possible.
    const withData = known({ sugar: 60 });
    const unknown = known({ sugar: null, provenance: { sugar: 'unknown' } });
    const best = known({ sugar: 0 });
    expect(fitOf(unknown)).toBeLessThanOrEqual(fitOf(best));
    // …and it must not be dragged to the bottom either (see the next test).
    expect(fitOf(unknown)).toBeGreaterThan(fitOf(known({ sugar: 100 })));
    expect(fitOf(withData)).toBeGreaterThan(0);
  });

  it('UNKNOWN never PENALIZES as though a bad measurement existed', () => {
    // Missing sodium previously scored electrolytes 0, the worst possible.
    const unknownElec = known({ electrolytes: null, provenance: { electrolytes: 'unknown' } });
    const worstElec = known({ electrolytes: 0 });
    expect(fitOf(unknownElec)).toBeGreaterThan(fitOf(worstElec));
  });

  it('an unknown attribute simply does not vote — the match is the known axes', () => {
    // The corrected policy: exclude the unknown axis and renormalize over the
    // weights that remain, so absence is neutral rather than directional.
    const allKnown = known();
    const oneUnknown = known({ sugar: null, provenance: { sugar: 'unknown' } });
    // Every remaining axis is identical at 70, and sugarImpact would have been
    // 70 too (100-30), so dropping it must leave the match unchanged.
    expect(fitOf(oneUnknown)).toBe(fitOf(allKnown));
  });

  it('EXPLICIT ZERO is preserved and still counts as data', () => {
    const zero = known({ sugar: 0 });
    expect(zero.sugar).toBe(0);
    expect(attributeProvenance(zero, 'sugar')).toBe('estimated');
    expect(fitOf(zero)).toBeGreaterThan(fitOf(known({ sugar: 100 })));
  });

  it('coverage is reported honestly, so a thin comparison cannot look complete', () => {
    const { results } = computeComparison({
      inputs: INPUTS,
      catalog: [known({ sugar: null, electrolytes: null, provenance: { sugar: 'unknown', electrolytes: 'unknown' } })],
    });
    expect(results[0]!.coverage).toEqual({ known: 3, total: 5 });

    const full = computeComparison({ inputs: INPUTS, catalog: [known()] });
    expect(full.results[0]!.coverage).toEqual({ known: 5, total: 5 });
  });

  it('a product with NO known attributes yields no match rather than a fabricated one', () => {
    const nothing = known({
      hydrationSpeed: null, electrolytes: null, sugar: null,
      absorptionRate: null, recoveryEfficiency: null,
      provenance: {
        hydrationSpeed: 'unknown', electrolytes: 'unknown', sugar: 'unknown',
        absorptionRate: 'unknown', recoveryEfficiency: 'unknown',
      },
    });
    const { results } = computeComparison({ inputs: INPUTS, catalog: [nothing] });
    expect(results[0]!.fitScore).toBeNull();
    expect(results[0]!.coverage).toEqual({ known: 0, total: 5 });
  });

  it('penalties gated on an attribute do NOT fire when that attribute is unknown', () => {
    // `score < 40 && electrolytes < 60` must not treat absence as "low".
    const depleted: CompareInputs = { ...INPUTS, score: 30, protocol: 'recovery' };
    const unknownElec = known({ electrolytes: null, provenance: { electrolytes: 'unknown' } });
    const lowElec = known({ electrolytes: 10 });
    expect(fitOf(unknownElec, depleted)).toBeGreaterThan(fitOf(lowElec, depleted));
  });
});

// ───────────────────────────────────────────────── D4 · the claim

describe('D4 — the physiological claim is retired, not replaced', () => {
  const RETIRED = 'may increase hydration demand';

  it('no recommendation branch can produce the retired sentence', () => {
    const scanned = scannedFrom(productById('gatorade'));
    const selfFit = computeComparison({ inputs: INPUTS, catalog: [productById('gatorade')] }).results[0]!;
    const alt = bestAlternativeFor(INPUTS, scanned.productId);
    for (const protocol of ['maintenance', 'recovery', 'depletion_correction', 'heat_stress', 'morning_reset'] as const) {
      const rec = buildRecommendation(scanned, { ...INPUTS, protocol }, selfFit, alt);
      expect(rec.headline, protocol).not.toContain(RETIRED);
      expect(rec.command, protocol).not.toContain(RETIRED);
      expect(rec.detail, protocol).not.toContain(RETIRED);
    }
  });

  it('the module contains no physiological assertion about the member at all', () => {
    // Guards against swapping one unsupported claim for another.
    const src = require('node:fs').readFileSync(
      require('node:path').join(__dirname, '..', 'hydrationScanService.ts'),
      'utf8',
    ).replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|\s)\/\/[^\n]*/g, '$1');
    for (const banned of [
      /increase[sd]? .{0,20}(hydration|fluid) (demand|need|loss)/i,
      /\bdehydrat/i,
      /your body (will|may|is)/i,
      /\brehydrate[sd]? you\b/i,
    ]) {
      expect(src, `banned physiological assertion: ${banned}`).not.toMatch(banned);
    }
  });

  it('the approved neutral explanation is available and is about the COMPARISON', () => {
    const weak = known({ id: 'weak', hydrationSpeed: 20, electrolytes: 10, sugar: 95, absorptionRate: 20, recoveryEfficiency: 20 });
    const selfFit = computeComparison({ inputs: INPUTS, catalog: [weak] }).results[0]!;
    const alt = bestAlternativeFor(INPUTS, weak.id);
    const rec = buildRecommendation(scannedFrom(weak), INPUTS, selfFit, alt);
    expect(rec.headline).toContain('ranked lower under the current comparison criteria');
  });
});

// ───────────────────────────────────────────────── D6 · neutrality

describe('D6 — commercial neutrality: the decision path is brand-blind', () => {
  it('the alternative pool is the WHOLE catalog, not AForce only', () => {
    // Asserted on the POOL, not on source text. An earlier version of this
    // test used a regex (`filter\([^)]*isAForce`) which could never match,
    // because `[^)]*` stops at the `)` in `(p)` — so reinstating the brand
    // filter passed every assertion. Behaviour is the only safe pin.
    const pool = eligibleAlternatives('gatorade');

    // Every product except the scanned one is eligible.
    expect(pool).toHaveLength(COMPARE_PRODUCTS.length - 1);
    expect(pool.some((p) => p.id === 'gatorade')).toBe(false);

    // …and the pool genuinely contains non-AForce products AND plain water.
    expect(pool.some((p) => !p.isAForce)).toBe(true);
    expect(pool.some((p) => p.id === 'water')).toBe(true);
    expect(pool.filter((p) => !p.isAForce).length).toBeGreaterThan(1);

    expect(bestAlternativeFor(INPUTS, 'gatorade')).toBeTruthy();
  });

  it('a NON-AForce product can be the nominated alternative', () => {
    // The strongest eligible alternative wins whatever its brand. Constructed
    // so a rival is unambiguously the best available.
    const catalog: CompareProduct[] = [
      known({ id: 'rival_best', brand: 'Rival', isAForce: false, hydrationSpeed: 99, electrolytes: 99, sugar: 0, absorptionRate: 99, recoveryEfficiency: 99 }),
      known({ id: 'af_mid', brand: 'AForce', isAForce: true, hydrationSpeed: 60, electrolytes: 60, sugar: 40, absorptionRate: 60, recoveryEfficiency: 60 }),
    ];
    const { results } = computeComparison({ inputs: INPUTS, catalog });
    expect(results[0]!.product.isAForce).toBe(false);
    expect(results[0]!.product.id).toBe('rival_best');
  });

  it('SYMMETRY — identical attributes get identical copy regardless of brand', () => {
    // The sharpest neutrality invariant. Two products differing ONLY in
    // isAForce must produce the same headline, command and verdict.
    const base = { hydrationSpeed: 95, electrolytes: 92, sugar: 6, absorptionRate: 93, recoveryEfficiency: 94 };
    const af = known({ id: 'sym_af', name: 'Sym', brand: 'B', isAForce: true, ...base });
    const nonAf = known({ id: 'sym_x', name: 'Sym', brand: 'B', isAForce: false, ...base });

    const fitAf = computeComparison({ inputs: INPUTS, catalog: [af] }).results[0]!;
    const fitX = computeComparison({ inputs: INPUTS, catalog: [nonAf] }).results[0]!;
    expect(fitAf.fitScore).toBe(fitX.fitScore);
    expect(fitAf.verdict).toBe(fitX.verdict);

    const recAf = buildRecommendation(scannedFrom(af), INPUTS, fitAf, undefined);
    const recX = buildRecommendation(scannedFrom(nonAf), INPUTS, fitX, undefined);
    expect(recAf.headline).toBe(recX.headline);
    expect(recAf.command).toBe(recX.command);
    expect(recAf.shouldLog).toBe(recX.shouldLog);
  });

  it('NO CHANGE NEEDED is a real outcome when nothing beats what was scanned', () => {
    const strong = known({ id: 'strong', hydrationSpeed: 96, electrolytes: 95, sugar: 4, absorptionRate: 95, recoveryEfficiency: 96 });
    const selfFit = computeComparison({ inputs: INPUTS, catalog: [strong] }).results[0]!;
    const rec = buildRecommendation(scannedFrom(strong), INPUTS, selfFit, undefined);
    expect(rec.alternativeProductId).toBeUndefined();
    expect(rec.command).not.toMatch(/switch to/i);
  });

  it('WATER can win — it is never automatically outranked', () => {
    // Plain water must remain capable of being the best available option.
    const water = productById('water');
    const sugary = known({ id: 'sugary', hydrationSpeed: 30, electrolytes: 5, sugar: 98, absorptionRate: 30, recoveryEfficiency: 25 });
    const { results } = computeComparison({ inputs: INPUTS, catalog: [water, sugary] });
    expect(results[0]!.product.id).toBe('water');
  });
});

describe('D6 — brand ownership moves no member-facing number', () => {
  it('the hydration impact score is identical for otherwise-equivalent products', async () => {
    // The second brand gate, in a different layer. `isAForce` used to add 0.15
    // to `support` — worth up to ~10.5 points on the member-visible 0-100
    // impact score, with leverage that GREW as member need grew (the amplifier
    // is driven by body weight, sex, activity and heat). Flag-dark in
    // production, but decision authority nonetheless.
    const { computeHydrationImpact } = await import('../../utils/impact/hydrationImpact');
    const product = {
      hydrationSpeed: 88,
      electrolyteDensity: 82,
      sugarLevel: 12,
      stimulantLevel: 0,
      isWater: false,
    };
    const profile = { bodyWeightLbs: 180, biologicalSex: 'male' as const, activityLevel: 0.6 };
    const state = 'RECOVERING' as const;
    const environment = { heat01: 0.5, humidity01: 0.5, tempC: 24 };

    const asAForce = computeHydrationImpact({ product: { ...product, isAForce: true }, profile, state, environment });
    const asRival = computeHydrationImpact({ product: { ...product, isAForce: false }, profile, state, environment });

    expect(asAForce.score).toBe(asRival.score);
    expect(asAForce.level).toBe(asRival.level);
    // …and brand is not a named DRIVER of the score either.
    expect(asAForce.drivers.map((d) => d.key)).not.toContain('aforce');
  });
});

describe('D6 — plain water is discoverable as plain water', () => {
  it('the query "water" resolves to canonical plain water, not a flavoured SKU', async () => {
    const { recognize } = await import('../productRecognitionService');
    const out = await recognize({ kind: 'manual', rawValue: 'water' });
    expect(out?.productId, 'typing "water" must not return a flavoured AForce SKU').toBe('water');
  });

  it('a specific flavoured query still resolves to that product', async () => {
    const { recognize } = await import('../productRecognitionService');
    const out = await recognize({ kind: 'manual', rawValue: 'watermelon' });
    expect(out?.productId).toBe('aforce_watermelon_surge');
  });
});
