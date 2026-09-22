import { describe, expect, it, vi } from 'vitest';

vi.mock('expo', () => ({ requireOptionalNativeModule: () => null }));

import { parseSkinIAImageFeatureResult } from '../../modules/skinia-image-features';

const metrics = {
  cheekBrightness: 110,
  cheekRedness: 0.08,
  surfaceShine: 0.04,
  cheekTexture: 12,
  brightEdgeDensity: 0.03,
  clippingFraction: 0.01,
};

describe('SkinIA native feature bridge', () => {
  it('allows only finite derived metrics and strips extra native fields', () => {
    expect(parseSkinIAImageFeatureResult({ state: 'PASS', metrics: { ...metrics, pixels: [1, 2, 3] } })).toEqual({
      state: 'PASS', metrics,
    });
    expect(parseSkinIAImageFeatureResult({ state: 'PASS', metrics: { ...metrics, cheekRedness: Infinity } })).toEqual({ state: 'UNAVAILABLE' });
    expect(parseSkinIAImageFeatureResult({ state: 'PASS', metrics: { ...metrics, cheekRedness: '0.1' } })).toEqual({ state: 'UNAVAILABLE' });
  });

  it('fails closed on unknown native states', () => {
    expect(parseSkinIAImageFeatureResult({ state: 'NO_FACE' })).toEqual({ state: 'NO_FACE' });
    expect(parseSkinIAImageFeatureResult({ state: 'PASS', data: 'not metrics' })).toEqual({ state: 'UNAVAILABLE' });
    expect(parseSkinIAImageFeatureResult({ state: 'new state' })).toEqual({ state: 'UNAVAILABLE' });
  });
});
