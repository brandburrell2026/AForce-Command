/**
 * PerformanceSignalV3 — band accents drawn as TEXT clear WCAG AA (Wave-5).
 *
 * The audited defect: the two largest numerals on the Hydration tab — the week
 * average and each day's score — took `accentForScore`, the FILL accent. At the
 * DEPLETED band that is brand Signal Red (`af.red`), which measures ~3.1:1 on
 * the dark canvas and fails the 4.5:1 AA floor `theme/afTokens.ts` documents.
 * So the single worst week a member can have was also the one they could not
 * read. `accentTextForScore` returns homePresentation's text-safe twin — the
 * same fix Home's arc took in PR #768 — and only DEPLETED changes; the other
 * three band accents already clear AA and are their own text variant.
 *
 * Fills are deliberately NOT covered by the floor: the chart bars and each
 * day's accent rail keep `accentForScore`, because a shape has no contrast
 * requirement and Signal Red must stay frozen at #C1281B where it is a fill.
 *
 * Contrast is measured with the shared `_wcagContrast` helper so this file and
 * `afTokens.test.ts` cannot disagree about what "passes AA" means.
 */
import { describe, it, expect } from 'vitest';

import { af } from '@/theme';
import { contrast } from '@/theme/__tests__/_wcagContrast';
import { accentForScore, accentTextForScore, bandForScore } from '../signalV3Presentation';

/** WCAG 2.2 AA for normal-size text. The scores render far larger, but the
 *  token ramp is held to the stricter floor everywhere else, so is this. */
const AA = 4.5;

/** One score inside each shipped day-card band (≥85 / ≥65 / ≥40 / below). */
const BAND_SAMPLES = [92, 74, 51, 18];

describe('accentTextForScore — every band is readable at every surface', () => {
  it.each(BAND_SAMPLES)('score %i clears AA on canvas, surface and raised', (score) => {
    const color = accentTextForScore(score);
    for (const bg of [af.canvas, af.surface, af.surfaceRaised]) {
      expect(contrast(color, bg), `${bandForScore(score)} on ${bg}`).toBeGreaterThanOrEqual(AA);
    }
  });

  it('swaps ONLY the depleted band — the other three accents are their own text variant', () => {
    expect(accentTextForScore(18)).toBe(af.redText);
    expect(accentTextForScore(18)).not.toBe(af.red);
    for (const score of [92, 74, 51]) {
      expect(accentTextForScore(score)).toBe(accentForScore(score));
    }
  });

  it('pins the defect: the FILL accent it replaced genuinely failed the floor', () => {
    // Guards against a future "these are the same, drop one" cleanup.
    expect(contrast(accentForScore(18), af.canvas)).toBeLessThan(AA);
    expect(accentForScore(18)).toBe(af.red);
  });
});

describe('Performance Signal keeps the band colour to one small dot (founder, 2026-11-20)', () => {
  it('no band colour reaches a number, a bar, a rail or any text', async () => {
    const { readFileSync } = await import('node:fs');
    const { join } = await import('node:path');
    const src = readFileSync(
      join(__dirname, '..', 'PerformanceSignalV3.tsx'),
      'utf8',
    ).replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/.*$/gm, '');

    // The band's colour appears exactly once: the 6pt dot beside the band word.
    expect(src.match(/d\.accent/g)).toHaveLength(1);
    expect(src).toContain('styles.dayDot, { backgroundColor: d.accent }');
    expect(src).toMatch(/dayDot: \{ width: 6, height: 6, borderRadius: 3 \}/);
    // Numbers and bars are the app's warm white.
    expect(src).not.toMatch(/accentTextForScore|accentForScore|b\.accent/);
    expect(src).toMatch(/summaryAvg: \{[^}]*color: af\.textPrimary/);
    expect(src).toMatch(/dayScore: \{[^}]*color: af\.textPrimary/);
    expect(src).toMatch(/bar: \{[^}]*backgroundColor: af\.textPrimary/);
    // The band is still said in words on every row.
    expect(src).toContain('<Text style={styles.dayBand}>{band}</Text>');
  });
});
