import { describe, it, expect } from 'vitest';
import {
  makeCommandTimer,
  resolveCommandTimerView,
  formatRemaining,
  type NightOutCommandTimer,
} from '../commandTimer';

const T0 = Date.UTC(2026, 0, 1, 22, 0, 0);
const MIN = 60 * 1000;

describe('NO-c timer contract', () => {
  it('makeCommandTimer anchors to the authoritative start timestamp', () => {
    const t = makeCommandTimer('cmd-1', 20 * MIN, T0);
    expect(t).toEqual({ commandId: 'cmd-1', startedAtMs: T0, windowMs: 20 * MIN });
  });

  it('no timer object exists until acceptance — a null timer resolves to invalid (idle), never running', () => {
    const v = resolveCommandTimerView(null, T0);
    expect(v.status).toBe('invalid');
    expect(v.remainingMs).toBe(0);
    expect(v.expired).toBe(false);
  });

  it('runs down from the stored timestamp (restoration re-derives the same view)', () => {
    const t = makeCommandTimer('c', 20 * MIN, T0);
    // 5 minutes later (e.g. after backgrounding + reopen)
    const v = resolveCommandTimerView(t, T0 + 5 * MIN);
    expect(v.status).toBe('running');
    expect(v.elapsedMs).toBe(5 * MIN);
    expect(v.remainingMs).toBe(15 * MIN);
    expect(v.remainingSec).toBe(15 * 60);
  });

  it('never produces negative time; expiry clamps remaining to 0', () => {
    const t = makeCommandTimer('c', 20 * MIN, T0);
    const v = resolveCommandTimerView(t, T0 + 999 * MIN);
    expect(v.status).toBe('expired');
    expect(v.remainingMs).toBe(0);
    expect(v.remainingSec).toBe(0);
  });

  it('EXPIRY IS NOT COMPLETION — expired view never signals completed / never advances anything', () => {
    const t = makeCommandTimer('c', 1 * MIN, T0);
    const v = resolveCommandTimerView(t, T0 + 10 * MIN);
    expect(v.expired).toBe(true);
    // there is no "completed" field the timer can set — completion is a separate
    // explicit action. The view only reports expiry.
    expect(Object.keys(v)).not.toContain('completed');
  });

  it('handles a backwards clock jump conservatively (no over-credit, no negative)', () => {
    const t = makeCommandTimer('c', 20 * MIN, T0);
    // clock moved BEFORE the start → elapsed clamped to 0, full window remains
    const v = resolveCommandTimerView(t, T0 - 30 * MIN);
    expect(v.status).toBe('running');
    expect(v.elapsedMs).toBe(0);
    expect(v.remainingMs).toBe(20 * MIN);
  });

  it('invalid / stale timestamps resolve to a safe recoverable state', () => {
    const cases: NightOutCommandTimer[] = [
      { commandId: 'c', startedAtMs: NaN, windowMs: 20 * MIN },
      { commandId: 'c', startedAtMs: 0, windowMs: 20 * MIN },
      { commandId: 'c', startedAtMs: -5, windowMs: 20 * MIN },
      { commandId: 'c', startedAtMs: T0, windowMs: 0 },
      { commandId: 'c', startedAtMs: T0, windowMs: Infinity },
    ];
    for (const t of cases) {
      const v = resolveCommandTimerView(t, T0 + MIN);
      expect(v.status).toBe('invalid');
      expect(v.remainingMs).toBe(0);
      expect(v.expired).toBe(false);
    }
    // a non-finite clock is also safe
    expect(resolveCommandTimerView(makeCommandTimer('c', 20 * MIN, T0), NaN).status).toBe('invalid');
  });

  it('exactly at the window boundary is expired (>=), not running', () => {
    const t = makeCommandTimer('c', 20 * MIN, T0);
    expect(resolveCommandTimerView(t, T0 + 20 * MIN).status).toBe('expired');
    expect(resolveCommandTimerView(t, T0 + 20 * MIN - 1).status).toBe('running');
  });

  it('formatRemaining renders m:ss and never negative', () => {
    expect(formatRemaining(20 * 60)).toBe('20:00');
    expect(formatRemaining(65)).toBe('1:05');
    expect(formatRemaining(9)).toBe('0:09');
    expect(formatRemaining(-100)).toBe('0:00');
  });
});
