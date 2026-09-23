import {
  isSkinIAPhase1Observation,
  type SkinIAPhase1Observation,
} from './skiniaPhase1Policy';

/**
 * Internal QA counting only. Callers must obtain an approved, live reference
 * and must not persist a case, image, identity, feature vector, or face box.
 */
export type SkinIAEvidenceDecision = Readonly<{
  observation: string;
  quality: 'ACCEPTED' | 'REJECTED';
  reference: 'PRESENT' | 'ABSENT' | 'AMBIGUOUS';
  candidate: 'PRESENT' | 'ABSENT' | 'UNABLE_TO_DETERMINE';
}>;

export type SkinIAEvidenceCounts = Readonly<{
  observation: SkinIAPhase1Observation;
  attempts: number;
  truePositive: number;
  falsePositive: number;
  falseNegative: number;
  trueNegative: number;
  ambiguousReference: number;
  qualityRejected: number;
  abstained: number;
}>;

export function emptySkinIAEvidenceCounts(observation: string): SkinIAEvidenceCounts {
  if (!isSkinIAPhase1Observation(observation)) throw new Error('Unsupported SkinIA observation');
  return Object.freeze({
    observation,
    attempts: 0,
    truePositive: 0,
    falsePositive: 0,
    falseNegative: 0,
    trueNegative: 0,
    ambiguousReference: 0,
    qualityRejected: 0,
    abstained: 0,
  });
}

/**
 * Converts one ephemeral, consented QA decision into aggregate counts. Quality
 * rejections, ambiguous references, and abstentions are never silently counted
 * as negatives or included in the TP/FP/FN/TN denominator.
 */
export function countSkinIAEvidenceDecision(
  counts: SkinIAEvidenceCounts,
  decision: SkinIAEvidenceDecision,
): SkinIAEvidenceCounts {
  if (!isSkinIAPhase1Observation(decision.observation) || decision.observation !== counts.observation) {
    throw new Error('SkinIA evidence label mismatch or unsupported observation');
  }
  if (decision.quality !== 'ACCEPTED' && decision.quality !== 'REJECTED') {
    throw new Error('Invalid SkinIA quality decision');
  }
  if (decision.reference !== 'PRESENT' && decision.reference !== 'ABSENT' && decision.reference !== 'AMBIGUOUS') {
    throw new Error('Invalid SkinIA reference decision');
  }
  if (decision.candidate !== 'PRESENT' && decision.candidate !== 'ABSENT' &&
      decision.candidate !== 'UNABLE_TO_DETERMINE') {
    throw new Error('Invalid SkinIA candidate decision');
  }
  if (decision.quality === 'REJECTED' && decision.candidate !== 'UNABLE_TO_DETERMINE') {
    throw new Error('Rejected SkinIA capture must not produce a candidate');
  }
  const next = { ...counts, attempts: counts.attempts + 1 };
  if (decision.quality === 'REJECTED') next.qualityRejected += 1;
  else if (decision.reference === 'AMBIGUOUS') next.ambiguousReference += 1;
  else if (decision.candidate === 'UNABLE_TO_DETERMINE') next.abstained += 1;
  else if (decision.reference === 'PRESENT' && decision.candidate === 'PRESENT') next.truePositive += 1;
  else if (decision.reference === 'ABSENT' && decision.candidate === 'PRESENT') next.falsePositive += 1;
  else if (decision.reference === 'PRESENT') next.falseNegative += 1;
  else next.trueNegative += 1;
  return Object.freeze(next);
}
