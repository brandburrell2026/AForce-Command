import { describe, expect, it } from 'vitest';
import {
  countSkinIAEvidenceDecision,
  emptySkinIAEvidenceCounts,
  mergeSkinIAEvidenceCounts,
  type SkinIAEvidenceDecision,
  type SkinIAEvidenceScope,
} from '../skiniaEvidenceAccumulator';

const label = 'VISIBLE_REDNESS';
const scope: SkinIAEvidenceScope = Object.freeze({
  buildId: 'test-build-1',
  methodRevision: 'method-v0.1',
  rubricRevision: 'rubric-v0.2',
  supportCellId: 'iphone17pro-diffuse-indoor',
});
type DeterminateDecision = Extract<SkinIAEvidenceDecision, { gate: 'DETERMINATE_REFERENCE' }>;
const decision = (overrides: Partial<DeterminateDecision> = {}): DeterminateDecision => ({
  observation: label,
  scope,
  gate: 'DETERMINATE_REFERENCE',
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
    const counts = cases.reduce(countSkinIAEvidenceDecision, emptySkinIAEvidenceCounts(label, scope));
    expect(counts).toEqual({
      observation: label,
      scope,
      attempts: 4,
      truePositive: 1,
      falsePositive: 1,
      falseNegative: 1,
      trueNegative: 1,
      ambiguousReference: 0,
      qualityRejected: 0,
      baselineNotComparable: 0,
      abstained: 0,
    });
    expect(Object.isFrozen(counts)).toBe(true);
  });

  it('keeps rejected, non-comparable, ambiguous, and abstained cases separate from the confusion matrix', () => {
    const cases: SkinIAEvidenceDecision[] = [
      { observation: label, scope, gate: 'QUALITY_REJECTED' },
      { observation: label, scope, gate: 'BASELINE_NOT_COMPARABLE' },
      { observation: label, scope, gate: 'REFERENCE_AMBIGUOUS' },
      decision({ candidate: 'UNABLE_TO_DETERMINE' }),
    ];
    const counts = cases.reduce(countSkinIAEvidenceDecision, emptySkinIAEvidenceCounts(label, scope));
    expect(counts).toMatchObject({
      attempts: 4, qualityRejected: 1, baselineNotComparable: 1, ambiguousReference: 1, abstained: 1,
    });
    expect(counts.truePositive + counts.falsePositive + counts.falseNegative + counts.trueNegative).toBe(0);
  });

  it('fails closed on unauthorized labels, mixed labels, or a finding after a non-scoring gate', () => {
    expect(() => emptySkinIAEvidenceCounts('HYDRATION', scope)).toThrow('Unsupported');
    expect(() => emptySkinIAEvidenceCounts(label, { ...scope, buildId: '' })).toThrow('scope');
    const counts = emptySkinIAEvidenceCounts(label, scope);
    expect(() => countSkinIAEvidenceDecision(counts, decision({ observation: 'VISIBLE_FLAKING' }))).toThrow('mismatch');
    expect(() => countSkinIAEvidenceDecision(counts, decision({
      scope: { ...scope, methodRevision: 'method-v0.2' },
    }))).toThrow('scope');
    expect(() => countSkinIAEvidenceDecision(counts, {
      observation: label, scope, gate: 'QUALITY_REJECTED', candidate: 'PRESENT',
    } as SkinIAEvidenceDecision)).toThrow('must not produce');
    expect(() => countSkinIAEvidenceDecision(counts, {
      observation: label, scope, gate: 'BASELINE_NOT_COMPARABLE', candidate: 'ABSENT',
    } as SkinIAEvidenceDecision)).toThrow('must not produce');
    expect(() => countSkinIAEvidenceDecision(counts, decision({ gate: 'UNKNOWN' as DeterminateDecision['gate'] }))).toThrow('gate');
    expect(() => countSkinIAEvidenceDecision(counts, decision({ reference: 'UNKNOWN' as 'ABSENT' }))).toThrow('reference');
    expect(() => countSkinIAEvidenceDecision(counts, decision({ candidate: 'UNKNOWN' as 'ABSENT' }))).toThrow('candidate');
  });

  it('retains only aggregate fields even if an unsafe caller adds identifying data', () => {
    const unsafe = { ...decision(), participantId: 'do-not-store', frameUri: 'do-not-store' };
    const counts = countSkinIAEvidenceDecision(emptySkinIAEvidenceCounts(label, scope), unsafe);
    expect(JSON.stringify(counts)).not.toContain('do-not-store');
  });

  it('merges only valid aggregate blocks for the same approved label', () => {
    const first = countSkinIAEvidenceDecision(emptySkinIAEvidenceCounts(label, scope), decision());
    const second = countSkinIAEvidenceDecision(emptySkinIAEvidenceCounts(label, scope), {
      observation: label, scope, gate: 'BASELINE_NOT_COMPARABLE',
    });
    expect(mergeSkinIAEvidenceCounts(first, second)).toMatchObject({
      attempts: 2, truePositive: 1, baselineNotComparable: 1,
    });
    expect(() => mergeSkinIAEvidenceCounts(first, emptySkinIAEvidenceCounts('VISIBLE_TEXTURE', scope))).toThrow('matching');
    expect(() => mergeSkinIAEvidenceCounts(first, emptySkinIAEvidenceCounts(label, {
      ...scope, supportCellId: 'different-light',
    }))).toThrow('matching');
    expect(() => mergeSkinIAEvidenceCounts(first, { ...second, attempts: 5 })).toThrow('valid');
    expect(() => mergeSkinIAEvidenceCounts(first, {
      ...second, baselineNotComparable: undefined as unknown as number,
    })).toThrow('valid');
    const unsafeCounts = { ...second, participantId: 'must-not-persist' };
    const unsafeScope = { ...scope, participantId: 'must-not-persist' };
    expect(() => mergeSkinIAEvidenceCounts(first, unsafeCounts)).toThrow('valid');
    expect(() => mergeSkinIAEvidenceCounts(first, { ...second, scope: unsafeScope })).toThrow('valid');
  });

  it('rejects count overflow on both individual decisions and merged blocks', () => {
    const full = {
      ...emptySkinIAEvidenceCounts(label, scope),
      attempts: Number.MAX_SAFE_INTEGER,
      truePositive: Number.MAX_SAFE_INTEGER,
    };
    expect(() => countSkinIAEvidenceDecision(full, decision())).toThrow('overflow');
    const one = countSkinIAEvidenceDecision(emptySkinIAEvidenceCounts(label, scope), decision());
    expect(() => mergeSkinIAEvidenceCounts(full, one)).toThrow('overflow');
  });
});
