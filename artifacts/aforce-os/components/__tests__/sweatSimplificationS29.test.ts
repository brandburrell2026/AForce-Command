/**
 * S2-9 — Sweat Calculator simplification locks.
 *
 * The audit's largest screen (2,171 LOC) stacked TEN equal cards after
 * Calculate — including two prop-less positioning cards and a brand
 * comparison table INSIDE the computed result — rendered the entire
 * screen in the OS system typeface (64 bare fontWeights, zero
 * fontFamily), and defeated Dynamic Type with adjustsFontSizeToFit.
 *
 * Locked here:
 *   1. Result surface = one hero + one command; the positioning trio
 *      (Recovery Intelligence / AForce System / comparison) renders ONLY
 *      inside the "Why AForce" disclosure — evicted from the result,
 *      preserved verbatim behind a tap. Analysis cards live in their own
 *      disclosure.
 *   2. The brand typeface is real (no bare fontWeight anywhere).
 *   3. Dynamic Type is respected (no adjustsFontSizeToFit; the house
 *      clamp bounds the hero numerals).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const src = readFileSync(
  resolve(__dirname, '..', 'sweat', 'SweatCalculatorScreenV2.tsx'),
  'utf8',
);
const code = src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^\s*\/\/.*$/gm, '');

function paneOf(name: string): string {
  const m = new RegExp(`<AFDisclosureSheet[\\s\\S]{0,400}?testID="${name}"[\\s\\S]*?</AFDisclosureSheet>`).exec(code);
  return m?.[0] ?? '';
}

describe('S2-9 — one hero, one command, two quiet disclosures', () => {
  it('the positioning trio renders only inside the Why AForce sheet', () => {
    const why = paneOf('sweat-why-sheet');
    for (const card of ['<RecoveryIntelligenceCard />', '<AForceSystemCard />', '<ComparisonTable />']) {
      expect(why).toContain(card);
      // exactly one render site — the sheet
      expect(code.split(card).length - 1, card).toBe(1);
    }
  });

  it('the analysis cards live in their own disclosure', () => {
    const analysis = paneOf('sweat-analysis-sheet');
    for (const card of ['SodiumGapCard', 'OptionalSupportCard', 'AdvancedDataCard']) {
      expect(analysis).toContain(card);
    }
  });

  it('the visible result is hero + decision + protocol + two rows + share', () => {
    const pane = /PerformanceHeader result=[\s\S]*?<AFDisclosureSheet/.exec(code)?.[0] ?? '';
    expect(pane).toContain('AIRecoveryDecision');
    expect(pane).toContain('RecoveryProtocolCard');
    expect(pane).toContain('testID="sweat-full-analysis"');
    expect(pane).toContain('testID="sweat-why-aforce"');
    expect(pane).not.toContain('RecoveryIntelligenceCard');
    expect(pane).not.toContain('ComparisonTable');
  });
});

describe('S2-9 — typeface and Dynamic Type', () => {
  it('no bare fontWeight — the screen renders in the brand family', () => {
    expect(code).not.toMatch(/fontWeight\s*:/);
  });

  it('shrink-to-fit is gone; the house clamp bounds the hero numerals', () => {
    expect(code).not.toContain('adjustsFontSizeToFit');
    expect(code).toContain('maxFontSizeMultiplier={AF_MAX_DISPLAY_FONT_SCALE}');
  });
});
