/**
 * Reminder planner — quiet hours, daily cap, past times, idempotency. Pure.
 */
import { describe, it, expect, vi } from 'vitest';

// Native edges the reminder service reaches at import (expo-notifications via
// pushNotifications; AsyncStorage via scopedStorage) — mocked per the repo's
// per-suite convention so the pure planner runs in node.
vi.mock('@/services/pushNotifications', () => ({ primePushPermission: vi.fn(async () => true) }));
vi.mock('@/services/scopedStorage', () => ({
  scopedStorage: { getItem: vi.fn(async () => null), setItem: vi.fn(async () => {}), removeItem: vi.fn(async () => {}) },
}));
import { CONCIERGE_REMINDER_MAX_PER_DAY } from '../../../config/hydroStateModel';
import { inQuietHours, planReminder, shiftOutOfQuietHours, type StoredReminder } from '../conciergeReminders';

const NOW = new Date('2026-10-05T14:00:00');

const req = (over: Partial<Parameters<typeof planReminder>[0]> = {}) => ({
  actionId: 'a1',
  title: 'Water before the gym',
  timeLocal: '18:30',
  dateLocal: '2026-10-05',
  recurrence: 'once' as const,
  ...over,
});

describe('quiet hours (22:00–07:00, shared with Moments)', () => {
  it('detects the window across midnight', () => {
    expect(inQuietHours(new Date('2026-10-05T22:00:00'))).toBe(true);
    expect(inQuietHours(new Date('2026-10-06T03:15:00'))).toBe(true);
    expect(inQuietHours(new Date('2026-10-06T06:59:00'))).toBe(true);
    expect(inQuietHours(new Date('2026-10-06T07:00:00'))).toBe(false);
    expect(inQuietHours(new Date('2026-10-05T21:59:00'))).toBe(false);
  });
  it('shifts a late-evening time to 07:00 the NEXT day and an early-morning time to 07:00 the same day', () => {
    expect(shiftOutOfQuietHours(new Date('2026-10-05T23:30:00')).toISOString()).toBe(new Date('2026-10-06T07:00:00').toISOString());
    expect(shiftOutOfQuietHours(new Date('2026-10-06T05:00:00')).toISOString()).toBe(new Date('2026-10-06T07:00:00').toISOString());
    const ok = new Date('2026-10-05T18:30:00');
    expect(shiftOutOfQuietHours(ok)).toBe(ok);
  });
});

describe('planReminder', () => {
  it('plans a one-off reminder at the requested local time', () => {
    const r = planReminder(req(), [], NOW);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.plan.timeLocal).toBe('18:30');
      expect(r.plan.shifted).toBe(false);
      expect(r.plan.identifier).toBe('aforce.concierge.reminder.a1');
    }
  });
  it('moves a quiet-hours request and says so', () => {
    const r = planReminder(req({ timeLocal: '23:00' }), [], NOW);
    expect(r.ok && r.plan.shifted).toBe(true);
    expect(r.ok && r.plan.timeLocal).toBe('07:00');
  });
  it('refuses a one-off time already in the past', () => {
    expect(planReminder(req({ timeLocal: '09:00' }), [], NOW)).toEqual({ ok: false, reason: 'in_past' });
  });
  it('rolls a daily reminder whose time has passed today to tomorrow', () => {
    const r = planReminder(req({ timeLocal: '09:00', recurrence: 'daily' }), [], NOW);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.plan.fireAt.toISOString()).toBe(new Date('2026-10-06T09:00:00').toISOString());
  });
  it('rejects malformed input', () => {
    expect(planReminder(req({ timeLocal: '9:00' }), [], NOW)).toEqual({ ok: false, reason: 'invalid' });
    expect(planReminder(req({ dateLocal: '10/05/2026' }), [], NOW)).toEqual({ ok: false, reason: 'invalid' });
    expect(planReminder(req({ title: '   ' }), [], NOW)).toEqual({ ok: false, reason: 'invalid' });
  });
  it('enforces the per-day cap from config', () => {
    const existing: StoredReminder[] = Array.from({ length: CONCIERGE_REMINDER_MAX_PER_DAY }, (_, i) => ({
      actionId: `x${i}`,
      identifier: `aforce.concierge.reminder.x${i}`,
      fireAtIso: new Date('2026-10-05T17:00:00').toISOString(),
      title: 'Water',
      recurrence: 'once',
      scheduledDate: '2026-10-05',
    }));
    expect(planReminder(req(), existing, NOW)).toEqual({ ok: false, reason: 'limit_reached' });
    const yesterday = existing.map((e) => ({ ...e, scheduledDate: '2026-10-04' }));
    expect(planReminder(req(), yesterday, NOW).ok).toBe(true);
  });
  it('is idempotent for the same action id (returns the stored plan, counts nothing new)', () => {
    const existing: StoredReminder[] = [
      {
        actionId: 'a1',
        identifier: 'aforce.concierge.reminder.a1',
        fireAtIso: new Date('2026-10-05T18:30:00').toISOString(),
        title: 'Water before the gym',
        recurrence: 'once',
        scheduledDate: '2026-10-05',
      },
    ];
    const r = planReminder(req({ timeLocal: '23:00' }), existing, NOW);
    expect(r.ok && r.plan.timeLocal).toBe('18:30');
    expect(r.ok && r.plan.shifted).toBe(false);
  });
});
