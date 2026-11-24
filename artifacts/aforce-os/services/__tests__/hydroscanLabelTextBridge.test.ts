import { describe, expect, it, vi } from 'vitest';

vi.mock('expo', () => ({ requireOptionalNativeModule: () => null }));

import {
  hydroScanLabelTextAvailable,
  parseHydroScanFrameResult,
  parseHydroScanTextResult,
  recognizeLabelFrame,
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

describe('HydroScan frame result: the box, shape and brightness fail closed', () => {
  const lines = [{ text: 'WATER', confidence: 0.9, box: { x: 0.3, y: 0.3, width: 0.3, height: 0.05 } }];

  it('keeps a valid box, shape and brightness', () => {
    const f = parseHydroScanFrameResult({
      state: 'OK',
      lines,
      object: { x: 0.3, y: 0.2, width: 0.4, height: 0.6, confidence: 0.8 },
      aspect: 0.75,
      brightness: 0.4,
    });
    expect(f).toEqual({ lines, object: { x: 0.3, y: 0.2, width: 0.4, height: 0.6 }, aspect: 0.75, brightness: 0.4 });
  });

  it('a platform that reports only text (Android today) gives nulls, not guesses', () => {
    expect(parseHydroScanFrameResult({ state: 'OK', lines })).toEqual({ lines, object: null, aspect: null, brightness: null });
  });

  it('drops anything out of range and fails closed on a bad result', () => {
    const f = parseHydroScanFrameResult({ state: 'OK', lines, object: { x: 2, y: 0, width: 1, height: 1 }, aspect: 40, brightness: 7 });
    expect(f).toEqual({ lines, object: null, aspect: null, brightness: null });
    expect(parseHydroScanFrameResult({ state: 'UNAVAILABLE' })).toBeNull();
    expect(parseHydroScanFrameResult(null)).toBeNull();
  });
});

describe('HydroScan frame bridge', () => {
  it('returns null when the native module is absent', async () => {
    expect(await recognizeLabelFrame({} as never)).toBeNull();
  });
});
