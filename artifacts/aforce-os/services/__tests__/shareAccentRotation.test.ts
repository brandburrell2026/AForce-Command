import { describe, it, expect } from 'vitest';
import { pickGlowAccent, GLOW_PALETTE } from '../shareAccentRotation';
import {
  ACTION_BROADCASTS,
  IDENTITY_BROADCASTS,
} from '../../data/shareBroadcasts';

describe('pickGlowAccent', () => {
  it('always returns a color from the 4-color palette', () => {
    const inputs = [
      'id-become', 'id-inside', 'id-not-drink', 'id-clean-af',
      'act-aforce', 'act-restore', 'act-cycle', 'act-hydrate',
      'status-balanced-0', 'status-peak-1', '', 'x', 'foo bar baz',
    ];
    for (const seed of inputs) {
      expect(GLOW_PALETTE).toContain(pickGlowAccent(seed));
    }
  });

  it('is deterministic — same seed always returns same color', () => {
    expect(pickGlowAccent('id-become')).toBe(pickGlowAccent('id-become'));
    expect(pickGlowAccent('act-aforce')).toBe(pickGlowAccent('act-aforce'));
  });

  it('palette is a single red entry', () => {
    expect(GLOW_PALETTE.length).toBe(1);
    expect(GLOW_PALETTE[0]).toBe('#FF0026');
  });

  it('every broadcast id resolves to red', () => {
    const seeds = [
      ...ACTION_BROADCASTS.map(b => b.id),
      ...IDENTITY_BROADCASTS.map(b => b.id),
      'status-peak-0', 'status-balanced-0', 'status-recovering-0', 'status-depleted-0',
    ];
    for (const seed of seeds) {
      expect(pickGlowAccent(seed)).toBe('#FF0026');
    }
  });

  it('null / undefined / empty seed returns a valid palette color (no throw)', () => {
    expect(GLOW_PALETTE).toContain(pickGlowAccent(undefined));
    expect(GLOW_PALETTE).toContain(pickGlowAccent(null));
    expect(GLOW_PALETTE).toContain(pickGlowAccent(''));
  });
});
