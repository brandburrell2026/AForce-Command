import { describe, expect, it, vi } from 'vitest';

vi.mock('expo', () => ({ requireOptionalNativeModule: () => null }));

import {
  hydroScanLabelTextAvailable,
  parseHydroScanTextResult,
  recognizeLabelText,
} from '../../modules/hydroscan-label-text';

describe('HydroScan label text bridge', () => {
  it('returns null when the native module is absent (web, tests, an older build)', async () => {
    expect(hydroScanLabelTextAvailable()).toBe(false);
    expect(await recognizeLabelText({} as never)).toBeNull();
  });

  it('keeps text, confidence and a 0..1 box, and strips everything else', () => {
    const out = parseHydroScanTextResult({
      state: 'OK',
      lines: [{ text: '20 FL OZ', confidence: 0.9, box: { x: 0.1, y: 0.2, width: 0.3, height: 0.05 }, pixels: [1, 2] }],
    });
    expect(out).toEqual([{ text: '20 FL OZ', confidence: 0.9, box: { x: 0.1, y: 0.2, width: 0.3, height: 0.05 } }]);
    expect(JSON.stringify(out)).not.toContain('pixels');
  });

  it('fails closed on anything that is not an OK list', () => {
    for (const v of [null, 'x', {}, { state: 'UNAVAILABLE' }, { state: 'OK' }, { state: 'OK', lines: 'no' }]) {
      expect(parseHydroScanTextResult(v)).toBeNull();
    }
  });

  it('drops malformed lines, bad numbers and caps size', () => {
    const out = parseHydroScanTextResult({
      state: 'OK',
      lines: [{ text: 5 }, null, { text: 'A', confidence: 7, box: { x: 2, y: 0, width: 1, height: 1 } }, { text: 'B'.repeat(500) }],
    })!;
    expect(out[0]).toEqual({ text: 'A' });
    expect(out[1]!.text.length).toBe(200);
    expect(parseHydroScanTextResult({ state: 'OK', lines: Array(300).fill({ text: 'x' }) })!.length).toBe(120);
  });
});
