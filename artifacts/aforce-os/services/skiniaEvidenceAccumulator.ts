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

const COUNT_KEYS = Object.freeze([
  'truePositive', 'falsePositive', 'falseNegative', 'trueNegative',
  'ambiguousReference', 'qualityRejected', 'abstained',
] as const satisfies readonly (keyof SkinIAEvidenceCounts)[]);

const hasValidCounts = (counts: SkinIAEvidenceCounts) =>
  Number.isSafeInteger(counts.attempts) && counts.attempts >= 0 &&
  COUNT_KEYS.every((key) => Number.isSafeInteger(counts[key]) && counts[key] >= 0) &&
  COUNT_KEYS.reduce((sum, key) => sum + counts[key], 0) === counts.attempts;

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
  if (!hasValidCounts(counts)) throw new Error('Invalid SkinIA evidence counts');
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

/** Combines aggregate-only blocks without retaining their underlying cases. */
export function mergeSkinIAEvidenceCounts(
  left: SkinIAEvidenceCounts,
  right: SkinIAEvidenceCounts,
): SkinIAEvidenceCounts {
  if (left.observation !== right.observation || !isSkinIAPhase1Observation(left.observation) ||
      !hasValidCounts(left) || !hasValidCounts(right)) {
    throw new Error('SkinIA evidence blocks must have matching valid labels and counts');
  }
  const merged = { ...left, attempts: left.attempts + right.attempts };
  for (const key of COUNT_KEYS) merged[key] = left[key] + right[key];
  if (!hasValidCounts(merged)) throw new Error('SkinIA evidence count overflow');
  return Object.freeze(merged);
}
