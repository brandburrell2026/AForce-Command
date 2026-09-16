import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const doc = readFileSync(resolve(__dirname, '..', '..', '..', '..', 'docs', 'skinia', 'CONTROLLED-TESTFLIGHT-READINESS.md'), 'utf8');

describe('SkinIA controlled TestFlight readiness documentation', () => {
  it('preserves the controlled cohort and public-release lock', () => {
    expect(doc).toContain('server-resolved, controlled-TestFlight cohort gate');
    expect(doc).toContain('Public production remains prohibited');
    expect(doc).toContain('separate explicit founder decision');
  });

  it('makes the current non-capture scope and QA limits explicit', () => {
    expect(doc).toContain('requests camera permission');
    expect(doc).toContain('attach raw images');
    expect(doc).toContain('static results fixture is unreachable from member navigation');
  });

  it('lists required non-result states and evidence blockers', () => {
    for (const state of ['UNKNOWN', 'NOT_ENOUGH_INFORMATION', 'CAPTURE_QUALITY_INSUFFICIENT', 'NO_COMPARABLE_BASELINE']) expect(doc).toContain(state);
    expect(doc).toContain('auto-exposure and auto-white-balance');
    expect(doc).toContain('independent review of the evidence');
  });

  it('states zero-retention cleanup for every exit path', () => {
    for (const exit of ['success', 'failure', 'timeout', 'cancellation', 'consent withdrawal', 'abandonment']) expect(doc).toContain(exit);
    expect(doc).toContain('delete the temporary raw image immediately');
  });
});
