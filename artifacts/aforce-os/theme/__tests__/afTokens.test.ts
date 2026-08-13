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
import { af, afType, afLayout, afMotion, afAlpha, afElev, withAlpha } from '../afTokens';
import { Colors } from '../colors';
// WCAG relative-luminance contrast. Shared with homePresentation.test.ts's
// band-accent text guards so both measure AA with the identical implementation.
import { contrast } from './_wcagContrast';

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

  it('tertiary micro-copy clears 4.5:1 on the raised card, where AFCommandCard puts it', () => {
    // The Wave-5 inline reason line (and the card's eyebrow) are tertiary on a
    // `raised` AFCard — the lightest surface in the ramp, so the tightest pair.
    expect(contrast(af.textTertiary, af.surfaceRaised)).toBeGreaterThanOrEqual(4.5);
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

// ─── VS 3.0 foundation: opacity scale + withAlpha + elevation ────────────────
describe('afAlpha opacity scale', () => {
  it('is an ascending set of alphas in (0,1]', () => {
    const vals = Object.values(afAlpha);
    expect(vals.length).toBeGreaterThan(0);
    for (const a of vals) {
      expect(typeof a).toBe('number');
      expect(a).toBeGreaterThan(0);
      expect(a).toBeLessThanOrEqual(1);
    }
    expect([...vals]).toEqual([...vals].sort((x, y) => x - y));
  });
});

describe('withAlpha — accepted input contract (safeguard #4)', () => {
  it('adds alpha to a solid #RRGGBB, byte-exact', () => {
    expect(withAlpha(af.red, 0.16)).toBe('rgba(193,40,27,0.16)'); // #C1281B
    expect(withAlpha(Colors.text.primary, 0.03)).toBe('rgba(255,255,255,0.03)'); // #FFFFFF
    expect(withAlpha(Colors.text.inverse, 0.5)).toBe('rgba(0,0,0,0.5)'); // #000000
  });
  it('expands #RGB shorthand', () => {
    expect(withAlpha('#abc', 0.5)).toBe('rgba(170,187,204,0.5)');
    expect(withAlpha('#FFF', 0.24)).toBe('rgba(255,255,255,0.24)');
  });
  it('accepts the inclusive alpha bounds 0 and 1', () => {
    expect(withAlpha(af.red, 0)).toBe('rgba(193,40,27,0)');
    expect(withAlpha(af.red, 1)).toBe('rgba(193,40,27,1)');
  });
  it('rejects malformed color inputs with TypeError', () => {
    for (const bad of ['C1281B', '#12', '#GGGGGG', '#1234567', 'rgba(0,0,0,1)', 'red', '', 123 as unknown as string, null as unknown as string]) {
      expect(() => withAlpha(bad, 0.5)).toThrow(TypeError);
    }
  });
  it('rejects out-of-range / non-finite / non-number alpha with RangeError', () => {
    for (const bad of [-0.01, 1.01, NaN, Infinity, -Infinity, '0.5' as unknown as number, null as unknown as number]) {
      expect(() => withAlpha(af.red, bad)).toThrow(RangeError);
    }
  });
});

describe('afElev — valid cross-platform RN ViewStyle recipes (safeguard #5)', () => {
  // The complete set of RN ViewStyle keys afElev is allowed to emit. All are
  // valid on BOTH platforms: layout/color keys are universal; shadow* apply on
  // iOS (ignored, not errored, on Android); elevation applies on Android
  // (ignored, not errored, on iOS).
  const ALLOWED = new Set([
    'backgroundColor', 'borderColor', 'borderWidth',
    'shadowColor', 'shadowOffset', 'shadowOpacity', 'shadowRadius', 'elevation',
  ]);
  const SHADOWED = ['raised', 'sheet', 'modal'] as const;

  it('every recipe emits only valid RN ViewStyle keys', () => {
    for (const recipe of Object.values(afElev)) {
      for (const key of Object.keys(recipe)) expect(ALLOWED.has(key)).toBe(true);
    }
  });
  it('every recipe has a surface + hairline border with the right types', () => {
    for (const recipe of Object.values(afElev)) {
      expect(typeof recipe.backgroundColor).toBe('string');
      expect(typeof recipe.borderColor).toBe('string');
      expect(recipe.borderWidth).toBe(afLayout.hairline);
    }
  });
  it('shadowed recipes carry BOTH an iOS shadow AND an Android elevation', () => {
    for (const name of SHADOWED) {
      const r = afElev[name] as Record<string, unknown>;
      expect(typeof r.shadowColor).toBe('string');
      expect(typeof r.shadowOpacity).toBe('number');
      expect(typeof r.shadowRadius).toBe('number');
      expect(r.shadowOffset).toMatchObject({ width: expect.any(Number), height: expect.any(Number) });
      expect(typeof r.elevation).toBe('number'); // Android
    }
  });
  it('flat is intentionally shadowless', () => {
    expect('shadowColor' in afElev.flat).toBe(false);
    expect('elevation' in afElev.flat).toBe(false);
  });
});
