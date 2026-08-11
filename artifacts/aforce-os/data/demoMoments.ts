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
