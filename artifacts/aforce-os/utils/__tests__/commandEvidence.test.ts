/**
 * Evidence Engine™ — Phase 1 proof.
 *
 * Locks two owner stop-conditions:
 *   1. ACCURATE reasoning — the primary evidence item reflects the EXACT branch
 *      that fired, and the selector stays in lockstep with the real
 *      `generateCommand` across an adversarial state matrix (parity).
 *   2. Evidence links CORRECTLY to underlying signals — items carry the real
 *      value + honest freshness + provenance; missing/stale/mock-only signals
 *      are never fabricated; any selector/command mismatch FAILS CLOSED.
 *   3. Score-Protection — deriving evidence never mutates state/output/score.
 *
 * RN-free: imports only pure utils.
 */

import { describe, it, expect, vi } from 'vitest';

// The ONLY react-native import in the entire calculateScore graph is
// i18nService (i18next + expo-localization + RN I18nManager). Mock it so the
// REAL command engine loads under vitest and the parity block below exercises
// the actual generateCommand precedence — not a hand-rolled copy. copy.ts only
// calls i18n.t(); returning the key is sufficient since parity asserts command
// IDs, never localized text. (vitest hoists vi.mock above the imports.)
vi.mock('../../services/i18nService', () => ({
  default: { t: (k: string) => k, language: 'en', changeLanguage: () => {} },
}));

import {
  deriveCommandEvidence,
  selectCommandRuleId,
} from '../scoring/commandEvidence';
import { calculateScore } from '../scoringEngine';
import type { Command, ScoreEngineOutput, UserState, PerformanceLevel } from '../../types';

const MIN = 60_000;
const HOUR = 60 * MIN;
const NOW = 1_700_000_000_000;

function cmd(id: string): Command {
  return { id, action: 'a', explanation: 'e', urgencyLevel: 'low', estimatedImpact: '+1 to score' };
}

function out(level: PerformanceLevel, score: number, socialOver: Record<string, unknown> = {}): ScoreEngineOutput {
  const social = {
    active: false,
    inRecoveryWindow: false,
    drinkCount: 0,
    alcoholMultiplier: 1,
    impairment: { level: 'NONE' },
    hangoverRisk: { level: 'NONE', score: 0 },
    ...socialOver,
  };
  return { score, performanceState: { level, score }, social } as unknown as ScoreEngineOutput;
}

function mk(over: Record<string, unknown> = {}): UserState {
  return {
    intakeEvents: [],
    ozConsumedToday: 48,
    ozTarget: 96,
    lastIntakeTime: new Date(NOW - 30 * MIN),
    heatLoad: 4,
    sweatRate: 3,
    urineSignal: 3,
    symptoms: [],
    complianceStreak: 2,
    overnightLossOz: 0,
    hasSeenMorningCommand: false,
    weatherTempC: null,
    weatherHumidity: null,
    weatherFetchedAt: null,
    bodyWeightLbs: 180,
    unitsConsumedToday: 5,
    ...over,
  } as unknown as UserState;
}

function deepFreeze<T>(o: T): T {
  if (o && typeof o === 'object') {
    Object.values(o as Record<string, unknown>).forEach((v) => deepFreeze(v));
    Object.freeze(o);
  }
  return o;
}

// ─── Primary-trigger lockstep (level + morning) ───────────────────────────

describe('primary trigger reflects the exact command branch', () => {
  const levels: Array<[PerformanceLevel, number, string, string]> = [
    ['DEPLETED', 45, 'cmd-depleted', 'lowers_readiness'],
    ['RECOVERING', 68, 'cmd-recovering', 'lowers_readiness'],
    ['BALANCED', 82, 'cmd-balanced', 'maintains_state'],
    ['PEAK', 95, 'cmd-peak', 'positive_reinforcement'],
  ];

  it.each(levels)('%s → readiness primary item', (level, score, id, direction) => {
    const ev = deriveCommandEvidence({ command: cmd(id), state: mk(), engineOutput: out(level, score), now: NOW });
    expect(ev.integrity).toBe('matched');
    expect(ev.commandId).toBe(id);
    expect(ev.items[0].key).toBe(`readiness_${id.replace('cmd-', '')}`);
    expect(ev.items[0].value).toBe(score);
    expect(ev.items[0].direction).toBe(direction);
    expect(ev.items[0].provenance).toBe('score_engine');
  });

  it('morning override outranks the level command and cites the overnight deficit', () => {
    const state = mk({ overnightLossOz: 20, hasSeenMorningCommand: false });
    const ev = deriveCommandEvidence({ command: cmd('cmd-morning'), state, engineOutput: out('BALANCED', 82), now: NOW });
    expect(ev.integrity).toBe('matched');
    expect(ev.items[0].key).toBe('overnight_deficit');
    expect(ev.items[0].value).toBe(20);
    expect(ev.items[0].unit).toBe('oz');
    expect(ev.items[0].direction).toBe('raises_demand');
  });
});

// ─── Social precedence lockstep ───────────────────────────────────────────

describe('social commands cite the social trigger (correct precedence)', () => {
  it('recovery window (not active) → social_recovery', () => {
    const ev = deriveCommandEvidence({
      command: cmd('cmd-social-recovery'),
      state: mk(),
      engineOutput: out('BALANCED', 80, { active: false, inRecoveryWindow: true, drinkCount: 3 }),
      now: NOW,
    });
    expect(ev.integrity).toBe('matched');
    expect(ev.items[0].key).toBe('social_recovery');
    expect(ev.items[0].value).toBe(3);
    expect(ev.items[0].provenance).toBe('social_rollup');
  });

  it('CRITICAL impairment outranks everything → social_impairment(critical)', () => {
    const ev = deriveCommandEvidence({
      command: cmd('cmd-social-stop-critical'),
      state: mk({ socialMode: { active: true, drinks: [{ loggedAt: new Date(NOW - 2 * MIN), hydrated: false }] } }),
      engineOutput: out('DEPLETED', 40, { active: true, impairment: { level: 'CRITICAL' }, hangoverRisk: { level: 'HIGH', score: 70 } }),
      now: NOW,
    });
    expect(ev.integrity).toBe('matched');
    expect(ev.items[0].key).toBe('social_impairment');
    expect(ev.items[0].labelParams?.level).toBe('critical');
  });

  it('HIGH impairment → social_impairment(high)', () => {
    const ev = deriveCommandEvidence({
      command: cmd('cmd-social-do-not-drive'),
      state: mk(),
      engineOutput: out('DEPLETED', 40, { active: true, impairment: { level: 'HIGH' } }),
      now: NOW,
    });
    expect(ev.integrity).toBe('matched');
    expect(ev.items[0].labelParams?.level).toBe('high');
  });

  it('recent drink (≤5m, not hydrated) outranks hangover risk → social_recent_drink', () => {
    const ev = deriveCommandEvidence({
      command: cmd('cmd-social-hydrate'),
      state: mk({ socialMode: { active: true, drinks: [{ loggedAt: new Date(NOW - 2 * MIN), hydrated: false }] } }),
      engineOutput: out('BALANCED', 80, { active: true, impairment: { level: 'NONE' }, hangoverRisk: { level: 'HIGH', score: 70 } }),
      now: NOW,
    });
    expect(ev.integrity).toBe('matched');
    expect(ev.items[0].key).toBe('social_recent_drink');
    expect(ev.items[0].value).toBe(2);
  });

  it('HIGH hangover risk (no recent drink) → social_hangover_risk with the real score', () => {
    const ev = deriveCommandEvidence({
      command: cmd('cmd-social-rtd'),
      state: mk({ socialMode: { active: true, drinks: [{ loggedAt: new Date(NOW - 30 * MIN), hydrated: true }] } }),
      engineOutput: out('BALANCED', 80, { active: true, impairment: { level: 'NONE' }, hangoverRisk: { level: 'HIGH', score: 72 } }),
      now: NOW,
    });
    expect(ev.integrity).toBe('matched');
    expect(ev.items[0].key).toBe('social_hangover_risk');
    expect(ev.items[0].value).toBe(72);
  });

  it('plain active session → social_active (pace)', () => {
    const ev = deriveCommandEvidence({
      command: cmd('cmd-social-pace'),
      state: mk({ socialMode: { active: true, drinks: [{ loggedAt: new Date(NOW - 30 * MIN), hydrated: true }] } }),
      engineOutput: out('BALANCED', 80, { active: true, drinkCount: 2, impairment: { level: 'NONE' }, hangoverRisk: { level: 'LOW', score: 10 } }),
      now: NOW,
    });
    expect(ev.integrity).toBe('matched');
    expect(ev.items[0].key).toBe('social_active');
    expect(ev.items[0].value).toBe(2);
  });

  it('social commands carry NO generic context items', () => {
    const ev = deriveCommandEvidence({
      command: cmd('cmd-social-pace'),
      state: mk({ intakeEvents: [{}], weatherTempC: 33, weatherFetchedAt: NOW - HOUR, appleHealth: { hrvSdnn: 65, fetchedAt: NOW }, socialMode: { active: true, drinks: [{ loggedAt: new Date(NOW - 30 * MIN), hydrated: true }] } }),
      engineOutput: out('BALANCED', 80, { active: true, drinkCount: 1, impairment: { level: 'NONE' }, hangoverRisk: { level: 'LOW', score: 5 } }),
      now: NOW,
    });
    expect(ev.items).toHaveLength(1);
    expect(ev.items[0].provenance).toBe('social_rollup');
  });
});

// ─── Supporting-context honesty (no fabrication) ──────────────────────────

describe('supporting context only surfaces real, present signals', () => {
  it('mock-only state (seeded units/weight, no real logs) → low confidence, only the primary item', () => {
    const ev = deriveCommandEvidence({ command: cmd('cmd-depleted'), state: mk(), engineOutput: out('DEPLETED', 45), now: NOW });
    expect(ev.confidence).toBe('low');
    expect(ev.items).toHaveLength(1);
    expect(ev.items[0].key).toBe('readiness_depleted');
  });

  it('real logged behaviour surfaces intake gap + pace-behind', () => {
    const state = mk({ intakeEvents: [{}], lastIntakeTime: new Date(NOW - 90 * MIN), ozConsumedToday: 10, ozTarget: 96 });
    const ev = deriveCommandEvidence({ command: cmd('cmd-depleted'), state, engineOutput: out('DEPLETED', 45), now: NOW });
    const keys = ev.items.map((i) => i.key);
    expect(keys).toContain('intake_gap');
    expect(keys).toContain('pace_behind');
    expect(ev.items.find((i) => i.key === 'intake_gap')?.value).toBe(90);
  });

  it('fresh hot weather surfaces a fresh weather item; confidence high with behaviour + weather', () => {
    const state = mk({ intakeEvents: [{}], weatherTempC: 33, weatherFetchedAt: NOW - HOUR });
    const ev = deriveCommandEvidence({ command: cmd('cmd-depleted'), state, engineOutput: out('DEPLETED', 45), now: NOW });
    const w = ev.items.find((i) => i.key === 'weather_heat');
    expect(w?.value).toBe(33);
    expect(w?.freshness.status).toBe('fresh');
    expect(ev.confidence).toBe('high');
  });

  it('stale weather is shown as stale, never as current', () => {
    const state = mk({ intakeEvents: [{}], weatherTempC: 33, weatherFetchedAt: NOW - 7 * HOUR });
    const ev = deriveCommandEvidence({ command: cmd('cmd-depleted'), state, engineOutput: out('DEPLETED', 45), now: NOW });
    expect(ev.items.find((i) => i.key === 'weather_heat')?.freshness.status).toBe('stale');
  });

  it('mild temperature does not raise demand → no weather item', () => {
    const state = mk({ intakeEvents: [{}], weatherTempC: 18, weatherFetchedAt: NOW - HOUR });
    const ev = deriveCommandEvidence({ command: cmd('cmd-depleted'), state, engineOutput: out('DEPLETED', 45), now: NOW });
    expect(ev.items.find((i) => i.key === 'weather_heat')).toBeUndefined();
  });

  it('hot temperature with no fetch timestamp is unprovenanced → no weather item', () => {
    const state = mk({ intakeEvents: [{}], weatherTempC: 33, weatherFetchedAt: null });
    const ev = deriveCommandEvidence({ command: cmd('cmd-depleted'), state, engineOutput: out('DEPLETED', 45), now: NOW });
    expect(ev.items.find((i) => i.key === 'weather_heat')).toBeUndefined();
  });

  it('fresh biometrics surface a context item; stale biometrics do not', () => {
    const fresh = deriveCommandEvidence({ command: cmd('cmd-depleted'), state: mk({ appleHealth: { hrvSdnn: 65, fetchedAt: NOW } }), engineOutput: out('DEPLETED', 45), now: NOW });
    expect(fresh.items.find((i) => i.key === 'biometrics')?.direction).toBe('context');

    const stale = deriveCommandEvidence({ command: cmd('cmd-depleted'), state: mk({ appleHealth: { hrvSdnn: 65, fetchedAt: NOW - 25 * HOUR } }), engineOutput: out('DEPLETED', 45), now: NOW });
    expect(stale.items.find((i) => i.key === 'biometrics')).toBeUndefined();
  });

  it('caps the supporting context items (≤ 4 total)', () => {
    const state = mk({ intakeEvents: [{}], lastIntakeTime: new Date(NOW - 90 * MIN), ozConsumedToday: 10, ozTarget: 96, weatherTempC: 33, weatherFetchedAt: NOW - HOUR, appleHealth: { hrvSdnn: 65, fetchedAt: NOW } });
    const ev = deriveCommandEvidence({ command: cmd('cmd-depleted'), state, engineOutput: out('DEPLETED', 45), now: NOW });
    expect(ev.items.length).toBeLessThanOrEqual(4);
  });
});

// ─── Fail-closed integrity ────────────────────────────────────────────────

describe('fail-closed when the selector disagrees with the fired command', () => {
  it('level/command mismatch → integrity mismatch, no items, low confidence', () => {
    const ev = deriveCommandEvidence({ command: cmd('cmd-depleted'), state: mk(), engineOutput: out('PEAK', 95), now: NOW });
    expect(ev.integrity).toBe('mismatch');
    expect(ev.items).toEqual([]);
    expect(ev.confidence).toBe('low');
  });

  it('an unknown command id never invents evidence', () => {
    const ev = deriveCommandEvidence({ command: cmd('cmd-totally-made-up'), state: mk(), engineOutput: out('PEAK', 95), now: NOW });
    expect(ev.integrity).toBe('mismatch');
    expect(ev.items).toEqual([]);
  });
});

// ─── Score-Protection (no mutation) ───────────────────────────────────────

describe('Score-Protection: evidence derivation is read-only', () => {
  it('does not throw on frozen inputs and leaves the score untouched', () => {
    const state = deepFreeze(mk({ intakeEvents: [{}], weatherTempC: 30, weatherFetchedAt: NOW - HOUR }));
    const engineOutput = deepFreeze(out('DEPLETED', 45));
    expect(() => deriveCommandEvidence({ command: cmd('cmd-depleted'), state, engineOutput, now: NOW })).not.toThrow();
    expect(engineOutput.score).toBe(45);
  });

  it('is pure — identical inputs yield identical evidence', () => {
    const state = mk({ intakeEvents: [{}], weatherTempC: 33, weatherFetchedAt: NOW - HOUR });
    const a = deriveCommandEvidence({ command: cmd('cmd-depleted'), state, engineOutput: out('DEPLETED', 45), now: NOW });
    const b = deriveCommandEvidence({ command: cmd('cmd-depleted'), state, engineOutput: out('DEPLETED', 45), now: NOW });
    expect(a).toEqual(b);
  });
});

// ─── Parity with the real command engine (lockstep proof) ─────────────────

describe('selector stays in lockstep with the real generateCommand', () => {
  // Use a real wall clock so the social path inside copy.ts (which reads
  // Date.now() directly) agrees with our injected clock; offsets stay far from
  // the 5-minute boundary so micro-skew can never flip the branch.
  const T = Date.now();
  const HR = 60 * 60_000;
  const M = 60_000;

  function rstate(over: Record<string, unknown> = {}): UserState {
    return {
      unitsConsumedToday: 0,
      ozConsumedToday: 48,
      aforceUnitsToday: 1,
      lastIntakeTime: new Date(T - 30 * M),
      lastIntakeType: 'water',
      symptomState: 'none',
      symptoms: [],
      urineSignal: 3,
      energyState: 'steady',
      heatLoad: 4,
      sweatRate: 3,
      activityLevel: 5,
      complianceStreak: 2,
      dailyTarget: 8,
      ozTarget: 96,
      isSnoozed: false,
      snoozeUntil: null,
      bodyWeightLbs: 180,
      isAwake: true,
      wakeTime: null,
      overnightLossOz: 0,
      hasSeenMorningCommand: false,
      weatherTempC: null,
      weatherHumidity: null,
      weatherCity: null,
      weatherFetchedAt: null,
      language: 'en',
      intakeEvents: [],
      clutchActive: false,
      ...over,
    } as unknown as UserState;
  }

  const matrix: Array<[string, UserState]> = [
    ['default', rstate()],
    ['depleted (dry + hot + concentrated)', rstate({ ozConsumedToday: 4, lastIntakeTime: new Date(T - 5 * HR), urineSignal: 8, heatLoad: 10, sweatRate: 9, symptoms: ['headache', 'fatigue'] })],
    ['peak (well hydrated + recent)', rstate({ ozConsumedToday: 90, lastIntakeTime: new Date(T - 5 * M), urineSignal: 1, heatLoad: 1, sweatRate: 1, complianceStreak: 7 })],
    ['morning override', rstate({ overnightLossOz: 20, hasSeenMorningCommand: false })],
    ['morning already seen (falls to level)', rstate({ overnightLossOz: 20, hasSeenMorningCommand: true })],
    ['behind pace + real logs', rstate({ intakeEvents: [{ id: 'e1' }], ozConsumedToday: 10 })],
    ['with fresh weather + biometrics', rstate({ intakeEvents: [{ id: 'e1' }], weatherTempC: 33, weatherFetchedAt: T - HR, appleHealth: { hrvSdnn: 60, fetchedAt: T } })],
    ['social active (pace, far from boundary)', rstate({ socialMode: { active: true, drinks: [{ id: 'd1', loggedAt: new Date(T - 25 * M), hydrated: true, standardDrinks: 1 }] } })],
  ];

  it.each(matrix)('agrees with generateCommand: %s', (_name, state) => {
    const o = calculateScore(state, T);
    const ev = deriveCommandEvidence({ command: o.command, state, engineOutput: o, now: T });
    expect(ev.integrity).toBe('matched');
    expect(ev.commandId).toBe(o.command.id);
    expect(selectCommandRuleId(state, o, T)).toBe(o.command.id);
    // The matched evidence always carries at least the primary trigger item.
    expect(ev.items.length).toBeGreaterThanOrEqual(1);
  });
});
