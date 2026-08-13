import { describe, it, expect } from 'vitest';
import { af } from '@/theme';
import { contrast } from '@/theme/__tests__/_wcagContrast';
import {
  normalizeBand,
  resolveHomePresentation,
  resolveArcAnimation,
  resolveArcDimensions,
} from '../homePresentation';

const BANDS = ['PEAK', 'BALANCED', 'RECOVERING', 'DEPLETED'] as const;

describe('normalizeBand', () => {
  it('accepts the four bands case-insensitively', () => {
    expect(normalizeBand('PEAK')).toBe('PEAK');
    expect(normalizeBand('balanced')).toBe('BALANCED');
    expect(normalizeBand('Recovering')).toBe('RECOVERING');
    expect(normalizeBand('DEPLETED')).toBe('DEPLETED');
  });
  it('falls back to BALANCED for unknown / empty (presentation-safe)', () => {
    expect(normalizeBand(undefined)).toBe('BALANCED');
    expect(normalizeBand(null)).toBe('BALANCED');
    expect(normalizeBand('WAT')).toBe('BALANCED');
  });
});

describe('resolveHomePresentation — band-tinted accent (brand af.* only)', () => {
  it('maps each band to its brand state-palette accent', () => {
    expect(resolveHomePresentation('PEAK').accent).toBe(af.green);
    expect(resolveHomePresentation('BALANCED').accent).toBe(af.cyan);
    expect(resolveHomePresentation('RECOVERING').accent).toBe(af.amber);
    expect(resolveHomePresentation('DEPLETED').accent).toBe(af.red);
  });
  it('DEPLETED uses brand Signal Red #C1281B, never the off-limits statusColor #FF2800', () => {
    const accent = resolveHomePresentation('DEPLETED').accent;
    expect(accent).toBe('#C1281B');
    expect(accent).not.toBe('#FF2800');
  });
  it('reorders signals most-relevant-first per band', () => {
    expect(resolveHomePresentation('DEPLETED').signalOrder).toEqual(['hydration', 'heat', 'recovery']);
    expect(resolveHomePresentation('PEAK').signalOrder).toEqual(['recovery', 'hydration', 'heat']);
    expect(resolveHomePresentation('BALANCED').signalOrder).toEqual(['hydration', 'heat', 'recovery']);
  });
  it('returns only presentation fields — never a score/command (Score-Protection)', () => {
    const p = resolveHomePresentation('DEPLETED');
    // `accentText` joined the shape in Wave 5 (the AA-clean twin of `accent`,
    // for text/glyphs). The assertion is unchanged in intent — an exact key
    // list, so a field carrying score/command data still fails here.
    expect(Object.keys(p).sort()).toEqual(['accent', 'accentText', 'band', 'signalOrder']);
  });
});

describe('resolveHomePresentation — accentText is the AA-clean twin (Wave 5)', () => {
  it('every band renders text/glyphs at ≥ 4.5:1 on the app canvas', () => {
    // Home draws the state word and the LiveStatusLine arrow/delta/verb in
    // `accentText` at 11–13pt, so the normal-text floor applies to all four.
    for (const band of BANDS) {
      const { accentText } = resolveHomePresentation(band);
      expect(contrast(accentText, af.canvas)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('DEPLETED swaps to af.redText because raw Signal Red fails AA as text', () => {
    expect(resolveHomePresentation('DEPLETED').accentText).toBe(af.redText);
    // Prove the guard above is real: the fill accent itself would NOT pass.
    expect(contrast(af.red, af.canvas)).toBeLessThan(4.5);
  });

  it('keeps the brand fill red for fills — accent is untouched by the text swap', () => {
    const p = resolveHomePresentation('DEPLETED');
    expect(p.accent).toBe('#C1281B');
    expect(p.accentText).not.toBe(p.accent);
  });

  it('leaves the three already-legible bands as their own text variant', () => {
    for (const band of ['PEAK', 'BALANCED', 'RECOVERING'] as const) {
      const p = resolveHomePresentation(band);
      expect(p.accentText).toBe(p.accent);
    }
  });

  it('never tints a healthy band with any red (Signal Red stays meaningful)', () => {
    for (const band of ['PEAK', 'BALANCED', 'RECOVERING'] as const) {
      const p = resolveHomePresentation(band);
      expect([p.accent, p.accentText]).not.toContain(af.red);
      expect([p.accent, p.accentText]).not.toContain(af.redText);
    }
  });
});

describe('resolveArcAnimation — motion decisions', () => {
  const base = { elite: true, reducedMotion: false, score: 76, prevScore: 40 };

  it('animates ring + counts up between two real values when elite', () => {
    const plan = resolveArcAnimation(base);
    expect(plan.animateRing).toBe(true);
    expect(plan.countUp).toBe(true);
    expect(plan.fromScore).toBe(40);
  });

  it('does nothing when the flag is off (reveal runs only when eligible)', () => {
    const plan = resolveArcAnimation({ ...base, elite: false });
    expect(plan.animateRing).toBe(false);
    expect(plan.countUp).toBe(false);
  });

  it('reduced-motion bypasses all motion', () => {
    const plan = resolveArcAnimation({ ...base, reducedMotion: true });
    expect(plan.animateRing).toBe(false);
    expect(plan.countUp).toBe(false);
    expect(plan.fromScore).toBe(40); // still no fabricated start
  });

  it('never counts from zero on first mount (no real prior)', () => {
    const plan = resolveArcAnimation({ ...base, prevScore: null });
    expect(plan.countUp).toBe(false);
    expect(plan.fromScore).toBe(76); // shows the value outright, not 0
  });

  it('does not animate a stale/unavailable (non-finite) score as a real score', () => {
    const plan = resolveArcAnimation({ ...base, score: NaN });
    expect(plan.animateRing).toBe(false);
    expect(plan.countUp).toBe(false);
  });

  it('does not count up when the score is unchanged', () => {
    const plan = resolveArcAnimation({ ...base, prevScore: 76 });
    expect(plan.countUp).toBe(false);
  });
});

describe('resolveArcDimensions', () => {
  it('elevates the premium (elite) arc to a larger, bolder gauge', () => {
    expect(resolveArcDimensions(true)).toEqual({ size: 268, stroke: 8 });
  });

  it('keeps the standard arc byte-for-byte with the shipped Home (240/6)', () => {
    expect(resolveArcDimensions(false)).toEqual({ size: 240, stroke: 6 });
  });

  it('premium is strictly larger + bolder than standard', () => {
    const premium = resolveArcDimensions(true);
    const standard = resolveArcDimensions(false);
    expect(premium.size).toBeGreaterThan(standard.size);
    expect(premium.stroke).toBeGreaterThan(standard.stroke);
  });
});
