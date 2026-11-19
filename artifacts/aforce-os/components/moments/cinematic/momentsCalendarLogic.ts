/**
 * Moments calendar — the words and days on the screen, as pure functions.
 *
 * Reference: the approved prototype's Calendar page (Moments → Calendar): a
 * strip of the next fourteen days, a dot under each day that has a Moment,
 * and the Moments from the chosen day onward. These are the member's own
 * AFORCE Moments. Nothing here reads the phone's calendar.
 */
import type { Moment } from '@/types/moments';
import { homeClock, isMomentSealed } from '@/components/home/cinematic/homeCinematicLogic';
import { isMomentDone } from './momentsCinematicLogic';

export const MOMENTS_CALENDAR_DAYS = 14;

const WEEKDAY_TWO = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_LONG = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/** Local calendar day, "2026-11-18". */
export function calendarDayKey(d: Date): string {
  const m = `${d.getMonth() + 1}`.padStart(2, '0');
  const day = `${d.getDate()}`.padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

export interface CalendarDayModel {
  key: string;
  weekday: string;
  dayOfMonth: number;
  hasMoment: boolean;
  /** "November 18" or "November 18, has a Moment" for screen readers. */
  label: string;
}

export interface CalendarRowModel {
  id: string;
  eyebrow: string;
  title: string;
  sub: string;
}

function momentKey(m: Pick<Moment, 'startAtIso'>): string | null {
  const d = new Date(m.startAtIso);
  return Number.isNaN(d.getTime()) ? null : calendarDayKey(d);
}

/** The next fourteen days starting today, each marked if a Moment falls on it. */
export function calendarStrip(moments: readonly Moment[], now: Date): CalendarDayModel[] {
  const withMoment = new Set(moments.map(momentKey).filter((k): k is string => k !== null));
  return Array.from({ length: MOMENTS_CALENDAR_DAYS }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
    const key = calendarDayKey(d);
    const hasMoment = withMoment.has(key);
    const base = `${MONTH_LONG[d.getMonth()]} ${d.getDate()}`;
    return {
      key,
      weekday: WEEKDAY_TWO[d.getDay()],
      dayOfMonth: d.getDate(),
      hasMoment,
      label: hasMoment ? `${base}, has a Moment` : base,
    };
  });
}

/** Month heading for the chosen day. */
export function calendarMonth(dayKey: string): string {
  const month = Number(dayKey.slice(5, 7));
  return MONTH_LONG[month - 1] ?? '';
}

/** Moments on the chosen day or later, soonest first. */
export function calendarRows(
  moments: readonly Moment[],
  fromDayKey: string,
  privateLabel: string,
): CalendarRowModel[] {
  return [...moments]
    .filter((m) => {
      const key = momentKey(m);
      return key !== null && key >= fromDayKey;
    })
    .sort((a, b) => Date.parse(a.startAtIso) - Date.parse(b.startAtIso))
    .map((m) => {
      const start = new Date(m.startAtIso);
      const state = m.preparation?.cancelledAtIso
        ? 'cancelled'
        : isMomentDone(m)
          ? 'done'
          : isMomentSealed(m)
            ? 'sealed'
            : 'not prepared';
      return {
        id: m.id,
        eyebrow: `${WEEKDAY_SHORT[start.getDay()]} ${start.getDate()}`,
        title: m.masked ? privateLabel : m.title,
        sub: `${homeClock(start)} · ${state}`,
      };
    });
}
