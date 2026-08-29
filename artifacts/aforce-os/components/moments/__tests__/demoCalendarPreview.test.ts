/**
 * DEMO CALENDAR PREVIEW — isolation lock (founder-authorized visual demo,
 * 2026-08-29).
 *
 * The authorization's hard boundary: production calendar data remains
 * legally gated OFF; demo builds may preview the finished experience with
 * EXPLICITLY SYNTHETIC fixtures through the existing DEMO/CAPTURE
 * mechanisms only. This lock makes each guarantee mechanical:
 *
 *  1. provenance — every fixture is machine-marked synthetic;
 *  2. no persistence — the fixtures ride the in-memory calendar merge
 *     (the same never-persisted lane real calendar moments use) and can
 *     never enter canonical production history;
 *  3. no bridge — the demo lane never touches permission/EventKit;
 *  4. the Legal gate is untouched — production default stays OFF (also
 *     pinned, with Appendix-A wording, by momentsLaunchFlip).
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { buildDemoCalendarMoments } from '../../../data/demoMoments';
import { DEFAULT_FLAGS } from '../../../featureFlags/flags';

const AOS = join(__dirname, '..', '..', '..');
const HOOK_SRC = readFileSync(join(AOS, 'components', 'moments', 'useMomentsData.ts'), 'utf8');
const CONNECT_SRC = readFileSync(
  join(AOS, 'components', 'moments', 'ConnectCalendarScreen.tsx'),
  'utf8',
);
const STORE_SRC = readFileSync(join(AOS, 'services', 'momentsStore.ts'), 'utf8');

describe('fixtures — explicitly synthetic, deterministic, state-complete', () => {
  const ANCHOR = '2026-08-12T17:38:00.000Z';
  const set = buildDemoCalendarMoments(ANCHOR);

  it('every fixture is machine-marked synthetic calendar data', () => {
    expect(set.length).toBeGreaterThanOrEqual(5);
    for (const m of set) {
      expect(m.id, m.title).toMatch(/^demo-cal-/);
      expect(m.source).toBe('calendar');
      expect(m.calendarEventId).toMatch(/^demo-cal-evt-/);
    }
  });

  it('covers the required preview states', () => {
    expect(set.some((m) => m.preparedAtIso), 'a completed/prepared moment').toBe(true);
    expect(set.some((m) => m.masked), 'a masked PRIVATE EVENT').toBe(true);
    expect(set.some((m) => m.importance === 'low'), 'a nothing-needed moment').toBe(true);
    const now = Date.parse(ANCHOR);
    expect(set.some((m) => Date.parse(m.startAtIso) < now), 'a past moment (AFTER → LEARN)').toBe(true);
    expect(
      set.some((m) => {
        const delta = Date.parse(m.startAtIso) - now;
        return delta > 0 && delta <= 60 * 60_000;
      }),
      'an active-prep moment (action warranted)',
    ).toBe(true);
  });

  it('is deterministic for capture (same anchor → same set)', () => {
    expect(buildDemoCalendarMoments(ANCHOR)).toEqual(set);
  });
});

describe('no persistence — the fixtures cannot enter canonical history', () => {
  it('the hook merges them in-memory only, gated on DEMO/CAPTURE', () => {
    expect(HOOK_SRC).toMatch(
      /DEMO_MODE \|\| CAPTURE_MODE \? buildDemoCalendarMoments\(new Date\(\)\.toISOString\(\)\) : \[\]/,
    );
    expect(HOOK_SRC).toMatch(
      /const mergedCalendar = DEMO_MODE \|\| CAPTURE_MODE \? demoCalendarMoments : calendarDerived;/,
    );
    // The store-write path must never see the synthetic set.
    const addMomentCalls = HOOK_SRC.match(/addMoment\(([^)]*)\)/g) ?? [];
    for (const call of addMomentCalls) {
      expect(call).not.toMatch(/Calendar/i);
    }
  });

  it('the persisted store has no demo-calendar pathway at all', () => {
    expect(STORE_SRC).not.toMatch(/demoMoments|demo-cal|buildDemoCalendarMoments/);
  });
});

describe('no bridge — the demo lane never reaches permission or EventKit', () => {
  it('the refresh effect skips before any bridge call in DEMO/CAPTURE', () => {
    const skip = HOOK_SRC.indexOf('if (DEMO_MODE || CAPTURE_MODE) return; // synthetic preview — no bridge');
    const refresh = HOOK_SRC.indexOf('void refreshCalendarMoments();');
    expect(skip).toBeGreaterThan(-1);
    expect(refresh).toBeGreaterThan(skip);
  });

  it('ConnectCalendarScreen: every bridge call sits behind the DEMO_PREVIEW guard', () => {
    // Source order: the preview early-returns precede each bridge call.
    const reloadGuard = CONNECT_SRC.indexOf('if (DEMO_PREVIEW) {');
    const firstBridgeRead = CONNECT_SRC.indexOf('getCalendarPermission(), getCalendarPrefs()');
    const connectGuard = CONNECT_SRC.indexOf('if (DEMO_PREVIEW) return; // preview is already');
    const permissionRequest = CONNECT_SRC.indexOf('await requestCalendarPermission();');
    expect(reloadGuard).toBeGreaterThan(-1);
    expect(firstBridgeRead).toBeGreaterThan(reloadGuard);
    expect(connectGuard).toBeGreaterThan(-1);
    expect(permissionRequest).toBeGreaterThan(connectGuard);
  });

  it('the preview posture is labeled on screen', () => {
    expect(CONNECT_SRC).toMatch(/DEMO PREVIEW · SYNTHETIC CALENDARS/);
    expect(CONNECT_SRC).toMatch(/testID="calendar-demo-preview"/);
  });
});

describe('the Legal gate is untouched', () => {
  it('production default stays OFF', () => {
    expect(DEFAULT_FLAGS.moments_calendar_enabled).toBe(false);
  });
});
