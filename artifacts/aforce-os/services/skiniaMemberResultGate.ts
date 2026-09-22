import type { SkinIAObservationOutcome } from './skiniaObservationPipeline';
import { skinIAMemberNonResultCopy, skinIAMemberObservationCopy } from './skiniaMemberCopy';

/**
 * Architecture §25.3 admits no live observation family yet. The internal
 * engine's LOW-confidence candidates are useful for QA, not member findings.
 * A later admission must change this lock in a separately reviewed release.
 */
export const SKINIA_MEMBER_OBSERVATIONS_ADMITTED = false;

export type SkinIAMemberResult = Readonly<
  | { kind: 'NON_RESULT'; message: ReturnType<typeof skinIAMemberNonResultCopy> }
  | { kind: 'OBSERVATION'; message: string; confidence: 'HIGH' | 'MODERATE' }
>;

/** Only approved copy crosses into the member UI; internal reasons stay private. */
export function resolveSkinIAMemberResult(outcome: SkinIAObservationOutcome | null): SkinIAMemberResult {
  if (!SKINIA_MEMBER_OBSERVATIONS_ADMITTED || outcome?.kind !== 'OBSERVATION' ||
      (outcome.confidence !== 'HIGH' && outcome.confidence !== 'MODERATE')) {
    return Object.freeze({ kind: 'NON_RESULT', message: skinIAMemberNonResultCopy() });
  }
  return Object.freeze({
    kind: 'OBSERVATION',
    message: skinIAMemberObservationCopy(outcome),
    confidence: outcome.confidence,
  });
}
