import { describe, expect, it } from 'vitest';
import {
  ADVANCED_VISUAL_INTELLIGENCE_NAME,
  SKINIA_MEMBER_LABEL,
  UNKNOWN_VISUAL_CHECK_RESULT,
  unavailableVisualCheckResult,
} from '../advancedVisualIntelligence';

describe('Advanced Visual Intelligence™ containment contract', () => {
  it('uses the approved canonical and member-facing names', () => {
    expect(ADVANCED_VISUAL_INTELLIGENCE_NAME).toBe('Advanced Visual Intelligence™');
    expect(SKINIA_MEMBER_LABEL).toBe('SkinIA Visual Check');
  });

  it('can only return an explicit unknown result', () => {
    expect(unavailableVisualCheckResult()).toEqual(UNKNOWN_VISUAL_CHECK_RESULT);
    expect(UNKNOWN_VISUAL_CHECK_RESULT).toEqual({ status: 'UNKNOWN', reason: 'FEATURE_NOT_APPROVED' });
  });
});
