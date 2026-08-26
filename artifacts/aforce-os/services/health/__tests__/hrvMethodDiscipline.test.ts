/**
 * HRV method discipline — the source-scan half of the G1 lock (the registry
 * half lives in lib/health-core/src/__tests__/hrvMethodRegistry.test.ts,
 * which is node-API-free by design).
 *
 * RMSSD and SDNN measure different things and must never be conflated. These
 * pins keep the shipped discipline from drifting silently.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const HEALTH = resolve(__dirname, '..');

function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

describe('conflation cannot happen downstream (source-pinned discipline)', () => {
  it('the Health Connect mapper hard-codes RMSSD and guards against sdnn', () => {
    const src = stripComments(
      readFileSync(resolve(HEALTH, 'healthConnect', 'mapRecords.ts'), 'utf8'),
    );
    expect(src).toMatch(/GOOGLE_HRV_METHOD:\s*HrvMethod\s*=\s*'rmssd'/);
    expect(
      /:\s*'sdnn'/.test(src),
      'mapRecords.ts must never assign sdnn — HC HRV records are RMSSD by definition',
    ).toBe(false);
  });

  it('readiness consumption is method-gated — rmssd read only under an explicit method check', () => {
    const src = stripComments(readFileSync(resolve(HEALTH, 'readinessSignals.ts'), 'utf8'));
    expect(src).toMatch(/method\s*===\s*'rmssd'/);
  });
});
