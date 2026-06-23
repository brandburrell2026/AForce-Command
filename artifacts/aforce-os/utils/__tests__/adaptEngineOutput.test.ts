import { describe, it, expect } from 'vitest';

import {
  adaptEngineOutputForRecheck,
  recheckUrgencyFromEngine,
  MODERATE_MIN_BASE_MINUTES,
} from '../intelligence/adaptEngineOutput';
import type { CommandEvent } from '../intelligence/commandEvents';
import type { CommandCategory, CommandUrgency } from '../intelligence/commandCategory';
import type { ScoreEngineOutput, FeatureFlags, PerformanceLevel } from '../../types';

const NOW = 1_700_000_000_000;

const FLAGS_ON = { command_confidence_adaptive_enabled: true } as unknown as FeatureFlags;
const FLAGS_OFF = { command_confidence_adaptive_enabled: false } as unknown as FeatureFlags;

let seq = 0;
function confirmation(commandType: CommandCategory, followed: boolean, occurredAtMs: number): CommandEvent {
  return {
    id: `c${seq++}`,
    kind: 'command_confirmation',
    occurredAtMs,
    localDayIndex: 0,
    source: 'test',
    followed,
    commandType,
  };
}

/** A ledger with enough followed confirmations to make `category` ready @100%. */
function readyLedger(category: CommandCategory, n = 12): CommandEvent[] {
  return Array.from({ length: n }, (_, i) => confirmation(category, true, NOW - (i + 1) * 1000));
}

function makeEngine(
  o: {
    level?: PerformanceLevel;
    score?: number;
    cmdUrgency?: CommandUrgency;
    timerUrgency?: CommandUrgency;
    minutes?: number;
  } = {},
): ScoreEngineOutput {
  const {
    level = 'RECOVERING',
    score = 55,
    cmdUrgency = 'low',
    timerUrgency = 'low',
    minutes = 20,
  } = o;
  return {
    score,
    performanceState: { level, score },
    command: {
      id: 'cmd-1',
      action: 'do a thing',
      explanation: 'because',
      urgencyLevel: cmdUrgency,
      estimatedImpact: 'small',
    },
    riskTimer: { minutes, seconds: 0, urgency: timerUrgency },
  } as unknown as ScoreEngineOutput;
}

function adapt(engineOutput: ScoreEngineOutput, over: Partial<Parameters<typeof adaptEngineOutputForRecheck>[0]> = {}) {
  return adaptEngineOutputForRecheck({
    engineOutput,
    flags: FLAGS_ON,
    ledgerEvents: readyLedger('recovery_reset'),
    now: NOW,
    autopilotActive: false,
    ...over,
  });
}

describe('recheckUrgencyFromEngine — fail-closed tier mapping', () => {
  it('any high/critical signal (command or timer) is never moderate', () => {
    expect(recheckUrgencyFromEngine(makeEngine({ cmdUrgency: 'critical' }))).toBe('critical');
    expect(recheckUrgencyFromEngine(makeEngine({ cmdUrgency: 'high' }))).toBe('high');
    expect(recheckUrgencyFromEngine(makeEngine({ timerUrgency: 'high' }))).toBe('high');
  });

  it('depletion (level or low score) fails closed to non-moderate', () => {
    expect(recheckUrgencyFromEngine(makeEngine({ level: 'DEPLETED', score: 30 }))).toBe('high');
    expect(recheckUrgencyFromEngine(makeEngine({ score: 39 }))).toBe('high');
  });

  it('a short base cadence (< minimum) fails closed to non-moderate', () => {
    expect(recheckUrgencyFromEngine(makeEngine({ minutes: MODERATE_MIN_BASE_MINUTES - 1 }))).toBe('high');
    expect(recheckUrgencyFromEngine(makeEngine({ minutes: 12 }))).toBe('high');
  });

  it('only a calm, long, low-urgency command reaches moderate', () => {
    expect(
      recheckUrgencyFromEngine(makeEngine({ cmdUrgency: 'low', timerUrgency: 'medium', minutes: 20 })),
    ).toBe('moderate');
  });
});

describe('adaptEngineOutputForRecheck — wiring seam', () => {
  it('flag off is a hard no-op (same reference, never mutated)', () => {
    const eng = makeEngine();
    const out = adapt(eng, { flags: FLAGS_OFF });
    expect(out).toBe(eng);
    expect(eng.riskTimer.minutes).toBe(20);
  });

  it('active sweat autopilot yields entirely (same reference)', () => {
    const eng = makeEngine();
    const out = adapt(eng, { autopilotActive: true });
    expect(out).toBe(eng);
  });

  it('hydration category is protected even when urgency is moderate & learning is ready', () => {
    // BALANCED @75, low urgency, base 20 → categorizeCommand = hydration_maintain
    // (a protected category) while the urgency tier is moderate. Proves the
    // category gate, not just the urgency gate, blocks the stretch.
    const eng = makeEngine({ level: 'BALANCED', score: 75 });
    const out = adapt(eng, { ledgerEvents: readyLedger('hydration_maintain') });
    expect(out).toBe(eng);
    expect(eng.riskTimer.minutes).toBe(20);
  });

  it('eligible non-hydration command stretches ONLY riskTimer.minutes', () => {
    const eng = makeEngine({ level: 'RECOVERING', score: 55, minutes: 20 });
    const out = adapt(eng); // recovery_reset, ready @100% → 1.5× → 30
    expect(out).not.toBe(eng);
    expect(out.riskTimer.minutes).toBe(30);
    // Original never mutated in place.
    expect(eng.riskTimer.minutes).toBe(20);
    // Score / command / level untouched (Score-Protection + command lock).
    expect(out.score).toBe(eng.score);
    expect(out.command).toBe(eng.command);
    expect(out.performanceState).toBe(eng.performanceState);
    expect(out.riskTimer.urgency).toBe(eng.riskTimer.urgency);
  });

  it('insufficient learning (empty ledger) is a no-op', () => {
    const eng = makeEngine();
    const out = adapt(eng, { ledgerEvents: [] });
    expect(out).toBe(eng);
  });

  it('high command urgency is a no-op (strain protected)', () => {
    const eng = makeEngine({ cmdUrgency: 'high' });
    const out = adapt(eng);
    expect(out).toBe(eng);
  });

  it('short base cadence is a no-op', () => {
    const eng = makeEngine({ minutes: 12 });
    const out = adapt(eng);
    expect(out).toBe(eng);
  });

  it('a single call is bounded by one 1.5× stretch of its INPUT base', () => {
    const eng = makeEngine({ minutes: 20 });
    const out = adapt(eng);
    expect(out.riskTimer.minutes).toBeLessThanOrEqual(eng.riskTimer.minutes * 1.5);
  });

  it('re-feeding an already-adapted output COMPOUNDS — proving why every seam must adapt a FRESH base', () => {
    // Each call stretches relative to its INPUT, so adapting an already-stretched
    // output again grows past the per-call cap. This is the exact footgun the
    // offline CONFIRM_COMMAND fallback avoids by NOT re-adapting state.engineOutput.
    const eng = makeEngine({ minutes: 20 });
    const once = adapt(eng); // 20 → 30
    expect(once.riskTimer.minutes).toBe(30);
    const twice = adapt(once); // 30 → 45 (compounded — must never happen at a seam)
    expect(twice.riskTimer.minutes).toBeGreaterThan(once.riskTimer.minutes);
  });
});
