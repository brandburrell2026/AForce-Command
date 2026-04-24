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

  it('palette has exactly 4 distinct colors', () => {
    expect(GLOW_PALETTE.length).toBe(4);
    expect(new Set(GLOW_PALETTE).size).toBe(4);
  });

  it('palette includes red so the original Depleted vibe is preserved', () => {
    expect(GLOW_PALETTE[0]).toBe('#FF2D55');
  });

  it('cycles through ALL 4 colors across the real broadcast pools', () => {
    // Across the real id-namespaces (action + identity + every status
    // variant the engine emits), every palette color appears at least
    // once. This guards against a hash collision regression where the
    // rotation degenerates to fewer than 4 colors in practice.
    const seeds = [
      ...ACTION_BROADCASTS.map(b => b.id),
      ...IDENTITY_BROADCASTS.map(b => b.id),
      'status-peak-0', 'status-peak-1', 'status-peak-2',
      'status-balanced-0', 'status-balanced-1', 'status-balanced-2',
      'status-recovering-0', 'status-recovering-1', 'status-recovering-2',
      'status-depleted-0', 'status-depleted-1', 'status-depleted-2',
    ];
    const used = new Set(seeds.map(pickGlowAccent));
    expect(used.size).toBe(GLOW_PALETTE.length);
  });

  it('null / undefined / empty seed returns a valid palette color (no throw)', () => {
    expect(GLOW_PALETTE).toContain(pickGlowAccent(undefined));
    expect(GLOW_PALETTE).toContain(pickGlowAccent(null));
    expect(GLOW_PALETTE).toContain(pickGlowAccent(''));
  });
});
