import { describe, expect, it } from 'vitest';
import {
  ADVANCED_VISUAL_INTELLIGENCE_NAME,
  SKINIA_MEMBER_LABEL,
  UNAVAILABLE_VISUAL_CHECK_CONSENT,
  UNKNOWN_VISUAL_CHECK_RESULT,
  unavailableVisualCheckConsent,
  unavailableVisualCheckResult,
  visualCheckShellViewedEvent,
  visualCheckUnavailableViewedEvent,
} from '../advancedVisualIntelligence';

describe('Advanced Visual Intelligence™ containment contract', () => {
  it('uses the approved canonical and member-facing names', () => {
    expect(ADVANCED_VISUAL_INTELLIGENCE_NAME).toBe('Advanced Visual Intelligence™');
    expect(SKINIA_MEMBER_LABEL).toBe('SkinIA Visual Check');
  });

  it('can only return an explicit unknown result', () => {
    expect(unavailableVisualCheckResult()).toEqual(UNKNOWN_VISUAL_CHECK_RESULT);
    expect(UNKNOWN_VISUAL_CHECK_RESULT).toEqual({ status: 'UNKNOWN', reason: 'FEATURE_NOT_APPROVED' });
  });

  it('exposes only a non-interactive, no-access consent checkpoint', () => {
    expect(unavailableVisualCheckConsent()).toEqual(UNAVAILABLE_VISUAL_CHECK_CONSENT);
    expect(UNAVAILABLE_VISUAL_CHECK_CONSENT).toEqual({
      stage: 'UNAVAILABLE_PENDING_APPROVAL',
      cameraPermission: 'NOT_REQUESTED',
      dataAccess: 'NO_IMAGE_ACCESS',
    });
  });

  it('defines shell analytics without visual, biometric, or device data', () => {
    const events = [visualCheckShellViewedEvent(), visualCheckUnavailableViewedEvent()];
    expect(events).toEqual([
      {
        name: 'skinia_shell_viewed',
        properties: { featureStatus: 'FEATURE_NOT_APPROVED', surface: 'skinia_visual_check' },
      },
      {
        name: 'skinia_unavailable_viewed',
        properties: { featureStatus: 'FEATURE_NOT_APPROVED', surface: 'skinia_visual_check' },
      },
    ]);
    for (const event of events) {
      expect(Object.keys(event.properties)).toEqual(['featureStatus', 'surface']);
    }
  });
});
