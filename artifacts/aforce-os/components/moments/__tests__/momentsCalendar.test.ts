/**
 * Moments calendar (the prototype's Calendar page): the member's own Moments
 * by day. It must never touch the phone's calendar — that stays on the
 * flag-gated Connect screen until Legal and Privacy sign (DR-011).
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Moment } from '@/types/moments';
import {
  MOMENTS_CALENDAR_DAYS,
  calendarDayKey,
  calendarMonth,
  calendarRows,
  calendarStrip,
} from '@/components/moments/cinematic/momentsCalendarLogic';

const ROOT = join(__dirname, '..', '..', '..');
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8');
const code = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

const NOW = new Date(2026, 10, 18, 9, 0);
const at = (d: number, h: number) => new Date(2026, 10, d, h, 0).toISOString();
const moment = (id: string, title: string, startAtIso: string, extra: Partial<Moment> = {}): Moment =>
  ({ id, title, startAtIso, ...extra }) as Moment;

describe('calendar strip', () => {
  it('is the next fourteen days starting today', () => {
    const strip = calendarStrip([], NOW);
    expect(strip).toHaveLength(MOMENTS_CALENDAR_DAYS);
    expect(strip[0]).toMatchObject({ key: '2026-11-18', weekday: 'We', dayOfMonth: 18, hasMoment: false });
    expect(strip[13].key).toBe('2026-12-01');
  });

  it('marks only the days that have a Moment, and says so to screen readers', () => {
    const strip = calendarStrip([moment('a', 'Dinner', at(20, 19))], NOW);
    expect(strip.filter((d) => d.hasMoment).map((d) => d.key)).toEqual(['2026-11-20']);
    expect(strip[2].label).toBe('November 20, has a Moment');
    expect(strip[0].label).toBe('November 18');
  });

  it('ignores a Moment with an unreadable time', () => {
    expect(calendarStrip([moment('x', 'Bad', 'not a date')], NOW).some((d) => d.hasMoment)).toBe(false);
    expect(calendarRows([moment('x', 'Bad', 'not a date')], '2026-11-18', 'Private')).toEqual([]);
  });
});

describe('calendar rows', () => {
  const list = [
    moment('c', 'Flight', at(24, 9)),
    moment('a', 'Lift', at(18, 6)),
    moment('b', 'Dinner', at(20, 19), { masked: true }),
  ];

  it('lists Moments from the chosen day on, soonest first', () => {
    expect(calendarRows(list, '2026-11-18', 'Private event').map((r) => r.id)).toEqual(['a', 'b', 'c']);
    expect(calendarRows(list, '2026-11-20', 'Private event').map((r) => r.id)).toEqual(['b', 'c']);
  });

  it('never shows the title of a private event', () => {
    const row = calendarRows(list, '2026-11-20', 'Private event')[0];
    expect(row.title).toBe('Private event');
    expect(row.eyebrow).toBe('Fri 20');
  });

  it('says plainly when a Moment is not prepared', () => {
    expect(calendarRows(list, '2026-11-24', 'Private event')[0].sub).toMatch(/· not prepared$/);
  });

  it('names the month of the chosen day', () => {
    expect(calendarMonth('2026-12-01')).toBe('December');
    expect(calendarDayKey(new Date(2026, 0, 5))).toBe('2026-01-05');
  });
});

describe('the calendar page reads only AFORCE Moments', () => {
  const screen = read('components/moments/cinematic/MomentsCalendarScreen.tsx');
  const logic = read('components/moments/cinematic/momentsCalendarLogic.ts');

  it('does not import the phone-calendar bridge or expo-calendar', () => {
    for (const src of [screen, logic]) {
      expect(code(src)).not.toMatch(/calendarBridge|calendarMoments|expo-calendar|requestCalendarPermission/);
    }
  });

  it('tells the member these are AFORCE Moments, not their calendar app', () => {
    expect(screen).toContain('Your AFORCE Moments · not your calendar app');
  });

  it('offers the phone-calendar connection only when its legal-gated flag is on', () => {
    expect(code(screen)).toMatch(/\{flags\.moments_calendar_enabled \? \(\s*<Pressable\s*onPress=\{\(\) => router\.push\('\/calendar-settings'\)\}/);
    expect(code(screen).match(/calendar-settings/g)).toHaveLength(1);
  });

  it('the Connect route still redirects away when that flag is off', () => {
    expect(read('app/calendar-settings.tsx')).toContain(
      "if (!flags.moments_enabled || !flags.moments_calendar_enabled) return <Redirect href=\"/\" />;",
    );
  });

  it('the flag stays off by default and out of the internal build', () => {
    const flags = read('featureFlags/flags.ts');
    const defaults = flags.slice(flags.indexOf('DEFAULT_FLAGS'), flags.indexOf('moments_calendar_enabled: true'));
    expect(defaults).toContain('moments_calendar_enabled: false,');
    expect(flags).toContain("LEGAL_GATED_FLAGS = ['moments_calendar_enabled']");
    expect(code(read('featureFlags/internalTestflightOverlay.ts'))).not.toContain('moments_calendar_enabled');
  });

  it('the Moments tab always links to this page', () => {
    const tab = read('components/editorial/moments/EditorialMomentsScreen.tsx');
    expect(tab).toContain("{ title: 'Calendar', sub: 'All Moments', onPress: () => router.push('/moments-calendar' as never), testID: 'moments-link-calendar' },");
  });
});
