/**
 * Day-cadence × Decision Guard — the founder-authorized coverage ruling
 * closing the last flagged notification stream (#876: "the Day 0/1/3/7
 * cadence … bypasses the SS42 seam entirely; if 'Decision Guard can block
 * every output' is read literally, this stream is currently outside any
 * guardable seam").
 *
 * The seam: deriveScheduledNotifications is the ONE copy source both
 * delivery paths consume (the OS bridge schedules slot.title/slot.body;
 * the in-app banner renders due.title/due.body from the same slots). The
 * guard judges every slot there; a day whose copy leaves contract is
 * DROPPED — fail-closed, never reworded.
 *
 * Pinned here:
 *  - all four spec copies are in contract → production schedules are
 *    byte-identical (the four-day pin in notifications.test.ts:53 keeps
 *    holding for exactly this reason);
 *  - a poisoned copy table (pure DI param, tests only) drops exactly the
 *    poisoned day and keeps the rest.
 */
import { describe, it, expect, vi } from 'vitest';

// Per-repo convention (notifications.test.ts): mock the RN/Expo-native
// edges so the REAL scheduler logic stays under test.
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
  NOTIFICATION_COPY,
  NOTIFICATION_DAYS,
  deriveScheduledNotifications,
} from '../notifications';
import { evaluateDeliverableCopy } from '@/utils/intelligence/decisionGuard';

const START = '2026-01-01T00:00:00.000Z';

describe('cadence copy — in contract, schedules byte-identical', () => {
  it('all four spec copies pass the guard (non-vacuous production proof)', () => {
    for (const day of NOTIFICATION_DAYS) {
      const { title, body } = NOTIFICATION_COPY[day];
      expect(evaluateDeliverableCopy(title), `day ${day} title`).toEqual({ verdict: 'approved' });
      expect(evaluateDeliverableCopy(body), `day ${day} body`).toEqual({ verdict: 'approved' });
    }
  });

  it('the default derivation still yields all four days, copy verbatim', () => {
    const slots = deriveScheduledNotifications(START);
    expect(slots.map((s) => s.day)).toEqual([0, 1, 3, 7]);
    for (const s of slots) {
      expect(s.title).toBe(NOTIFICATION_COPY[s.day].title);
      expect(s.body).toBe(NOTIFICATION_COPY[s.day].body);
    }
  });
});

describe('cadence guard — out-of-contract copy is dropped, never reworded', () => {
  const poisonedTable = (day: (typeof NOTIFICATION_DAYS)[number], title: string) =>
    ({
      ...NOTIFICATION_COPY,
      [day]: { title, body: NOTIFICATION_COPY[day].body },
    }) as typeof NOTIFICATION_COPY;

  it('drops exactly the day whose copy smuggles an unsafe dose', () => {
    const slots = deriveScheduledNotifications(START, poisonedTable(3, 'Chug 500 oz today'));
    expect(slots.map((s) => s.day)).toEqual([0, 1, 7]);
  });

  it('drops exactly the day whose copy carries commercial steering', () => {
    const slots = deriveScheduledNotifications(
      START,
      poisonedTable(7, 'Bring an AForce stick everywhere'),
    );
    expect(slots.map((s) => s.day)).toEqual([0, 1, 3]);
  });

  it('surviving slots are untouched (drop, never rewrite)', () => {
    const slots = deriveScheduledNotifications(START, poisonedTable(0, 'Drink 900 oz now'));
    expect(slots.map((s) => s.day)).toEqual([1, 3, 7]);
    for (const s of slots) {
      expect(s.title).toBe(NOTIFICATION_COPY[s.day].title);
      expect(s.body).toBe(NOTIFICATION_COPY[s.day].body);
    }
  });
});
