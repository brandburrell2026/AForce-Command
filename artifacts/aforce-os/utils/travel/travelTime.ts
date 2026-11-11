/**
 * Travel Intelligence — time-zone math and dayparts (T1, pure engine).
 *
 * Uses the platform's IANA time-zone database through Intl, so daylight
 * saving is handled per instant: New York → London is 5h most of the year but
 * 4h for the weeks when the US and UK change clocks on different dates.
 *
 * Pure: takes the instant as an argument (no Date.now()), no I/O.
 */

import {
  TRAVEL_BIG_SHIFT_HOURS,
  TRAVEL_DAYPART_HOURS,
  TRAVEL_SUNSET_WINDOW_MIN,
} from '../../config/hydroStateModel';
import type { Daypart } from './travelTypes';

const formatterCache = new Map<string, Intl.DateTimeFormat>();

function formatterFor(timeZone: string): Intl.DateTimeFormat | null {
  const cached = formatterCache.get(timeZone);
  if (cached) return cached;
  try {
    const f = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    formatterCache.set(timeZone, f);
    return f;
  } catch {
    return null;
  }
}

/** True when the runtime recognises the IANA zone name. */
export function isValidTimeZone(timeZone: string | null | undefined): timeZone is string {
  if (!timeZone) return false;
  return formatterFor(timeZone) !== null;
}

export interface LocalTimeParts {
  year: number;
  month: number; // 1–12
  day: number;
  hour: number; // 0–23
  minute: number;
  second: number;
}

/** Wall-clock parts of `instantMs` in `timeZone`, or null for an unknown zone. */
export function localTimeParts(instantMs: number, timeZone: string): LocalTimeParts | null {
  const f = formatterFor(timeZone);
  if (!f || !Number.isFinite(instantMs)) return null;
  const parts: Record<string, number> = {};
  for (const p of f.formatToParts(new Date(instantMs))) {
    if (p.type !== 'literal') parts[p.type] = Number(p.value);
  }
  return {
    year: parts.year,
    month: parts.month,
    day: parts.day,
    hour: parts.hour === 24 ? 0 : parts.hour,
    minute: parts.minute,
    second: parts.second,
  };
}

/** UTC offset of `timeZone` at `instantMs`, in minutes (east positive). */
export function utcOffsetMinutes(instantMs: number, timeZone: string): number | null {
  const p = localTimeParts(instantMs, timeZone);
  if (!p) return null;
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  const flooredInstant = Math.floor(instantMs / 1000) * 1000;
  return Math.round((asUtc - flooredInstant) / 60000);
}

/**
 * Destination minus origin, in hours, at `instantMs` (may be fractional:
 * India is +5.5). Positive = destination is ahead. Null if either zone is
 * unknown.
 */
export function timeDifferenceHours(
  originTz: string | null,
  destinationTz: string | null,
  instantMs: number,
): number | null {
  if (!isValidTimeZone(originTz) || !isValidTimeZone(destinationTz)) return null;
  const o = utcOffsetMinutes(instantMs, originTz);
  const d = utcOffsetMinutes(instantMs, destinationTz);
  if (o == null || d == null) return null;
  return (d - o) / 60;
}

/** True when the shift is large enough to count as a big shift. */
export function isBigShift(diffHours: number | null): boolean {
  return diffHours != null && Math.abs(diffHours) >= TRAVEL_BIG_SHIFT_HOURS;
}

export interface SunTimes {
  /** Provider sunrise for the local day, epoch ms. */
  sunriseMs: number;
  /** Provider sunset for the local day, epoch ms. */
  sunsetMs: number;
}

/**
 * Daypart at the destination. With provider sunrise/sunset it uses real
 * light (sunset = within TRAVEL_SUNSET_WINDOW_MIN of sunset); without, it
 * falls back to local-hour bands from config. Null for an unknown zone.
 */
export function daypartAt(
  instantMs: number,
  timeZone: string | null,
  sun?: SunTimes | null,
): Daypart | null {
  if (!isValidTimeZone(timeZone)) return null;
  if (sun && Number.isFinite(sun.sunriseMs) && Number.isFinite(sun.sunsetMs) && sun.sunsetMs > sun.sunriseMs) {
    const windowMs = TRAVEL_SUNSET_WINDOW_MIN * 60000;
    if (Math.abs(instantMs - sun.sunsetMs) <= windowMs) return 'sunset';
    if (instantMs < sun.sunriseMs || instantMs > sun.sunsetMs) return 'night';
    const p = localTimeParts(instantMs, timeZone);
    if (p && p.hour < TRAVEL_DAYPART_HOURS.morning[1]) return 'morning';
    return 'day';
  }
  const p = localTimeParts(instantMs, timeZone);
  if (!p) return null;
  const h = p.hour;
  const inBand = (band: readonly [number, number]) => h >= band[0] && h < band[1];
  if (inBand(TRAVEL_DAYPART_HOURS.morning)) return 'morning';
  if (inBand(TRAVEL_DAYPART_HOURS.day)) return 'day';
  if (inBand(TRAVEL_DAYPART_HOURS.sunset)) return 'sunset';
  return 'night';
}
