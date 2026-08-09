import { describe, expect, it } from 'vitest';

import { buildScoreDrivers, formatDriverDelta, SCORE_DRIVER_ORDER } from '../scoring/drivers';
import type { ScoreContribution } from '../../types';

function c(id: string, delta: number): ScoreContribution {
  return { id, label: id, delta, maxMagnitude: 50, hint: '' };
}

describe('buildScoreDrivers', () => {
  it('always returns the four drivers in spec order', () => {
    const drivers = buildScoreDrivers([]);
    expect(drivers.map((d) => d.id)).toEqual([...SCORE_DRIVER_ORDER]);
    expect(drivers.map((d) => d.label)).toEqual(['Water', 'Sleep', 'Heat', 'Recovery']);
  });

  it('sums every contribution that maps into a driver', () => {
    const drivers = buildScoreDrivers([
      c('base', 30),
      c('aforce_bonus', 12),
      c('recency', -8),
      c('urine', -4),
    ]);
    const water = drivers.find((d) => d.id === 'water')!;
    // 30 + 12 - 8 - 4 = 30
    expect(water.delta).toBe(30);
    expect(water.direction).toBe('positive');
    expect(water.text).toBe('Your water intake is lifting your score.');
  });

  it('marks a net-negative driver as negative with plain copy', () => {
    const drivers = buildScoreDrivers([c('context', -12), c('output', -3)]);
    const heat = drivers.find((d) => d.id === 'heat')!;
    expect(heat.delta).toBe(-15);
    expect(heat.direction).toBe('negative');
    expect(heat.text).toBe('Heat and effort are draining you faster.');
  });

  it('treats a zero-sum driver as neutral, not positive', () => {
    const drivers = buildScoreDrivers([c('sleep', 0)]);
    const sleep = drivers.find((d) => d.id === 'sleep')!;
    expect(sleep.delta).toBe(0);
    expect(sleep.direction).toBe('neutral');
    // Build-50 Gate 2 follow-up (independent verdict, S1): the prior
    // neutral copy ("Sleep and recovery are steady for now.") was an
    // affirmative claim about the user's body rendered in the zero-data
    // default state — see drivers.ts's DRIVER_COPY.sleep.neutral comment.
    expect(sleep.text).toBe("Sleep and recovery aren't affecting your score right now.");
  });

  // Build-50 Gate 2, item 5: the 'sleep' pill sums BOTH the 'sleep'
  // contribution (overnight carryover) AND 'health_signals' (the combined
  // HRV / sleep / readiness / recovery% / stress delta from any connected
  // platform — see utils/scoring/breakdown.ts's computeRecoverySignal).
  // Before this fix, a positive/negative movement driven ENTIRELY by a
  // non-sleep signal (e.g. HRV alone, sleep field never reported) still
  // rendered a sleep-specific sentence ("Good rest is helping your
  // score." / "Short sleep is weighing on your score.") — a false,
  // screenshot-able claim about rest quality that was never measured.
  it('does not claim "sleep" specifically when only a non-sleep health signal moved the pill', () => {
    // health_signals delta of +5 here represents e.g. HRV alone (sleep,
    // readiness, recoveryPct, and stress all null) — 'sleep' (overnight
    // carryover) contributes 0, so the ENTIRE movement is non-sleep.
    const positive = buildScoreDrivers([c('sleep', 0), c('health_signals', 5)]);
    const sleepDriverPositive = positive.find((d) => d.id === 'sleep')!;
    expect(sleepDriverPositive.direction).toBe('positive');
    expect(sleepDriverPositive.text).toBe('Sleep and recovery signals are helping your score.');
    expect(sleepDriverPositive.text.toLowerCase()).not.toContain('rest is helping');
    expect(sleepDriverPositive.text.toLowerCase()).not.toMatch(/^good rest/);

    const negative = buildScoreDrivers([c('sleep', 0), c('health_signals', -5)]);
    const sleepDriverNegative = negative.find((d) => d.id === 'sleep')!;
    expect(sleepDriverNegative.direction).toBe('negative');
    expect(sleepDriverNegative.text).toBe('Sleep and recovery signals are weighing on your score.');
    expect(sleepDriverNegative.text.toLowerCase()).not.toMatch(/^short sleep/);
  });

  it('rolls behaviour signals into recovery', () => {
    const drivers = buildScoreDrivers([
      c('recovery', 10),
      c('confirmation', 2),
      c('consistency', 6),
      c('symptom', -4),
    ]);
    const recovery = drivers.find((d) => d.id === 'recovery')!;
    // 10 + 2 + 6 - 4 = 14
    expect(recovery.delta).toBe(14);
    expect(recovery.direction).toBe('positive');
  });

  it('ignores contributions that map to no driver (e.g. social)', () => {
    const drivers = buildScoreDrivers([c('social_intake', -20), c('base', 10)]);
    const water = drivers.find((d) => d.id === 'water')!;
    expect(water.delta).toBe(10);
    // social did not leak into any driver total
    const sum = drivers.reduce((s, d) => s + d.delta, 0);
    expect(sum).toBe(10);
  });

  it('rounds fractional contribution sums', () => {
    const drivers = buildScoreDrivers([c('base', 5.4), c('recency', -0.5)]);
    const water = drivers.find((d) => d.id === 'water')!;
    expect(water.delta).toBe(5);
  });
});

describe('formatDriverDelta', () => {
  it('signs positives, zero, and negatives', () => {
    expect(formatDriverDelta(8)).toBe('+8');
    expect(formatDriverDelta(0)).toBe('+0');
    expect(formatDriverDelta(-3)).toBe('-3');
    expect(formatDriverDelta(5.6)).toBe('+6');
  });
});
