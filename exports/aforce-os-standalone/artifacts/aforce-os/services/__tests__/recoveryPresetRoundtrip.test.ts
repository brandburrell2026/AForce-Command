/**
 * Round-trip regression test for the chunk #4 fix flagged by architect.
 *
 * Earlier bug: `normalizeSocialMode()` dropped `preset` when reading
 * server JSON back into `UserState`, so any path that handed the
 * client a server payload (POST response, WS broadcast, GET /home)
 * silently stripped the user's preset choice and the engine never
 * applied the preset stress floor.
 *
 * Mocks mirror `biometricsWiring.test.ts` since `realApi` transitively
 * pulls product catalogs, mock state, auth, and the score engine.
 */

import { describe, it, expect, vi } from 'vitest';

vi.mock('../../data/products', () => ({ PRODUCTS: {} }));
vi.mock('../../data/mockData', () => ({ defaultUserState: {} }));
vi.mock('../authToken', () => ({
  getAuthHeaders: async () => ({}),
  getAuthToken: async () => null,
}));
vi.mock('../../utils/scoringEngine', () => ({
  // Pure pass-through — the round-trip test doesn't exercise scoring.
  calculateScore: () => ({}),
}));

import { normalizeUserState } from '../realApi';
import { buildSocialRollup } from '../socialModeEngine';

function serverRow(preset: 'travel' | 'heat' | 'hard_block' | undefined | string) {
  return {
    id: 'u_test',
    startTime: new Date().toISOString(),
    weatherTempC: 20,
    weatherHumidity: 30,
    activityLevel: 0,
    complianceStreak: 10,
    socialMode: {
      active: true,
      startedAt: new Date().toISOString(),
      drinks: [],
      ...(preset != null ? { preset } : {}),
    },
  };
}

describe('Recovery preset survives client normalization', () => {
  it.each(['travel', 'heat', 'hard_block'] as const)(
    '%s preset round-trips through normalizeUserState',
    (preset) => {
      const us = normalizeUserState(serverRow(preset));
      expect(us.socialMode?.preset).toBe(preset);
    },
  );

  it('omitted preset normalizes to no preset field', () => {
    const us = normalizeUserState(serverRow(undefined));
    expect(us.socialMode?.preset).toBeUndefined();
  });

  it('unknown preset value is silently dropped (no garbage in state)', () => {
    const us = normalizeUserState(serverRow('cosmic_storm'));
    expect(us.socialMode?.preset).toBeUndefined();
  });

  it('Heat preset on a clean-environment state lowers the recovery score vs no preset', () => {
    const baseline = normalizeUserState(serverRow(undefined));
    const withHeat = normalizeUserState(serverRow('heat'));

    const baselineRollup = buildSocialRollup(baseline, 100, Date.now());
    const heatRollup = buildSocialRollup(withHeat, 100, Date.now());

    expect(baselineRollup).not.toBeNull();
    expect(heatRollup).not.toBeNull();
    expect(heatRollup!.recoveryCapacity.score)
      .toBeLessThan(baselineRollup!.recoveryCapacity.score);
  });
});
