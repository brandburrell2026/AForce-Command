/**
 * Beverage comparison engine tests — pin the rubric so a future tweak
 * can't silently flip a winner verdict.
 */

import { describe, expect, it } from 'vitest';

import {
  AFORCE_PROFILE,
  COMPETITORS,
  competitorIdForScannedProduct,
} from '../../data/beverageCompetitors';
import {
  compareBeverages,
  scoreBeverage,
} from '../beverageComparisonEngine';

describe('beverageComparisonEngine', () => {
  it('scores AForce above 75 (it should — it is the system being sold)', () => {
    const card = scoreBeverage(AFORCE_PROFILE);
    expect(card.total).toBeGreaterThan(75);
    expect(card.metrics).toHaveLength(5);
  });

  it('AForce beats every legacy sugar drink in the catalog', () => {
    const sugarDrinks = COMPETITORS.filter((c) =>
      ['gatorade', 'powerade', 'bodyarmor', 'g2'].includes(c.id),
    );
    expect(sugarDrinks.length).toBeGreaterThan(0);
    for (const c of sugarDrinks) {
      const r = compareBeverages(AFORCE_PROFILE, c);
      expect(r.winner).toBe('aforce');
      expect(r.spread).toBeGreaterThan(0);
    }
  });

  it('flags artificial inputs in the clean-label metric', () => {
    const propel = COMPETITORS.find((c) => c.id === 'propel')!;
    const card = scoreBeverage(propel);
    const clean = card.metrics.find((m) => m.key === 'clean')!;
    // Propel uses artificial sweeteners (acesulfame K + sucralose) so it
    // should NOT score 100 on clean label.
    expect(clean.score).toBeLessThan(100);
  });

  it('rewards alkaline pH', () => {
    const alkaline = scoreBeverage(AFORCE_PROFILE).metrics.find((m) => m.key === 'alkaline')!;
    const acidic = scoreBeverage(COMPETITORS.find((c) => c.id === 'gatorade')!)
      .metrics.find((m) => m.key === 'alkaline')!;
    expect(alkaline.score).toBeGreaterThan(acidic.score);
  });

  it('per-metric winner array always covers all 5 metrics', () => {
    const r = compareBeverages(AFORCE_PROFILE, COMPETITORS[0]);
    expect(Object.keys(r.metricWinners).sort()).toEqual(
      ['alkaline', 'clean', 'electrolytes', 'functional', 'sugar'],
    );
  });

  describe('competitorIdForScannedProduct (scan -> compare deep link)', () => {
    it('maps known scanned competitor ids to their comparison profile', () => {
      expect(competitorIdForScannedProduct('gatorade')).toBe('gatorade');
      expect(competitorIdForScannedProduct('lmnt')).toBe('lmnt');
      expect(competitorIdForScannedProduct('liquid_iv')).toBe('liquid_iv');
      expect(competitorIdForScannedProduct('pedialyte')).toBe('pedialyte');
      expect(competitorIdForScannedProduct('prime')).toBe('prime');
    });

    it('returns null for AForce SKUs (no self-compare)', () => {
      expect(competitorIdForScannedProduct('aforce_stick')).toBeNull();
      expect(competitorIdForScannedProduct('aforce_rtd')).toBeNull();
      expect(competitorIdForScannedProduct('aforce_berry_blast')).toBeNull();
    });

    it('returns undefined for unknown brands so the CTA stays hidden', () => {
      expect(competitorIdForScannedProduct('water')).toBeUndefined();
      expect(competitorIdForScannedProduct('mystery_juice')).toBeUndefined();
    });
  });
});
