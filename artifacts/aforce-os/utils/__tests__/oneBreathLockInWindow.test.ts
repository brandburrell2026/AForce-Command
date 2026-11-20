/**
 * Lock In only when the Moment begins (One Breath Final Build Spec, L1–L2).
 */
import { describe, it, expect } from 'vitest';
import { MOMENT_LOCK_IN_BEFORE_MIN } from '@/config/hydroStateModel';
import { LOCK_IN_NOT_YET, lockInOpensInMs, lockInWindow } from '@/utils/oneBreath/lockInWindow';

const START = '2026-11-21T11:30:00.000Z';
const at = (minutesBeforeStart: number) => Date.parse(START) - minutesBeforeStart * 60_000;

describe('Lock In window', () => {
  it('is closed at sealing time for a Moment that is hours away', () => {
    expect(lockInWindow(START, at(18 * 60))).toBe('before');
    expect(lockInWindow(START, at(MOMENT_LOCK_IN_BEFORE_MIN + 1))).toBe('before');
  });

  it('opens exactly at the shared lead time and stays open through the start', () => {
    expect(lockInWindow(START, at(MOMENT_LOCK_IN_BEFORE_MIN))).toBe('open');
    expect(lockInWindow(START, at(0))).toBe('open');
    expect(lockInWindow(START, at(-45))).toBe('open');
  });

  it('reports how long until it opens, for one timer and no polling', () => {
    expect(lockInOpensInMs(START, at(MOMENT_LOCK_IN_BEFORE_MIN + 10))).toBe(10 * 60_000);
    expect(lockInOpensInMs(START, at(5))).toBe(0);
  });

  it('never blocks on a start time it cannot read', () => {
    expect(lockInWindow(undefined, Date.now())).toBe('open');
    expect(lockInWindow('not a date', Date.now())).toBe('open');
  });

  it('the waiting line states the same number the window uses', () => {
    expect(LOCK_IN_NOT_YET).toContain(String(MOMENT_LOCK_IN_BEFORE_MIN));
  });
});
