/**
 * S2-14b — founder micro-label ruling, Phase A: tracked uppercase
 * micro-labels YIELD their tracking to readability at accessibility
 * text sizes.
 *
 * Ruling terms pinned here:
 *   - owner token: afType.eyebrow (the design system's only tracked entry);
 *   - boundary: AF_MAX_DISPLAY_FONT_SCALE (1.35) — the EXISTING display
 *     ceiling, not a new threshold; at or below it the spec tracking is
 *     returned unchanged, above it tracking drops to 0;
 *   - the token itself is never mutated;
 *   - delivery: useAFEyebrowType() appended AFTER the static style in the
 *     seven tracked AF primitives, so per-component customizations
 *     (AFOfflineBanner's fontSize 10, colors, margins) survive;
 *   - labels stay unclamped: no numberOfLines, no maxFontSizeMultiplier on
 *     the wired eyebrow Texts — tracking is the ONLY thing that yields.
 *
 * AFStatPair is deliberately NOT wired: its label spreads the eyebrow
 * family/size field-by-field WITHOUT tracking, so it has nothing to yield.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afEyebrowAt, afType, AF_MAX_DISPLAY_FONT_SCALE } from '../../theme';

const read = (rel: string): string =>
  readFileSync(resolve(__dirname, '..', '..', rel), 'utf8');
const stripComments = (s: string): string =>
  s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/.*$/gm, '$1');

describe('afEyebrowAt — the boundary is the existing display ceiling', () => {
  it('at or below 1.35 the spec tracking is returned unchanged', () => {
    expect(afEyebrowAt(1).letterSpacing).toBe(afType.eyebrow.letterSpacing);
    expect(afEyebrowAt(AF_MAX_DISPLAY_FONT_SCALE).letterSpacing).toBe(afType.eyebrow.letterSpacing);
  });

  it('past the ceiling tracking yields to 0 — accessibility sizes read as words, not spaced glyphs', () => {
    expect(afEyebrowAt(1.36).letterSpacing).toBe(0);
    expect(afEyebrowAt(2.35).letterSpacing).toBe(0);
    expect(afEyebrowAt(3.1).letterSpacing).toBe(0);
  });

  it('the owner token itself is never mutated', () => {
    afEyebrowAt(3.1);
    expect(afType.eyebrow.letterSpacing).toBe(1.6);
  });
});

describe('the hook is the single live delivery path', () => {
  it('useAFEyebrowType reads the live fontScale and delegates to afEyebrowAt — no second authority', () => {
    const hook = stripComments(read('hooks/useAFEyebrowType.ts'));
    expect(hook).toContain('useWindowDimensions()');
    expect(hook).toContain('return afEyebrowAt(fontScale);');
    // a numeric boundary or a letterSpacing VALUE here would be a second
    // authority (the return-TYPE annotation `letterSpacing: number` is not).
    expect(hook).not.toMatch(/1\.35|letterSpacing:\s*[\d]/);
  });
});

describe('the seven tracked primitives are wired (Phase A inheritance)', () => {
  const WIRED: ReadonlyArray<{ file: string; jsx: string }> = [
    { file: 'components/ui/AFSectionLabel.tsx', jsx: '[styles.label, eyebrowType]' },
    { file: 'components/ui/AFCommandCard.tsx', jsx: '[styles.eyebrow, eyebrowType]' },
    { file: 'components/ui/AFTopBar.tsx', jsx: '[styles.eyebrow, eyebrowType]' },
    { file: 'components/ui/AFMetric.tsx', jsx: '[styles.label, eyebrowType]' },
    { file: 'components/ui/AFOfflineBanner.tsx', jsx: '[styles.text, eyebrowType]' },
    { file: 'components/ui/AFEditorialHero.tsx', jsx: '[styles.eyebrow, eyebrowType]' },
    { file: 'components/ui/AFProductCard.tsx', jsx: '[styles.badge, eyebrowType]' },
  ];

  for (const { file, jsx } of WIRED) {
    it(`${file.split('/').pop()} applies the yield AFTER its static style and leaves the label unclamped`, () => {
      const code = stripComments(read(file));
      expect(code).toContain("from '@/hooks/useAFEyebrowType'");
      expect(code).toContain('const eyebrowType = useAFEyebrowType();');
      const line = code.split('\n').find((l) => l.includes(jsx));
      expect(line, `${file}: wired style array not found`).toBeTruthy();
      expect(line).not.toContain('numberOfLines');
      expect(line).not.toContain('maxFontSizeMultiplier');
    });
  }

  it('AFStatPair stays unwired — its label carries no tracking to yield', () => {
    const code = stripComments(read('components/ui/AFStatPair.tsx'));
    expect(code).not.toContain('useAFEyebrowType');
    expect(code).not.toMatch(/label: \{[^}]*letterSpacing/s);
  });
});
