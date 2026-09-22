import { describe, expect, it } from 'vitest';
import { skinIAMemberNonResultCopy, skinIAMemberObservationCopy } from '../skiniaMemberCopy';

describe('SkinIA approved member copy', () => {
  it('uses only approved visible-observation and non-result language', () => {
    expect(skinIAMemberObservationCopy({ kind: 'OBSERVATION', observation: 'VISIBLE_DRYNESS', confidence: 'MODERATE', capturedAt: '2026-09-16T00:00:00Z', comparison: 'PERSONAL_BASELINE' })).toBe('Your skin appears drier than your recent baseline.');
    expect(skinIAMemberNonResultCopy()).toBe('We couldn’t make a reliable observation from today’s image.');
  });
});
