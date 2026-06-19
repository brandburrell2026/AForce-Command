import { describe, it, expect } from 'vitest';
import {
  localDayKey,
  localDayIndex,
  isMorningWindow,
  isCheckInDue,
  snoozeRevalidationDelay,
  clampScale,
  isCheckInGoal,
  CHECKIN_GOAL_IDS,
} from '../voiceCheckIn';

describe('voiceCheckIn · localDayKey / localDayIndex', () => {
  it('formats the local calendar day as YYYY-MM-DD', () => {
    expect(localDayKey(new Date(2026, 5, 19, 7, 30))).toBe('2026-06-19');
    expect(localDayKey(new Date(2026, 0, 1, 0, 0))).toBe('2026-01-01');
  });

  it('day index is stable within a day and increments across midnight', () => {
    const morning = new Date(2026, 5, 19, 6, 0);
    const evening = new Date(2026, 5, 19, 23, 0);
    const next = new Date(2026, 5, 20, 1, 0);
    expect(localDayIndex(morning)).toBe(localDayIndex(evening));
    expect(localDayIndex(next) - localDayIndex(morning)).toBe(1);
  });
});

describe('voiceCheckIn · isMorningWindow', () => {
  it('is true inside 04:00–11:59 local', () => {
    expect(isMorningWindow(new Date(2026, 5, 19, 4, 0))).toBe(true);
    expect(isMorningWindow(new Date(2026, 5, 19, 7, 30))).toBe(true);
    expect(isMorningWindow(new Date(2026, 5, 19, 11, 59))).toBe(true);
  });

  it('is false before 04:00 and at/after 12:00', () => {
    expect(isMorningWindow(new Date(2026, 5, 19, 3, 59))).toBe(false);
    expect(isMorningWindow(new Date(2026, 5, 19, 12, 0))).toBe(false);
    expect(isMorningWindow(new Date(2026, 5, 19, 18, 0))).toBe(false);
  });
});

describe('voiceCheckIn · isCheckInDue', () => {
  const morning = new Date(2026, 5, 19, 7, 0);

  it('is due in the morning when not completed today', () => {
    expect(
      isCheckInDue({ lastCompletedDayKey: null, snoozedUntilMs: null, now: morning }),
    ).toBe(true);
    expect(
      isCheckInDue({
        lastCompletedDayKey: '2026-06-18',
        snoozedUntilMs: null,
        now: morning,
      }),
    ).toBe(true);
  });

  it('is not due once completed today', () => {
    expect(
      isCheckInDue({
        lastCompletedDayKey: '2026-06-19',
        snoozedUntilMs: null,
        now: morning,
      }),
    ).toBe(false);
  });

  it('is never due outside the morning window', () => {
    const afternoon = new Date(2026, 5, 19, 15, 0);
    expect(
      isCheckInDue({ lastCompletedDayKey: null, snoozedUntilMs: null, now: afternoon }),
    ).toBe(false);
  });

  it('respects an active snooze', () => {
    const snoozeUntil = new Date(2026, 5, 19, 8, 0).getTime();
    expect(
      isCheckInDue({
        lastCompletedDayKey: null,
        snoozedUntilMs: snoozeUntil,
        now: morning,
      }),
    ).toBe(false);
    // After the snooze passes (still morning), it is due again.
    expect(
      isCheckInDue({
        lastCompletedDayKey: null,
        snoozedUntilMs: snoozeUntil,
        now: new Date(2026, 5, 19, 8, 1),
      }),
    ).toBe(true);
  });
});

describe('voiceCheckIn · snoozeRevalidationDelay', () => {
  const now = new Date(2026, 5, 19, 8, 0);

  it('returns null when there is no snooze', () => {
    expect(snoozeRevalidationDelay(null, now)).toBeNull();
  });

  it('returns the positive delay for a future snooze', () => {
    const until = new Date(2026, 5, 19, 8, 30).getTime();
    expect(snoozeRevalidationDelay(until, now)).toBe(30 * 60_000);
  });

  it('returns null for an already-expired snooze (no revalidate loop)', () => {
    const past = new Date(2026, 5, 19, 7, 30).getTime();
    expect(snoozeRevalidationDelay(past, now)).toBeNull();
    // Exactly at expiry is also "nothing to wait for".
    expect(snoozeRevalidationDelay(now.getTime(), now)).toBeNull();
  });
});

describe('voiceCheckIn · validation helpers', () => {
  it('clamps onto the 1–5 scale', () => {
    expect(clampScale(0)).toBe(1);
    expect(clampScale(3)).toBe(3);
    expect(clampScale(9)).toBe(5);
    expect(clampScale(3.6)).toBe(4);
    expect(clampScale(Number.NaN)).toBe(1);
  });

  it('recognizes known goal ids only', () => {
    for (const g of CHECKIN_GOAL_IDS) expect(isCheckInGoal(g)).toBe(true);
    expect(isCheckInGoal('sleep')).toBe(false);
    expect(isCheckInGoal(3)).toBe(false);
    expect(isCheckInGoal(null)).toBe(false);
  });
});
