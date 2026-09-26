import { describe, expect, it } from 'vitest';
import { resolveSkinIAReviewPresentation } from '../skiniaReviewPresentation';
import { SKINIA_PHASE1_NON_RESULT } from '../skiniaPhase1Policy';
import type { SkinIAObservationOutcome } from '../skiniaObservationPipeline';

const highLookingOutcome: SkinIAObservationOutcome = {
  kind: 'OBSERVATION',
  observation: 'VISIBLE_REDNESS',
  confidence: 'HIGH',
  capturedAt: '2026-09-23T00:00:00.000Z',
  comparison: 'PERSONAL_BASELINE',
};

describe('SkinIA accepted-capture presentation', () => {
  it('explains an accepted internal QA capture without claiming a skin finding', () => {
    const view = resolveSkinIAReviewPresentation(null, true);
    expect(view).toEqual({
      title: 'Capture check passed',
      kicker: 'INTERNAL QA CAPTURE RESULT',
      body: 'The image passed technical capture checks. This is not a skin reading.',
      qaNote: 'SkinIA observations are still under review. Another scan will not unlock a finding in this build.',
      action: 'Back to SkinIA',
      qaCode: 'OBSERVATIONS_NOT_ADMITTED',
    });
  });

  it('still blocks a synthetic high-confidence result from the member', () => {
    const view = resolveSkinIAReviewPresentation(highLookingOutcome, true);
    expect(view.body).toContain('not a skin reading');
    expect(view.qaCode).toBe('OBSERVATIONS_NOT_ADMITTED');
    expect(JSON.stringify(view)).not.toContain('VISIBLE_REDNESS');
  });

  it('keeps internal status text out of non-internal builds', () => {
    const view = resolveSkinIAReviewPresentation(null, false);
    expect(view.title).toBe('Unable to Analyze');
    expect(view.body).toBe(SKINIA_PHASE1_NON_RESULT);
    expect(view.qaNote).toBeNull();
    expect(view.qaCode).toBeNull();
  });
});
