/**
 * HydroScan recommendation copy — AForce positioning.
 *
 * Locks the natural-recommend tone for the on-card verdict line:
 * - headlines read as system observations, never as "buy this"
 * - commands defer amount and cadence to the member's current command
 *   (re-plumb wave: the old standardized "12 oz / recheck in 20" pour
 *   was a second recommendation engine — see
 *   commandAuthorityContainment.test.ts)
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

describe('buildRecommendation — brand-neutral framing + command deference', () => {
  // CONSCIOUS REPIN — founder rulings D4 + D6 (2026-08-30). Four assertions in
  // this describe encoded the behaviour those rulings removed: a copy branch
  // reachable only when `scanned.isAForce`, an AForce-only alternative pool,
  // and the retired physiological claim. They are re-pinned to the corrected
  // behaviour; every guarantee they legitimately protected (command deference,
  // no dose or clock, water-first, no aggressive sell) is retained below and
  // in the unchanged cases.

  it('a strong scanned product is framed as supporting the state — regardless of brand', () => {
    const selfFit = makeFit({
      product: bestAforce.product,
      fitScore: 92,
      verdict: 'optimal',
      whyItFits: 'Optimal for current state.',
    });
    // D6: the framing follows the VERDICT, never `isAForce`. "active system
    // fuel" was reachable only by AForce products; a rival holding an
    // identical optimal verdict could not receive it.
    const rec = buildRecommendation(scannedAForceStick, baseInputs, selfFit, undefined);
    expect(rec.headline).toContain('supports your Balanced state');
    expect(rec.command).toBe('Pair with water — your current command sets the amount.');
    expect(rec.shouldLog).toBe(true);
    expect(rec.noChangeNeeded).toBe(true);
  });

  it('a genuinely stronger alternative is named without a physiological claim', () => {
    const selfFit = makeFit({ fitScore: 60 });
    const rec = buildRecommendation(scannedGatorade, baseInputs, selfFit, bestAforce);
    // D4: the retired claim is replaced by a statement about the COMPARISON.
    expect(rec.headline).toBe('This product ranked lower under the current comparison criteria.');
    expect(rec.command).toBe('Consider AForce Stick — water first.');
    expect(rec.alternativeProductId).toBe('aforce_stick');
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
    expect(rec.command).toBe('Pair with water — your current command sets the amount.');
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
    expect(rec.command).toBe('Pair with water — your current command sets the amount.');
    expect(rec.shouldLog).toBe(true);
  });

  it('a marginal alternative does NOT trigger a switch — the margin still holds', () => {
    // +2 is inside the +4 margin, so nothing is nominated and the honest
    // outcome is that no change is needed (D6).
    const selfFit = makeFit({ fitScore: 86, verdict: 'suboptimal' });
    const closeAlternative = makeFit({
      product: bestAforce.product,
      fitScore: 88,
      verdict: 'suboptimal',
    });
    const rec = buildRecommendation(scannedGatorade, baseInputs, selfFit, closeAlternative);
    expect(rec.headline).toBe('This product ranked lower under the current comparison criteria.');
    expect(rec.command).toBe('Water first — your current command sets the amount.');
    expect(rec.alternativeProductId).toBeUndefined();
    expect(rec.noChangeNeeded).toBe(true);
    expect(rec.shouldLog).toBe(false);
  });

  it('ranked low with nothing better on file — water first, no claim, no product pushed', () => {
    const selfFit = makeFit({ fitScore: 40, verdict: 'suboptimal' });
    const rec = buildRecommendation(scannedGatorade, baseInputs, selfFit, undefined);
    expect(rec.headline).toBe('This product ranked lower under the current comparison criteria.');
    expect(rec.command).toBe('Water first — your current command sets the amount.');
    expect(rec.alternativeProductId).toBeUndefined();
  });

  it('NO aggressive-sell verbs, stale pours, or dose/clock residue in any case', () => {
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
      expect(rec.command).not.toMatch(/12 oz/);
      expect(rec.command).not.toMatch(/Recheck in \d/);
    }
  });
});
