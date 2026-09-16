import { describe, expect, it } from 'vitest';
import { skinIAInternalTelemetryEvent } from '../skiniaInternalTelemetry';

describe('SkinIA internal telemetry contract', () => {
  it('emits only cohort-safe outcome metadata', () => {
    const event = skinIAInternalTelemetryEvent({ kind: 'NON_RESULT', message: 'Unable to make a reliable observation.', reason: 'INSUFFICIENT_CONFIDENCE' });
    expect(event).toEqual({ name: 'skinia_internal_non_result', properties: { releaseScope: 'INTERNAL_TESTFLIGHT_ONLY', outcome: 'NON_RESULT', reason: 'INSUFFICIENT_CONFIDENCE' } });
    expect(JSON.stringify(event)).not.toMatch(/image|pixel|face|device|member/i);
  });
});
