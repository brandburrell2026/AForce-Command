/**
 * The urine mapping is checked against BOTH consumers — because it has two.
 *
 * The first ratification (`clear 1 · light_yellow 2 · yellow 4 · dark_yellow 7`)
 * was made on a memo of mine that claimed urine affected heat risk only. It does
 * not. `urineSignal` feeds two independent, separately-thresholded formulas:
 *
 *   HydroState score  `-max(0, urineSignal - 3) * 4`      penalises ABOVE 3
 *   Heat risk         `urineSignal >= 5 ? (s - 4) * 2 : 0`  penalises AT 5+
 *
 * Because the score's threshold is 3 rather than 5, `yellow: 4` silently cost
 * 4 HydroState points — caught on device as an exact -4 drop, not by any test.
 * The single-file grep behind that memo is the whole reason this file exists.
 *
 * Both formulas are APPROVED and UNCHANGED. They are re-stated here as
 * independent oracles: if either upstream formula is ever edited, these tests
 * diverge from it and the mapping must be re-ratified against the new one.
 * That is deliberate — a mapping is only safe relative to the formulas it was
 * ratified against.
 *
 * STATUS: APPROVED FOR BETA / NOT SCIENTIFICALLY VALIDATED. These tests prove
 * the mapping is internally consistent with the approved formulas. They prove
 * nothing about clinical appropriateness. Passing is not ratification.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { URINE_COLOR_SIGNAL, type UrineColor } from '../urineHydrationCheck';

const PKG = resolve(__dirname, '..', '..');

/**
 * Mirrors `utils/scoring/breakdown.ts` — HydroState urine penalty.
 *
 * `|| 0` normalises NEGATIVE ZERO: `-Math.max(0, 1 - 3) * 4` evaluates to `-0`,
 * and `Object.is(-0, 0)` is false, so a bare comparison would fail on a
 * correct mapping. Harmless in production — the real formula's `-0` sums
 * identically — but it must not make this table read as a defect.
 */
const hydroStatePenalty = (signal: number): number => -Math.max(0, signal - 3) * 4 || 0;

/** Mirrors `services/heatRiskEngine.ts` — heat-risk urine points. */
const heatRiskPoints = (signal: number): number => (signal >= 5 ? (signal - 4) * 2 : 0);

/** Tiles that must NEVER directly penalise HydroState during Phase-1 beta. */
const MUST_STAY_NEUTRAL: UrineColor[] = ['clear', 'light_yellow', 'yellow'];

describe('the mirrored formulas still match their source', () => {
  // If an approved formula is edited upstream, these oracles go stale and every
  // table below silently starts asserting the wrong thing. Pin them to source.
  it('HydroState penalty formula is unchanged', () => {
    const src = readFileSync(resolve(PKG, 'utils', 'scoring', 'breakdown.ts'), 'utf8');
    expect(
      src.includes('-Math.max(0, (state.urineSignal - 3)) * 4'),
      'utils/scoring/breakdown.ts urine penalty changed — the mapping must be re-ratified ' +
        'against the new formula before this test is updated.',
    ).toBe(true);
  });

  it('heat-risk formula is unchanged', () => {
    const src = readFileSync(resolve(PKG, 'services', 'heatRiskEngine.ts'), 'utf8');
    expect(
      src.includes('input.urineSignal >= 5 ? (input.urineSignal - 4) * 2 : 0'),
      'services/heatRiskEngine.ts urine points changed — the mapping must be re-ratified ' +
        'against the new formula before this test is updated.',
    ).toBe(true);
  });
});

describe('HydroState penalty table (ratified beta mapping)', () => {
  it.each([
    ['clear', 0],
    ['light_yellow', 0],
    ['yellow', 0],
    ['dark_yellow', -8],
  ] as const)('%s contributes %i to HydroState', (tile, expected) => {
    expect(hydroStatePenalty(URINE_COLOR_SIGNAL[tile as UrineColor])).toBe(expected);
  });

  it.each(MUST_STAY_NEUTRAL)(
    '%s must NOT cross the HydroState penalty threshold',
    (tile) => {
      const signal = URINE_COLOR_SIGNAL[tile];
      expect(
        hydroStatePenalty(signal),
        `${tile} maps to ${signal}, which costs HydroState points. Founder intent for Phase-1 ` +
          'beta is that only dark_yellow penalises the score. The threshold is signal > 3 — this ' +
          'is exactly the defect that made yellow:4 cost -4 on device.',
      ).toBe(0);
    },
  );

  it('only dark_yellow penalises HydroState', () => {
    const penalising = (Object.keys(URINE_COLOR_SIGNAL) as UrineColor[]).filter(
      (t) => hydroStatePenalty(URINE_COLOR_SIGNAL[t]) < 0,
    );
    expect(penalising).toEqual(['dark_yellow']);
  });
});

describe('heat-risk penalty table (ratified beta mapping)', () => {
  it.each([
    ['clear', 0],
    ['light_yellow', 0],
    ['yellow', 0],
    ['dark_yellow', 2],
  ] as const)('%s contributes %i heat-risk points', (tile, expected) => {
    expect(heatRiskPoints(URINE_COLOR_SIGNAL[tile as UrineColor])).toBe(expected);
  });

  it.each(MUST_STAY_NEUTRAL)('%s must NOT cross the heat-risk threshold', (tile) => {
    const signal = URINE_COLOR_SIGNAL[tile];
    expect(
      heatRiskPoints(signal),
      `${tile} maps to ${signal}, which is >= 5 and adds heat-risk points.`,
    ).toBe(0);
  });

  it('only dark_yellow adds heat-risk points', () => {
    const penalising = (Object.keys(URINE_COLOR_SIGNAL) as UrineColor[]).filter(
      (t) => heatRiskPoints(URINE_COLOR_SIGNAL[t]) > 0,
    );
    expect(penalising).toEqual(['dark_yellow']);
  });
});

describe('the mapping stays inside the persisted contract', () => {
  it('every tile is an integer within 1..8', () => {
    for (const [tile, signal] of Object.entries(URINE_COLOR_SIGNAL)) {
      expect(Number.isInteger(signal), `${tile} must be an integer`).toBe(true);
      expect(signal, `${tile} below scale`).toBeGreaterThanOrEqual(1);
      expect(signal, `${tile} above scale`).toBeLessThanOrEqual(8);
    }
  });

  it('darker tiles never map lower than lighter ones', () => {
    const order: UrineColor[] = ['clear', 'light_yellow', 'yellow', 'dark_yellow'];
    for (let i = 1; i < order.length; i++) {
      expect(
        URINE_COLOR_SIGNAL[order[i]!],
        `${order[i]} must not map below ${order[i - 1]}`,
      ).toBeGreaterThan(URINE_COLOR_SIGNAL[order[i - 1]!]);
    }
  });
});
