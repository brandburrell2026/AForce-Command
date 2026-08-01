import { describe, it, expect } from 'vitest';
import { afMotion } from '@/theme';
import {
  shouldAnimate,
  pressScale,
  shouldFireHaptic,
  shimmerEnabled,
} from '../motionLogic';

describe('afMotion tokens (E3 additions)', () => {
  it('exposes a cinematic tier and the fast/standard/slow scale', () => {
    expect(afMotion.durations.fast).toBe(120);
    expect(afMotion.durations.standard).toBe(220);
    expect(afMotion.durations.slow).toBe(360);
    expect(afMotion.durations.cinematic).toBe(700);
  });
  it('keeps the pinned legacy values', () => {
    expect(afMotion.durations.selection).toBe(150);
    expect(afMotion.durations.pulse).toBe(3200);
  });
  it('defines a rest/pressed scale pair', () => {
    expect(afMotion.scale.rest).toBe(1);
    expect(afMotion.scale.pressed).toBeLessThan(1);
  });
});

describe('shouldAnimate — the reduced-motion contract', () => {
  it('animates only when enabled AND not reduced-motion', () => {
    expect(shouldAnimate({ enabled: true, reducedMotion: false })).toBe(true);
    expect(shouldAnimate({ enabled: true, reducedMotion: true })).toBe(false);
    expect(shouldAnimate({ enabled: false, reducedMotion: false })).toBe(false);
  });
});

describe('pressScale', () => {
  it('compresses on press when animating', () => {
    expect(pressScale({ animate: true, pressed: true })).toBe(afMotion.scale.pressed);
    expect(pressScale({ animate: true, pressed: false })).toBe(1);
  });
  it('stays at rest (never jumps) when motion is off — the static alternative', () => {
    expect(pressScale({ animate: false, pressed: true })).toBe(1);
    expect(pressScale({ animate: false, pressed: false })).toBe(1);
  });
  it('honors a custom pressedScale', () => {
    expect(pressScale({ animate: true, pressed: true, pressedScale: 0.9 })).toBe(0.9);
  });
});

describe('shouldFireHaptic — meaningful-only, respects switches', () => {
  it('fires when enabled and not reduced', () => {
    expect(shouldFireHaptic('success', { enabled: true })).toBe(true);
  });
  it('never fires when disabled', () => {
    expect(shouldFireHaptic('selection', { enabled: false })).toBe(false);
  });
  it('never fires under reduce-haptics', () => {
    expect(shouldFireHaptic('impact', { enabled: true, reducedHaptics: true })).toBe(false);
  });
});

describe('shimmerEnabled', () => {
  it('mirrors shouldAnimate', () => {
    expect(shimmerEnabled({ enabled: true, reducedMotion: false })).toBe(true);
    expect(shimmerEnabled({ enabled: true, reducedMotion: true })).toBe(false);
  });
});
