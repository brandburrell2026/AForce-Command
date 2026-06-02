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

  describe('friction score', () => {
    it('is null with all-null components when no events', () => {
      const m = computeAnalyticsMetrics([]);
      expect(m.friction.score).toBeNull();
      expect(m.friction.components).toEqual({
        timeToFirstLog: null,
        timeToFirstWin: null,
        reminderResponse: null,
        dailyActiveUsage: null,
        loggingCompletion: null,
      });
    });

    it('scores a frictionless onboarding at/near 100', () => {
      const base = Date.parse('2026-03-01T08:00:00.000Z');
      const m = computeAnalyticsMetrics([
        { type: 'session_open', at: at(base) },
        { type: 'onboarding_completed', at: at(base + 1000) },
        { type: 'win', at: at(base + 60_000) }, // first win well under 1h
        { type: 'reminder_shown', at: at(base + 2000), meta: { reminderDay: 1 } },
        {
          type: 'reminder_response',
          at: at(base + 2500),
          meta: { reminderDay: 1 },
        },
        { type: 'log_action', at: at(base + 3000), meta: { ttlMs: 800 } },
      ]);
      expect(m.friction.components.timeToFirstLog).toBe(1); // 800ms < 2000
      expect(m.friction.components.timeToFirstWin).toBe(1); // 60s < 1h
      expect(m.friction.components.reminderResponse).toBe(1); // 1/1
      expect(m.friction.components.loggingCompletion).toBe(1); // under 2s
      expect(m.friction.score).toBeGreaterThanOrEqual(80);
    });

    it('uses true time-to-first-log (anchor → first log), not median TTL', () => {
      const base = Date.parse('2026-03-02T08:00:00.000Z');
      const m = computeAnalyticsMetrics([
        { type: 'onboarding_completed', at: at(base) },
        // First log 30 min after onboarding → ease(900000, 1_800_000) = 0.5,
        // even though the per-log TTL (4000ms) is fast.
        { type: 'log_action', at: at(base + 1_800_000), meta: { ttlMs: 4000 } },
      ]);
      expect(m.logging.timeToFirstLogMs).toBe(1_800_000);
      expect(m.friction.components.timeToFirstLog).toBeCloseTo(0.5);
      expect(m.friction.components.loggingCompletion).toBe(0); // 4000ms ≥ 2s
      // No sessions → daily active usage unavailable; no reminders/wins.
      expect(m.friction.components.reminderResponse).toBeNull();
      expect(m.friction.components.timeToFirstWin).toBeNull();
      expect(m.friction.components.dailyActiveUsage).toBeNull();
      // averages only available components: mean(0.5, 0) * 100 = 25
      expect(m.friction.score).toBe(25);
    });

    it('time-to-first-log is null without an anchor', () => {
      const m = computeAnalyticsMetrics([
        { type: 'log_action', at: at(0), meta: { ttlMs: 800 } },
      ]);
      expect(m.logging.timeToFirstLogMs).toBeNull();
      expect(m.friction.components.timeToFirstLog).toBeNull();
    });

    it('ignores a pre-anchor log and measures from anchor to first later log', () => {
      const base = Date.parse('2026-03-02T08:00:00.000Z');
      const m = computeAnalyticsMetrics([
        // Log logged DURING onboarding, before the anchor — must not count.
        { type: 'log_action', at: at(base - 60_000), meta: { ttlMs: 800 } },
        { type: 'onboarding_completed', at: at(base) },
        { type: 'log_action', at: at(base + 120_000), meta: { ttlMs: 900 } },
      ]);
      // 2 min after the anchor, not the pre-anchor log.
      expect(m.logging.timeToFirstLogMs).toBe(120_000);
    });
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

  it('reports neutral logging metrics when nothing has been logged', () => {
    const m = computeAnalyticsMetrics([]);
    expect(m.logging.count).toBe(0);
    expect(m.logging.medianTimeToLogMs).toBeNull();
    expect(m.logging.underTwoSecondsRate).toBeNull();
  });

  it('computes Time-To-Log median and the under-2s rate', () => {
    const base = Date.parse('2026-01-01T08:00:00.000Z');
    const m = computeAnalyticsMetrics([
      { type: 'log_action', at: at(base), meta: { ttlMs: 800, source: 'log_water' } },
      { type: 'log_action', at: at(base + HOUR), meta: { ttlMs: 1500, source: 'repeat_last' } },
      { type: 'log_action', at: at(base + 2 * HOUR), meta: { ttlMs: 5000, source: 'complete_cycle' } },
    ]);
    expect(m.logging.count).toBe(3);
    expect(m.logging.medianTimeToLogMs).toBe(1500);
    expect(m.logging.underTwoSecondsRate).toBeCloseTo(2 / 3);
  });

  it('averages the two middle Time-To-Log values for an even count', () => {
    const base = Date.parse('2026-01-01T08:00:00.000Z');
    const m = computeAnalyticsMetrics([
      { type: 'log_action', at: at(base), meta: { ttlMs: 400, source: 'log_water' } },
      { type: 'log_action', at: at(base + HOUR), meta: { ttlMs: 600, source: 'log_water' } },
    ]);
    expect(m.logging.medianTimeToLogMs).toBe(500);
    expect(m.logging.underTwoSecondsRate).toBe(1);
  });

  it('ignores log events with a missing or negative ttl', () => {
    const base = Date.parse('2026-01-01T08:00:00.000Z');
    const m = computeAnalyticsMetrics([
      { type: 'log_action', at: at(base), meta: { source: 'log_water' } },
      { type: 'log_action', at: at(base + HOUR), meta: { ttlMs: -1, source: 'log_water' } },
      { type: 'log_action', at: at(base + 2 * HOUR), meta: { ttlMs: 1200, source: 'log_water' } },
    ]);
    expect(m.logging.count).toBe(1);
    expect(m.logging.medianTimeToLogMs).toBe(1200);
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
