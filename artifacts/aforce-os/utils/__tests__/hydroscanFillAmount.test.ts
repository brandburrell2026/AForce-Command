import { describe, expect, it } from 'vitest';

import {
  activeChip,
  drunkOz,
  fillChips,
  loggableOz,
  ozToMl,
  remainingShare,
  shareFromTrack,
  shareWords,
} from '../hydroscan/fillAmount';

describe('HydroScan fill line: the fill, the slider and the amount are one number', () => {
  it("the film's half bottle: half of 16.9 fl oz is 8.5 fl oz, 251 mL, with half left", () => {
    expect(drunkOz(16.9, 0.5)).toBe(8.5);
    expect(ozToMl(8.5)).toBe(251);
    expect(remainingShare(0.5)).toBe(0.5);
    expect(shareWords(0.5)).toBe('About half');
    expect(activeChip(16.9, 0.5)).toBe('half');
  });

  it('Sip, a quarter, half, three quarters and All, in that order', () => {
    expect(fillChips(16.9).map((c) => c.label)).toEqual(['Sip', '¼', '½', '¾', 'All']);
    expect(fillChips(12).map((c) => drunkOz(12, c.share))).toEqual([1, 3, 6, 9, 12]);
  });

  it('a sip is one ounce, or the whole of a container smaller than that', () => {
    expect(drunkOz(16.9, fillChips(16.9)[0]!.share)).toBe(1);
    expect(drunkOz(0.8, fillChips(0.8)[0]!.share)).toBe(0.8);
  });

  it('all of it empties the container; nothing drunk leaves it full', () => {
    expect(drunkOz(12, 1)).toBe(12);
    expect(remainingShare(1)).toBe(0);
    expect(remainingShare(0)).toBe(1);
    expect(shareWords(0)).toBe('');
    expect(shareWords(1)).toBe('All of it');
  });

  it('a drag between the chips lights no chip and still gives an amount', () => {
    expect(activeChip(16.9, 0.62)).toBeNull();
    expect(drunkOz(16.9, 0.62)).toBe(10.5);
  });

  it('out-of-range input is clamped, never extrapolated', () => {
    expect(drunkOz(12, 4)).toBe(12);
    expect(drunkOz(12, -1)).toBe(0);
    expect(drunkOz(0, 0.5)).toBe(0);
    expect(shareFromTrack(1.4)).toBe(1);
    expect(shareFromTrack(-0.2)).toBe(0);
    expect(shareFromTrack(0.504)).toBe(0.5);
    expect(shareFromTrack(Number.NaN)).toBe(0);
  });

  it('only an amount within the single-log limits can be logged', () => {
    expect(loggableOz(16.9, 0.5)).toBe(8.5);
    expect(loggableOz(16.9, 0)).toBeNull();
    expect(loggableOz(16.9, 0.01)).toBeNull();
    expect(loggableOz(128, 1)).toBeNull();
  });
});
