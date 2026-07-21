/**
 * F2 — pure logic guards for the af.* primitive library.
 * The geometry math (arc/ring dashoffsets) and button-phase precedence are the
 * error-prone parts; pin them here so the RN components stay thin wrappers.
 */
import { describe, it, expect } from 'vitest';
import {
  clampProgress,
  ringGeometry,
  arcGeometry,
  trendOf,
  buttonPhase,
  buttonIsInert,
} from '../afPrimitives.logic';

describe('clampProgress', () => {
  it('clamps to 0…1 and neutralizes non-finite input', () => {
    expect(clampProgress(0.5)).toBe(0.5);
    expect(clampProgress(-1)).toBe(0);
    expect(clampProgress(2)).toBe(1);
    expect(clampProgress(NaN)).toBe(0);
    expect(clampProgress(Infinity)).toBe(0);
  });
});

describe('ringGeometry', () => {
  it('insets the radius by half the stroke and derives circumference', () => {
    const g = ringGeometry(100, 10, 1);
    expect(g.radius).toBe(45);
    expect(g.circumference).toBeCloseTo(2 * Math.PI * 45, 6);
  });
  it('dashoffset is full at 0, empty at 1, half at 0.5', () => {
    const g0 = ringGeometry(100, 10, 0);
    const g1 = ringGeometry(100, 10, 1);
    const gh = ringGeometry(100, 10, 0.5);
    expect(g0.dashoffset).toBeCloseTo(g0.circumference, 6);
    expect(g1.dashoffset).toBeCloseTo(0, 6);
    expect(gh.dashoffset).toBeCloseTo(gh.circumference / 2, 6);
  });
});

describe('arcGeometry', () => {
  it('arc length is the swept fraction of the circumference', () => {
    const g = arcGeometry(100, 10, 1, 270);
    expect(g.arcLength).toBeCloseTo(g.circumference * (270 / 360), 6);
    expect(g.dashArray).toBe(`${g.arcLength} ${g.circumference}`);
  });
  it('fills the arc proportionally to progress', () => {
    const g = arcGeometry(100, 10, 0.5, 270);
    expect(g.dashoffset).toBeCloseTo(g.arcLength * 0.5, 6);
  });
});

describe('trendOf', () => {
  it('maps sign to direction with an accessible glyph, flat for 0/null', () => {
    expect(trendOf(3)).toEqual({ direction: 'up', sign: '+' });
    expect(trendOf(-2).direction).toBe('down');
    expect(trendOf(-2).sign).toBe('−'); // U+2212, not hyphen
    expect(trendOf(0)).toEqual({ direction: 'flat', sign: '' });
    expect(trendOf(null)).toEqual({ direction: 'flat', sign: '' });
  });
});

describe('button phase precedence', () => {
  it('disabled > loading > pressed > default', () => {
    expect(buttonPhase({ disabled: true, loading: true, pressed: true })).toBe('disabled');
    expect(buttonPhase({ loading: true, pressed: true })).toBe('loading');
    expect(buttonPhase({ pressed: true })).toBe('pressed');
    expect(buttonPhase({})).toBe('default');
  });
  it('is inert while disabled or loading', () => {
    expect(buttonIsInert({ disabled: true })).toBe(true);
    expect(buttonIsInert({ loading: true })).toBe(true);
    expect(buttonIsInert({})).toBe(false);
  });
});
