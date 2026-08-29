/**
 * demoMoments — deterministic sample Moments for demo/capture sessions and
 * the gallery fixtures (Phase 1 "manual demo data", founder approval
 * 2026-08-12). Mirrors the founder comp: Training (done), Investor Meeting
 * (active prep), Dinner with Family, Flight.
 *
 * Times are built relative to a base date so the comp's active-prep state
 * ("Investor Meeting in 22 min") reproduces at any capture time. Consumed
 * ONLY by demo seeding (services/demoMode gate) and galleryFixtures — never
 * imported by production logic.
 */
import type { Moment } from '@/types/moments';

/** Build the comp's day around `nowIso` (meeting starts in 22 minutes). */
export function buildDemoMoments(nowIso: string): Moment[] {
  const now = Date.parse(nowIso);
  const MIN = 60_000;
  const at = (deltaMin: number) => new Date(now + deltaMin * MIN).toISOString();
  const created = at(-12 * 60);
  return [
    {
      id: 'demo-training',
      source: 'demo',
      title: 'Training',
      type: 'training',
      importance: 'high',
      startAtIso: at(-6 * 60), // this morning — completed
      preparedAtIso: at(-7 * 60),
      createdAtIso: created,
    },
    {
      id: 'demo-investor-meeting',
      source: 'demo',
      title: 'Investor Meeting',
      type: 'work',
      importance: 'high',
      startAtIso: at(22), // the comp's "starts in 22 min"
      createdAtIso: created,
    },
    {
      id: 'demo-evening-run',
      source: 'demo',
      title: 'Evening Run',
      type: 'training',
      importance: 'high',
      startAtIso: at(76), // prep window (75 min before) opens 1 min after seed
      createdAtIso: created,
    },
    {
      id: 'demo-dinner',
      source: 'demo',
      title: 'Dinner with Family',
      type: 'personal',
      importance: 'moderate',
      startAtIso: at(4 * 60 + 30),
      createdAtIso: created,
    },
    {
      id: 'demo-flight',
      source: 'demo',
      title: 'Flight',
      type: 'travel',
      importance: 'moderate',
      startAtIso: at(7 * 60 + 15),
      createdAtIso: created,
    },
  ];
}

/**
 * buildDemoCalendarMoments — the SYNTHETIC calendar-derived preview day
 * (founder-authorized visual demo, 2026-08-29; production calendar data
 * remains legally gated OFF — this set exists so DEMO/CAPTURE builds can
 * show the finished Calendar/Moments experience before activation).
 *
 * Provenance is explicit and machine-checkable: every id is prefixed
 * `demo-cal-`, every calendarEventId `demo-cal-evt-`, and every title is
 * invented (no real events, contacts, or member meeting titles). The set
 * is consumed ONLY by the DEMO/CAPTURE in-memory merge in useMomentsData
 * — the same never-persisted lane real calendar moments use — so these
 * fixtures cannot enter canonical production history
 * (components/moments/__tests__/demoCalendarPreview.test.ts).
 *
 * States covered, per the preview spec: completed (AFTER → LEARN), active
 * prep (action warranted), upcoming (prep window later), masked PRIVATE
 * EVENT, and a low-importance nothing-needed evening.
 */
export function buildDemoCalendarMoments(anchorIso: string): Moment[] {
  const now = Date.parse(anchorIso);
  const MIN = 60_000;
  const at = (deltaMin: number) => new Date(now + deltaMin * MIN).toISOString();
  const created = at(-12 * 60);
  const cal = (
    n: number,
    m: Omit<Moment, 'id' | 'source' | 'calendarEventId' | 'createdAtIso'>,
  ): Moment => ({
    id: `demo-cal-${n}`,
    source: 'calendar',
    calendarEventId: `demo-cal-evt-${n}`,
    createdAtIso: created,
    ...m,
  });
  return [
    cal(1, {
      title: 'Workout',
      type: 'training',
      importance: 'high',
      startAtIso: at(-4 * 60), // this morning — completed, prepared beforehand
      preparedAtIso: at(-4 * 60 - 50),
    }),
    cal(2, {
      title: 'Investor Call',
      type: 'work',
      importance: 'high',
      startAtIso: at(25), // active prep — action warranted now
    }),
    cal(3, {
      title: 'Board Meeting',
      type: 'work',
      importance: 'high',
      startAtIso: at(2 * 60 + 30), // upcoming — prep window later
    }),
    cal(4, {
      title: 'Private event', // masked upstream — renders PRIVATE EVENT
      type: 'personal',
      importance: 'moderate',
      masked: true,
      startAtIso: at(5 * 60),
    }),
    cal(5, {
      title: 'Dinner',
      type: 'personal',
      importance: 'low', // nothing needed — quiet row
      startAtIso: at(6 * 60 + 30),
    }),
  ];
}
