import { describe, expect, it } from 'vitest';
import type { SkinIAImageMetrics } from '../../modules/skinia-image-features';
import {
  deriveSkinIABaselineFreeQaProbes,
  deriveSkinIAExperimentalCandidates,
  SKINIA_QA_PROBE_REVISION,
} from '../skiniaImageAnalysis';
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

  it('rejects a malformed or non-finite feature vector instead of producing a QA candidate', () => {
    expect(deriveSkinIAExperimentalCandidates({ ...baseline, cheekRedness: Infinity }, baseline)).toEqual([]);
    expect(deriveSkinIAExperimentalCandidates(baseline, { ...baseline, surfaceShine: NaN })).toEqual([]);
    expect(deriveSkinIAExperimentalCandidates({ ...baseline, brightEdgeDensity: undefined as unknown as number }, baseline)).toEqual([]);
  });
});
