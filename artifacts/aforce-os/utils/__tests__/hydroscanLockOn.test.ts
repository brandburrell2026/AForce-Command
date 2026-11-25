import { describe, expect, it } from 'vitest';

import { createEvidence, readEvidence, type Reading } from '../hydroscan/labelEvidence';
import {
  boxOnView,
  confidenceBars,
  hasLight,
  isSteady,
  lockPill,
  lockStage,
  matchedBy,
  readout,
  reliableBounds,
  unionOfLines,
} from '../hydroscan/lockOn';

const empty = readEvidence(createEvidence());
const with_ = (patch: Partial<Reading>): Reading => ({ ...empty, ...patch });
const water = with_({
  status: 'ready',
  samples: 3,
  drinkType: { value: 'water', confidence: 'confirmed', source: 'label' },
  volume: { value: 16.9, confidence: 'confirmed', source: 'label' },
});

describe('HydroScan lock-on: Searching, Reading, Locked come from what was read', () => {
  it('nothing read yet is Searching, with every field blank', () => {
    expect(lockStage(empty)).toBe('searching');
    expect(readout(empty)).toEqual({ drink: null, size: null, level: null, match: null, bars: 0 });
  });

  it('a still or a barcode with no result yet is Reading', () => {
    expect(lockStage(with_({ samples: 1 }))).toBe('reading');
    expect(lockStage(with_({ barcodeCode: '012345678905' }))).toBe('reading');
  });

  it('a question is not a lock; only a ready result is', () => {
    expect(lockStage(with_({ samples: 4, status: 'question' }))).toBe('reading');
    expect(lockStage(water)).toBe('locked');
  });

  it('the readout shows only resolved fields, and never a level', () => {
    expect(readout(water)).toEqual({ drink: 'WATER', size: '16.9 FL OZ', level: null, match: 'LABEL', bars: 3 });
    const noSize = with_({ ...water, volume: { value: null, confidence: 'unknown', source: null } });
    expect(readout(noSize).size).toBeNull();
  });

  it('a brand read from the barcode says so', () => {
    const can = with_({ status: 'ready', brand: { value: 'Aforce', confidence: 'likely', source: 'barcode' } });
    expect(readout(can)).toMatchObject({ drink: 'AFORCE', match: 'BARCODE', bars: 2 });
    expect(matchedBy(can)).toBe('Matched by barcode');
    expect(matchedBy(water)).toBe('Matched by label');
    expect(matchedBy(empty)).toBeNull();
  });

  it('bars follow confidence and the pill names what was locked', () => {
    expect([confidenceBars('unknown'), confidenceBars('likely'), confidenceBars('confirmed')]).toEqual([0, 2, 3]);
    expect(lockPill('Water')).toBe('Locked · Water');
    expect(lockPill('AFORCE · Watermelon')).toBe('Locked · AFORCE · Watermelon');
  });
});

describe('HydroScan brackets settle only on reliable bounds', () => {
  const centred = { x: 0.3, y: 0.2, width: 0.4, height: 0.6 };

  it('accepts a drink held in the middle of the picture', () => {
    expect(reliableBounds(centred)).toEqual(centred);
  });

  it('rejects a sliver, the whole frame, and something off to the side', () => {
    expect(reliableBounds({ x: 0.45, y: 0.45, width: 0.05, height: 0.05 })).toBeNull();
    expect(reliableBounds({ x: 0, y: 0, width: 1, height: 1 })).toBeNull();
    expect(reliableBounds({ x: 0, y: 0.2, width: 0.2, height: 0.5 })).toBeNull();
    expect(reliableBounds(null)).toBeNull();
    expect(reliableBounds({ x: Number.NaN, y: 0, width: 0.4, height: 0.5 })).toBeNull();
  });

  it('falls back to the box around the label text, and needs two lines for it', () => {
    const lines = [
      { box: { x: 0.35, y: 0.3, width: 0.3, height: 0.05 } },
      { box: { x: 0.4, y: 0.6, width: 0.2, height: 0.05 } },
    ];
    const u = unionOfLines(lines)!;
    expect(u.x).toBeCloseTo(0.29);
    expect(u.y).toBeCloseTo(0.24);
    expect(u.x + u.width).toBeCloseTo(0.71);
    expect(u.y + u.height).toBeCloseTo(0.71);
    expect(reliableBounds(null, lines)).not.toBeNull();
    expect(unionOfLines([lines[0]!])).toBeNull();
    expect(unionOfLines(null)).toBeNull();
  });

  it('maps a picture box onto a preview that covers the screen', () => {
    // A 3:4 picture on a 400 by 800 view is shown 600 wide, cropped 100 each side.
    const b = boxOnView({ x: 0.25, y: 0.25, width: 0.5, height: 0.5 }, 0.75, { width: 400, height: 800 })!;
    expect(b).toEqual({ x: 50, y: 200, width: 300, height: 400 });
    // The part cropped off the side is clamped to the screen.
    const edge = boxOnView({ x: 0, y: 0.25, width: 0.5, height: 0.5 }, 0.75, { width: 400, height: 800 })!;
    expect(edge.x).toBe(0);
    expect(edge.width).toBe(200);
    expect(boxOnView({ x: 0.25, y: 0.25, width: 0.5, height: 0.5 }, 0, { width: 400, height: 800 })).toBeNull();
    expect(boxOnView({ x: 0.25, y: 0.25, width: 0.5, height: 0.5 }, 0.75, { width: 0, height: 0 })).toBeNull();
  });

  it('steady and light are unknown until measured', () => {
    expect(isSteady(null, centred)).toBeNull();
    expect(isSteady(centred, { ...centred, x: 0.31 })).toBe(true);
    expect(isSteady(centred, { x: 0.05, y: 0.5, width: 0.3, height: 0.3 })).toBe(false);
    expect(hasLight(null)).toBeNull();
    expect(hasLight(0.05)).toBe(false);
    expect(hasLight(0.5)).toBe(true);
  });
});
