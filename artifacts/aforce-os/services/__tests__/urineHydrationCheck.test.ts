import { describe, it, expect } from 'vitest';
import {
  assessUrineColor,
  URINE_COLOR_OPTIONS,
  URINE_DISCLAIMER,
  type UrineColor,
} from '../urineHydrationCheck';

describe('Urine Hydration Check — color → verdict mapping (spec)', () => {
  it('exposes the four color inputs in spec order (clear → dark)', () => {
    expect(URINE_COLOR_OPTIONS.map((o) => o.color)).toEqual([
      'clear',
      'light_yellow',
      'yellow',
      'dark_yellow',
    ]);
    expect(URINE_COLOR_OPTIONS.map((o) => o.label)).toEqual([
      'Clear',
      'Light Yellow',
      'Yellow',
      'Dark Yellow',
    ]);
  });

  it('exposes the non-medical disclaimer verbatim per spec', () => {
    expect(URINE_DISCLAIMER).toBe(
      'Use urine color as a simple hydration signal. Not a medical test.',
    );
  });

  it.each<[UrineColor, string, string]>([
    ['clear', 'Hydration Appears Stable', 'stable'],
    ['light_yellow', 'Good Hydration Range', 'good'],
    ['yellow', 'Hydration Support Suggested', 'support'],
    ['dark_yellow', 'Hydration Correction Recommended', 'correction'],
  ])('maps %s → "%s" (severity=%s)', (color, verdict, severity) => {
    const result = assessUrineColor(color);
    expect(result.color).toBe(color);
    expect(result.verdict).toBe(verdict);
    expect(result.severity).toBe(severity);
    expect(result.colorLabel).toBeTruthy();
    expect(result.detail).toBeTruthy();
    expect(result.recommendation).toBeTruthy();
    expect(result.hex).toMatch(/^#[0-9A-F]{6}$/i);
  });

  it('uses the natural AForce positioning language for support/correction', () => {
    expect(assessUrineColor('yellow').recommendation).toMatch(
      /hydration efficiency support/,
    );
    expect(assessUrineColor('dark_yellow').recommendation).toMatch(
      /mineral recovery support/,
    );
  });

  it('does not push AForce when hydration is already stable / good', () => {
    expect(assessUrineColor('clear').recommendation).not.toMatch(/AForce/);
    expect(assessUrineColor('light_yellow').recommendation).not.toMatch(/AForce/);
  });

  it('never uses aggressive "Take 1" verbs and prefers 12 oz pour where applicable', () => {
    for (const opt of URINE_COLOR_OPTIONS) {
      const r = assessUrineColor(opt.color);
      expect(r.recommendation).not.toMatch(/^Take 1\b/);
      expect(r.verdict).not.toMatch(/\bnot optimal\b/);
    }
    expect(assessUrineColor('light_yellow').recommendation).toMatch(/12 oz water/);
    expect(assessUrineColor('yellow').recommendation).toMatch(/12 oz water/);
  });
});
