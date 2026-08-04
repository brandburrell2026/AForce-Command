/**
 * Context-variant explanation selection (RC-1 Wave 4, audit P1).
 *
 * `buildBaseCommand`'s per-band explanations used to be static strings no
 * matter what was actually going on for the user. `selectExplanationContext`
 * now picks the ONE highest-signal context (heat > short sleep > streak) so
 * the explanation reflects reality, without ever stacking more than one
 * context into a single line.
 *
 * Locks:
 *   1. Each context fires in isolation, on the bands it's eligible for.
 *   2. Precedence — heat beats sleep beats streak when more than one signal
 *      is present at once.
 *   3. Byte-parity — when no context applies, the plain band key is
 *      selected unchanged (no `_heat`/`_sleep`/`_streak` suffix).
 *   4. Streak is never selected for RECOVERING/DEPLETED (reinforcement only
 *      belongs on the bands where things are actually going well).
 *
 * i18n is mocked to return the raw key (`t: (k) => k`) — same pattern as
 * commandEvidence.test.ts — so assertions target the SELECTED key, fully
 * decoupled from the prose text living in locales/en.json.
 */

import { describe, it, expect, vi } from 'vitest';

vi.mock('../../services/i18nService', () => ({
  default: { t: (k: string) => k, language: 'en', changeLanguage: () => {} },
}));

import { generateCommand, selectExplanationContext } from '../scoring/copy';
import type { PerformanceLevel, UserState } from '../../types';

function mk(over: Record<string, unknown> = {}): UserState {
  return {
    intakeEvents: [],
    ozConsumedToday: 48,
    ozTarget: 96,
    lastIntakeTime: new Date(),
    heatLoad: 4,
    sweatRate: 3,
    urineSignal: 3,
    symptoms: [],
    complianceStreak: 2,
    overnightLossOz: 0,
    hasSeenMorningCommand: true,
    weatherTempC: null,
    weatherHumidity: null,
    weatherFetchedAt: null,
    bodyWeightLbs: 180,
    unitsConsumedToday: 5,
    ...over,
  } as unknown as UserState;
}

const BANDS: Array<[PerformanceLevel, number]> = [
  ['PEAK', 95],
  ['BALANCED', 82],
  ['RECOVERING', 68],
  ['DEPLETED', 45],
];

describe('selectExplanationContext — priority selection', () => {
  it('returns null (plain band line) when no context signal is present', () => {
    for (const [level] of BANDS) {
      expect(selectExplanationContext(level, mk())).toBeNull();
    }
  });

  it('heat fires in isolation on every band (heatLoad >= 6)', () => {
    for (const [level] of BANDS) {
      expect(selectExplanationContext(level, mk({ heatLoad: 6 }))).toBe('heat');
      expect(selectExplanationContext(level, mk({ heatLoad: 9 }))).toBe('heat');
    }
  });

  it('heat does not fire below its threshold', () => {
    expect(selectExplanationContext('PEAK', mk({ heatLoad: 5.9 }))).toBeNull();
  });

  it('sleep fires in isolation on every band (sleepHoursLastNight < 6)', () => {
    for (const [level] of BANDS) {
      const state = mk({ appleHealth: { sleepHoursLastNight: 5, hrvSdnn: null } });
      expect(selectExplanationContext(level, state)).toBe('sleep');
    }
  });

  it('sleep does not fire at/above its threshold, or when the signal is absent', () => {
    expect(
      selectExplanationContext('PEAK', mk({ appleHealth: { sleepHoursLastNight: 6, hrvSdnn: null } })),
    ).toBeNull();
    expect(
      selectExplanationContext('PEAK', mk({ appleHealth: { sleepHoursLastNight: null, hrvSdnn: null } })),
    ).toBeNull();
    expect(selectExplanationContext('PEAK', mk())).toBeNull();
  });

  it('streak fires only on PEAK/BALANCED (complianceStreak >= 4)', () => {
    expect(selectExplanationContext('PEAK', mk({ complianceStreak: 4 }))).toBe('streak');
    expect(selectExplanationContext('BALANCED', mk({ complianceStreak: 7 }))).toBe('streak');
    expect(selectExplanationContext('RECOVERING', mk({ complianceStreak: 7 }))).toBeNull();
    expect(selectExplanationContext('DEPLETED', mk({ complianceStreak: 7 }))).toBeNull();
  });

  it('streak does not fire below its threshold', () => {
    expect(selectExplanationContext('PEAK', mk({ complianceStreak: 3 }))).toBeNull();
  });

  it('precedence: heat beats sleep beats streak when multiple signals are present', () => {
    const allThree = mk({
      heatLoad: 9,
      appleHealth: { sleepHoursLastNight: 4, hrvSdnn: null },
      complianceStreak: 10,
    });
    expect(selectExplanationContext('PEAK', allThree)).toBe('heat');

    const sleepAndStreak = mk({
      heatLoad: 2,
      appleHealth: { sleepHoursLastNight: 4, hrvSdnn: null },
      complianceStreak: 10,
    });
    expect(selectExplanationContext('PEAK', sleepAndStreak)).toBe('sleep');
  });
});

describe('generateCommand — explanation key selection per band (byte-parity + variants)', () => {
  it.each(BANDS)('%s: no context → plain band key unchanged', (level, score) => {
    const cmd = generateCommand(level, mk(), score, null);
    expect(cmd.explanation).toBe(`coach.${level.toLowerCase()}_explanation`);
  });

  it.each(BANDS)('%s: heat context → _heat suffixed key', (level, score) => {
    const cmd = generateCommand(level, mk({ heatLoad: 8 }), score, null);
    expect(cmd.explanation).toBe(`coach.${level.toLowerCase()}_explanation_heat`);
  });

  it.each(BANDS)('%s: sleep context → _sleep suffixed key', (level, score) => {
    const state = mk({ appleHealth: { sleepHoursLastNight: 5, hrvSdnn: null } });
    const cmd = generateCommand(level, state, score, null);
    expect(cmd.explanation).toBe(`coach.${level.toLowerCase()}_explanation_sleep`);
  });

  it('PEAK/BALANCED: streak context → _streak suffixed key', () => {
    const peak = generateCommand('PEAK', mk({ complianceStreak: 5 }), 95, null);
    expect(peak.explanation).toBe('coach.peak_explanation_streak');
    const balanced = generateCommand('BALANCED', mk({ complianceStreak: 5 }), 82, null);
    expect(balanced.explanation).toBe('coach.balanced_explanation_streak');
  });

  it('RECOVERING/DEPLETED: a streak never selects a _streak key (falls through to plain)', () => {
    const recovering = generateCommand('RECOVERING', mk({ complianceStreak: 9 }), 68, null);
    expect(recovering.explanation).toBe('coach.recovering_explanation');
    const depleted = generateCommand('DEPLETED', mk({ complianceStreak: 9 }), 45, null);
    expect(depleted.explanation).toBe('coach.depleted_explanation');
  });
});
