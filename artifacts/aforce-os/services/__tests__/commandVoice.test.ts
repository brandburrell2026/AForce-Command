/**
 * AForce Command Voice Engine — pure script library tests.
 *
 * Locks in: every score band boundary, every risk threshold transition,
 * intensity-driven phrasing, completion reward determinism, Pressure
 * Mode shortening, scope filtering, and the canonical brand language
 * constants.
 */

import { describe, it, expect } from 'vitest';

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
} from '../voice/commandVoice';

describe('commandVoice — brand language', () => {
  it('exports every canonical brand term required by the spec', () => {
    expect(BRAND_LANGUAGE.engineName).toBe('AForce Command Voice Engine');
    expect(BRAND_LANGUAGE.performanceCommand).toBe('Performance Command');
    expect(BRAND_LANGUAGE.hydrationCycle).toBe('Hydration Cycle');
    expect(BRAND_LANGUAGE.systemReset).toBe('System Reset');
    expect(BRAND_LANGUAGE.riskState).toBe('Risk State');
    expect(BRAND_LANGUAGE.pressureMode).toBe('Pressure Mode');
    expect(BRAND_LANGUAGE.recoveryProtocol).toBe('Recovery Protocol');
    expect(BRAND_LANGUAGE.performanceRestored).toBe('Performance Restored');
  });
});

describe('commandVoice — scoreBand classifier', () => {
  it('matches the spec thresholds at every boundary', () => {
    // PEAK 85–100
    expect(scoreBand(100)).toBe('PEAK');
    expect(scoreBand(85)).toBe('PEAK');
    // STABLE 70–84
    expect(scoreBand(84)).toBe('STABLE');
    expect(scoreBand(70)).toBe('STABLE');
    // CORRECT 50–69
    expect(scoreBand(69)).toBe('CORRECT');
    expect(scoreBand(50)).toBe('CORRECT');
    // RISK 30–49
    expect(scoreBand(49)).toBe('RISK');
    expect(scoreBand(30)).toBe('RISK');
    // CRITICAL 0–29
    expect(scoreBand(29)).toBe('CRITICAL');
    expect(scoreBand(0)).toBe('CRITICAL');
    // Below zero clamps to CRITICAL too.
    expect(scoreBand(-12)).toBe('CRITICAL');
  });

  it('exposes the spec thresholds as a readonly constant', () => {
    expect(SCORE_BAND_THRESHOLDS.PEAK).toBe(85);
    expect(SCORE_BAND_THRESHOLDS.STABLE).toBe(70);
    expect(SCORE_BAND_THRESHOLDS.CORRECT).toBe(50);
    expect(SCORE_BAND_THRESHOLDS.RISK).toBe(30);
  });
});

describe('commandVoice — scoreBandLine', () => {
  it('returns the spec phrases verbatim at standard intensity', () => {
    expect(scoreBandLine(92, 'standard')).toBe('System optimized. Hydration status is elite.');
    expect(scoreBandLine(75, 'standard')).toBe('Performance stable. Maintain hydration rhythm.');
    expect(scoreBandLine(60, 'standard')).toBe('Hydration score declining. Correct now.');
    expect(scoreBandLine(40, 'standard')).toBe('Risk increasing. Drink 12 ounces with AForce now.');
    expect(scoreBandLine(15, 'standard')).toBe('Critical hydration risk. Execute recovery command immediately.');
  });

  it('shortens lines under Pressure Mode', () => {
    // Pressure variants are ≤ standard length and end with a period.
    for (const score of [92, 75, 60, 40, 15]) {
      const std = scoreBandLine(score, 'standard');
      const pres = scoreBandLine(score, 'pressure');
      expect(pres.length).toBeLessThanOrEqual(std.length);
      expect(pres).toMatch(/[.!?]$/);
    }
    // Spot-check the spec example: "Risk rising. Drink now." ish.
    expect(scoreBandLine(40, 'pressure')).toMatch(/risk/i);
    expect(scoreBandLine(40, 'pressure').toLowerCase()).toContain('now');
  });

  it('uses calmer fuller phrasing under Calm intensity', () => {
    const calm = scoreBandLine(60, 'calm');
    expect(calm).toContain('Correct now');
    expect(calm.length).toBeGreaterThan(scoreBandLine(60, 'standard').length);
  });

  it('lineForBand mirrors scoreBandLine for the same band', () => {
    expect(lineForBand('CRITICAL', 'standard')).toBe(scoreBandLine(10, 'standard'));
    expect(lineForBand('PEAK', 'pressure')).toBe(scoreBandLine(95, 'pressure'));
  });
});

describe('commandVoice — risk timer thresholds', () => {
  it('descending threshold order is 16, 8, 4, 0', () => {
    expect(RISK_THRESHOLDS).toEqual([16, 8, 4, 0]);
  });

  it('thresholdFor returns null above the first threshold', () => {
    expect(thresholdFor(20)).toBeNull();
    expect(thresholdFor(17)).toBeNull();
  });

  it('thresholdFor lands on the highest threshold the timer has descended into', () => {
    expect(thresholdFor(16)).toBe(16);
    expect(thresholdFor(12)).toBe(16);
    expect(thresholdFor(9)).toBe(16);
    expect(thresholdFor(8)).toBe(8);
    expect(thresholdFor(5)).toBe(8);
    expect(thresholdFor(4)).toBe(4);
    expect(thresholdFor(1)).toBe(4);
    expect(thresholdFor(0)).toBe(0);
  });

  it('clamps negative timers to the failure (0) threshold', () => {
    expect(thresholdFor(-1)).toBe(0);
    expect(thresholdFor(-99)).toBe(0);
  });

  it('returns null for non-finite inputs', () => {
    expect(thresholdFor(Number.NaN)).toBeNull();
    expect(thresholdFor(Number.POSITIVE_INFINITY)).toBeNull();
  });
});

describe('commandVoice — riskTimerLine', () => {
  it('returns the spec phrases verbatim at standard intensity', () => {
    expect(riskTimerLine(16, 'standard')).toBe('Early risk detected. Hydration correction recommended.');
    expect(riskTimerLine(8, 'standard')).toBe('Performance risk rising. Take action now.');
    expect(riskTimerLine(4, 'standard')).toBe('High risk state. Immediate hydration required.');
    expect(riskTimerLine(0, 'standard')).toBe('Hydration command failed. Recovery protocol activated.');
  });

  it('Pressure Mode lines are shorter and still terminate cleanly', () => {
    for (const t of RISK_THRESHOLDS) {
      const std = riskTimerLine(t, 'standard');
      const pres = riskTimerLine(t, 'pressure');
      expect(pres.length).toBeLessThanOrEqual(std.length);
      expect(pres).toMatch(/[.!?]$/);
    }
  });
});

describe('commandVoice — completion reward', () => {
  it('lists the three spec phrases', () => {
    const lines = getCompletionRewardLines();
    expect(lines).toContain('Hydration cycle complete. System reset.');
    expect(lines).toContain('Command executed. Performance restored.');
    expect(lines).toContain('Recovery confirmed. You are back in range.');
    expect(lines.length).toBe(3);
  });

  it('is deterministic when a numeric seed is supplied', () => {
    expect(completionRewardLine(0)).toBe('Hydration cycle complete. System reset.');
    expect(completionRewardLine(1)).toBe('Command executed. Performance restored.');
    expect(completionRewardLine(2)).toBe('Recovery confirmed. You are back in range.');
    // Wraps modulo length.
    expect(completionRewardLine(3)).toBe(completionRewardLine(0));
    // Negative seeds are normalized.
    expect(completionRewardLine(-1)).toBe(completionRewardLine(1));
  });

  it('still returns one of the canonical lines without a seed', () => {
    const all = getCompletionRewardLines();
    for (let i = 0; i < 10; i += 1) {
      expect(all).toContain(completionRewardLine());
    }
  });
});

describe('commandVoice — pressureCommandLine', () => {
  it('strips filler and tightens phrasing', () => {
    const out = pressureCommandLine('Please drink twelve ounces of water immediately.');
    expect(out.toLowerCase()).not.toContain('please');
    expect(out.toLowerCase()).not.toContain('immediately');
    expect(out.toLowerCase()).toContain('12');
    expect(out.toLowerCase()).toContain('now');
    expect(out).toMatch(/[.!?]$/);
  });

  it('normalizes "ounces" to "oz" and number words to digits', () => {
    expect(pressureCommandLine('Drink sixteen ounces of water.').toLowerCase())
      .toContain('16 oz');
    expect(pressureCommandLine('Drink twenty ounces.').toLowerCase())
      .toContain('20 oz');
  });

  it('clips runaway commands to ten words and terminates', () => {
    const long =
      'Please go ahead and drink twelve ounces of water with one AForce stick now and recheck in twenty minutes to confirm your hydration status remains elite.';
    const short = pressureCommandLine(long);
    expect(short.split(/\s+/).length).toBeLessThanOrEqual(10);
    expect(short).toMatch(/[.!?]$/);
  });

  it('returns empty string for empty / whitespace input', () => {
    expect(pressureCommandLine('')).toBe('');
    expect(pressureCommandLine('   ')).toBe('');
  });
});

describe('commandVoice — effectiveCommandLine (Pressure Mode policy)', () => {
  const cmd = 'Please drink twelve ounces of water immediately.';

  it("preserves the original line for 'calm' intensity at any band", () => {
    expect(effectiveCommandLine(cmd, 'calm', 'PEAK')).toBe(cmd);
    expect(effectiveCommandLine(cmd, 'calm', 'DEPLETED')).toBe(cmd);
  });

  it("forces Pressure Mode when intensity is 'pressure' regardless of band", () => {
    const out = effectiveCommandLine(cmd, 'pressure', 'PEAK');
    expect(out.toLowerCase()).not.toContain('please');
    expect(out.toLowerCase()).toContain('12');
  });

  it("auto-engages Pressure Mode under 'standard' intensity when DEPLETED", () => {
    const out = effectiveCommandLine(cmd, 'standard', 'DEPLETED');
    expect(out.toLowerCase()).not.toContain('please');
  });

  it("leaves the line alone under 'standard' intensity above DEPLETED", () => {
    expect(effectiveCommandLine(cmd, 'standard', 'PEAK')).toBe(cmd);
    expect(effectiveCommandLine(cmd, 'standard', 'BALANCED')).toBe(cmd);
    expect(effectiveCommandLine(cmd, 'standard', 'RECOVERING')).toBe(cmd);
  });
});

describe('commandVoice — categoryAllowedForScope', () => {
  it("'muted' silences every category", () => {
    for (const c of ['score_band', 'risk_timer', 'system_command', 'completion'] as const) {
      expect(categoryAllowedForScope(c, 'muted')).toBe(false);
    }
  });

  it("'all' allows every category", () => {
    for (const c of ['score_band', 'risk_timer', 'system_command', 'completion'] as const) {
      expect(categoryAllowedForScope(c, 'all')).toBe(true);
    }
  });

  it("'risk' allows only score_band + risk_timer", () => {
    expect(categoryAllowedForScope('score_band', 'risk')).toBe(true);
    expect(categoryAllowedForScope('risk_timer', 'risk')).toBe(true);
    expect(categoryAllowedForScope('system_command', 'risk')).toBe(false);
    expect(categoryAllowedForScope('completion', 'risk')).toBe(false);
  });

  it("'commands' allows only system_command + completion", () => {
    expect(categoryAllowedForScope('score_band', 'commands')).toBe(false);
    expect(categoryAllowedForScope('risk_timer', 'commands')).toBe(false);
    expect(categoryAllowedForScope('system_command', 'commands')).toBe(true);
    expect(categoryAllowedForScope('completion', 'commands')).toBe(true);
  });
});
