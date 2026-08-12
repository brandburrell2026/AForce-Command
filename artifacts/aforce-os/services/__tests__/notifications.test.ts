import { describe, it, expect, vi } from 'vitest';

// Per-repo convention (see realApi.intake.test.ts / claimsGateRuntimeSeams.test.ts):
// vi.mock the RN/Expo-native edges the service imports so the REAL scheduler
// logic stays under test. `@react-native-async-storage/async-storage` touches
// native storage, and `@/store/useAppStore` transitively pulls the `expo`
// winter runtime — both unloadable in node/vitest. Mocks match only what
// notifications.ts reads: AsyncStorage.getItem/setItem and useFeatureFlags().
vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn(async () => null),
    setItem: vi.fn(async () => undefined),
  },
}));
vi.mock('@/store/useAppStore', () => ({
  useFeatureFlags: () => ({ spec_notifications: false }),
}));

import {
  MAX_PER_DAY,
  NOTIFICATION_COPY,
  NOTIFICATION_DAYS,
  deriveScheduledNotifications,
  dueNotifications,
  throttleByCalendarDay,
  type NotificationDelivery,
} from '../notifications';

const START = '2026-01-01T00:00:00.000Z';
const startMs = Date.parse(START);
const MS_PER_DAY = 24 * 60 * 60 * 1000;

describe('notifications — spec constants', () => {
  it('caps at one delivery per calendar day', () => {
    expect(MAX_PER_DAY).toBe(1);
  });

  it('uses the exact spec cadence in spec order', () => {
    expect(NOTIFICATION_DAYS).toEqual([0, 1, 3, 7]);
  });

  it('exposes the four spec titles verbatim', () => {
    expect(NOTIFICATION_COPY[0]!.title).toBe('Welcome');
    expect(NOTIFICATION_COPY[1]!.title).toBe('Signal active');
    expect(NOTIFICATION_COPY[3]!.title).toBe('Recovery rhythm building');
    expect(NOTIFICATION_COPY[7]!.title).toBe('Recovery Story');
  });
});

describe('deriveScheduledNotifications', () => {
  it('returns one entry per spec day with the right offsets and copy', () => {
    const s = deriveScheduledNotifications(START);
    expect(s.map((x) => x.day)).toEqual([0, 1, 3, 7]);
    expect(Date.parse(s[0]!.dueAt) - startMs).toBe(0);
    expect(Date.parse(s[1]!.dueAt) - startMs).toBe(1 * MS_PER_DAY);
    expect(Date.parse(s[2]!.dueAt) - startMs).toBe(3 * MS_PER_DAY);
    expect(Date.parse(s[3]!.dueAt) - startMs).toBe(7 * MS_PER_DAY);
    expect(s[0]!.title).toBe('Welcome');
  });

  it('tolerates unparseable startAt without throwing', () => {
    const s = deriveScheduledNotifications('not-a-date');
    expect(s).toHaveLength(4);
  });
});

describe('throttleByCalendarDay', () => {
  it('returns false when no deliveries today', () => {
    const history: NotificationDelivery[] = [
      { day: 0, deliveredAt: '2025-12-31T23:59:00.000Z' },
    ];
    expect(throttleByCalendarDay(history, '2026-01-01T08:00:00.000Z')).toBe(false);
  });

  it('returns true once today already has one delivery', () => {
    const history: NotificationDelivery[] = [
      { day: 0, deliveredAt: '2026-01-01T01:00:00.000Z' },
    ];
    expect(throttleByCalendarDay(history, '2026-01-01T23:00:00.000Z')).toBe(true);
  });
});

describe('dueNotifications', () => {
  const scheduled = deriveScheduledNotifications(START);

  it('returns null when nothing is due yet', () => {
    expect(dueNotifications(scheduled, startMs - 1, [])).toBeNull();
  });

  it('returns Day 0 at start with empty history', () => {
    const due = dueNotifications(scheduled, startMs, []);
    expect(due?.day).toBe(0);
  });

  it('returns the next undelivered day when prior days are delivered', () => {
    const history: NotificationDelivery[] = [
      { day: 0, deliveredAt: START },
    ];
    // Now = Day 2 (between Day 1 and Day 3)
    const due = dueNotifications(scheduled, startMs + 2 * MS_PER_DAY, history);
    expect(due?.day).toBe(1);
  });

  it('returns null when today already has one delivery (1/day cap)', () => {
    const history: NotificationDelivery[] = [
      { day: 0, deliveredAt: '2026-01-08T01:00:00.000Z' },
    ];
    // Now = Day 7 (8th calendar day), but already delivered today
    const due = dueNotifications(scheduled, Date.parse('2026-01-08T20:00:00.000Z'), history);
    expect(due).toBeNull();
  });

  it('allows next-day delivery after a same-day delivery has rolled over', () => {
    const history: NotificationDelivery[] = [
      { day: 0, deliveredAt: '2026-01-01T01:00:00.000Z' },
    ];
    // Now = Day 1+1h, no delivery yet today → Day 1 is eligible
    const due = dueNotifications(scheduled, startMs + 1 * MS_PER_DAY + 3600_000, history);
    expect(due?.day).toBe(1);
  });

  it('returns null when all four days are delivered', () => {
    const history: NotificationDelivery[] = NOTIFICATION_DAYS.map((day) => ({
      day,
      deliveredAt: '2025-12-01T00:00:00.000Z',
    }));
    expect(dueNotifications(scheduled, startMs + 30 * MS_PER_DAY, history)).toBeNull();
  });
});
