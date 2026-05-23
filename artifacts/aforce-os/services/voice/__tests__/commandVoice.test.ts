import { describe, expect, it } from 'vitest';

import {
  BRAND_LANGUAGE,
  RISK_THRESHOLDS,
  SCORE_BAND_THRESHOLDS,
  categoryAllowedForScope,
  completionRewardLine,
  effectiveCommandLine,
  getCompletionRewardLines,
  lineForBand,
  pressureCommandLine,
  riskTimerLine,
  scoreBand,
  scoreBandLine,
  thresholdFor,
  type ScoreBand,
  type VoiceCategory,
  type VoiceIntensity,
  type VoiceScope,
} from '../commandVoice';

/* ────────────────────────────────────────────────────────────────────
 * BRAND_LANGUAGE
 * ──────────────────────────────────────────────────────────────────── */

describe('BRAND_LANGUAGE', () => {
  it('exports every spec brand term verbatim', () => {
    expect(BRAND_LANGUAGE.engineName).toBe('AForce Command Voice Engine');
    expect(BRAND_LANGUAGE.performanceCommand).toBe('Performance Command');
    expect(BRAND_LANGUAGE.hydrationCycle).toBe('Hydration Cycle');
    expect(BRAND_LANGUAGE.systemReset).toBe('System Reset');
    expect(BRAND_LANGUAGE.riskState).toBe('Risk State');
    expect(BRAND_LANGUAGE.pressureMode).toBe('Pressure Mode');
    expect(BRAND_LANGUAGE.recoveryProtocol).toBe('Recovery Protocol');
    expect(BRAND_LANGUAGE.performanceRestored).toBe('Performance Restored');
  });

  it('is frozen so callers cannot mutate canonical terms', () => {
    expect(Object.isFrozen(BRAND_LANGUAGE)).toBe(true);
  });
});

/* ────────────────────────────────────────────────────────────────────
 * scoreBand — every band boundary
 * ──────────────────────────────────────────────────────────────────── */

describe('scoreBand', () => {
  it('maps 100, 85 → PEAK; 84, 70 → STABLE; 69, 50 → CORRECT; 49, 30 → RISK; 29, 0 → CRITICAL', () => {
    expect(scoreBand(100)).toBe('PEAK');
    expect(scoreBand(85)).toBe('PEAK');

    expect(scoreBand(84)).toBe('STABLE');
    expect(scoreBand(70)).toBe('STABLE');

    expect(scoreBand(69)).toBe('CORRECT');
    expect(scoreBand(50)).toBe('CORRECT');

    expect(scoreBand(49)).toBe('RISK');
    expect(scoreBand(30)).toBe('RISK');

    expect(scoreBand(29)).toBe('CRITICAL');
    expect(scoreBand(0)).toBe('CRITICAL');
  });
});

/* ────────────────────────────────────────────────────────────────────
 * scoreBandLine — exact spec phrases per band, intensity-aware
 * ──────────────────────────────────────────────────────────────────── */

describe('scoreBandLine', () => {
  it('returns the spec line at standard intensity for every band', () => {
    expect(scoreBandLine(95)).toBe('Flow state active. Hydration is elite.');
    expect(scoreBandLine(75)).toBe('Recovery stable. Hydration maintained.');
    expect(scoreBandLine(60)).toBe('Recovery window opening. Time for a water cycle.');
    expect(scoreBandLine(40)).toBe('Recovery window open. Complete a water cycle with AForce.');
    expect(scoreBandLine(10)).toBe('Recovery needed. Complete one water cycle now.');
  });

  it('shortens to a sharper variant under pressure intensity', () => {
    const standard = scoreBandLine(40, 'standard');
    const pressure = scoreBandLine(40, 'pressure');
    expect(pressure.length).toBeLessThan(standard.length);
    expect(pressure).toBe('Twelve ounces. AForce. Now.');
  });

  it('returns a longer measured line under calm intensity', () => {
    const standard = scoreBandLine(40, 'standard');
    const calm = scoreBandLine(40, 'calm');
    expect(calm.length).toBeGreaterThanOrEqual(standard.length);
  });

  it('lineForBand exposes a band → line accessor', () => {
    const bands: ReadonlyArray<ScoreBand> = ['PEAK', 'STABLE', 'CORRECT', 'RISK', 'CRITICAL'];
    const intensities: ReadonlyArray<VoiceIntensity> = ['calm', 'standard', 'pressure'];
    for (const b of bands) {
      for (const i of intensities) {
        expect(lineForBand(b, i)).toMatch(/[A-Za-z]/);
        expect(lineForBand(b, i).trim().length).toBeGreaterThan(0);
      }
    }
  });
});

/* ────────────────────────────────────────────────────────────────────
 * Risk-timer thresholds + lines
 * ──────────────────────────────────────────────────────────────────── */

describe('RISK_THRESHOLDS + thresholdFor', () => {
  it('exposes the spec thresholds in descending order', () => {
    expect([...RISK_THRESHOLDS]).toEqual([16, 8, 4, 0]);
  });

  it('returns null while still above the first threshold', () => {
    expect(thresholdFor(20)).toBeNull();
    expect(thresholdFor(17)).toBeNull();
  });

  it('returns the most-recent crossed threshold for every minute value', () => {
    expect(thresholdFor(16)).toBe(16);
    expect(thresholdFor(12)).toBe(16);
    expect(thresholdFor(9)).toBe(16);
    expect(thresholdFor(8)).toBe(8);
    expect(thresholdFor(5)).toBe(8);
    expect(thresholdFor(4)).toBe(4);
    expect(thresholdFor(1)).toBe(4);
    expect(thresholdFor(0)).toBe(0);
  });

  it('clamps negatives to the failure (0) line', () => {
    expect(thresholdFor(-5)).toBe(0);
    expect(thresholdFor(-100)).toBe(0);
  });

  it('returns null on non-finite minutes', () => {
    expect(thresholdFor(Number.POSITIVE_INFINITY)).toBeNull();
    expect(thresholdFor(Number.NaN)).toBeNull();
  });
});

describe('riskTimerLine', () => {
  it('returns the spec phrase verbatim at standard intensity', () => {
    expect(riskTimerLine(16)).toBe('Recommended next step. Recheck in 15 minutes.');
    expect(riskTimerLine(8)).toBe('Recovery window opening. Time for a water cycle.');
    expect(riskTimerLine(4)).toBe('Recovery window open. Time for hydration.');
    expect(riskTimerLine(0)).toBe('Recovery still pending. Open a water cycle to reset.');
  });

  it('shortens under pressure intensity', () => {
    expect(riskTimerLine(16, 'pressure')).toBe('Next step. Hydrate soon.');
    expect(riskTimerLine(8, 'pressure')).toBe('Recovery opening. Hydrate.');
    expect(riskTimerLine(4, 'pressure')).toBe('Recovery open. Hydrate.');
    expect(riskTimerLine(0, 'pressure')).toBe('Recovery pending. Water cycle now.');
  });

  it('every threshold + intensity returns a non-empty line', () => {
    const intensities: ReadonlyArray<VoiceIntensity> = ['calm', 'standard', 'pressure'];
    for (const t of RISK_THRESHOLDS) {
      for (const i of intensities) {
        expect(riskTimerLine(t, i).trim().length).toBeGreaterThan(0);
      }
    }
  });
});

/* ────────────────────────────────────────────────────────────────────
 * Completion reward voice
 * ──────────────────────────────────────────────────────────────────── */

describe('completionRewardLine', () => {
  it('exposes the three spec phrases', () => {
    const lines = getCompletionRewardLines();
    expect(lines).toHaveLength(3);
    expect(lines).toContain('Water cycle complete. Hydration reset.');
    expect(lines).toContain('Recovery confirmed. You are back in flow.');
    expect(lines).toContain('Reset complete. Balance restored.');
  });

  it('is deterministic given a numeric seed', () => {
    expect(completionRewardLine(0)).toBe(getCompletionRewardLines()[0]);
    expect(completionRewardLine(1)).toBe(getCompletionRewardLines()[1]);
    expect(completionRewardLine(2)).toBe(getCompletionRewardLines()[2]);
    expect(completionRewardLine(3)).toBe(getCompletionRewardLines()[0]); // wraps
    expect(completionRewardLine(7)).toBe(getCompletionRewardLines()[1]);
    // Negative seeds are absoluted.
    expect(completionRewardLine(-2)).toBe(getCompletionRewardLines()[2]);
  });

  it('returns one of the three lines without a seed (random branch)', () => {
    const all = new Set(getCompletionRewardLines());
    for (let i = 0; i < 30; i++) {
      expect(all.has(completionRewardLine())).toBe(true);
    }
  });
});

/* ────────────────────────────────────────────────────────────────────
 * Pressure Mode shortener
 * ──────────────────────────────────────────────────────────────────── */

describe('pressureCommandLine', () => {
  it('strips filler + hedging words', () => {
    const out = pressureCommandLine('Please go ahead and drink some water now.');
    expect(out).toBe('Drink water now.');
  });

  it('canonicalizes "twelve ounces of water" to "12 ounces"', () => {
    const out = pressureCommandLine('Drink twelve ounces of water with one AForce stick now.');
    expect(out).toBe('Drink 12 ounces with 1 AForce stick now.');
  });

  it('collapses "and" and "and then" into a comma cut', () => {
    const out = pressureCommandLine('Drink water and then take an AForce stick.');
    expect(out).toMatch(/^Drink water,/);
    expect(out).not.toMatch(/\band\b/);
  });

  it('collapses "immediately" / "right now" / "as soon as possible" into "now"', () => {
    expect(pressureCommandLine('Hydrate immediately.')).toBe('Hydrate now.');
    expect(pressureCommandLine('Hydrate right now.')).toBe('Hydrate now.');
    expect(pressureCommandLine('Hydrate as soon as possible.')).toBe('Hydrate now.');
  });

  it('always ends with terminal punctuation', () => {
    expect(pressureCommandLine('Drink water')).toMatch(/\.$/);
    expect(pressureCommandLine('Drink water!')).toMatch(/!$/);
  });

  it('clips lines to roughly ten words', () => {
    const out = pressureCommandLine(
      'Drink eight ounces of water with one AForce stick and one electrolyte pack now.',
    );
    const wordCount = out.replace(/[.!?]$/, '').split(/\s+/).length;
    expect(wordCount).toBeLessThanOrEqual(10);
  });

  it('returns "" on empty / whitespace input', () => {
    expect(pressureCommandLine('')).toBe('');
    expect(pressureCommandLine('   ')).toBe('');
  });

  it('capitalizes the first letter even after stripping leading filler', () => {
    const out = pressureCommandLine('please drink water now.');
    expect(out[0]).toBe(out[0].toUpperCase());
    expect(out).toBe('Drink water now.');
  });
});

/* ────────────────────────────────────────────────────────────────────
 * effectiveCommandLine — Pressure Mode swap rule
 * ──────────────────────────────────────────────────────────────────── */

describe('effectiveCommandLine', () => {
  const cmd = 'Drink twelve ounces of water with one AForce stick now.';

  it('passes the original line through at calm intensity, regardless of level', () => {
    expect(effectiveCommandLine(cmd, 'calm', 'PEAK')).toBe(cmd);
    expect(effectiveCommandLine(cmd, 'calm', 'DEPLETED')).toBe(cmd);
  });

  it('swaps to Pressure Mode at pressure intensity for any level', () => {
    expect(effectiveCommandLine(cmd, 'pressure', 'PEAK')).toBe(pressureCommandLine(cmd));
    expect(effectiveCommandLine(cmd, 'pressure', 'BALANCED')).toBe(pressureCommandLine(cmd));
  });

  it('auto-engages Pressure Mode at standard intensity when level is DEPLETED', () => {
    expect(effectiveCommandLine(cmd, 'standard', 'DEPLETED')).toBe(pressureCommandLine(cmd));
  });

  it('keeps the original line at standard intensity for non-DEPLETED levels', () => {
    expect(effectiveCommandLine(cmd, 'standard', 'PEAK')).toBe(cmd);
    expect(effectiveCommandLine(cmd, 'standard', 'BALANCED')).toBe(cmd);
    expect(effectiveCommandLine(cmd, 'standard', 'RECOVERING')).toBe(cmd);
  });
});

/* ────────────────────────────────────────────────────────────────────
 * Scope filter
 * ──────────────────────────────────────────────────────────────────── */

describe('categoryAllowedForScope', () => {
  const categories: ReadonlyArray<VoiceCategory> = [
    'score_band', 'risk_timer', 'system_command', 'completion',
  ];

  it('muted suppresses every category', () => {
    for (const c of categories) {
      expect(categoryAllowedForScope(c, 'muted')).toBe(false);
    }
  });

  it('all permits every category', () => {
    for (const c of categories) {
      expect(categoryAllowedForScope(c, 'all')).toBe(true);
    }
  });

  it('risk permits score_band + risk_timer only', () => {
    expect(categoryAllowedForScope('score_band',     'risk')).toBe(true);
    expect(categoryAllowedForScope('risk_timer',     'risk')).toBe(true);
    expect(categoryAllowedForScope('system_command', 'risk')).toBe(false);
    expect(categoryAllowedForScope('completion',     'risk')).toBe(false);
  });

  it('commands permits system_command + completion only', () => {
    expect(categoryAllowedForScope('system_command', 'commands')).toBe(true);
    expect(categoryAllowedForScope('completion',     'commands')).toBe(true);
    expect(categoryAllowedForScope('score_band',     'commands')).toBe(false);
    expect(categoryAllowedForScope('risk_timer',     'commands')).toBe(false);
  });

  it('every (category, scope) pair is a deterministic boolean', () => {
    const scopes: ReadonlyArray<VoiceScope> = ['all', 'risk', 'commands', 'muted'];
    for (const s of scopes) {
      for (const c of categories) {
        expect(typeof categoryAllowedForScope(c, s)).toBe('boolean');
      }
    }
  });
});

/* ────────────────────────────────────────────────────────────────────
 * SCORE_BAND_THRESHOLDS — published constant + edge cases
 * (merged from prior services/__tests__/ copy)
 * ──────────────────────────────────────────────────────────────────── */

describe('SCORE_BAND_THRESHOLDS', () => {
  it('exposes the spec floor for every named band', () => {
    expect(SCORE_BAND_THRESHOLDS.PEAK).toBe(85);
    expect(SCORE_BAND_THRESHOLDS.STABLE).toBe(70);
    expect(SCORE_BAND_THRESHOLDS.CORRECT).toBe(50);
    expect(SCORE_BAND_THRESHOLDS.RISK).toBe(30);
  });

  it('is frozen so callers cannot mutate band floors', () => {
    expect(Object.isFrozen(SCORE_BAND_THRESHOLDS)).toBe(true);
  });
});

describe('scoreBand — out-of-range inputs', () => {
  it('clamps negative scores into the CRITICAL band', () => {
    expect(scoreBand(-1)).toBe('CRITICAL');
    expect(scoreBand(-12)).toBe('CRITICAL');
    expect(scoreBand(-9999)).toBe('CRITICAL');
  });
});

describe('lineForBand parity with scoreBandLine', () => {
  it('returns the same string for every band as the equivalent scoreBandLine call', () => {
    expect(lineForBand('CRITICAL', 'standard')).toBe(scoreBandLine(10, 'standard'));
    expect(lineForBand('RISK',     'standard')).toBe(scoreBandLine(40, 'standard'));
    expect(lineForBand('CORRECT',  'standard')).toBe(scoreBandLine(60, 'standard'));
    expect(lineForBand('STABLE',   'standard')).toBe(scoreBandLine(75, 'standard'));
    expect(lineForBand('PEAK',     'pressure')).toBe(scoreBandLine(95, 'pressure'));
  });
});
