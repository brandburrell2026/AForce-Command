/**
 * SkinIA Visual Check — future ephemeral-session lifecycle contract.
 *
 * This is a pure policy contract, not a capture implementation. It does not
 * request permissions, open hardware, accept image data, create files, or
 * perform deletion. A future controlled TestFlight implementation must call
 * its platform-specific cleanup immediately for every disposition below.
 */

export type SkinIAEphemeralExit =
  | 'COMPLETED'
  | 'CANCELLED'
  | 'FAILED'
  | 'TIMED_OUT'
  | 'CONSENT_WITHDRAWN'
  | 'ABANDONED';

export type SkinIAEphemeralCleanupRequirement = Readonly<{
  exit: SkinIAEphemeralExit;
  rawImageDisposition: 'DELETE_IMMEDIATELY';
  imagePersistence: 'PROHIBITED';
  blockedSurfaces: readonly [
    'STORAGE',
    'DATABASE',
    'LOGS',
    'ANALYTICS',
    'CACHE',
    'BACKUPS',
    'CRASH_REPORTS',
    'MODEL_TRAINING',
    'IDENTITY_TEMPLATES',
  ];
  observationDisposition: 'DO_NOT_PRODUCE_OBSERVATION_UNTIL_VALIDATED';
}>;

const blockedSurfaces: SkinIAEphemeralCleanupRequirement['blockedSurfaces'] = [
  'STORAGE',
  'DATABASE',
  'LOGS',
  'ANALYTICS',
  'CACHE',
  'BACKUPS',
  'CRASH_REPORTS',
  'MODEL_TRAINING',
  'IDENTITY_TEMPLATES',
];

/**
 * Returns the non-negotiable cleanup requirement for an ephemeral session.
 * The value carries no member identifier, visual data, file reference, or
 * telemetry payload.
 */
export function skinIAEphemeralCleanupRequirement(exit: SkinIAEphemeralExit): SkinIAEphemeralCleanupRequirement {
  return Object.freeze({
    exit,
    rawImageDisposition: 'DELETE_IMMEDIATELY',
    imagePersistence: 'PROHIBITED',
    blockedSurfaces,
    observationDisposition: 'DO_NOT_PRODUCE_OBSERVATION_UNTIL_VALIDATED',
  });
}
