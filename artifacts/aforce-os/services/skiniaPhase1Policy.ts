/**
 * AF-SI-001A internal-TestFlight policy lock.
 *
 * This module deliberately contains only the authorized vocabulary and output
 * rules. It accepts no image and has no storage, network, model, or telemetry
 * dependency. Later pipeline work must import these constants rather than
 * defining its own observation names or member-facing confidence scale.
 */

export const SKINIA_PHASE1_OBSERVATIONS = Object.freeze([
  'VISIBLE_DRYNESS',
  'VISIBLE_FLAKING',
  'VISIBLE_REDNESS',
  'VISIBLE_SURFACE_SHINE',
  'VISIBLE_TEXTURE',
] as const);

export type SkinIAPhase1Observation = (typeof SKINIA_PHASE1_OBSERVATIONS)[number];

export const SKINIA_PHASE1_CONFIDENCE_BANDS = Object.freeze([
  'HIGH',
  'MODERATE',
  'LOW',
  'UNABLE_TO_DETERMINE',
] as const);

export type SkinIAPhase1Confidence = (typeof SKINIA_PHASE1_CONFIDENCE_BANDS)[number];

export const SKINIA_PHASE1_NON_RESULT = 'We couldn’t make a reliable observation from today’s image.';
export const SKINIA_PHASE1_RAW_IMAGE_POLICY = 'EPHEMERAL_ONLY_NEVER_PERSIST' as const;
export const SKINIA_PHASE1_RELEASE_SCOPE = 'INTERNAL_TESTFLIGHT_ONLY' as const;

export function isSkinIAPhase1Observation(value: string): value is SkinIAPhase1Observation {
  return (SKINIA_PHASE1_OBSERVATIONS as readonly string[]).includes(value);
}
