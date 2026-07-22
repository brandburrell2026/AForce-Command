import { describe, it, expect } from 'vitest';

import {
  deriveActiveModes,
  MODE_HEAT_INDEX_C,
  MODE_WORKOUT_MIN_MINUTES,
  MODE_RECOVERY_SCORE,
  type SmartModeContext,
} from '../modes/smartModes';

const NEUTRAL: SmartModeContext = {
  heatIndexC: 20,
  workoutMinutesToday: 0,
  hydrationScore: 80,
  goalProgress: 0.6,
  isTravelDay: false,
};

describe('deriveActiveModes', () => {
  it('returns no modes and neutral multipliers for a calm context', () => {
    const r = deriveActiveModes(NEUTRAL);
    expect(r.active).toEqual([]);
    expect(r.reminderIntensityMultiplier).toBe(1);
    expect(r.hydrationTargetMultiplier).toBe(1);
  });

  it('activates Heat Mode at/above the heat-index threshold', () => {
    const r = deriveActiveModes({ ...NEUTRAL, heatIndexC: MODE_HEAT_INDEX_C });
    expect(r.active.map((m) => m.id)).toEqual(['heat']);
    expect(r.active[0].guidance.toLowerCase()).toContain('water');
    expect(r.reminderIntensityMultiplier).toBeGreaterThan(1);
    expect(r.hydrationTargetMultiplier).toBeGreaterThan(1);
  });

  it('does not activate Heat Mode when heat index is unknown', () => {
    const r = deriveActiveModes({ ...NEUTRAL, heatIndexC: null });
    expect(r.active).toEqual([]);
  });

  it('activates Workout Mode at/above the workout-minutes threshold', () => {
    const r = deriveActiveModes({
      ...NEUTRAL,
      workoutMinutesToday: MODE_WORKOUT_MIN_MINUTES,
    });
    expect(r.active.map((m) => m.id)).toEqual(['workout']);
    expect(r.reminderIntensityMultiplier).toBeGreaterThan(1);
  });

  it('activates Travel Mode only on an explicit travel signal', () => {
    expect(deriveActiveModes({ ...NEUTRAL, isTravelDay: true }).active.map((m) => m.id)).toEqual(
      ['travel'],
    );
    expect(deriveActiveModes({ ...NEUTRAL, isTravelDay: false }).active).toEqual([]);
  });

  it('activates Recovery Mode below the recovery score and softens reminders', () => {
    const r = deriveActiveModes({
      ...NEUTRAL,
      hydrationScore: MODE_RECOVERY_SCORE - 1,
    });
    expect(r.active.map((m) => m.id)).toEqual(['recovery']);
    expect(r.reminderIntensityMultiplier).toBeLessThan(1);
    expect(r.hydrationTargetMultiplier).toBe(1);
  });

  it('emits modes in fixed priority order and never exceeds four', () => {
    const r = deriveActiveModes({
      heatIndexC: 35,
      workoutMinutesToday: 45,
      hydrationScore: 20,
      goalProgress: 0.2,
      isTravelDay: true,
    });
    expect(r.active.map((m) => m.id)).toEqual([
      'heat',
      'workout',
      'travel',
      'recovery',
    ]);
    expect(r.active.length).toBeLessThanOrEqual(4);
  });

  it('takes the strongest target bump and clamps aggregate multipliers', () => {
    const r = deriveActiveModes({
      heatIndexC: 35, // target 1.2, reminder 1.2
      workoutMinutesToday: 45, // target 1.15, reminder 1.2
      hydrationScore: 20, // reminder 0.6
      goalProgress: 0.2,
      isTravelDay: true, // target 1.1
    });
    // target = max(1.2, 1.15, 1.1, 1.0) = 1.2
    expect(r.hydrationTargetMultiplier).toBeCloseTo(1.2);
    // reminder = 1.2 * 1.2 * 1.0 * 0.6 = 0.864, within [0.5, 1.5]
    expect(r.reminderIntensityMultiplier).toBeGreaterThanOrEqual(0.5);
    expect(r.reminderIntensityMultiplier).toBeLessThanOrEqual(1.5);
    expect(r.reminderIntensityMultiplier).toBeCloseTo(0.864);
  });

  it('command-restating modes lead with water; recovery is a mode indicator (build-lock water-first, ruling #8)', () => {
    const r = deriveActiveModes({
      heatIndexC: 35,
      workoutMinutesToday: 45,
      hydrationScore: 20,
      goalProgress: 0.2,
      isTravelDay: true,
    });
    expect(r.active.length).toBe(4);
    for (const mode of r.active) {
      const g = mode.guidance;
      if (mode.id === 'recovery') {
        // Ruling #8: the recovery banner is a mode INDICATOR, not a command
        // restatement — the RECOVERY COACH card is the single source of the
        // water-first command on Home, so this line states mode + tone and
        // never re-prints "start with water" (would double the command).
        // The water-first build-lock is upheld where the command actually
        // lives, so recovery is exempt here rather than duplicating it.
        expect(g).not.toBe('');
        continue;
      }
      // Every mode that DOES restate the command must stay water-first.
      expect(
        g.startsWith('HYDRATE NOW') || g.startsWith('Start with water'),
      ).toBe(true);
      expect(g.toLowerCase()).toContain('water');
    }
  });
});
