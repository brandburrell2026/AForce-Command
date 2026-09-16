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

/**
 * A display-only consent checkpoint for the unavailable feature. This is not
 * a stored consent record and cannot request any operating-system permission.
 */
export type VisualCheckConsentShell = {
  stage: 'UNAVAILABLE_PENDING_APPROVAL';
  cameraPermission: 'NOT_REQUESTED';
  dataAccess: 'NO_IMAGE_ACCESS';
};

/**
 * Privacy-safe event definitions for the containment shell. These describe
 * product-surface activity only; they deliberately cannot carry an image,
 * visual feature, result value, device identifier, or health measurement.
 * Wiring an analytics transport remains a separately reviewed concern.
 */
export type VisualCheckAnalyticsEvent = {
  name: 'skinia_shell_viewed' | 'skinia_unavailable_viewed';
  properties: {
    featureStatus: 'FEATURE_NOT_APPROVED';
    surface: 'skinia_visual_check';
  };
};

export function visualCheckShellViewedEvent(): VisualCheckAnalyticsEvent {
  return {
    name: 'skinia_shell_viewed',
    properties: {
      featureStatus: 'FEATURE_NOT_APPROVED',
      surface: 'skinia_visual_check',
    },
  };
}

export function visualCheckUnavailableViewedEvent(): VisualCheckAnalyticsEvent {
  return {
    name: 'skinia_unavailable_viewed',
    properties: {
      featureStatus: 'FEATURE_NOT_APPROVED',
      surface: 'skinia_visual_check',
    },
  };
}

/** The only result this containment build can produce. */
export const UNKNOWN_VISUAL_CHECK_RESULT: VisualCheckResult = Object.freeze({
  status: 'UNKNOWN',
  reason: 'FEATURE_NOT_APPROVED',
});

export const UNAVAILABLE_VISUAL_CHECK_CONSENT: VisualCheckConsentShell = Object.freeze({
  stage: 'UNAVAILABLE_PENDING_APPROVAL',
  cameraPermission: 'NOT_REQUESTED',
  dataAccess: 'NO_IMAGE_ACCESS',
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

export function unavailableVisualCheckConsent(): VisualCheckConsentShell {
  return UNAVAILABLE_VISUAL_CHECK_CONSENT;
}
