import { describe, expect, it } from 'vitest';
import type { SkinIAImageMetrics } from '../../modules/skinia-image-features';
import {
  deriveSkinIABaselineFreeQaProbes,
  SKINIA_QA_PROBE_REVISION,
} from '../skiniaImageAnalysis';

const baseline: SkinIAImageMetrics = Object.freeze({
  cheekBrightness: 125,
  cheekRedness: 0.10,
  surfaceShine: 0.04,
  cheekTexture: 10,
  brightEdgeDensity: 0.04,
  clippingFraction: 0.01,
});

describe('SkinIA experimental on-device analysis', () => {
  it('exposes versioned baseline-free numeric probes without making a label or confidence decision', () => {
    const probes = deriveSkinIABaselineFreeQaProbes({ state: 'PASS', metrics: baseline });
    expect(probes).toEqual({
      revision: SKINIA_QA_PROBE_REVISION,
      status: 'UNVALIDATED_QA_PROBES',
      redColorIndex: 0.10,
      brightPixelFraction: 0.04,
      brightEdgeFraction: 0.04,
    });
    expect(Object.isFrozen(probes)).toBe(true);
    expect(probes).not.toHaveProperty('observation');
    expect(probes).not.toHaveProperty('confidence');
  });

  it('fails closed on non-finite or out-of-range native metrics', () => {
    expect(deriveSkinIABaselineFreeQaProbes({ state: 'NO_FACE' })).toBeNull();
    expect(deriveSkinIABaselineFreeQaProbes({ state: 'PASS', metrics: { ...baseline, cheekRedness: Infinity } })).toBeNull();
    expect(deriveSkinIABaselineFreeQaProbes({ state: 'PASS', metrics: { ...baseline, surfaceShine: -0.1 } })).toBeNull();
    expect(deriveSkinIABaselineFreeQaProbes({ state: 'PASS', metrics: { ...baseline, brightEdgeDensity: 1.1 } })).toBeNull();
    expect(deriveSkinIABaselineFreeQaProbes({ state: 'PASS', metrics: { ...baseline, cheekBrightness: 256 } })).toBeNull();
  });

  it('does not turn a shifted probe into an appearance finding', () => {
    const probes = deriveSkinIABaselineFreeQaProbes({ state: 'PASS', metrics: {
      ...baseline, cheekRedness: 0.14, surfaceShine: 0.01, brightEdgeDensity: 0.08,
    } });
    expect(probes).toMatchObject({ redColorIndex: 0.14, brightPixelFraction: 0.01, brightEdgeFraction: 0.08 });
    expect(probes).not.toHaveProperty('observation');
    expect(probes).not.toHaveProperty('confidence');
  });
});
