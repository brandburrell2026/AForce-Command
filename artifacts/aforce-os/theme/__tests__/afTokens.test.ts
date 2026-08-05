/**
 * F1 — af.* token foundation guards.
 *
 * Pins the two things that must never silently drift:
 *   1. Brand fidelity — af.red is the FROZEN Signal Red #C1281B, never the
 *      spec's off-brand #E41E2B (founder ruling 2026-07-20), and the semantic
 *      set is structurally complete per spec §3.1.
 *   2. WCAG 2.2 AA contrast (spec §11) — every text-on-surface pair clears its
 *      floor, so a future value tweak that breaks legibility fails CI here
 *      rather than on a user's screen.
 */
import { describe, it, expect } from 'vitest';
import { af, afType, afLayout, afMotion } from '../afTokens';
import { Colors } from '../colors';

// ── WCAG relative-luminance contrast (solid hex only) ──
function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as [number, number, number];
}
function relLuminance([r, g, b]: [number, number, number]): number {
  const f = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  const [R, G, B] = [f(r), f(g), f(b)];
  return 0.2126 * R + 0.7152 * G + 0.0722 * B;
}
function contrast(a: string, b: string): number {
  const la = relLuminance(hexToRgb(a));
  const lb = relLuminance(hexToRgb(b));
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

describe('af.* brand fidelity', () => {
  it('red is the frozen Signal Red #C1281B, not the spec #E41E2B', () => {
    expect(af.red.toUpperCase()).toBe('#C1281B');
    expect(af.red).toBe(Colors.accent.primary);
    expect(af.red.toUpperCase()).not.toBe('#E41E2B');
  });

  it('canvas is the brand Cinematic Black, not the spec #050506', () => {
    expect(af.canvas.toUpperCase()).toBe('#0D0D0D');
    expect(af.canvas).toBe(Colors.background.primary);
  });

  it('semantic status binds to the brand state palette', () => {
    expect(af.green).toBe(Colors.states.PEAK.primary);
    expect(af.amber).toBe(Colors.states.RECOVERING.primary);
    expect(af.cyan).toBe(Colors.states.BALANCED.primary);
  });

  it('exposes the full spec §3.1 semantic color set', () => {
    const required = [
      'canvas', 'canvasElevated', 'surface', 'surfaceRaised', 'surfacePressed',
      'textPrimary', 'textSecondary', 'textTertiary', 'textDisabled',
      'divider', 'border', 'borderStrong',
      'red', 'onRed', 'redDim', 'redHairline', 'green', 'amber', 'cyan',
      'guardian', 'guardianDim', 'guardianTint', 'guardianHairline',
    ] as const;
    for (const key of required) expect(af).toHaveProperty(key);
  });

  it('guardian is the ratified #8B5CF6 (RC-2 Ruling E), bound to Colors.guardian.primary', () => {
    expect(af.guardian.toUpperCase()).toBe('#8B5CF6');
    expect(af.guardian).toBe(Colors.guardian.primary);
  });

  it('guardian alpha variants reproduce the exact original hex-suffix byte (RC-2 Ruling E)', () => {
    // Each call site previously built `${'#8B5CF6'}XX` — assert the rgba
    // decimal round-trips to the identical alpha byte, i.e. the migration to
    // a named token changed zero rendered pixels.
    const alphaByte = (rgba: string): number => {
      const m = /rgba\([^,]+,[^,]+,[^,]+,\s*([\d.]+)\)/.exec(rgba);
      if (!m) throw new Error(`not an rgba() string: ${rgba}`);
      return Math.round(parseFloat(m[1]) * 255);
    };
    expect(alphaByte(af.guardianDim)).toBe(0x1a);
    expect(alphaByte(af.guardianTint)).toBe(0x22);
    expect(alphaByte(af.guardianHairline)).toBe(0x55);
  });
});

describe('af.* WCAG 2.2 AA contrast (spec §11)', () => {
  it('primary + secondary text clear the 4.5:1 normal-text floor on canvas', () => {
    expect(contrast(af.textPrimary, af.canvas)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(af.textSecondary, af.canvas)).toBeGreaterThanOrEqual(4.5);
  });

  it('tertiary micro-label clears 4.5:1 (the reason it is #85868C, not spec #727378)', () => {
    expect(contrast(af.textTertiary, af.canvas)).toBeGreaterThanOrEqual(4.5);
    // The spec literal would have failed — prove the guard is real.
    expect(contrast('#727378', af.canvas)).toBeLessThan(4.5);
  });

  it('primary text stays legible on the raised surface too', () => {
    expect(contrast(af.textPrimary, af.surface)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(af.textPrimary, af.surfaceRaised)).toBeGreaterThanOrEqual(4.5);
  });

  it('on-red label clears the 3:1 large-text/non-text floor for red buttons', () => {
    // af.red is an accent/button fill; its labels are large+bold (title/bodyStrong),
    // so the 3:1 large-text floor applies (spec §11).
    expect(contrast(af.onRed, af.red)).toBeGreaterThanOrEqual(3.0);
  });
});

describe('af.* type + layout + motion structure', () => {
  it('scores/timers use the tabular mono face; heroes use the display face', () => {
    expect(afType.displayScore.fontFamily).toContain('Mono');
    expect(afType.displayHero.fontFamily).toContain('Archivo');
    expect(afType.eyebrow.letterSpacing).toBeGreaterThan(0);
  });

  it('layout carries the spec §3.3 key sizes', () => {
    expect(afLayout.buttonHeight).toBe(56);
    expect(afLayout.screenPaddingX).toBe(24);
    expect(afLayout.radiusCard).toBe(18);
    expect(afLayout.maxContentWidth).toBe(640);
  });

  it('motion carries the recovery-pulse + entrance tokens (spec §12)', () => {
    expect(afMotion.durations.pulse).toBe(3200);
    expect(afMotion.durations.entrance).toBeGreaterThanOrEqual(220);
    expect(afMotion.durations.entrance).toBeLessThanOrEqual(320);
    expect(afMotion.easing.standardOut).toHaveLength(4);
  });
});
