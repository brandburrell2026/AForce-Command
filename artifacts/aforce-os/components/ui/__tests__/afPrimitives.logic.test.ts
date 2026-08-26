/**
 * F2 — pure logic guards for the af.* primitive library.
 * The geometry math (arc/ring dashoffsets) and button-phase precedence are the
 * error-prone parts; pin them here so the RN components stay thin wrappers.
 */
import { describe, it, expect } from 'vitest';
import { ringHalo } from '../afPrimitives.logic';

describe('ringHalo (P-A ring-alive glow)', () => {
  it('swells opacity + width from rest (0) to peak (1)', () => {
    const rest = ringHalo(0, 6);
    const peak = ringHalo(1, 6);
    expect(peak.opacity).toBeGreaterThan(rest.opacity);
    expect(peak.width).toBeGreaterThan(rest.width);
  });
  it('stays a subtle glow (never opaque, always wider than the stroke)', () => {
    for (const b of [0, 0.5, 1]) {
      const h = ringHalo(b, 6);
      expect(h.opacity).toBeGreaterThan(0);
      expect(h.opacity).toBeLessThan(0.5);
      expect(h.width).toBeGreaterThan(6);
    }
  });
  it('clamps out-of-range breath (guards NaN/overshoot)', () => {
    expect(ringHalo(2, 6).opacity).toBe(ringHalo(1, 6).opacity);
    expect(ringHalo(-1, 6).opacity).toBe(ringHalo(0, 6).opacity);
  });
});
import {
  clampProgress,
  ringGeometry,
  arcGeometry,
  trendOf,
  buttonPhase,
  buttonIsInert,
  chartScale,
  timelineStepIsActionable,
  commandReasonLine,
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

describe('chartScale', () => {
  it('spans the padded width and inverts y (max at top)', () => {
    const { points, min, max } = chartScale([10, 20, 30], 100, 50, 6);
    expect(min).toBe(10);
    expect(max).toBe(30);
    expect(points[0].x).toBe(6);
    expect(points[2].x).toBe(94);
    // Highest value → smallest y (top); lowest → largest y (bottom).
    expect(points[2].y).toBeLessThan(points[0].y);
    expect(points[2].y).toBeCloseTo(6, 6); // max pins to top pad
    expect(points[0].y).toBeCloseTo(44, 6); // min pins to bottom (height-pad)
  });
  it('pins a flat series to the mid-line instead of dividing by zero', () => {
    const { points } = chartScale([5, 5, 5], 100, 50, 6);
    for (const p of points) expect(p.y).toBeCloseTo(25, 6);
  });
  it('handles empty input', () => {
    expect(chartScale([], 100, 50)).toEqual({ points: [], polyline: '', min: 0, max: 0 });
  });
});

describe('timelineStepIsActionable', () => {
  it('is true only for current + upcoming', () => {
    expect(timelineStepIsActionable('current')).toBe(true);
    expect(timelineStepIsActionable('upcoming')).toBe(true);
    expect(timelineStepIsActionable('completed')).toBe(false);
    expect(timelineStepIsActionable('locked')).toBe(false);
    expect(timelineStepIsActionable('hold')).toBe(false);
  });
});

describe('commandReasonLine (Wave-5 inline WHY)', () => {
  // Real strings from locales/en.json `coach.*_explanation`, so the split is
  // pinned against the copy the card actually receives, not invented samples.
  it('takes the first sentence of a real band explanation', () => {
    expect(
      commandReasonLine('Deep recovery window. Electrolytes will restore your balance.')?.line,
    ).toBe('Deep recovery window.');
    expect(
      commandReasonLine('Recovery window opening. A water cycle now keeps you in flow.')?.line,
    ).toBe('Recovery window opening.');
    expect(
      commandReasonLine(
        "You're locked in — notice what peak feels like. Add a stick if the heat or your effort ramps up.",
      )?.line,
    ).toBe("You're locked in — notice what peak feels like.");
  });

  it('does not break a sentence at a decimal point or an abbreviation-style period', () => {
    expect(commandReasonLine('Overnight took 1.5 L out of you. Reset your baseline.')?.line).toBe(
      'Overnight took 1.5 L out of you.',
    );
  });

  it('returns a single-sentence rationale whole, with nothing left to disclose', () => {
    const single = "You're holding steady, but the heat's raising the bar — stay a step ahead of it.";
    expect(commandReasonLine(single)).toEqual({ line: single, hasMore: false });
  });

  it('flags hasMore whenever the full text says more than the line', () => {
    const two = 'Deep recovery window. Electrolytes will restore your balance.';
    expect(commandReasonLine(two)?.hasMore).toBe(true);
  });

  it('collapses newlines/runs of whitespace so the line can never wrap the card', () => {
    const r = commandReasonLine('Deep recovery\n  window now');
    expect(r?.line).toBe('Deep recovery window now');
    expect(r?.line).not.toMatch(/\s{2,}|\n/);
  });

  it('cuts an over-long single sentence at a word boundary with an ellipsis', () => {
    const long = `${'word '.repeat(40)}end.`;
    const r = commandReasonLine(long, 24);
    expect(r?.line.length).toBeLessThanOrEqual(24);
    expect(r?.line.endsWith('…')).toBe(true);
    expect(r?.line).not.toMatch(/ …$/); // no dangling space before the ellipsis
    expect(r?.hasMore).toBe(true); // the disclosure still holds the full text
  });

  it('renders nothing rather than an empty row when there is no rationale', () => {
    expect(commandReasonLine(undefined)).toBeNull();
    expect(commandReasonLine(null)).toBeNull();
    expect(commandReasonLine('')).toBeNull();
    expect(commandReasonLine('   \n ')).toBeNull();
  });

  it('never invents or reorders copy — the line is always a prefix of the normalised rationale', () => {
    const src = 'Deep recovery window. Electrolytes will restore your balance.';
    const line = commandReasonLine(src)!.line;
    expect(src.startsWith(line)).toBe(true);
  });
});
