/**
 * Advanced Visual Intelligence™ containment contract.
 *
 * Member-facing name: SkinIA Visual Check.
 *
 * This module deliberately defines the boundary before any capability exists.
 * It MUST NOT import a camera, image picker, ML runtime, network client, or
 * storage service. There is no image capture, image upload, processing,
 * inference, retention, comparison, or model call in this module.
 */

export const ADVANCED_VISUAL_INTELLIGENCE_NAME = 'Advanced Visual Intelligence™';
export const SKINIA_MEMBER_LABEL = 'SkinIA Visual Check';

export type VisualCheckResult = {
  status: 'UNKNOWN';
  reason: 'FEATURE_NOT_APPROVED';
};

/** The only result this containment build can produce. */
export const UNKNOWN_VISUAL_CHECK_RESULT: VisualCheckResult = Object.freeze({
  status: 'UNKNOWN',
  reason: 'FEATURE_NOT_APPROVED',
});

/**
 * Contract placeholder for a future device-local quality gate. It accepts no
 * visual input and returns no measurement; legal and founder approvals are
 * required before a concrete implementation can be introduced.
 */
export interface DeviceLocalQualityGate {
  readonly kind: 'UNIMPLEMENTED_PENDING_APPROVAL';
}

/**
 * Contract placeholder for a future device-local baseline. No data is held,
 * joined, persisted, or compared by this containment build.
 */
export interface DeviceLocalBaseline {
  readonly kind: 'UNIMPLEMENTED_PENDING_APPROVAL';
}

/** Read-only context shape; no join implementation exists in this build. */
export interface ReadOnlyVisualContextJoin {
  readonly kind: 'UNIMPLEMENTED_PENDING_APPROVAL';
}

export function unavailableVisualCheckResult(): VisualCheckResult {
  return UNKNOWN_VISUAL_CHECK_RESULT;
}
