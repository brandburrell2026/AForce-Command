import { describe, expect, it } from 'vitest';
import {
  countSkinIAEvidenceDecision,
  emptySkinIAEvidenceCounts,
  mergeSkinIAEvidenceCounts,
  type SkinIAEvidenceDecision,
} from '../skiniaEvidenceAccumulator';

const label = 'VISIBLE_REDNESS';
const decision = (overrides: Partial<SkinIAEvidenceDecision> = {}): SkinIAEvidenceDecision => ({
  observation: label,
  quality: 'ACCEPTED',
  reference: 'PRESENT',
  candidate: 'PRESENT',
  ...overrides,
});

describe('SkinIA aggregate evidence counts', () => {
  it('counts each confusion-matrix outcome without retaining a case', () => {
    const cases = [
      decision(),
      decision({ reference: 'ABSENT' }),
      decision({ candidate: 'ABSENT' }),
      decision({ reference: 'ABSENT', candidate: 'ABSENT' }),
    ];
    const counts = cases.reduce(countSkinIAEvidenceDecision, emptySkinIAEvidenceCounts(label));
    expect(counts).toEqual({
      observation: label,
      attempts: 4,
      truePositive: 1,
      falsePositive: 1,
      falseNegative: 1,
      trueNegative: 1,
      ambiguousReference: 0,
      qualityRejected: 0,
      abstained: 0,
    });
    expect(Object.isFrozen(counts)).toBe(true);
  });

  it('keeps rejected, ambiguous, and abstained cases outside the confusion matrix', () => {
    const cases = [
      decision({ quality: 'REJECTED', candidate: 'UNABLE_TO_DETERMINE' }),
      decision({ reference: 'AMBIGUOUS' }),
      decision({ candidate: 'UNABLE_TO_DETERMINE' }),
    ];
    const counts = cases.reduce(countSkinIAEvidenceDecision, emptySkinIAEvidenceCounts(label));
    expect(counts).toMatchObject({ attempts: 3, qualityRejected: 1, ambiguousReference: 1, abstained: 1 });
    expect(counts.truePositive + counts.falsePositive + counts.falseNegative + counts.trueNegative).toBe(0);
  });

  it('fails closed on unauthorized labels, mixed labels, or a finding after quality rejection', () => {
    expect(() => emptySkinIAEvidenceCounts('HYDRATION')).toThrow('Unsupported');
    const counts = emptySkinIAEvidenceCounts(label);
    expect(() => countSkinIAEvidenceDecision(counts, decision({ observation: 'VISIBLE_FLAKING' }))).toThrow('mismatch');
    expect(() => countSkinIAEvidenceDecision(counts, decision({ quality: 'REJECTED' }))).toThrow('must not produce');
    expect(() => countSkinIAEvidenceDecision(counts, decision({ quality: 'UNKNOWN' as 'ACCEPTED' }))).toThrow('quality');
    expect(() => countSkinIAEvidenceDecision(counts, decision({ reference: 'UNKNOWN' as 'ABSENT' }))).toThrow('reference');
    expect(() => countSkinIAEvidenceDecision(counts, decision({ candidate: 'UNKNOWN' as 'ABSENT' }))).toThrow('candidate');
  });

  it('retains only aggregate fields even if an unsafe caller adds identifying data', () => {
    const unsafe = { ...decision(), participantId: 'do-not-store', frameUri: 'do-not-store' };
    const counts = countSkinIAEvidenceDecision(emptySkinIAEvidenceCounts(label), unsafe);
    expect(JSON.stringify(counts)).not.toContain('do-not-store');
  });

  it('merges only valid aggregate blocks for the same approved label', () => {
    const first = countSkinIAEvidenceDecision(emptySkinIAEvidenceCounts(label), decision());
    const second = countSkinIAEvidenceDecision(emptySkinIAEvidenceCounts(label), decision({ reference: 'ABSENT' }));
    expect(mergeSkinIAEvidenceCounts(first, second)).toMatchObject({
      attempts: 2, truePositive: 1, falsePositive: 1,
    });
    expect(() => mergeSkinIAEvidenceCounts(first, emptySkinIAEvidenceCounts('VISIBLE_TEXTURE'))).toThrow('matching');
    expect(() => mergeSkinIAEvidenceCounts(first, { ...second, attempts: 5 })).toThrow('valid');
  });
});
