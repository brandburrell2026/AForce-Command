import { describe, expect, it } from 'vitest';
import {
  countSkinIALiveReferenceDecision,
  emptySkinIALiveReferenceCounts,
  mergeSkinIALiveReferenceCounts,
  summarizeSkinIALiveReferenceCounts,
  type SkinIALiveReferenceCounts,
  type SkinIALiveReferenceDecision,
  type SkinIALiveReferenceScope,
} from '../skiniaLiveReferenceFeasibility';

const scope: SkinIALiveReferenceScope = {
  buildId: 'build-100',
  protocolRevision: 'reference-feasibility-draft-1',
  rubricRevision: 'flaking-rubric-draft-1',
  supportCellId: 'iphone17pro-diffuse-indoor',
};
const label = 'VISIBLE_FLAKING';

const rated = (
  first: 'PRESENT' | 'ABSENT' | 'AMBIGUOUS',
  second: 'PRESENT' | 'ABSENT' | 'AMBIGUOUS',
): SkinIALiveReferenceDecision => ({ label, scope, gate: 'REFERENCE_RATED', first, second });

describe('SkinIA flaking live-reference feasibility accounting', () => {
  it('keeps quality rejection, ambiguity, directional disagreement, and agreement separate', () => {
    const decisions: SkinIALiveReferenceDecision[] = [
      { label, scope, gate: 'QUALITY_REJECTED' },
      rated('AMBIGUOUS', 'PRESENT'),
      rated('PRESENT', 'PRESENT'), rated('PRESENT', 'PRESENT'),
      rated('PRESENT', 'ABSENT'), rated('ABSENT', 'PRESENT'),
      rated('ABSENT', 'ABSENT'), rated('ABSENT', 'ABSENT'), rated('ABSENT', 'ABSENT'),
    ];
    const counts = decisions.reduce(countSkinIALiveReferenceDecision, emptySkinIALiveReferenceCounts(scope));
    expect(counts).toMatchObject({
      label: 'VISIBLE_FLAKING', attempts: 9, qualityRejected: 1, referenceAmbiguous: 1,
      bothPresent: 2, firstPresentSecondAbsent: 1, firstAbsentSecondPresent: 1, bothAbsent: 3,
    });
    expect(summarizeSkinIALiveReferenceCounts(counts)).toEqual({
      attempts: 9, accepted: 8, binaryRatable: 7,
      captureAvailability: 8 / 9, ambiguityFraction: 1 / 8,
      binaryAgreement: 5 / 7, positiveSpecificAgreement: 2 / 3,
      negativeSpecificAgreement: 3 / 4,
    });
    expect(Object.isFrozen(counts)).toBe(true);
    expect(Object.isFrozen(counts.scope)).toBe(true);
  });

  it('does not invent agreement or a passing value when a denominator is empty', () => {
    expect(summarizeSkinIALiveReferenceCounts(emptySkinIALiveReferenceCounts(scope))).toEqual({
      attempts: 0, accepted: 0, binaryRatable: 0, captureAvailability: null,
      ambiguityFraction: null, binaryAgreement: null,
      positiveSpecificAgreement: null, negativeSpecificAgreement: null,
    });
    const ambiguousOnly = countSkinIALiveReferenceDecision(
      emptySkinIALiveReferenceCounts(scope), rated('AMBIGUOUS', 'AMBIGUOUS'),
    );
    expect(summarizeSkinIALiveReferenceCounts(ambiguousOnly)).toMatchObject({
      ambiguityFraction: 1, binaryAgreement: null,
      positiveSpecificAgreement: null, negativeSpecificAgreement: null,
    });
    const negativeOnly = countSkinIALiveReferenceDecision(
      emptySkinIALiveReferenceCounts(scope), rated('ABSENT', 'ABSENT'),
    );
    expect(summarizeSkinIALiveReferenceCounts(negativeOnly)).toMatchObject({
      positiveSpecificAgreement: null, negativeSpecificAgreement: 1,
    });
  });

  it('rejects invalid or identifying decisions instead of retaining participant data', () => {
    const empty = emptySkinIALiveReferenceCounts(scope);
    expect(() => emptySkinIALiveReferenceCounts({ ...scope, buildId: '' })).toThrow('scope');
    expect(() => emptySkinIALiveReferenceCounts({ ...scope, participantId: 'private' } as SkinIALiveReferenceScope)).toThrow('scope');
    expect(() => countSkinIALiveReferenceDecision(empty, {
      ...rated('PRESENT', 'ABSENT'), participantId: 'private',
    } as unknown as SkinIALiveReferenceDecision)).toThrow('identifying');
    expect(() => countSkinIALiveReferenceDecision(empty, {
      label, scope, gate: 'QUALITY_REJECTED', imageUri: 'private',
    } as SkinIALiveReferenceDecision)).toThrow('participant data');
    expect(() => countSkinIALiveReferenceDecision(empty, {
      ...rated('PRESENT', 'PRESENT'), second: 'MAYBE',
    } as unknown as SkinIALiveReferenceDecision)).toThrow('Invalid');
    expect(() => countSkinIALiveReferenceDecision(empty, {
      label, scope: { ...scope, rubricRevision: 'changed' }, gate: 'QUALITY_REJECTED',
    })).toThrow('scope mismatch');
    expect(() => countSkinIALiveReferenceDecision(empty, {
      label: 'VISIBLE_REDNESS', scope, gate: 'QUALITY_REJECTED',
    } as unknown as SkinIALiveReferenceDecision)).toThrow('label');
  });

  it('merges aggregate blocks only within the same frozen support cell and versions', () => {
    const first = countSkinIALiveReferenceDecision(emptySkinIALiveReferenceCounts(scope), rated('PRESENT', 'PRESENT'));
    const second = countSkinIALiveReferenceDecision(emptySkinIALiveReferenceCounts(scope), rated('ABSENT', 'PRESENT'));
    expect(mergeSkinIALiveReferenceCounts(first, second)).toMatchObject({
      attempts: 2, bothPresent: 1, firstAbsentSecondPresent: 1,
    });
    expect(() => mergeSkinIALiveReferenceCounts(first, emptySkinIALiveReferenceCounts({
      ...scope, supportCellId: 'different-light',
    }))).toThrow('matching');
    expect(() => mergeSkinIALiveReferenceCounts(first, { ...second, attempts: 4 })).toThrow('valid');
    expect(() => summarizeSkinIALiveReferenceCounts({
      ...first, participantId: 'private',
    } as unknown as SkinIALiveReferenceCounts)).toThrow('Invalid');
  });

  it('copies scope IDs so a caller cannot alter an accumulated block after counting', () => {
    const mutableScope = { ...scope };
    const base = emptySkinIALiveReferenceCounts(mutableScope);
    const next = countSkinIALiveReferenceDecision(
      { ...base, scope: mutableScope },
      { label, scope: mutableScope, gate: 'REFERENCE_RATED', first: 'PRESENT', second: 'PRESENT' },
    );
    mutableScope.buildId = 'changed-later';
    expect(base.scope.buildId).toBe('build-100');
    expect(next.scope.buildId).toBe('build-100');
    expect(Object.isFrozen(next.scope)).toBe(true);
  });

  it('rejects count overflow', () => {
    const full = {
      ...emptySkinIALiveReferenceCounts(scope),
      attempts: Number.MAX_SAFE_INTEGER,
      bothPresent: Number.MAX_SAFE_INTEGER,
    };
    expect(() => countSkinIALiveReferenceDecision(full, rated('PRESENT', 'PRESENT'))).toThrow('overflow');
    const one = countSkinIALiveReferenceDecision(emptySkinIALiveReferenceCounts(scope), rated('PRESENT', 'PRESENT'));
    expect(() => mergeSkinIALiveReferenceCounts(full, one)).toThrow('overflow');
  });
});
