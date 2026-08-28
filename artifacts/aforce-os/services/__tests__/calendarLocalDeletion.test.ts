/**
 * PR A — calendar local-deletion hardening (DR-011 close-out, O-1 + O-2).
 *
 *  O-1: disconnectCalendar() clears BOTH the prefs key (@aforce/calendarPrefs)
 *       and the prepared-marks key (@aforce/momentPrepared) — a disconnect
 *       leaves no calendar-derived record on disk.
 *  O-2: sign-out (user scope → null) purges the signing-out user's scoped
 *       calendar keys; another user's keys survive; a plain sign-in purges
 *       nothing.
 *
 * Driven over an in-memory AsyncStorage (the userScopeIsolation idiom).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

const { mem } = vi.hoisted(() => ({ mem: new Map<string, string>() }));

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: async (k: string) => (mem.has(k) ? (mem.get(k) as string) : null),
    setItem: async (k: string, v: string) => {
      mem.set(k, v);
    },
    removeItem: async (k: string) => {
      mem.delete(k);
    },
  },
}));
// secureStorage pulls the RN/Expo module graph; the secure lane is not under
// test — back it with the same in-memory map (matches userScopeIsolation).
vi.mock('../secureStorage', () => ({
  secureKV: {
    getItem: async (k: string) => (mem.has(`sec:${k}`) ? (mem.get(`sec:${k}`) as string) : null),
    setItem: async (k: string, v: string) => {
      mem.set(`sec:${k}`, v);
    },
    removeItem: async (k: string) => {
      mem.delete(`sec:${k}`);
    },
  },
}));

// Let the fire-and-forget purge (dispatched with `void` inside the sync scope
// listener) settle.
const flush = () => new Promise((r) => setTimeout(r, 0));

beforeEach(() => {
  mem.clear();
  vi.resetModules();
});

describe('O-1 · disconnectCalendar clears prefs AND prepared-marks', () => {
  it('removes both @aforce/calendarPrefs and @aforce/momentPrepared', async () => {
    const bridge = await import('../calendarBridge');
    mem.set(
      '@aforce/calendarPrefs',
      JSON.stringify({ connected: true, selectedCalendarIds: ['c1'], categories: ['work'] }),
    );
    mem.set('@aforce/momentPrepared', JSON.stringify({ evt1: '2026-08-28T00:00:00.000Z' }));

    await bridge.disconnectCalendar();

    expect(mem.has('@aforce/calendarPrefs')).toBe(false);
    expect(mem.has('@aforce/momentPrepared')).toBe(false);
  });
});

describe('O-2 · sign-out purges the signing-out user\'s scoped calendar keys', () => {
  it('deletes prefs+prepared for the signing-out user; a bystander user survives', async () => {
    const { setUserScope, migrationSettled, __resetUserScopeForTests } = await import('../userScope');
    const { wireUserScopeCleanup, __resetUserScopeCleanupForTests } = await import('../userScopeCleanup');
    __resetUserScopeForTests();
    __resetUserScopeCleanupForTests();

    wireUserScopeCleanup();
    setUserScope('userA');
    await migrationSettled();

    mem.set('@aforce/calendarPrefs:userA', 'A-prefs');
    mem.set('@aforce/momentPrepared:userA', 'A-marks');
    mem.set('@aforce/calendarPrefs:userB', 'B-prefs'); // bystander

    setUserScope(null); // sign out
    await flush();

    expect(mem.has('@aforce/calendarPrefs:userA')).toBe(false);
    expect(mem.has('@aforce/momentPrepared:userA')).toBe(false);
    expect(mem.has('@aforce/calendarPrefs:userB')).toBe(true);
  });

  it('a plain sign-in (null → user) purges nothing', async () => {
    const { setUserScope, migrationSettled, __resetUserScopeForTests } = await import('../userScope');
    const { wireUserScopeCleanup, __resetUserScopeCleanupForTests } = await import('../userScopeCleanup');
    __resetUserScopeForTests();
    __resetUserScopeCleanupForTests();

    mem.set('@aforce/calendarPrefs:userA', 'A-prefs');
    wireUserScopeCleanup();
    setUserScope('userA'); // sign in
    await migrationSettled();
    await flush();

    expect(mem.has('@aforce/calendarPrefs:userA')).toBe(true);
  });
});
