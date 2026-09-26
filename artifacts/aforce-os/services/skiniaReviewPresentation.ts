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
      ? 'Capture check passed'
      : result.kind === 'OBSERVATION' ? 'Your visual check.' : 'Unable to Analyze',
    kicker: captureAcceptedButFindingsGated ? 'INTERNAL QA CAPTURE RESULT' : 'VISUAL CHECK RESULT',
    body: captureAcceptedButFindingsGated
      ? 'The image passed technical capture checks. This is not a skin reading.'
      : result.message,
    qaNote: captureAcceptedButFindingsGated
      ? 'SkinIA observations are still under review. Another scan will not unlock a finding in this build.'
      : null,
    action: captureAcceptedButFindingsGated ? 'Back to SkinIA' : 'Take another scan',
    qaCode: captureAcceptedButFindingsGated ? 'OBSERVATIONS_NOT_ADMITTED' as const : null,
  });
}
