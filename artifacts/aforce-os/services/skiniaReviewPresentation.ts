import type { SkinIAObservationOutcome } from './skiniaObservationPipeline';
import { resolveSkinIAMemberResult, SKINIA_MEMBER_OBSERVATIONS_ADMITTED } from './skiniaMemberResultGate';

/** A passed technical capture is not an admitted skin observation. */
export function resolveSkinIAReviewPresentation(
  outcome: SkinIAObservationOutcome | null,
  internalTestFlight: boolean,
) {
  const result = resolveSkinIAMemberResult(outcome);
  const captureAcceptedButFindingsGated = internalTestFlight &&
    !SKINIA_MEMBER_OBSERVATIONS_ADMITTED && result.kind === 'NON_RESULT';

  return Object.freeze({
    title: captureAcceptedButFindingsGated
      ? 'Technical capture complete'
      : result.kind === 'OBSERVATION' ? 'Your visual check.' : 'Unable to Analyze',
    kicker: captureAcceptedButFindingsGated ? 'INTERNAL QA CAPTURE RESULT' : 'VISUAL CHECK RESULT',
    body: result.message,
    qaNote: captureAcceptedButFindingsGated
      ? 'Technical capture checks passed. This build does not display SkinIA observations; another scan will not unlock a finding.'
      : null,
    action: captureAcceptedButFindingsGated ? 'Take another QA scan' : 'Take another scan',
    qaCode: captureAcceptedButFindingsGated ? 'OBSERVATIONS_NOT_ADMITTED' as const : null,
  });
}
