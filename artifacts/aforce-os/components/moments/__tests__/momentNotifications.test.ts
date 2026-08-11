/**
 * momentNotifications planner — unit tests for the DR-010 interruption
 * budget. The contract: quiet hours drop (never shift), ≥60-min gap, daily
 * cap, importance filter by mode, prepared/started/past-due never fire,
 * lead presets respected with window fallback, and copy params carry only
 * behavioral content (title/time/action — no scores or bands).
 */
import { describe, it, expect } from 'vitest';

import type { Moment } from '@/types/moments';
import {
  planMomentNotifications,
  DEFAULT_MOMENT_NOTIFY_PREFS,
} from '@/services/momentNotifications';
import {
  MOMENT_NOTIFY_MAX_PER_DAY,
  MOMENT_PREP_WINDOW_MIN,
} from '@/config/hydroStateModel';

// Local noon anchor: all derived fire times land far from the 22:00–07:00
// quiet window unless a case constructs them there deliberately.
const NOW = new Date(2026, 7, 12, 12, 0, 0).toISOString();

function localMoment(hoursFromNow: number, overrides: Partial<Moment> = {}): Moment {
  const start = new Date(2026, 7, 12, 12, 0, 0);
  start.setMinutes(start.getMinutes() + Math.round(hoursFromNow * 60));
  return {
    id: overrides.id ?? `m-${hoursFromNow}`,
    source: 'manual',
    title: 'Investor Meeting',
    type: 'work',
    importance: 'high',
    startAtIso: start.toISOString(),
    createdAtIso: NOW,
    ...overrides,
  };
}

describe('planMomentNotifications — timing', () => {
  it('fires at the prep-window start by default (work: 60 min before)', () => {
    const m = localMoment(3);
    const [p] = planMomentNotifications([m], DEFAULT_MOMENT_NOTIFY_PREFS, NOW);
    expect(p).toBeDefined();
    const expected = Date.parse(m.startAtIso) - MOMENT_PREP_WINDOW_MIN.work.startBefore * 60_000;
    expect(Date.parse(p!.fireAtIso)).toBe(expected);
    expect(p!.titleParams).toMatchObject({ title: 'Investor Meeting', minutes: 60 });
  });

  it('honors a lead preset; a lead beyond the start falls back to the window', () => {
    const m = localMoment(3);
    const [p] = planMomentNotifications([m], { mode: 'important', leadMin: 90 }, NOW);
    expect(Date.parse(p!.fireAtIso)).toBe(Date.parse(m.startAtIso) - 90 * 60_000);
  });

  it('never fires past-due or after the moment starts', () => {
    // Window start already passed (starts in 30 min < 60-min lead).
    expect(planMomentNotifications([localMoment(0.5)], DEFAULT_MOMENT_NOTIFY_PREFS, NOW)).toEqual([]);
    // Already started.
    expect(planMomentNotifications([localMoment(-1)], DEFAULT_MOMENT_NOTIFY_PREFS, NOW)).toEqual([]);
  });

  it('drops (never shifts) fires that land in quiet hours', () => {
    // Starts 23:30 local → window start 22:30, inside quiet hours.
    const m = localMoment(11.5);
    expect(planMomentNotifications([m], DEFAULT_MOMENT_NOTIFY_PREFS, NOW)).toEqual([]);
  });
});

describe('planMomentNotifications — budget', () => {
  it('enforces the ≥60-min gap and the daily cap', () => {
    // Five high-importance moments 45 min apart → fires 45 min apart → gap
    // guardrail thins them, then the daily cap binds.
    const set = [2, 2.75, 3.5, 4.25, 5].map((h, i) => localMoment(h, { id: `g${i}` }));
    const plan = planMomentNotifications(set, DEFAULT_MOMENT_NOTIFY_PREFS, NOW);
    expect(plan.length).toBeLessThanOrEqual(MOMENT_NOTIFY_MAX_PER_DAY);
    for (let i = 1; i < plan.length; i++) {
      expect(
        Date.parse(plan[i]!.fireAtIso) - Date.parse(plan[i - 1]!.fireAtIso),
      ).toBeGreaterThanOrEqual(60 * 60_000);
    }
  });

  it('important-only mode filters low importance; all mode keeps it', () => {
    const low = localMoment(3, { id: 'low', importance: 'low' });
    expect(planMomentNotifications([low], { mode: 'important', leadMin: null }, NOW)).toEqual([]);
    expect(planMomentNotifications([low], { mode: 'all', leadMin: null }, NOW)).toHaveLength(1);
  });

  it('prepared moments never fire', () => {
    const m = localMoment(3, { preparedAtIso: NOW });
    expect(planMomentNotifications([m], DEFAULT_MOMENT_NOTIFY_PREFS, NOW)).toEqual([]);
  });
});

describe('planMomentNotifications — behavioral copy only', () => {
  it('params carry title/time/action pieces and no score-like fields', () => {
    const [p] = planMomentNotifications([localMoment(3)], DEFAULT_MOMENT_NOTIFY_PREFS, NOW);
    expect(p!.bodyKey).toBe('moments.notify.body_best_before');
    expect(p!.bodyParams['actionKey']).toBe('moments.action.hydrate_exact');
    const allParams = { ...p!.titleParams, ...p!.bodyParams };
    for (const k of Object.keys(allParams)) {
      expect(k).not.toMatch(/score|band|forecast|predict/i);
    }
  });
});
