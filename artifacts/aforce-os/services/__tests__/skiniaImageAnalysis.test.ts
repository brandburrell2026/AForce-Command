import { describe, expect, it } from 'vitest';
import type { SkinIAImageMetrics } from '../../modules/skinia-image-features';
import { deriveSkinIAExperimentalCandidates } from '../skiniaImageAnalysis';
import { resolveSkinIAInternalObservation } from '../skiniaObservationPipeline';

const baseline: SkinIAImageMetrics = Object.freeze({
  cheekBrightness: 125,
  cheekRedness: 0.10,
  surfaceShine: 0.04,
  cheekTexture: 10,
  brightEdgeDensity: 0.04,
  clippingFraction: 0.01,
});

describe('SkinIA experimental on-device analysis', () => {
  it('does not invent a finding from a first capture without a comparison', () => {
    expect(deriveSkinIAExperimentalCandidates(baseline, null)).toEqual([]);
  });

  it('generates only approved, low-confidence comparison candidates from derived metrics', () => {
    const current = Object.freeze({
      ...baseline,
      cheekRedness: 0.14,
      surfaceShine: 0.01,
      cheekTexture: 14,
      brightEdgeDensity: 0.08,
    });
    const candidates = deriveSkinIAExperimentalCandidates(current, baseline);
    expect(candidates.map((candidate) => candidate.observation)).toEqual([
      'VISIBLE_REDNESS', 'VISIBLE_TEXTURE', 'VISIBLE_FLAKING', 'VISIBLE_DRYNESS',
    ]);
    for (const candidate of candidates) {
      expect(candidate.confidence).toBe('LOW');
      expect(resolveSkinIAInternalObservation({ ...candidate, capturedAt: '2026-09-22T00:00:00Z' }, true)).toMatchObject({
        kind: 'NON_RESULT', reason: 'INSUFFICIENT_CONFIDENCE',
      });
    }
  });

  it('does not emit a candidate when metrics remain near baseline', () => {
    expect(deriveSkinIAExperimentalCandidates({ ...baseline, cheekRedness: 0.102, cheekTexture: 10.1 }, baseline)).toEqual([]);
  });
});
