import { describe, it, expect } from 'vitest';

import { unknownProductImpact } from '../impact/unknownImpact';
import type { UnknownProductType } from '../../types/scan';

describe('unknownProductImpact', () => {
  it('keeps water Water-First positive (HIGH_SUPPORT + GOOD_TIMING)', () => {
    expect(unknownProductImpact('water')).toEqual({
      impactLevel: 'HIGH_SUPPORT',
      timingLevel: 'GOOD_TIMING',
    });
  });

  it('flags energy products as a load and hydrate-first', () => {
    const r = unknownProductImpact('energy');
    expect(r.impactLevel).toBe('MODERATE_IMPACT');
    expect(r.timingLevel).toBe('HYDRATE_FIRST');
  });

  it('treats protein / supplement / other as neutral, good timing', () => {
    for (const t of ['protein', 'supplement', 'other'] as UnknownProductType[]) {
      expect(unknownProductImpact(t)).toEqual({
        impactLevel: 'NEUTRAL',
        timingLevel: 'GOOD_TIMING',
      });
    }
  });

  it('never returns HIGH_IMPACT for a manual category (advisory, conservative)', () => {
    const all: UnknownProductType[] = ['water', 'protein', 'energy', 'supplement', 'other'];
    for (const t of all) {
      expect(unknownProductImpact(t).impactLevel).not.toBe('HIGH_IMPACT');
    }
  });
});
