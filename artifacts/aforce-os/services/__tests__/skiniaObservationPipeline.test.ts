import { describe, expect, it } from 'vitest';
import { SKINIA_PHASE1_NON_RESULT } from '../skiniaPhase1Policy';
import { resolveSkinIAInternalObservation } from '../skiniaObservationPipeline';

const candidate = { observation: 'VISIBLE_REDNESS', confidence: 'MODERATE' as const, capturedAt: '2026-09-16T00:00:00.000Z' };

describe('SkinIA internal observation pipeline contract', () => {
  it('admits only a permitted, baseline-relative, non-numeric-confidence observation', () => {
    expect(resolveSkinIAInternalObservation(candidate, true)).toEqual({
      kind: 'OBSERVATION', observation: 'VISIBLE_REDNESS', confidence: 'MODERATE', capturedAt: candidate.capturedAt, comparison: 'PERSONAL_BASELINE',
    });
  });

  it.each([
    [{ ...candidate, observation: 'HYDRATION_APPEARANCE' }, true, 'UNSUPPORTED_OBSERVATION'],
    [{ ...candidate, confidence: 'LOW' as const }, true, 'INSUFFICIENT_CONFIDENCE'],
    [{ ...candidate, confidence: 'UNABLE_TO_DETERMINE' as const }, true, 'INSUFFICIENT_CONFIDENCE'],
    [candidate, false, 'NO_COMPARABLE_BASELINE'],
  ] as const)('fails closed for an unapproved or unsupported result', (input, baseline, reason) => {
    expect(resolveSkinIAInternalObservation(input, baseline)).toEqual({ kind: 'NON_RESULT', message: SKINIA_PHASE1_NON_RESULT, reason });
  });
});
