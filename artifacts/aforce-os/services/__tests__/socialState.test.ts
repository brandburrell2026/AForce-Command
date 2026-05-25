/**
 * socialState — pure-function contract tests for Rule #13's six
 * Social Mode surfaces. The React hook is exercised separately
 * when a screen actually consumes it; this file only covers the
 * deterministic derivation underneath.
 */

import { describe, it, expect } from 'vitest';

import {
  CREW_MAX,
  deriveSocialCommand,
  deriveSocialForecast,
  deriveSocialSharedContext,
  deriveSocialSignal,
  deriveSocialSnapshot,
  type CrewMember,
} from '../socialState';

describe('deriveSocialSignal', () => {
  it('returns RECOVERY REQUIRED below 30 capacity', () => {
    expect(deriveSocialSignal({ recoveryCapacity: 12, waterCycles: 0, drinkCount: 0 })).toBe(
      'RECOVERY REQUIRED',
    );
  });

  it('returns RECOVERING when drinking, even at moderate capacity', () => {
    expect(deriveSocialSignal({ recoveryCapacity: 70, waterCycles: 4, drinkCount: 3 })).toBe(
      'RECOVERING',
    );
  });

  it('returns LOCKED IN at high capacity + enough water cycles', () => {
    expect(deriveSocialSignal({ recoveryCapacity: 82, waterCycles: 6, drinkCount: 0 })).toBe(
      'LOCKED IN',
    );
  });

  it('returns FLOW as the default mid-band signal', () => {
    expect(deriveSocialSignal({ recoveryCapacity: 65, waterCycles: 4, drinkCount: 0 })).toBe(
      'FLOW',
    );
  });
});

describe('deriveSocialCommand', () => {
  it('always demands water once any drink is logged', () => {
    expect(deriveSocialCommand({ recoveryCapacity: 90, waterCycles: 9, drinkCount: 1 })).toBe(
      'One water. Now.',
    );
  });

  it('asks to cycle water when too few cycles', () => {
    expect(deriveSocialCommand({ recoveryCapacity: 80, waterCycles: 1, drinkCount: 0 })).toBe(
      'Cycle water before the next round.',
    );
  });
});

describe('deriveSocialForecast', () => {
  it('flags signal down at very low capacity', () => {
    expect(deriveSocialForecast({ recoveryCapacity: 22, waterCycles: 6, drinkCount: 0 })).toBe(
      'Signal down.',
    );
  });

  it('returns Signal up when capacity high AND cycles strong', () => {
    expect(deriveSocialForecast({ recoveryCapacity: 80, waterCycles: 6, drinkCount: 0 })).toBe(
      'Signal up.',
    );
  });
});

describe('deriveSocialSharedContext', () => {
  it('returns the quiet sentence when crew is empty', () => {
    expect(deriveSocialSharedContext([])).toBe('Crew quiet.');
  });

  it('summarises mixed crew states in canonical order', () => {
    const crew: CrewMember[] = [
      { name: 'a', state: 'FLOW' },
      { name: 'b', state: 'LOCKED IN' },
      { name: 'c', state: 'RECOVERING' },
    ];
    expect(deriveSocialSharedContext(crew)).toBe('1 locked in · 1 in flow · 1 recovering.');
  });

  it('caps at CREW_MAX even if more members are supplied', () => {
    const crew: CrewMember[] = [
      { name: 'a', state: 'LOCKED IN' },
      { name: 'b', state: 'LOCKED IN' },
      { name: 'c', state: 'LOCKED IN' },
      { name: 'd', state: 'RECOVERING' }, // dropped
    ];
    expect(deriveSocialSharedContext(crew)).toBe(`${CREW_MAX} locked in.`);
  });
});

describe('deriveSocialSnapshot', () => {
  it('returns all six surfaces in one call', () => {
    const snap = deriveSocialSnapshot({
      recoveryCapacity: 65,
      waterCycles: 4,
      drinkCount: 0,
      crew: [{ name: 'maya', state: 'LOCKED IN' }],
      sessionMemory: null,
    });
    expect(snap.signal).toBe('FLOW');
    expect(snap.command).toBe('Hold position.');
    expect(snap.forecast).toBe('Signal holding.');
    expect(snap.sharedContext).toBe('1 locked in.');
    expect(snap.crew).toHaveLength(1);
    expect(snap.sessionMemory).toBeNull();
  });
});
