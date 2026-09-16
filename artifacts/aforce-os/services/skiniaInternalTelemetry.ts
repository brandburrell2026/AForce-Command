import type { SkinIAObservationOutcome } from './skiniaObservationPipeline';
import { SKINIA_PHASE1_RELEASE_SCOPE } from './skiniaPhase1Policy';

/** Transport-agnostic events. Deliberately excludes image, device, and member identifiers. */
export type SkinIAInternalTelemetryEvent = Readonly<{
  name: 'skinia_internal_capture_completed' | 'skinia_internal_non_result';
  properties: Readonly<{
    releaseScope: typeof SKINIA_PHASE1_RELEASE_SCOPE;
    outcome: 'OBSERVATION' | 'NON_RESULT';
    reason?: SkinIAObservationOutcome extends infer _T ? string : never;
  }>;
}>;

export function skinIAInternalTelemetryEvent(outcome: SkinIAObservationOutcome): SkinIAInternalTelemetryEvent {
  if (outcome.kind === 'OBSERVATION') return Object.freeze({ name: 'skinia_internal_capture_completed' as const, properties: { releaseScope: SKINIA_PHASE1_RELEASE_SCOPE, outcome: 'OBSERVATION' as const } });
  return Object.freeze({ name: 'skinia_internal_non_result' as const, properties: { releaseScope: SKINIA_PHASE1_RELEASE_SCOPE, outcome: 'NON_RESULT' as const, reason: outcome.reason } });
}
