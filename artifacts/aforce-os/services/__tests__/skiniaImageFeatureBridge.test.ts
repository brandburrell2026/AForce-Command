import { describe, expect, it, vi } from 'vitest';

vi.mock('expo', () => ({ requireOptionalNativeModule: () => null }));

import { parseSkinIAImageFeatureResult, SKINIA_QA_SAMPLE_ZONES_REVISION } from '../../modules/skinia-image-features';

const metrics = {
  cheekBrightness: 110,
  cheekRedness: 0.08,
  surfaceShine: 0.04,
  cheekTexture: 12,
  brightEdgeDensity: 0.03,
  clippingFraction: 0.01,
};

const zone = {
  sampleCount: 64, brightness: 110, redColorIndex: 0.08,
  brightPixelFraction: 0.04, edgeMagnitude: 12,
  brightEdgeFraction: 0.03, clippingFraction: 0.01,
};
const qaSampleZones = {
  revision: SKINIA_QA_SAMPLE_ZONES_REVISION,
  forehead: zone, leftCheek: zone, rightCheek: zone, nose: zone, chin: zone,
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
    expect(parseSkinIAImageFeatureResult({ state: 'REGIONS_UNUSABLE' })).toEqual({ state: 'REGIONS_UNUSABLE' });
    expect(parseSkinIAImageFeatureResult({ state: 'PASS', data: 'not metrics' })).toEqual({ state: 'UNAVAILABLE' });
    expect(parseSkinIAImageFeatureResult({ state: 'new state' })).toEqual({ state: 'UNAVAILABLE' });
  });

  it('accepts only versioned, bounded numeric QA sample zones without pixels or boxes', () => {
    const result = parseSkinIAImageFeatureResult({
      state: 'PASS', metrics,
      qaSampleZones: { ...qaSampleZones, forehead: { ...zone, pixels: [1, 2, 3] }, faceBox: [0, 1] },
    });
    expect(result).toEqual({ state: 'PASS', metrics, qaSampleZones });
    expect(JSON.stringify(result)).not.toContain('pixels');
    expect(JSON.stringify(result)).not.toContain('faceBox');
    if (result.state !== 'PASS') throw new Error('Expected accepted QA zones');
    expect(Object.isFrozen(result.qaSampleZones)).toBe(true);
    expect(Object.isFrozen(result.qaSampleZones?.forehead)).toBe(true);
  });

  it('rejects malformed QA zones rather than passing partial or unknown revisions', () => {
    expect(parseSkinIAImageFeatureResult({ state: 'PASS', metrics, qaSampleZones: { ...qaSampleZones, revision: 'UNKNOWN' } })).toEqual({ state: 'UNAVAILABLE' });
    expect(parseSkinIAImageFeatureResult({ state: 'PASS', metrics, qaSampleZones: { ...qaSampleZones, chin: { ...zone, sampleCount: 0 } } })).toEqual({ state: 'UNAVAILABLE' });
    expect(parseSkinIAImageFeatureResult({ state: 'PASS', metrics, qaSampleZones: { ...qaSampleZones, nose: { ...zone, brightPixelFraction: Infinity } } })).toEqual({ state: 'UNAVAILABLE' });
    expect(parseSkinIAImageFeatureResult({ state: 'PASS', metrics, qaSampleZones: { ...qaSampleZones, leftCheek: null } })).toEqual({ state: 'UNAVAILABLE' });
  });
});
