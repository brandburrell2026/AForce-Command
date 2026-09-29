/**
 * Aggregate-only accounting for a proposed, flaking-only LIVE human-reference
 * feasibility study. This is not image analysis, algorithm accuracy evidence,
 * a participant record, or permission to enroll anyone. A protocol and privacy
 * plan must be approved before any real decisions are collected.
 */

export const SKINIA_LIVE_REFERENCE_LABEL = 'VISIBLE_FLAKING' as const;

export type SkinIALiveReferenceScope = Readonly<{
  buildId: string;
  protocolRevision: string;
  rubricRevision: string;
  supportCellId: string;
}>;

export type SkinIALiveRating = 'PRESENT' | 'ABSENT' | 'AMBIGUOUS';

export type SkinIALiveReferenceDecision = Readonly<
  { label: typeof SKINIA_LIVE_REFERENCE_LABEL; scope: SkinIALiveReferenceScope } & (
    | { gate: 'QUALITY_REJECTED' }
    | { gate: 'REFERENCE_RATED'; first: SkinIALiveRating; second: SkinIALiveRating }
  )
>;

export type SkinIALiveReferenceCounts = Readonly<{
  label: typeof SKINIA_LIVE_REFERENCE_LABEL;
  scope: SkinIALiveReferenceScope;
  attempts: number;
  qualityRejected: number;
  referenceAmbiguous: number;
  bothPresent: number;
  firstPresentSecondAbsent: number;
  firstAbsentSecondPresent: number;
  bothAbsent: number;
}>;

export type SkinIALiveReferenceSummary = Readonly<{
  attempts: number;
  accepted: number;
  binaryRatable: number;
  captureAvailability: number | null;
  ambiguityFraction: number | null;
  binaryAgreement: number | null;
  positiveSpecificAgreement: number | null;
  negativeSpecificAgreement: number | null;
}>;

const SCOPE_KEYS = Object.freeze([
  'buildId', 'protocolRevision', 'rubricRevision', 'supportCellId',
] as const satisfies readonly (keyof SkinIALiveReferenceScope)[]);
const COUNT_KEYS = Object.freeze([
  'qualityRejected', 'referenceAmbiguous', 'bothPresent',
  'firstPresentSecondAbsent', 'firstAbsentSecondPresent', 'bothAbsent',
] as const satisfies readonly (keyof SkinIALiveReferenceCounts)[]);
const COUNT_FIELDS = Object.freeze(['label', 'scope', 'attempts', ...COUNT_KEYS] as const);

function validScope(scope: SkinIALiveReferenceScope): boolean {
  return !!scope && typeof scope === 'object' && Reflect.ownKeys(scope).length === SCOPE_KEYS.length &&
    SCOPE_KEYS.every((key) => typeof scope[key] === 'string' && scope[key].trim().length > 0);
}

function sameScope(left: SkinIALiveReferenceScope, right: SkinIALiveReferenceScope): boolean {
  return validScope(left) && validScope(right) && SCOPE_KEYS.every((key) => left[key] === right[key]);
}

function copyScope(scope: SkinIALiveReferenceScope): SkinIALiveReferenceScope {
  return Object.freeze({
    buildId: scope.buildId,
    protocolRevision: scope.protocolRevision,
    rubricRevision: scope.rubricRevision,
    supportCellId: scope.supportCellId,
  });
}

function validCounts(counts: SkinIALiveReferenceCounts): boolean {
  if (!counts || typeof counts !== 'object' || Reflect.ownKeys(counts).length !== COUNT_FIELDS.length ||
      counts.label !== SKINIA_LIVE_REFERENCE_LABEL || !validScope(counts.scope) ||
      !Number.isSafeInteger(counts.attempts) || counts.attempts < 0 ||
      !COUNT_KEYS.every((key) => Number.isSafeInteger(counts[key]) && counts[key] >= 0)) return false;
  const total = COUNT_KEYS.reduce((sum, key) => sum + counts[key], 0);
  return Number.isSafeInteger(total) && total === counts.attempts;
}

export function emptySkinIALiveReferenceCounts(scope: SkinIALiveReferenceScope): SkinIALiveReferenceCounts {
  if (!validScope(scope)) throw new Error('Invalid SkinIA live-reference scope');
  return Object.freeze({
    label: SKINIA_LIVE_REFERENCE_LABEL,
    scope: copyScope(scope),
    attempts: 0,
    qualityRejected: 0,
    referenceAmbiguous: 0,
    bothPresent: 0,
    firstPresentSecondAbsent: 0,
    firstAbsentSecondPresent: 0,
    bothAbsent: 0,
  });
}

/** Each consented attempt enters exactly one first-applicable gate. */
export function countSkinIALiveReferenceDecision(
  counts: SkinIALiveReferenceCounts,
  decision: SkinIALiveReferenceDecision,
): SkinIALiveReferenceCounts {
  if (!validCounts(counts)) throw new Error('Invalid SkinIA live-reference counts');
  if (!decision || typeof decision !== 'object' || !sameScope(counts.scope, decision.scope)) {
    throw new Error('SkinIA live-reference scope mismatch');
  }
  if (decision.label !== SKINIA_LIVE_REFERENCE_LABEL) {
    throw new Error('Unsupported SkinIA live-reference label');
  }
  const fields = Reflect.ownKeys(decision);
  if (decision.gate === 'QUALITY_REJECTED') {
    if (fields.length !== 3 || !fields.includes('label') ||
        !fields.includes('scope') || !fields.includes('gate')) {
      throw new Error('Quality rejection must not include reference or participant data');
    }
  } else if (decision.gate === 'REFERENCE_RATED') {
    if (fields.length !== 5 || !fields.includes('label') ||
        !fields.includes('scope') || !fields.includes('gate') ||
        !fields.includes('first') || !fields.includes('second') ||
        !['PRESENT', 'ABSENT', 'AMBIGUOUS'].includes(decision.first) ||
        !['PRESENT', 'ABSENT', 'AMBIGUOUS'].includes(decision.second)) {
      throw new Error('Invalid or identifying SkinIA live-reference rating');
    }
  } else {
    throw new Error('Invalid SkinIA live-reference gate');
  }
  if (counts.attempts === Number.MAX_SAFE_INTEGER) throw new Error('SkinIA live-reference count overflow');
  const next = { ...counts, attempts: counts.attempts + 1 };
  if (decision.gate === 'QUALITY_REJECTED') next.qualityRejected += 1;
  else if (decision.first === 'AMBIGUOUS' || decision.second === 'AMBIGUOUS') next.referenceAmbiguous += 1;
  else if (decision.first === 'PRESENT' && decision.second === 'PRESENT') next.bothPresent += 1;
  else if (decision.first === 'PRESENT') next.firstPresentSecondAbsent += 1;
  else if (decision.second === 'PRESENT') next.firstAbsentSecondPresent += 1;
  else next.bothAbsent += 1;
  return Object.freeze({ ...next, scope: copyScope(counts.scope) });
}

/** Never combine versions or support cells into an apparently stronger result. */
export function mergeSkinIALiveReferenceCounts(
  left: SkinIALiveReferenceCounts,
  right: SkinIALiveReferenceCounts,
): SkinIALiveReferenceCounts {
  if (!validCounts(left) || !validCounts(right) || !sameScope(left.scope, right.scope)) {
    throw new Error('SkinIA live-reference blocks must have matching valid scope and counts');
  }
  const merged = { ...left, attempts: left.attempts + right.attempts };
  for (const key of COUNT_KEYS) merged[key] = left[key] + right[key];
  if (!validCounts(merged)) throw new Error('SkinIA live-reference count overflow');
  return Object.freeze({ ...merged, scope: copyScope(left.scope) });
}

/**
 * Descriptive point estimates only. Ambiguous ratings are reported over all
 * quality-accepted attempts but are excluded from the binary 2x2 table.
 * Zero denominators return null, never a fabricated zero or pass. Confidence
 * intervals, targets, and a study verdict belong to a signed protocol.
 */
export function summarizeSkinIALiveReferenceCounts(
  counts: SkinIALiveReferenceCounts,
): SkinIALiveReferenceSummary {
  if (!validCounts(counts)) throw new Error('Invalid SkinIA live-reference counts');
  const accepted = counts.attempts - counts.qualityRejected;
  const binaryRatable = accepted - counts.referenceAmbiguous;
  const discordant = counts.firstPresentSecondAbsent + counts.firstAbsentSecondPresent;
  // a/(a + (b+c)/2) equals 2a/(2a+b+c) without doubling a large count.
  const positiveDenominator = counts.bothPresent + discordant / 2;
  const negativeDenominator = counts.bothAbsent + discordant / 2;
  return Object.freeze({
    attempts: counts.attempts,
    accepted,
    binaryRatable,
    captureAvailability: counts.attempts ? accepted / counts.attempts : null,
    ambiguityFraction: accepted ? counts.referenceAmbiguous / accepted : null,
    binaryAgreement: binaryRatable ? (counts.bothPresent + counts.bothAbsent) / binaryRatable : null,
    positiveSpecificAgreement: positiveDenominator ? counts.bothPresent / positiveDenominator : null,
    negativeSpecificAgreement: negativeDenominator ? counts.bothAbsent / negativeDenominator : null,
  });
}
