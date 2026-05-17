/**
 * Chunk #5: Cruise Mode + Voyage Shield foundation tests.
 *
 * Two stackable modifiers on the Recovery session:
 *   - Cruise Mode    → extends recovery window 8h → 24h.
 *   - Voyage Shield  → floors the Recovery Capacity Score at 60.
 *
 * Both live as end-timestamps on `SocialModeState`. The engine reads
 * them via `isModifierActive()` and feeds them through the existing
 * `buildSocialRollup` pipeline.
 */

import { describe, it, expect } from 'vitest';

import {
  isModifierActive,
  applyVoyageShield,
  VOYAGE_SHIELD_FLOOR,
  CRUISE_WINDOW_MS,
} from '../recoveryCapacity';
import {
  buildSocialRollup,
  effectiveRecoveryWindowMs,
  RECOVERY_WINDOW_MS,
} from '../socialModeEngine';
import type { UserState } from '../../types';

const NOW = Date.now();

function userState(over: Partial<UserState> = {}): UserState {
  return {
    unitsConsumedToday: 0, ozConsumedToday: 0, aforceUnitsToday: 0,
    lastIntakeTime: new Date(NOW - 60 * 60_000), lastIntakeType: 'water',
    symptomState: 'none', symptoms: [], urineSignal: 3, energyState: 'steady',
    heatLoad: 4, sweatRate: 3, activityLevel: 0, complianceStreak: 7,
    dailyTarget: 8, ozTarget: 96, isSnoozed: false, snoozeUntil: null,
    bodyWeightLbs: 180, isAwake: true, wakeTime: null, overnightLossOz: 0,
    hasSeenMorningCommand: false, weatherTempC: 20, weatherHumidity: 30,
    weatherCity: null, weatherFetchedAt: null, language: 'en',
    intakeEvents: [],
    ...over,
  } as UserState;
}

describe('isModifierActive', () => {
  it('true when end-timestamp is in the future', () => {
    expect(isModifierActive(new Date(NOW + 1_000), NOW)).toBe(true);
    expect(isModifierActive(NOW + 1_000, NOW)).toBe(true);
  });

  it('false when missing, past, or invalid', () => {
    expect(isModifierActive(undefined, NOW)).toBe(false);
    expect(isModifierActive(null, NOW)).toBe(false);
    expect(isModifierActive(new Date(NOW - 1_000), NOW)).toBe(false);
    expect(isModifierActive(NaN, NOW)).toBe(false);
  });
});

describe('applyVoyageShield', () => {
  it('floors a low score at 60 when shielded', () => {
    expect(applyVoyageShield(20, true)).toBe(VOYAGE_SHIELD_FLOOR);
    expect(applyVoyageShield(59, true)).toBe(VOYAGE_SHIELD_FLOOR);
  });

  it('leaves scores already at/above the floor unchanged', () => {
    expect(applyVoyageShield(60, true)).toBe(60);
    expect(applyVoyageShield(95, true)).toBe(95);
  });

  it('is a no-op when not shielded', () => {
    expect(applyVoyageShield(20, false)).toBe(20);
    expect(applyVoyageShield(95, false)).toBe(95);
  });
});

describe('effectiveRecoveryWindowMs', () => {
  it('returns the 8h window when Cruise is not active', () => {
    const sm = { active: false, startedAt: new Date(NOW), drinks: [] };
    expect(effectiveRecoveryWindowMs(sm, NOW)).toBe(RECOVERY_WINDOW_MS);
  });

  it('returns the 24h window when Cruise is active', () => {
    const sm = {
      active: false, startedAt: new Date(NOW), drinks: [],
      cruiseUntil: new Date(NOW + 60 * 60_000),
    };
    expect(effectiveRecoveryWindowMs(sm, NOW)).toBe(CRUISE_WINDOW_MS);
  });
});

describe('windowMs is the effective rollup window (UI countdown source)', () => {
  it('a deactivated session 10h ago with Cruise active reports a 24h windowMs (UI shows >0 remaining beyond 8h)', () => {
    const state = userState({
      socialMode: {
        active: false,
        startedAt: new Date(NOW - 11 * 3600_000),
        endedAt: new Date(NOW - 10 * 3600_000),
        cruiseUntil: new Date(NOW + 14 * 3600_000),
        drinks: [],
      },
    });
    const rollup = buildSocialRollup(state, 80, NOW);
    expect(rollup).not.toBeNull();
    expect(rollup!.windowMs).toBe(CRUISE_WINDOW_MS);
    // The remaining countdown the sheet computes:
    // remaining = windowMs - (NOW - endedAt)
    const remaining = rollup!.windowMs - (NOW - state.socialMode!.endedAt!.getTime());
    expect(remaining).toBeGreaterThan(0);
    expect(remaining).toBeGreaterThan(8 * 3600_000);
  });

  it('a deactivated session 2h ago without Cruise reports the 8h windowMs', () => {
    const state = userState({
      socialMode: {
        active: false,
        startedAt: new Date(NOW - 3 * 3600_000),
        endedAt: new Date(NOW - 2 * 3600_000),
        drinks: [],
      },
    });
    const rollup = buildSocialRollup(state, 80, NOW);
    expect(rollup).not.toBeNull();
    expect(rollup!.windowMs).toBe(RECOVERY_WINDOW_MS);
  });
});

describe('Cruise Mode extends the recovery window', () => {
  it('a session ended 10h ago is OUT of the default 8h window', () => {
    const state = userState({
      socialMode: {
        active: false,
        startedAt: new Date(NOW - 11 * 3600_000),
        endedAt: new Date(NOW - 10 * 3600_000),
        drinks: [],
      },
    });
    const rollup = buildSocialRollup(state, 80, NOW);
    expect(rollup).toBeNull();
  });

  it('a session ended 10h ago is STILL inside the 24h Cruise window', () => {
    const state = userState({
      socialMode: {
        active: false,
        startedAt: new Date(NOW - 11 * 3600_000),
        endedAt: new Date(NOW - 10 * 3600_000),
        cruiseUntil: new Date(NOW + 14 * 3600_000),
        drinks: [],
      },
    });
    const rollup = buildSocialRollup(state, 80, NOW);
    expect(rollup).not.toBeNull();
    expect(rollup!.cruiseActive).toBe(true);
    expect(rollup!.inRecoveryWindow).toBe(true);
    expect(rollup!.windowMs).toBe(CRUISE_WINDOW_MS);
  });
});

describe('Voyage Shield floors the score', () => {
  it('a Critical-band session is floored to Stable when shielded', () => {
    const state = userState({
      complianceStreak: 0,
      weatherTempC: 40,
      activityLevel: 10,
      socialMode: {
        active: true,
        startedAt: new Date(NOW),
        drinks: [],
        voyageShieldUntil: new Date(NOW + 60 * 60_000),
      },
    });
    const rollup = buildSocialRollup(state, 10, NOW);
    expect(rollup).not.toBeNull();
    expect(rollup!.voyageShieldActive).toBe(true);
    expect(rollup!.recoveryCapacity.score).toBe(VOYAGE_SHIELD_FLOOR);
    expect(rollup!.recoveryCapacity.band).toBe('stable');
  });

  it('a healthy score is unchanged by the shield', () => {
    const state = userState({
      complianceStreak: 7,
      socialMode: {
        active: true,
        startedAt: new Date(NOW),
        drinks: [],
        voyageShieldUntil: new Date(NOW + 60 * 60_000),
      },
    });
    const rollup = buildSocialRollup(state, 100, NOW);
    expect(rollup!.voyageShieldActive).toBe(true);
    expect(rollup!.recoveryCapacity.score).toBeGreaterThanOrEqual(90);
    expect(rollup!.recoveryCapacity.band).toBe('peak');
  });

  it('contributions still reflect the underlying components (shield is cosmetic on final score)', () => {
    const state = userState({
      complianceStreak: 0,
      weatherTempC: 40,
      socialMode: {
        active: true,
        startedAt: new Date(NOW),
        drinks: [],
        voyageShieldUntil: new Date(NOW + 60 * 60_000),
      },
    });
    const rollup = buildSocialRollup(state, 0, NOW);
    expect(rollup!.recoveryCapacity.contributions.autoPilot).toBe(0);
    expect(rollup!.recoveryCapacity.score).toBe(VOYAGE_SHIELD_FLOOR);
  });
});

describe('Voyage Shield is an independent 12h modifier', () => {
  it('shield-active outside the 8h window (no Cruise) keeps the rollup alive AND floors the score', () => {
    const state = userState({
      complianceStreak: 0,
      socialMode: {
        active: false,
        startedAt: new Date(NOW - 11 * 3600_000),
        endedAt: new Date(NOW - 10 * 3600_000),
        voyageShieldUntil: new Date(NOW + 2 * 3600_000),
        drinks: [],
      },
    });
    const rollup = buildSocialRollup(state, 10, NOW);
    expect(rollup).not.toBeNull();
    expect(rollup!.inRecoveryWindow).toBe(false);
    expect(rollup!.cruiseActive).toBe(false);
    expect(rollup!.voyageShieldActive).toBe(true);
    expect(rollup!.recoveryCapacity.score).toBe(VOYAGE_SHIELD_FLOOR);
    expect(rollup!.recoveryCapacity.band).toBe('stable');
  });

  it('shield expired AND outside the 8h window collapses the rollup to null', () => {
    const state = userState({
      socialMode: {
        active: false,
        startedAt: new Date(NOW - 11 * 3600_000),
        endedAt: new Date(NOW - 10 * 3600_000),
        voyageShieldUntil: new Date(NOW - 60_000),
        drinks: [],
      },
    });
    expect(buildSocialRollup(state, 80, NOW)).toBeNull();
  });
});

describe('Cruise and Shield stack independently', () => {
  it('both active: extended window AND floored score', () => {
    const state = userState({
      complianceStreak: 0,
      socialMode: {
        active: false,
        startedAt: new Date(NOW - 11 * 3600_000),
        endedAt: new Date(NOW - 10 * 3600_000),
        cruiseUntil: new Date(NOW + 14 * 3600_000),
        voyageShieldUntil: new Date(NOW + 2 * 3600_000),
        drinks: [],
      },
    });
    const rollup = buildSocialRollup(state, 5, NOW);
    expect(rollup).not.toBeNull();
    expect(rollup!.cruiseActive).toBe(true);
    expect(rollup!.voyageShieldActive).toBe(true);
    expect(rollup!.recoveryCapacity.score).toBe(VOYAGE_SHIELD_FLOOR);
  });

  it('both expired: rollup is null when outside default window', () => {
    const state = userState({
      socialMode: {
        active: false,
        startedAt: new Date(NOW - 11 * 3600_000),
        endedAt: new Date(NOW - 10 * 3600_000),
        cruiseUntil: new Date(NOW - 60_000),
        voyageShieldUntil: new Date(NOW - 60_000),
        drinks: [],
      },
    });
    expect(buildSocialRollup(state, 80, NOW)).toBeNull();
  });
});
