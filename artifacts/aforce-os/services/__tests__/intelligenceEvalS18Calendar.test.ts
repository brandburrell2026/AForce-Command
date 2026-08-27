/**
 * §18 INTELLIGENCE EVALUATION — tranche 5: calendar consent revocation.
 *
 * FOUNDER CLARIFICATION (2026-08-27, binding): Calendar integration and
 * AForce Moments/Foresight are intended, intact capabilities. "Calendar
 * withdrawal" means ONLY the per-member consent-revocation scenario below.
 * This tranche is TEST-ONLY: it deletes no feature, route, UI, service,
 * schema, or flag, and changes no product status. If an invariant fails,
 * the failure is documented and work STOPS — no repair in this tranche.
 *
 * Lives apart from intelligenceEvalS18.test.ts so that suite stays
 * mock-free: this lifecycle needs the calendar bridge + storage mocked
 * (the classifier stays REAL — it is pure).
 *
 * The retention invariant pins the EXISTING policy (PR-002 Appendix A
 * minimization, calendarMoments.ts header): derived calendar moments are
 * in-memory only and never persisted; the single persisted artifact is
 * the member's own prepared-marks (event id → ISO), which contain no
 * event data. No new deletion policy is invented here.
 */
import { describe, expect, it, vi } from 'vitest';

const bridgeState = {
  permission: 'granted' as 'granted' | 'denied' | 'undetermined' | 'unavailable',
  prefs: {
    connected: true,
    selectedCalendarIds: ['cal-main'],
    categories: ['work', 'training', 'travel'] as const,
  },
  events: [] as Array<{ id: string; title?: string; startAtIso: string; endAtIso?: string; allDay?: boolean }>,
};

const storageWrites: Array<{ key: string; value: string }> = [];
const storage = new Map<string, string>();

vi.mock('../calendarBridge', () => ({
  getCalendarPermission: async () => bridgeState.permission,
  getCalendarPrefs: async () => bridgeState.prefs,
  fetchUpcomingEvents: async () => bridgeState.events,
}));
vi.mock('../scopedStorage', () => ({
  scopedStorage: {
    getItem: async (k: string) => storage.get(k) ?? null,
    setItem: async (k: string, v: string) => {
      storage.set(k, v);
      storageWrites.push({ key: k, value: v });
    },
    removeItem: async (k: string) => {
      storage.delete(k);
    },
  },
}));
vi.mock('../userScope', () => ({
  subscribeUserScope: () => () => {},
}));

import {
  refreshCalendarMoments,
  getCalendarMoments,
  markCalendarMomentPrepared,
} from '../calendarMoments';
import { planMomentNotifications, DEFAULT_MOMENT_NOTIFY_PREFS } from '../momentNotifications';
import type { Moment } from '../../types/moments';

// Local noon anchor keeps every fire time clear of the quiet window.
const DAY = new Date(Date.UTC(2026, 5, 23, 12, 0, 0));
DAY.setHours(12, 0, 0, 0);
const T0 = DAY.getTime();
const iso = (ms: number) => new Date(ms).toISOString();

const manualMoment: Moment = {
  id: 'manual-1',
  source: 'manual',
  title: 'Manual training block',
  type: 'training',
  importance: 'high',
  startAtIso: iso(T0 + 5 * 3600 * 1000),
} as Moment;

function mergedMoments(): Moment[] {
  return [manualMoment, ...getCalendarMoments()];
}

describe('§18 — calendar consent lifecycle (grant → revoke → reconnect)', () => {
  it('1. connected + granted: eligible calendar context informs Moments under existing rules', async () => {
    bridgeState.events = [
      // Untitled timed event — the classifier GUARANTEES a masked neutral
      // moment for this shape, keeping the scenario keyword-independent.
      { id: 'e1', title: '', startAtIso: iso(T0 + 4 * 3600 * 1000) },
      // All-day event — the classifier GUARANTEES a skip.
      { id: 'e2', title: 'Board offsite', startAtIso: iso(T0 + 6 * 3600 * 1000), allDay: true },
    ];
    await refreshCalendarMoments(true);
    const derived = getCalendarMoments();
    expect(derived).toHaveLength(1);
    expect(derived[0]?.id).toBe('cal-e1');
    expect(derived[0]?.source).toBe('calendar');
    expect(derived[0]?.masked).toBe(true);

    const plan = planMomentNotifications(mergedMoments(), DEFAULT_MOMENT_NOTIFY_PREFS, iso(T0));
    expect(plan.some((p) => p.momentId === 'cal-e1')).toBe(true);
  });

  it('2+3. revocation stops calendar use and no calendar-derived intervention can fire', async () => {
    bridgeState.permission = 'denied';
    await refreshCalendarMoments(true);
    expect(getCalendarMoments()).toEqual([]);

    const plan = planMomentNotifications(mergedMoments(), DEFAULT_MOMENT_NOTIFY_PREFS, iso(T0));
    expect(plan.some((p) => p.momentId.startsWith('cal-'))).toBe(false);
  });

  it('4. retention follows the EXISTING policy — no event data was ever persisted', () => {
    // Appendix-A minimization: the only persisted artifact may be the
    // prepared-marks map (event id → ISO). Event titles, times, or bodies
    // must never have touched storage.
    for (const w of storageWrites) {
      expect(w.value).not.toContain('Board offsite');
      expect(w.value).not.toContain('startAtIso');
    }
  });

  it('5. unrelated Moments are unaffected — the manual moment still plans normally', () => {
    const plan = planMomentNotifications(mergedMoments(), DEFAULT_MOMENT_NOTIFY_PREFS, iso(T0));
    expect(plan.some((p) => p.momentId === 'manual-1')).toBe(true);
  });

  it('6. reconnect resumes normal function without duplication, and prepared state survives', async () => {
    // Mark prepared while disconnected state settles (mark is content-free).
    await markCalendarMomentPrepared('e1');

    bridgeState.permission = 'granted';
    await refreshCalendarMoments(true);
    const derived = getCalendarMoments();
    // Exactly one instance of the same id — no duplicate accumulation.
    expect(derived.filter((m) => m.id === 'cal-e1')).toHaveLength(1);
    // The member's own prepared-mark reapplied by event id…
    expect(derived[0]?.preparedAtIso).toBeTruthy();
    // …so the reconnected moment plans NO ping (prepared = silence, tranche 3).
    const plan = planMomentNotifications(mergedMoments(), DEFAULT_MOMENT_NOTIFY_PREFS, iso(T0));
    expect(plan.some((p) => p.momentId === 'cal-e1')).toBe(false);
    expect(plan.some((p) => p.momentId === 'manual-1')).toBe(true);
  });
});
