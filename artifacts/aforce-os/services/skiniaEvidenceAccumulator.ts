import {
  isSkinIAPhase1Observation,
  type SkinIAPhase1Observation,
} from './skiniaPhase1Policy';

/**
 * Internal QA counting only. A determinate scoring decision requires an
 * approved live reference. Callers must not persist a case, image, identity,
 * feature vector, or face box.
 */
export type SkinIAEvidenceScope = Readonly<{
  buildId: string;
  methodRevision: string;
  rubricRevision: string;
  supportCellId: string;
}>;

export type SkinIAEvidenceDecision = Readonly<
  { observation: string; scope: SkinIAEvidenceScope } & (
    | { gate: 'QUALITY_REJECTED' }
    | { gate: 'BASELINE_NOT_COMPARABLE' }
    | { gate: 'REFERENCE_AMBIGUOUS' }
    | {
        gate: 'DETERMINATE_REFERENCE';
        reference: 'PRESENT' | 'ABSENT';
        candidate: 'PRESENT' | 'ABSENT' | 'UNABLE_TO_DETERMINE';
      }
  )
>;

export type SkinIAEvidenceCounts = Readonly<{
  observation: SkinIAPhase1Observation;
  scope: SkinIAEvidenceScope;
  attempts: number;
  truePositive: number;
  falsePositive: number;
  falseNegative: number;
  trueNegative: number;
  ambiguousReference: number;
  qualityRejected: number;
  baselineNotComparable: number;
  abstained: number;
}>;

const COUNT_KEYS = Object.freeze([
  'truePositive', 'falsePositive', 'falseNegative', 'trueNegative',
  'ambiguousReference', 'qualityRejected', 'baselineNotComparable', 'abstained',
] as const satisfies readonly (keyof SkinIAEvidenceCounts)[]);

const SCOPE_KEYS = Object.freeze([
  'buildId', 'methodRevision', 'rubricRevision', 'supportCellId',
] as const satisfies readonly (keyof SkinIAEvidenceScope)[]);
const COUNT_FIELDS = Object.freeze(['observation', 'scope', 'attempts', ...COUNT_KEYS] as const);

const hasValidScope = (scope: SkinIAEvidenceScope) =>
  !!scope && typeof scope === 'object' && Reflect.ownKeys(scope).length === SCOPE_KEYS.length &&
  SCOPE_KEYS.every((key) => typeof scope[key] === 'string' && scope[key].trim().length > 0);

const sameScope = (left: SkinIAEvidenceScope, right: SkinIAEvidenceScope) =>
  hasValidScope(left) && hasValidScope(right) && SCOPE_KEYS.every((key) => left[key] === right[key]);

const hasValidCounts = (counts: SkinIAEvidenceCounts) => {
  if (!counts || typeof counts !== 'object' || Reflect.ownKeys(counts).length !== COUNT_FIELDS.length ||
      !hasValidScope(counts.scope) || !Number.isSafeInteger(counts.attempts) || counts.attempts < 0 ||
      !COUNT_KEYS.every((key) => Number.isSafeInteger(counts[key]) && counts[key] >= 0)) return false;
  const countedAttempts = COUNT_KEYS.reduce((sum, key) => sum + counts[key], 0);
  return Number.isSafeInteger(countedAttempts) && countedAttempts === counts.attempts;
};

export function emptySkinIAEvidenceCounts(observation: string, scope: SkinIAEvidenceScope): SkinIAEvidenceCounts {
  if (!isSkinIAPhase1Observation(observation)) throw new Error('Unsupported SkinIA observation');
  if (!hasValidScope(scope)) throw new Error('Invalid SkinIA evidence scope');
  return Object.freeze({
    observation,
    scope: Object.freeze({
      buildId: scope.buildId,
      methodRevision: scope.methodRevision,
      rubricRevision: scope.rubricRevision,
      supportCellId: scope.supportCellId,
    }),
    attempts: 0,
    truePositive: 0,
    falsePositive: 0,
    falseNegative: 0,
    trueNegative: 0,
    ambiguousReference: 0,
    qualityRejected: 0,
    baselineNotComparable: 0,
    abstained: 0,
  });
}

/**
 * Converts one ephemeral, consented QA decision into aggregate counts. Quality
 * rejections, non-comparable baselines, ambiguous live references, and
 * abstentions are distinct gates. None is silently counted as a negative or
 * included in the TP/FP/FN/TN denominator.
 */
export function countSkinIAEvidenceDecision(
  counts: SkinIAEvidenceCounts,
  decision: SkinIAEvidenceDecision,
): SkinIAEvidenceCounts {
  if (!isSkinIAPhase1Observation(decision.observation) || decision.observation !== counts.observation) {
    throw new Error('SkinIA evidence label mismatch or unsupported observation');
  }
  if (!hasValidCounts(counts)) throw new Error('Invalid SkinIA evidence counts');
  if (!sameScope(counts.scope, decision.scope)) throw new Error('SkinIA evidence scope mismatch');
  const gated = decision as SkinIAEvidenceDecision & { reference?: unknown; candidate?: unknown };
  if (decision.gate !== 'QUALITY_REJECTED' && decision.gate !== 'BASELINE_NOT_COMPARABLE' &&
      decision.gate !== 'REFERENCE_AMBIGUOUS' && decision.gate !== 'DETERMINATE_REFERENCE') {
    throw new Error('Invalid SkinIA evidence gate');
  }
  if (decision.gate !== 'DETERMINATE_REFERENCE' &&
      (gated.reference !== undefined || gated.candidate !== undefined)) {
    throw new Error('Unscored SkinIA gate must not produce a reference or candidate');
  }
  if (decision.gate === 'DETERMINATE_REFERENCE' &&
      decision.reference !== 'PRESENT' && decision.reference !== 'ABSENT') {
    throw new Error('Invalid SkinIA reference decision');
  }
  if (decision.gate === 'DETERMINATE_REFERENCE' &&
      decision.candidate !== 'PRESENT' && decision.candidate !== 'ABSENT' &&
      decision.candidate !== 'UNABLE_TO_DETERMINE') {
    throw new Error('Invalid SkinIA candidate decision');
  }
  if (counts.attempts === Number.MAX_SAFE_INTEGER) throw new Error('SkinIA evidence count overflow');
  const next = { ...counts, attempts: counts.attempts + 1 };
  if (decision.gate === 'QUALITY_REJECTED') next.qualityRejected += 1;
  else if (decision.gate === 'BASELINE_NOT_COMPARABLE') next.baselineNotComparable += 1;
  else if (decision.gate === 'REFERENCE_AMBIGUOUS') next.ambiguousReference += 1;
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
  if (left.observation !== right.observation || !sameScope(left.scope, right.scope) ||
      !isSkinIAPhase1Observation(left.observation) ||
      !hasValidCounts(left) || !hasValidCounts(right)) {
    throw new Error('SkinIA evidence blocks must have matching valid labels, scope, and counts');
  }
  const merged = { ...left, attempts: left.attempts + right.attempts };
  for (const key of COUNT_KEYS) merged[key] = left[key] + right[key];
  if (!hasValidCounts(merged)) throw new Error('SkinIA evidence count overflow');
  return Object.freeze(merged);
}
