import { describe, expect, it } from 'vitest';
import { SKINIA_MEMBER_OBSERVATIONS_ADMITTED, resolveSkinIAMemberResult } from '../skiniaMemberResultGate';
import { SKINIA_PHASE1_NON_RESULT } from '../skiniaPhase1Policy';
import type { SkinIAObservationOutcome } from '../skiniaObservationPipeline';

const admittedLookingOutcome: SkinIAObservationOutcome = {
  kind: 'OBSERVATION',
  observation: 'VISIBLE_REDNESS',
  confidence: 'HIGH',
  capturedAt: '2026-09-22T00:00:00.000Z',
  comparison: 'PERSONAL_BASELINE',
};

describe('SkinIA fail-closed member result gate', () => {
  it('keeps live observations disabled while §25.3 admission is empty', () => {
    expect(SKINIA_MEMBER_OBSERVATIONS_ADMITTED).toBe(false);
    const result = resolveSkinIAMemberResult(admittedLookingOutcome);
    expect(result).toEqual({
      kind: 'NON_RESULT', message: SKINIA_PHASE1_NON_RESULT,
    });
    expect(JSON.stringify(result)).not.toContain('VISIBLE_REDNESS');
  });

  it('uses the same approved non-result for no candidate or a rejected candidate', () => {
    expect(resolveSkinIAMemberResult(null)).toEqual({ kind: 'NON_RESULT', message: SKINIA_PHASE1_NON_RESULT });
    expect(resolveSkinIAMemberResult({
      kind: 'NON_RESULT', message: SKINIA_PHASE1_NON_RESULT, reason: 'INSUFFICIENT_CONFIDENCE',
    })).toEqual({ kind: 'NON_RESULT', message: SKINIA_PHASE1_NON_RESULT });
  });
});
