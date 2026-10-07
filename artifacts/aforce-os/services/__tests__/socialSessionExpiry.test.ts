/**
 * Social Mode — a session is a NIGHT, not a standing state (2026-10-06).
 *
 * Pins: an open session older than SOCIAL_SESSION_MAX_MS is not live; the
 * rollup then behaves exactly as if End night had been tapped at
 * startedAt + max (recovery window from that point, then null); the decay
 * multiplier follows the same rule; a fresh open session is unchanged.
 */
import { describe, it, expect, vi } from 'vitest';

vi.mock('@/store/useAppStore', () => ({ useFeatureFlags: () => ({}) }));

import { SOCIAL_SESSION_MAX_MS } from '../../config/hydroStateModel';
import {
  RECOVERY_WINDOW_MS,
  buildSocialRollup,
  effectiveSessionEndMs,
  isSocialSessionLive,
} from '../socialModeEngine';
import type { UserState } from '../../types';

const H = 60 * 60 * 1000;
const NOW = Date.parse('2026-10-06T18:00:00Z');

function state(socialMode: UserState['socialMode']): UserState {
  return {
    unitsConsumedToday: 0, ozConsumedToday: 0, aforceUnitsToday: 0, intakeEvents: [],
    lastIntakeTime: new Date(NOW - 20 * H), lastIntakeType: 'water', symptomState: 'none', symptoms: [],
    urineSignal: 3, energyState: 'steady', heatLoad: 4, sweatRate: 3, activityLevel: 5, complianceStreak: 0,
    dailyTarget: 8, ozTarget: 96, isSnoozed: false, snoozeUntil: null, bodyWeightLbs: 180, isAwake: true,
    wakeTime: null, overnightLossOz: 0, hasSeenMorningCommand: true, socialMode,
  } as UserState;
}
const drinks = [
  { id: 'd1', type: 'beer', loggedAt: new Date(NOW - 56 * 24 * H), multiplier: 1.3, hydrated: false },
  { id: 'd2', type: 'cocktail', loggedAt: new Date(NOW - 56 * 24 * H + 60_000), multiplier: 1.3, hydrated: false },
] as unknown as NonNullable<UserState['socialMode']>['drinks'];

describe('isSocialSessionLive', () => {
  it('a fresh open session is live; an ended one is not; an undefined one is not', () => {
    expect(isSocialSessionLive({ active: true, startedAt: new Date(NOW - 2 * H), drinks }, NOW)).toBe(true);
    expect(isSocialSessionLive({ active: false, startedAt: new Date(NOW - 2 * H), endedAt: new Date(NOW - H), drinks }, NOW)).toBe(false);
    expect(isSocialSessionLive(undefined, NOW)).toBe(false);
  });
  it('an open session older than the config maximum is NOT live (the founder\'s 2026-08-12 case)', () => {
    const stale = { active: true, startedAt: new Date('2026-08-12T10:36:26.959Z'), drinks };
    expect(isSocialSessionLive(stale, NOW)).toBe(false);
    expect(effectiveSessionEndMs(stale, NOW)).toBe(Date.parse('2026-08-12T10:36:26.959Z') + SOCIAL_SESSION_MAX_MS);
  });
  it('the boundary is the config constant, not a literal', () => {
    const start = NOW - SOCIAL_SESSION_MAX_MS;
    expect(isSocialSessionLive({ active: true, startedAt: new Date(start + 1), drinks }, NOW)).toBe(true);
    expect(isSocialSessionLive({ active: true, startedAt: new Date(start), drinks }, NOW)).toBe(false);
  });
});

describe('buildSocialRollup honours liveness', () => {
  it('a weeks-old open session yields NO social rollup — normal commands return', () => {
    const rollup = buildSocialRollup(state({ active: true, startedAt: new Date('2026-08-12T10:36:26.959Z'), drinks }), 70, NOW);
    expect(rollup).toBeNull();
  });
  it('an open session just past the maximum is in the recovery window, as if End night had been tapped then', () => {
    const startedAt = new Date(NOW - SOCIAL_SESSION_MAX_MS - 1 * H); // ended 1h ago by implication
    const rollup = buildSocialRollup(state({ active: true, startedAt, drinks }), 70, NOW);
    expect(rollup).not.toBeNull();
    expect(rollup!.active).toBe(false);
    expect(rollup!.inRecoveryWindow).toBe(true);
    expect(rollup!.alcoholMultiplier).toBe(1);
    expect(RECOVERY_WINDOW_MS).toBeGreaterThan(1 * H);
  });
  it('a fresh open session is live with the decay multiplier applied', () => {
    const rollup = buildSocialRollup(state({ active: true, startedAt: new Date(NOW - 2 * H), drinks: [{ ...drinks[0]!, loggedAt: new Date(NOW - 30 * 60_000) }] as never }), 70, NOW);
    expect(rollup).not.toBeNull();
    expect(rollup!.active).toBe(true);
    expect(rollup!.inRecoveryWindow).toBe(false);
  });
});
