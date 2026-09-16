import {
  type SkinIAPhase1Confidence,
  type SkinIAPhase1Observation,
  SKINIA_PHASE1_NON_RESULT,
  isSkinIAPhase1Observation,
} from './skiniaPhase1Policy';

/** Internal-only, derived-data contract. Raw imagery never enters this module. */
export type SkinIADerivedCandidate = Readonly<{
  observation: string;
  confidence: SkinIAPhase1Confidence;
  capturedAt: string;
}>;

export type SkinIAInternalObservation = Readonly<{
  kind: 'OBSERVATION';
  observation: SkinIAPhase1Observation;
  confidence: Exclude<SkinIAPhase1Confidence, 'UNABLE_TO_DETERMINE'>;
  capturedAt: string;
  comparison: 'PERSONAL_BASELINE';
}>;

export type SkinIAObservationNonResult = Readonly<{
  kind: 'NON_RESULT';
  message: typeof SKINIA_PHASE1_NON_RESULT;
  reason: 'UNSUPPORTED_OBSERVATION' | 'INSUFFICIENT_CONFIDENCE' | 'NO_COMPARABLE_BASELINE';
}>;

export type SkinIAObservationOutcome = SkinIAInternalObservation | SkinIAObservationNonResult;

/**
 * Admits a derived internal result only if it uses an approved observation,
 * carries a non-numeric confidence band, and has a personal baseline. No
 * capture data, pixels, landmarks, biometric template, or model payload is
 * accepted or retained here.
 */
export function resolveSkinIAInternalObservation(
  candidate: SkinIADerivedCandidate,
  hasComparablePersonalBaseline: boolean,
): SkinIAObservationOutcome {
  if (!isSkinIAPhase1Observation(candidate.observation)) {
    return Object.freeze({ kind: 'NON_RESULT', message: SKINIA_PHASE1_NON_RESULT, reason: 'UNSUPPORTED_OBSERVATION' });
  }
  if (candidate.confidence === 'UNABLE_TO_DETERMINE' || candidate.confidence === 'LOW') {
    return Object.freeze({ kind: 'NON_RESULT', message: SKINIA_PHASE1_NON_RESULT, reason: 'INSUFFICIENT_CONFIDENCE' });
  }
  if (!hasComparablePersonalBaseline) {
    return Object.freeze({ kind: 'NON_RESULT', message: SKINIA_PHASE1_NON_RESULT, reason: 'NO_COMPARABLE_BASELINE' });
  }
  return Object.freeze({
    kind: 'OBSERVATION',
    observation: candidate.observation,
    confidence: candidate.confidence,
    capturedAt: candidate.capturedAt,
    comparison: 'PERSONAL_BASELINE',
  });
}
