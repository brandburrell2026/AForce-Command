import { describe, it, expect } from 'vitest';
import {
  computeExecutionReadiness,
  EXECUTION_CONSISTENCY_WINDOW_DAYS,
} from '../intelligence/executionReadiness';
import type { CommandEvent } from '../intelligence/commandEvents';

const NOW = 1_700_000_000_000;
const DAY = 86_400_000;
const utcDay = (ms: number): number => Math.floor(ms / DAY);

function intakeAt(dayOffset: number, idx = 0): CommandEvent {
  const ms = NOW - dayOffset * DAY;
  return {
    id: `intake:${dayOffset}:${idx}`,
    kind: 'intake',
    occurredAtMs: ms,
    localDayIndex: utcDay(ms),
    source: 't',
    intakeEventId: `${dayOffset}-${idx}`,
  };
}

function voiceAt(dayOffset: number): CommandEvent {
  const ms = NOW - dayOffset * DAY;
  return {
    id: `voice:${dayOffset}`,
    kind: 'voice_checkin',
    occurredAtMs: ms,
    localDayIndex: utcDay(ms),
    source: 't',
    energy: 4,
    stress: 2,
  };
}

function confirmAt(dayOffset: number, followed: boolean): CommandEvent {
  const ms = NOW - dayOffset * DAY;
  return {
    id: `command_confirmation:${dayOffset}`,
    kind: 'command_confirmation',
    occurredAtMs: ms,
    localDayIndex: utcDay(ms),
    source: 't',
    followed,
  };
}

function execAt(dayOffset: number, idx = 0): CommandEvent {
  const ms = NOW - dayOffset * DAY;
  return {
    id: `execution_event:${dayOffset}:${idx}`,
    kind: 'execution_event',
    occurredAtMs: ms,
    localDayIndex: utcDay(ms),
    source: 't',
    subtype: 'session',
  };
}

/** Behaviour signal at full strength: one intake on each of 7 distinct days. */
function fullBehaviorDays(): CommandEvent[] {
  return Array.from({ length: EXECUTION_CONSISTENCY_WINDOW_DAYS }, (_, i) => intakeAt(i));
}

/** Check-in signal at full strength: a check-in on each of 7 distinct days. */
function fullCheckinDays(): CommandEvent[] {
  return Array.from({ length: EXECUTION_CONSISTENCY_WINDOW_DAYS }, (_, i) => voiceAt(i));
}

describe('computeExecutionReadiness — honest status (no fabrication)', () => {
  it('empty ledger → insufficient, null score, no signals', () => {
    const r = computeExecutionReadiness([], NOW);
    expect(r.status).toBe('insufficient');
    expect(r.score).toBeNull();
    expect(r.signalsUsed).toEqual([]);
    expect(r.reasons).toContain('no_execution_signal');
  });

  it('a SINGLE strong signal cannot fabricate a number (stays collecting)', () => {
    // Perfect 7-day behaviour, but nothing corroborates it.
    const r = computeExecutionReadiness(fullBehaviorDays(), NOW);
    expect(r.status).toBe('collecting');
    expect(r.score).toBeNull();
    expect(r.signalsUsed).toEqual(['behaviorConsistency']);
    expect(r.reasons).toContain('collecting_more_signal');
  });

  it('adherence below the sample floor does not count as data', () => {
    // Only 2 confirmations (< min 3) plus behaviour → still one real signal.
    const r = computeExecutionReadiness(
      [...fullBehaviorDays(), confirmAt(1, true), confirmAt(2, true)],
      NOW,
    );
    expect(r.signals.adherence.hasData).toBe(false);
    expect(r.signalsUsed).toEqual(['behaviorConsistency']);
    expect(r.status).toBe('collecting');
  });
});

describe('computeExecutionReadiness — ready (renormalized over present signals)', () => {
  it('two signals (behaviour + check-in) → ready, renormalized to 100', () => {
    const r = computeExecutionReadiness([...fullBehaviorDays(), ...fullCheckinDays()], NOW);
    expect(r.status).toBe('ready');
    // both values are 1.0; renormalized weighted average = 1.0 → 100.
    expect(r.score).toBe(100);
    expect(r.signalsUsed).toEqual(['behaviorConsistency', 'checkInConsistency']);
  });

  it('three signals weight adherence correctly (0.5 adherence, full others → 75)', () => {
    const r = computeExecutionReadiness(
      [
        ...fullBehaviorDays(),
        ...fullCheckinDays(),
        confirmAt(1, true),
        confirmAt(2, true),
        confirmAt(3, false),
        confirmAt(4, false), // 2/4 followed → rate 0.5
      ],
      NOW,
    );
    expect(r.status).toBe('ready');
    expect(r.signals.adherence.value).toBeCloseTo(0.5, 5);
    // weighted = 0.45*0.5 + 0.30*1 + 0.15*1 = 0.675; total = 0.90 → 0.75 → 75.
    expect(r.score).toBe(75);
    expect(r.signalsUsed).toEqual(['adherence', 'behaviorConsistency', 'checkInConsistency']);
  });

  it('reserved execution-family events count once flowing (behaviour + family → ready)', () => {
    const r = computeExecutionReadiness(
      [...fullBehaviorDays(), execAt(0, 0), execAt(0, 1), execAt(1, 0)], // 3 family events
      NOW,
    );
    expect(r.signals.executionFamily.count).toBe(3);
    expect(r.status).toBe('ready');
    // behaviour 1.0 (w 0.30) + family 3/5=0.6 (w 0.10): weighted 0.36 / total 0.40 = 0.9 → 90.
    expect(r.score).toBe(90);
    expect(r.signalsUsed).toEqual(['behaviorConsistency', 'executionFamily']);
  });
});

describe('computeExecutionReadiness — bounds & windowing', () => {
  it('score is always within [0,100]', () => {
    const r = computeExecutionReadiness([...fullBehaviorDays(), ...fullCheckinDays()], NOW);
    expect(r.score).not.toBeNull();
    expect(r.score!).toBeGreaterThanOrEqual(0);
    expect(r.score!).toBeLessThanOrEqual(100);
  });

  it('ignores events in the future and far outside the window', () => {
    const stale = intakeAt(60); // 60 days ago — outside the 7d window
    const future = { ...intakeAt(0), id: 'intake:future', occurredAtMs: NOW + 5 * DAY } as CommandEvent;
    const r = computeExecutionReadiness([stale, future], NOW);
    expect(r.signals.behaviorConsistency.totalEvents).toBe(0);
    expect(r.status).toBe('insufficient');
  });

  it('all-zero followed adherence is real data (rate 0), not "no data"', () => {
    const r = computeExecutionReadiness(
      [...fullBehaviorDays(), confirmAt(1, false), confirmAt(2, false), confirmAt(3, false)],
      NOW,
    );
    expect(r.signals.adherence.hasData).toBe(true);
    expect(r.signals.adherence.value).toBe(0);
    expect(r.status).toBe('ready');
    // behaviour 1.0 (0.45 weight share vs adherence 0.45): weighted = 0.45*0 + 0.30*1 = 0.30;
    // total = 0.75 → 0.4 → 40.
    expect(r.score).toBe(40);
  });
});
