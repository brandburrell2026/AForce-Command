import { describe, it, expect } from 'vitest';

import {
  deriveRecovery,
  derivePressure,
  deriveTrend,
  deriveRecoveryCommand,
  deriveRecoveryStory,
  deriveFingerprint,
  deriveRecoverySnapshot,
  recoveryInputsFromState,
  type RecoveryInputs,
} from '../recoveryEngine';
import { baseUser, baseEngine, makeUserState, makeEngine } from '../../store/__tests__/_fixtures';

const base: RecoveryInputs = {
  score: 75,
  decayPerMinute: 0.2,
  waterCycles: 4,
  urineSignal: 3,
  heatLoad: 20,
  activityLevel: 20,
  overnightLossOz: 4,
  drinkCount: 0,
  complianceStreak: 5,
  energyState: 'steady',
};

describe('recoveryEngine — pure derivations', () => {
  it('recovery scales with hydration score and rewards streaks', () => {
    expect(deriveRecovery(base)).toBe(77); // 75 + 2 streak boost
    expect(deriveRecovery({ ...base, complianceStreak: 0 })).toBe(75);
  });

  it('recovery penalises dark urine, alcohol, and poor sleep', () => {
    const punished: RecoveryInputs = {
      ...base,
      urineSignal: 7,
      drinkCount: 3,
      overnightLossOz: 14,
    };
    expect(deriveRecovery(punished)).toBeLessThan(deriveRecovery(base));
  });

  it('recovery is clamped to [0,100]', () => {
    expect(deriveRecovery({ ...base, score: 500 })).toBeLessThanOrEqual(100);
    expect(
      deriveRecovery({ ...base, score: 0, drinkCount: 5, urineSignal: 8 }),
    ).toBeGreaterThanOrEqual(0);
  });

  it('pressure rises with heat, activity, decay, drinks; cycles release it', () => {
    const calm = derivePressure(base);
    const loaded = derivePressure({
      ...base,
      heatLoad: 80,
      activityLevel: 80,
      decayPerMinute: 1.0,
      drinkCount: 3,
    });
    expect(loaded).toBeGreaterThan(calm);
    const relieved = derivePressure({ ...base, waterCycles: 10 });
    expect(relieved).toBeLessThanOrEqual(calm);
  });

  it('trend reflects energy and decay direction', () => {
    expect(
      deriveTrend({ ...base, energyState: 'peak', decayPerMinute: 0.1 }),
    ).toBe('rising');
    expect(
      deriveTrend({ ...base, energyState: 'crashed' }),
    ).toBe('declining');
    expect(
      deriveTrend({ ...base, decayPerMinute: 0.7 }),
    ).toBe('declining');
    expect(deriveTrend(base)).toBe('stable');
  });

  it('command is a short imperative and prioritises alcohol then deficit', () => {
    expect(deriveRecoveryCommand({ ...base, drinkCount: 1 }, 70)).toBe(
      'One water. Now.',
    );
    expect(deriveRecoveryCommand(base, 20)).toBe('Pause. Hydrate.');
    expect(deriveRecoveryCommand(base, 90)).toBe('Hold position.');
    for (const inp of [base, { ...base, drinkCount: 1 }]) {
      const cmd = deriveRecoveryCommand(inp, deriveRecovery(inp));
      expect(cmd.length).toBeLessThanOrEqual(40);
      expect(cmd).not.toMatch(/\bAI\b/i);
    }
  });

  it('story is single-line and free of AI / engine name-drops', () => {
    const story = deriveRecoveryStory(base, 70, 30, 'rising');
    expect(story).not.toContain('\n');
    expect(story).not.toMatch(/\b(ai|engine)\b/i);
    expect(story.length).toBeLessThanOrEqual(120);
  });

  it('fingerprint is a deterministic 8-char hex and stable across same banded inputs', () => {
    const fp = deriveFingerprint(base);
    expect(fp).toMatch(/^[0-9a-f]{8}$/);
    expect(
      deriveFingerprint({ ...base, score: 99, decayPerMinute: 0.0001 }),
    ).toBe(fp); // non-banded inputs do not affect fingerprint
    expect(deriveFingerprint({ ...base, overnightLossOz: 14 })).not.toBe(fp);
  });

  it('snapshot bundles all six outputs', () => {
    const snap = deriveRecoverySnapshot(base);
    expect(snap).toMatchObject({
      recovery: expect.any(Number),
      pressure: expect.any(Number),
      trend: expect.stringMatching(/^(rising|stable|declining)$/),
      command: expect.any(String),
      fingerprint: expect.stringMatching(/^[0-9a-f]{8}$/),
      story: expect.any(String),
    });
  });
});

describe('recoveryEngine — recoveryInputsFromState (store bridge)', () => {
  it('maps the canonical UserState/ScoreEngineOutput fields into RecoveryInputs', () => {
    const inputs = recoveryInputsFromState(baseUser, baseEngine);
    expect(inputs).toEqual({
      score: baseEngine.score,
      decayPerMinute: baseEngine.prediction.decayPerMinute,
      waterCycles: baseUser.unitsConsumedToday,
      urineSignal: baseUser.urineSignal,
      heatLoad: baseUser.heatLoad,
      activityLevel: baseUser.activityLevel,
      overnightLossOz: baseUser.overnightLossOz,
      drinkCount: 0,
      complianceStreak: baseUser.complianceStreak,
      energyState: baseUser.energyState,
    });
  });

  it('drinkCount falls back to 0 when socialMode is absent', () => {
    const user = makeUserState();
    expect(user.socialMode).toBeUndefined();
    expect(recoveryInputsFromState(user, baseEngine).drinkCount).toBe(0);
  });

  it('drinkCount reads the length of socialMode.drinks when present', () => {
    const user = makeUserState({
      socialMode: {
        active: true,
        startTime: new Date(),
        drinks: [
          { id: 'd1', kind: 'beer', loggedAt: new Date(), ozAmount: 12 },
          { id: 'd2', kind: 'wine', loggedAt: new Date(), ozAmount: 5 },
        ],
      },
    });
    expect(recoveryInputsFromState(user, baseEngine).drinkCount).toBe(2);
  });

  it('propagates engine score and decayPerMinute changes verbatim', () => {
    const engine = makeEngine({
      score: 41,
      prediction: { decayPerMinute: 0.95, minutesToDepleted: 12, label: 'Falling fast' },
    });
    const inputs = recoveryInputsFromState(baseUser, engine);
    expect(inputs.score).toBe(41);
    expect(inputs.decayPerMinute).toBeCloseTo(0.95);
  });

  it('full pipeline: store fixtures → recoveryInputsFromState → deriveRecoverySnapshot yields a valid snapshot', () => {
    const snap = deriveRecoverySnapshot(recoveryInputsFromState(baseUser, baseEngine));
    expect(snap.recovery).toBeGreaterThanOrEqual(0);
    expect(snap.recovery).toBeLessThanOrEqual(100);
    expect(snap.pressure).toBeGreaterThanOrEqual(0);
    expect(snap.pressure).toBeLessThanOrEqual(100);
    expect(snap.trend).toMatch(/^(rising|stable|declining)$/);
    expect(snap.fingerprint).toMatch(/^[0-9a-f]{8}$/);
    expect(snap.story).not.toMatch(/\b(ai|engine)\b/i);
    expect(snap.command).not.toMatch(/\bAI\b/i);
  });
});
