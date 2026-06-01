import { describe, it, expect } from 'vitest';

import {
  computeAnalyticsMetrics,
  type AnalyticsEvent,
} from '../analytics/metrics';

const HOUR = 3_600_000;
const DAY = 86_400_000;

function at(ms: number): string {
  return new Date(ms).toISOString();
}

describe('computeAnalyticsMetrics', () => {
  it('returns empty/neutral metrics for no events', () => {
    const m = computeAnalyticsMetrics([]);
    expect(m.timeToFirstWinMs).toBeNull();
    expect(m.onboarding.completed).toBe(false);
    expect(m.onboarding.completedAt).toBeNull();
    expect(m.retention.activeDays).toBe(0);
    expect(m.retention.currentDayStreak).toBe(0);
    expect(m.reminders.shown).toBe(0);
    expect(m.reminders.responseRate).toBeNull();
    expect(m.streak.current).toBeNull();
    expect(m.streak.max).toBeNull();
  });

  it('measures Time To First Win from onboarding completion to first win', () => {
    const base = Date.parse('2026-01-01T08:00:00.000Z');
    const events: AnalyticsEvent[] = [
      { type: 'session_open', at: at(base) },
      { type: 'onboarding_completed', at: at(base + 5 * 60_000) },
      { type: 'win', at: at(base + 5 * 60_000 + 2 * HOUR), meta: { winId: 'water_cycle' } },
      { type: 'win', at: at(base + 6 * HOUR), meta: { winId: 'daily_goal' } },
    ];
    const m = computeAnalyticsMetrics(events);
    expect(m.timeToFirstWinMs).toBe(2 * HOUR);
  });

  it('falls back to first session when onboarding is not recorded', () => {
    const base = Date.parse('2026-01-01T08:00:00.000Z');
    const m = computeAnalyticsMetrics([
      { type: 'session_open', at: at(base) },
      { type: 'win', at: at(base + 90 * 60_000), meta: { winId: 'water_cycle' } },
    ]);
    expect(m.timeToFirstWinMs).toBe(90 * 60_000);
  });

  it('Time To First Win is null when there is no win', () => {
    const base = Date.parse('2026-01-01T08:00:00.000Z');
    const m = computeAnalyticsMetrics([
      { type: 'session_open', at: at(base) },
      { type: 'onboarding_completed', at: at(base + 60_000) },
    ]);
    expect(m.timeToFirstWinMs).toBeNull();
  });

  it('records onboarding completion and time from first session', () => {
    const base = Date.parse('2026-01-01T08:00:00.000Z');
    const m = computeAnalyticsMetrics([
      { type: 'session_open', at: at(base) },
      { type: 'onboarding_completed', at: at(base + 30 * 60_000) },
    ]);
    expect(m.onboarding.completed).toBe(true);
    expect(m.onboarding.completedAt).toBe(at(base + 30 * 60_000));
    expect(m.onboarding.msFromFirstSession).toBe(30 * 60_000);
  });

  it('counts retention as distinct calendar days and a current consecutive streak', () => {
    const d0 = Date.parse('2026-01-01T08:00:00.000Z');
    const m = computeAnalyticsMetrics([
      { type: 'session_open', at: at(d0) },
      { type: 'session_open', at: at(d0 + 2 * HOUR) }, // same day → still 1 day
      { type: 'session_open', at: at(d0 + DAY) },
      { type: 'session_open', at: at(d0 + 2 * DAY) },
      { type: 'session_open', at: at(d0 + 5 * DAY) }, // gap breaks streak
    ]);
    expect(m.retention.activeDays).toBe(4);
    expect(m.retention.currentDayStreak).toBe(1);
    expect(m.retention.firstSeenAt).toBe(at(d0));
    expect(m.retention.lastActiveAt).toBe(at(d0 + 5 * DAY));
  });

  it('counts a multi-day consecutive streak ending at the latest day', () => {
    const d0 = Date.parse('2026-01-01T08:00:00.000Z');
    const m = computeAnalyticsMetrics([
      { type: 'session_open', at: at(d0) },
      { type: 'session_open', at: at(d0 + DAY) },
      { type: 'session_open', at: at(d0 + 2 * DAY) },
    ]);
    expect(m.retention.currentDayStreak).toBe(3);
  });

  it('computes reminder response rate from distinct slots', () => {
    const base = Date.parse('2026-01-01T08:00:00.000Z');
    const m = computeAnalyticsMetrics([
      { type: 'reminder_shown', at: at(base), meta: { reminderDay: '0' } },
      { type: 'reminder_shown', at: at(base + HOUR), meta: { reminderDay: '0' } }, // dup slot
      { type: 'reminder_shown', at: at(base + DAY), meta: { reminderDay: '1' } },
      { type: 'reminder_response', at: at(base + 30 * 60_000), meta: { reminderDay: '0' } },
    ]);
    expect(m.reminders.shown).toBe(2);
    expect(m.reminders.responded).toBe(1);
    expect(m.reminders.responseRate).toBe(0.5);
  });

  it('caps response rate to [0,1] by counting only responses to shown slots', () => {
    const base = Date.parse('2026-01-01T08:00:00.000Z');
    const m = computeAnalyticsMetrics([
      { type: 'reminder_shown', at: at(base), meta: { reminderDay: '0' } },
      // A response for a slot that was never shown must not inflate the rate.
      { type: 'reminder_response', at: at(base + HOUR), meta: { reminderDay: '0' } },
      { type: 'reminder_response', at: at(base + 2 * HOUR), meta: { reminderDay: '9' } },
    ]);
    expect(m.reminders.shown).toBe(1);
    expect(m.reminders.responded).toBe(1);
    expect(m.reminders.responseRate).toBe(1);
  });

  it('tracks streak progression current value and max', () => {
    const base = Date.parse('2026-01-01T08:00:00.000Z');
    const m = computeAnalyticsMetrics([
      { type: 'streak_changed', at: at(base), meta: { value: 1 } },
      { type: 'streak_changed', at: at(base + DAY), meta: { value: 2 } },
      { type: 'streak_changed', at: at(base + 2 * DAY), meta: { value: 3 } },
      { type: 'streak_changed', at: at(base + 3 * DAY), meta: { value: 0 } }, // reset
    ]);
    expect(m.streak.current).toBe(0);
    expect(m.streak.max).toBe(3);
    expect(m.streak.changes).toBe(4);
  });

  it('is order-independent (sorts events by time before computing)', () => {
    const base = Date.parse('2026-01-01T08:00:00.000Z');
    const ordered: AnalyticsEvent[] = [
      { type: 'session_open', at: at(base) },
      { type: 'onboarding_completed', at: at(base + 60_000) },
      { type: 'win', at: at(base + HOUR), meta: { winId: 'water_cycle' } },
    ];
    const shuffled = [ordered[2], ordered[0], ordered[1]];
    expect(computeAnalyticsMetrics(shuffled)).toEqual(
      computeAnalyticsMetrics(ordered),
    );
  });

  it('ignores events with unparseable timestamps', () => {
    const base = Date.parse('2026-01-01T08:00:00.000Z');
    const m = computeAnalyticsMetrics([
      { type: 'session_open', at: 'not-a-date' },
      { type: 'session_open', at: at(base) },
    ]);
    expect(m.retention.activeDays).toBe(1);
  });
});
