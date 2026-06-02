/**
 * sleepStateMachine — locks the 5-state Sleep lifecycle contract from
 * Rule #14 of the spec. Pure-function tests only; the React hook is
 * exercised separately at the screen level when it's wired in a
 * later rule.
 *
 * State priority (verified below): RECOVERY beats PREPARE/WIND_DOWN
 * (you can be asleep before your planned bedtime), MORNING_RESTORE
 * beats IDLE for the first 2 h after waking.
 */

import { describe, it, expect } from 'vitest';

import {
  deriveSleepState,
  MORNING_RESTORE_MIN,
  PREPARE_LEAD_MIN,
  WIND_DOWN_LEAD_MIN,
} from '../sleepStateMachine';

const MIN_MS = 60_000;
const BEDTIME = Date.UTC(2026, 4, 25, 22, 0, 0); // arbitrary anchor

describe('deriveSleepState', () => {
  it('returns IDLE when no sleep context exists', () => {
    const snap = deriveSleepState({
      now: BEDTIME - 8 * 60 * MIN_MS,
      plannedBedtimeAt: null,
      sleepStartAt: null,
      sleepEndAt: null,
    });
    expect(snap.state).toBe('idle');
    expect(snap.nextTransitionAt).toBeNull();
  });

  it('returns IDLE when bedtime is more than PREPARE lead away', () => {
    const snap = deriveSleepState({
      now: BEDTIME - (PREPARE_LEAD_MIN + 30) * MIN_MS,
      plannedBedtimeAt: BEDTIME,
      sleepStartAt: null,
      sleepEndAt: null,
    });
    expect(snap.state).toBe('idle');
    expect(snap.nextTransitionAt).toBe(BEDTIME - PREPARE_LEAD_MIN * MIN_MS);
  });

  it('transitions to PREPARE at exactly the PREPARE lead boundary', () => {
    const snap = deriveSleepState({
      now: BEDTIME - PREPARE_LEAD_MIN * MIN_MS,
      plannedBedtimeAt: BEDTIME,
      sleepStartAt: null,
      sleepEndAt: null,
    });
    expect(snap.state).toBe('prepare');
    expect(snap.nextTransitionAt).toBe(BEDTIME - WIND_DOWN_LEAD_MIN * MIN_MS);
  });

  it('transitions to WIND_DOWN at exactly the WIND_DOWN lead boundary', () => {
    const snap = deriveSleepState({
      now: BEDTIME - WIND_DOWN_LEAD_MIN * MIN_MS,
      plannedBedtimeAt: BEDTIME,
      sleepStartAt: null,
      sleepEndAt: null,
    });
    expect(snap.state).toBe('wind_down');
    expect(snap.nextTransitionAt).toBe(BEDTIME);
  });

  it('returns RECOVERY while asleep, even if before planned bedtime', () => {
    const sleepStart = BEDTIME - 10 * MIN_MS; // fell asleep 10 min early
    const snap = deriveSleepState({
      now: BEDTIME - 5 * MIN_MS,
      plannedBedtimeAt: BEDTIME,
      sleepStartAt: sleepStart,
      sleepEndAt: null,
    });
    expect(snap.state).toBe('recovery');
    expect(snap.since).toBe(sleepStart);
    expect(snap.nextTransitionAt).toBeNull();
  });

  it('returns MORNING_RESTORE for the first 2 h after wake', () => {
    const sleepEnd = BEDTIME + 8 * 60 * MIN_MS; // woke 8 h after bedtime
    const snap = deriveSleepState({
      now: sleepEnd + 30 * MIN_MS,
      plannedBedtimeAt: BEDTIME,
      sleepStartAt: BEDTIME,
      sleepEndAt: sleepEnd,
    });
    expect(snap.state).toBe('morning_restore');
    expect(snap.nextTransitionAt).toBe(sleepEnd + MORNING_RESTORE_MIN * MIN_MS);
  });

  it('falls back to IDLE once MORNING_RESTORE expires', () => {
    const sleepEnd = BEDTIME + 8 * 60 * MIN_MS;
    const snap = deriveSleepState({
      now: sleepEnd + (MORNING_RESTORE_MIN + 1) * MIN_MS,
      plannedBedtimeAt: null,
      sleepStartAt: BEDTIME,
      sleepEndAt: sleepEnd,
    });
    expect(snap.state).toBe('idle');
  });
});
