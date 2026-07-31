/**
 * HydroScan recommendation copy — AForce positioning.
 *
 * Locks the natural-recommend tone for the on-card verdict line:
 * - headlines read as system observations, never as "buy this"
 * - the recommended pour is standardized at 12 oz water
 * - AForce is positioned as system fuel / performance support
 *
 * Targets the pure `buildRecommendation()` seam so we don't depend on
 * the full app-state machine; the four cases map 1:1 to the four
 * branches inside the builder.
 */

import { describe, it, expect } from 'vitest';
import { buildRecommendation } from '../hydrationScanService';
import type { CompareInputs, CompareResult } from '../../types/comparison';

const baseInputs: CompareInputs = {
  state: 'BALANCED',
  score: 70,
  protocol: 'maintenance',
  goal: 'performance',
  heatLoad: 0.3,
  sweatRate: 0.8,
  symptomCount: 0,
  hoursSinceLastIntake: 1,
};

function makeFit(over: Partial<CompareResult>): CompareResult {
  return {
    product: {
      id: 'gatorade',
      name: 'Gatorade',
      brand: 'Gatorade',
      category: 'sports_drink',
      hydrationSpeed: 60,
      electrolytes: 30,
      sugar: 80,
      absorptionRate: 60,
      recoveryEfficiency: 40,
      isAForce: false,
      compatibleProtocols: ['maintenance'],
      factualNote: 'Test fixture',
    },
    fitScore: 55,
    verdict: 'suboptimal',
    axes: { hydration: 60, electrolytes: 30, recovery: 40, sugarLoad: 80 },
    whyItFits: 'High sugar load with limited mineral profile.',
    ...over,
  } as CompareResult;
}

const scannedGatorade = {
  productId: 'gatorade',
  productName: 'Gatorade',
  brand: 'Gatorade',
  category: 'sports_drink',
  hydrationSpeed: 60,
  electrolyteDensity: 30,
  sugarLevel: 80,
  stimulantLevel: 0,
  recoveryFit: 40,
  performanceFit: 60,
  isAForce: false,
} as const;

const scannedAForceStick = {
  productId: 'aforce_stick',
  productName: 'AForce Stick',
  brand: 'AForce',
  category: 'electrolyte_mix',
  hydrationSpeed: 90,
  electrolyteDensity: 95,
  sugarLevel: 0,
  stimulantLevel: 0,
  recoveryFit: 90,
  performanceFit: 90,
  isAForce: true,
} as const;

const bestAforce = makeFit({
  product: {
    id: 'aforce_stick',
    name: 'AForce Stick',
    brand: 'AForce',
    category: 'electrolyte_mix',
    hydrationSpeed: 90,
    electrolytes: 95,
    sugar: 0,
    absorptionRate: 90,
    recoveryEfficiency: 90,
    isAForce: true,
    compatibleProtocols: ['maintenance', 'recovery', 'depletion_correction', 'heat_stress', 'morning_reset'],
    factualNote: 'Test fixture',
  },
  fitScore: 88,
  verdict: 'optimal',
  whyItFits: 'Dense mineral profile, fast absorption.',
});

describe('buildRecommendation — AForce positioning + 12 oz pour', () => {
  it('CASE 1 (scanned AForce + optimal) frames product as active system fuel', () => {
    const selfFit = makeFit({
      product: bestAforce.product,
      fitScore: 92,
      verdict: 'optimal',
      whyItFits: 'Optimal for current state.',
    });
    const rec = buildRecommendation(scannedAForceStick, baseInputs, selfFit, bestAforce);
    expect(rec.headline).toContain('active system fuel');
    expect(rec.headline).toContain('Balanced');
    expect(rec.command).toBe('Pair with 12 oz water. Recheck in 20 minutes.');
    expect(rec.shouldLog).toBe(true);
  });

  it('CASE 2 (AForce alternative outperforms scanned) — natural observation, no efficacy tail', () => {
    const selfFit = makeFit({ fitScore: 60 });
    const rec = buildRecommendation(scannedGatorade, baseInputs, selfFit, bestAforce);
    expect(rec.headline).toBe('Current intake may increase hydration demand.');
    expect(rec.command).toBe(
      'Recommended: 12 oz water + AForce Stick.',
    );
    expect(rec.aforceEquivalentId).toBe('aforce_stick');
    expect(rec.shouldLog).toBe(false);
  });

  it('CASE 3 (scanned acceptable, no clearly stronger AForce uplift) frames as "supports your state"', () => {
    const selfFit = makeFit({ fitScore: 86, verdict: 'strong' });
    // bestAforce is only +2 better → not stronger by the +4 threshold.
    const closeAforce = makeFit({
      product: bestAforce.product,
      fitScore: 88,
      verdict: 'strong',
    });
    const rec = buildRecommendation(scannedGatorade, baseInputs, selfFit, closeAforce);
    expect(rec.headline).toContain('supports your Balanced state');
    expect(rec.command).toBe('Pair with 12 oz water. Recheck in 20 minutes.');
    expect(rec.shouldLog).toBe(true);
  });

  it('CASE 3 with "acceptable" verdict — supportive framing, not the sub-par observation copy', () => {
    const selfFit = makeFit({ fitScore: 70, verdict: 'acceptable' });
    const closeAforce = makeFit({
      product: bestAforce.product,
      fitScore: 72,
      verdict: 'acceptable',
    });
    const rec = buildRecommendation(scannedGatorade, baseInputs, selfFit, closeAforce);
    expect(rec.headline).toContain('supports your Balanced state');
    expect(rec.headline).not.toMatch(/may increase hydration demand/);
    expect(rec.command).toBe('Pair with 12 oz water. Recheck in 20 minutes.');
    expect(rec.shouldLog).toBe(true);
  });

  it('CASE 4a (sub-par scanned, marginal AForce uplift available) — plain AForce recommendation', () => {
    // Sub-par selfFit (weak verdict), AForce only +2 better → skips
    // CASE 2 (+4 threshold) and CASE 3 (verdict not strong/optimal),
    // falls through to CASE 4 with bestAforce present.
    const selfFit = makeFit({ fitScore: 86, verdict: 'suboptimal' });
    const closeAforce = makeFit({
      product: bestAforce.product,
      fitScore: 88,
      verdict: 'suboptimal',
    });
    const rec = buildRecommendation(scannedGatorade, baseInputs, selfFit, closeAforce);
    expect(rec.headline).toBe('Current intake may increase hydration demand.');
    expect(rec.command).toBe(
      'Recommended: 12 oz water + AForce Stick.',
    );
    expect(rec.aforceEquivalentId).toBe('aforce_stick');
    expect(rec.shouldLog).toBe(false);
  });

  it('CASE 4b (sub-par scanned, no AForce uplift) — water-only fallback', () => {
    const selfFit = makeFit({ fitScore: 40, verdict: 'suboptimal' });
    const rec = buildRecommendation(scannedGatorade, baseInputs, selfFit, undefined);
    expect(rec.headline).toBe('Current intake may increase hydration demand.');
    expect(rec.command).toBe('Recommended: 12 oz water. Recheck in 20 minutes.');
    expect(rec.aforceEquivalentId).toBeUndefined();
  });

  it('NO aggressive-sell verbs or stale 16-ounce pours in any case', () => {
    const cases = [
      buildRecommendation(scannedAForceStick, baseInputs, makeFit({ product: bestAforce.product, fitScore: 92, verdict: 'optimal' }), bestAforce),
      buildRecommendation(scannedGatorade, baseInputs, makeFit({ fitScore: 60 }), bestAforce),
      buildRecommendation(scannedGatorade, baseInputs, makeFit({ fitScore: 86, verdict: 'strong' }), makeFit({ product: bestAforce.product, fitScore: 88, verdict: 'strong' })),
      buildRecommendation(scannedGatorade, baseInputs, makeFit({ fitScore: 40 }), bestAforce),
      buildRecommendation(scannedGatorade, baseInputs, makeFit({ fitScore: 40 }), undefined),
    ];
    for (const rec of cases) {
      expect(rec.headline).not.toMatch(/\bnot optimal\b/);
      expect(rec.headline).not.toMatch(/\bstronger fit\b/);
      expect(rec.command).not.toMatch(/^Take 1\b/);
      expect(rec.command).not.toMatch(/16 ounces/);
    }
  });
});
