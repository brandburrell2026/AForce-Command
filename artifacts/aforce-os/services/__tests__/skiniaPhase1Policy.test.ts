import { describe, expect, it } from 'vitest';
import {
  SKINIA_PHASE1_CONFIDENCE_BANDS,
  SKINIA_PHASE1_NON_RESULT,
  SKINIA_PHASE1_OBSERVATIONS,
  SKINIA_PHASE1_RAW_IMAGE_POLICY,
  SKINIA_PHASE1_RELEASE_SCOPE,
  isSkinIAPhase1Observation,
} from '../skiniaPhase1Policy';

describe('SkinIA Phase 1 internal policy lock', () => {
  it('admits only the five approved visible observations', () => {
    expect(SKINIA_PHASE1_OBSERVATIONS).toEqual([
      'VISIBLE_DRYNESS', 'VISIBLE_FLAKING', 'VISIBLE_REDNESS', 'VISIBLE_SURFACE_SHINE', 'VISIBLE_TEXTURE',
    ]);
    expect(isSkinIAPhase1Observation('VISIBLE_REDNESS')).toBe(true);
    for (const prohibited of ['HYDRATION_APPEARANCE', 'VISIBLE_BRIGHTNESS', 'UNDER_EYE_FATIGUE', 'SKIN_AGE']) {
      expect(isSkinIAPhase1Observation(prohibited)).toBe(false);
    }
  });

  it('locks confidence, retention, release scope, and non-result wording', () => {
    expect(SKINIA_PHASE1_CONFIDENCE_BANDS).toEqual(['HIGH', 'MODERATE', 'LOW', 'UNABLE_TO_DETERMINE']);
    expect(SKINIA_PHASE1_RAW_IMAGE_POLICY).toBe('EPHEMERAL_ONLY_NEVER_PERSIST');
    expect(SKINIA_PHASE1_RELEASE_SCOPE).toBe('INTERNAL_TESTFLIGHT_ONLY');
    expect(SKINIA_PHASE1_NON_RESULT).toBe('Unable to make a reliable observation.');
  });
});
