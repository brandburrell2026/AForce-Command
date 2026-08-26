/**
 * deriveProtocol — locks in the **synchronous** mapping from the
 * engine's PerformanceLevel → Protocol stage that powers the AForce
 * Protocol screen and its Depletion Correction state.
 *
 * The Protocol screen depends on this being a pure function (not a
 * fetch/Promise) so the Depletion Correction stage flips the moment
 * the score crosses the DEPLETED threshold — no async race, no
 * loading flash. If the level→stage mapping ever drifts (or someone
 * re-introduces a `Promise`), this contract test fails first.
 *
 * `protocolDerivation` transitively imports `data/products` (which uses RN
 * `require('../assets/...')` for image bundling) and the
 * `scoringEngine` (which pulls i18next + expo-localization). Both are
 * unparseable in node/vitest, so we stub them with the same minimal
 * shape used by `realApi.intake.test.ts`. `deriveProtocol` itself
 * does not call into either, so the stubs do not weaken the contract.
 */

import { describe, it, expect, vi } from 'vitest';

vi.mock('../../data/products', () => ({
  PRODUCTS: {
    water: { fluidType: 'water', ozPerServing: 12 },
    aforce_stick: { fluidType: 'aforce_stick', ozPerServing: 12, flavor: 'watermelon' },
    aforce_rtd: { fluidType: 'aforce_rtd', ozPerServing: 12, flavor: 'watermelon' },
    aforce_canister: { fluidType: 'aforce_canister', ozPerServing: 18, flavor: 'watermelon' },
    aforce_bulk_bag: { fluidType: 'aforce_bulk_bag', ozPerServing: 16, flavor: 'soursop' },
  },
}));

vi.mock('../../utils/scoringEngine', () => ({
  calculateScore: vi.fn(() => ({
    score: 50,
    performanceState: { level: 'BALANCED', label: 'Balanced', score: 50, color: '#000' },
    riskTimer: { minutes: 30, seconds: 0, urgency: 'moderate' },
    contributions: [], reasons: [], command: null, decayPerMinute: 0.5,
    minutesSinceLastIntake: 0, prediction: null, recoverySignal: null,
    pulseConfig: { stateName: 'balanced', primary: '#fff', secondary: '#fff', waveBehavior: 'breathing', colorMode: 'static', durationMs: 4000 },
  })),
}));

import { deriveProtocol } from '../protocolDerivation';
import type {
  ScoreEngineOutput,
  UserState,
  PerformanceLevel,
} from '../../types';

function fakeUserState(overrides: Partial<UserState> = {}): UserState {
  return {
    urineSignal: 0,
    ...overrides,
  } as unknown as UserState;
}

function fakeEngine(
  level: PerformanceLevel,
  riskMinutes = 30,
): ScoreEngineOutput {
  return {
    score: level === 'PEAK' ? 95 : level === 'BALANCED' ? 75 : level === 'RECOVERING' ? 55 : 35,
    performanceState: { level, color: '#000', label: level } as unknown as ScoreEngineOutput['performanceState'],
    riskTimer: { minutes: riskMinutes } as unknown as ScoreEngineOutput['riskTimer'],
  } as unknown as ScoreEngineOutput;
}

describe('deriveProtocol — PerformanceLevel → stage mapping', () => {
  it('PEAK → "Peak Support"', () => {
    const p = deriveProtocol(fakeUserState(), fakeEngine('PEAK'), null);
    expect(p.stage).toBe('Peak Support');
  });

  it('BALANCED → "Maintain"', () => {
    const p = deriveProtocol(fakeUserState(), fakeEngine('BALANCED'), null);
    expect(p.stage).toBe('Maintain');
  });

  it('RECOVERING → "Recovery"', () => {
    const p = deriveProtocol(fakeUserState(), fakeEngine('RECOVERING'), null);
    expect(p.stage).toBe('Recovery');
  });

  it('DEPLETED → "Depletion Correction" (the headline real-time stage)', () => {
    const p = deriveProtocol(fakeUserState(), fakeEngine('DEPLETED'), null);
    expect(p.stage).toBe('Depletion Correction');
    expect(p.description).toContain('Electrolytes');
  });

  it('is synchronous — returns a payload, never a Promise', () => {
    const out = deriveProtocol(fakeUserState(), fakeEngine('DEPLETED'), null);
    expect(out).not.toBeInstanceOf(Promise);
    expect(typeof out.stage).toBe('string');
  });

  it('reflects engine.riskTimer.minutes in the second step + footer', () => {
    const p = deriveProtocol(fakeUserState(), fakeEngine('RECOVERING', 17), null);
    expect(p.nextRecheckMinutes).toBe(17);
    expect(p.steps[1].window).toBe('Within 17 min');
  });

  it('flips step 1 to complete when urineSignal > 0 (live signal pulled in)', () => {
    const dry = deriveProtocol(fakeUserState({ urineSignal: 0 }), fakeEngine('BALANCED'), null);
    const wet = deriveProtocol(fakeUserState({ urineSignal: 2 }), fakeEngine('BALANCED'), null);
    expect(dry.steps[0].complete).toBe(false);
    expect(wet.steps[0].complete).toBe(true);
  });

  it('returns deterministic compliance when called sync (no Math.random)', () => {
    const a = deriveProtocol(fakeUserState(), fakeEngine('BALANCED'), null);
    const b = deriveProtocol(fakeUserState(), fakeEngine('BALANCED'), null);
    expect(a.weeklyCompliancePct).toBe(b.weeklyCompliancePct);
  });
});
