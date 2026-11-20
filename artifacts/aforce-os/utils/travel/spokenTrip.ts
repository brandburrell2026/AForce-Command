/**
 * "Say your trip" — turns one spoken sentence into trip-form fields (pure).
 *
 * The words come from the phone's own on-device speech-to-text (the same
 * capture One Breath uses). This file only reads the resulting text with
 * fixed patterns. There is no model, no network and no guessing: a part that
 * is not clearly stated is left blank and, where it helps, a note says why.
 * The member reviews every field before anything is saved.
 *
 *   "Delta 123 from JFK to Los Angeles on November 14 at 9:05 AM"
 *     → DL123 · JFK · LAX · 2026-11-14 · 09:05
 *
 * Also read (2026-11-20): a weekday ("Friday", "this Friday"), a 24-hour time
 * ("14:30"), "9 in the morning", an arrival time ("landing at 12:30 PM"), and
 * a way back ("returning December 7 at 5 PM") as a second leg. Still not
 * filled, each with a note: "next Friday", a weekday said on that weekday, a
 * time with no AM or PM, and a three-letter code that is not a real airport.
 */

import airportTimeZones from '@/data/airportTimeZones.json';
import { airportsNamed } from './airportNames';
import { resolveDestination } from './cityRegistry';

const KNOWN_AIRPORT = (code: string) => Object.prototype.hasOwnProperty.call(airportTimeZones, code);

export interface SpokenTripFields {
  flightNumber?: string;
  origin?: string;
  destination?: string;
  /** YYYY-MM-DD */
  date?: string;
  /** HH:mm, 24-hour */
  time?: string;
  /** YYYY-MM-DD at the destination. Only when the member said it; never assumed to be the departure date. */
  arrivalDate?: string;
  /** HH:mm, 24-hour, at the destination. */
  arrivalTime?: string;
}

export interface SpokenTrip {
  fields: SpokenTripFields;
  /** Plain sentences about anything heard but not filled in. */
  notes: string[];
  /**
   * A second leg, when the member said they are coming back ("returning
   * December 7 at 5 PM"). Its airports are the first leg's, swapped, when both
   * are known. Only what was said about the return is filled.
   */
  returnLeg?: SpokenTripFields;
  /** The airline's code when an airline was named with no flight number ("flying Delta"). */
  airline?: string;
}

/** Airlines recognised by name. Anything else needs its two-character code. */
const AIRLINE_NAMES: ReadonlyArray<[RegExp, string]> = [
  [/american(?: airlines)?/, 'AA'],
  [/delta(?: air ?lines)?/, 'DL'],
  [/united(?: airlines)?/, 'UA'],
  [/southwest(?: airlines)?/, 'WN'],
  [/jet ?blue/, 'B6'],
  [/alaska(?: airlines)?/, 'AS'],
  [/spirit(?: airlines)?/, 'NK'],
  [/frontier(?: airlines)?/, 'F9'],
  [/hawaiian(?: airlines)?/, 'HA'],
  [/british airways/, 'BA'],
  [/air canada/, 'AC'],
  [/air france/, 'AF'],
  [/lufthansa/, 'LH'],
  [/emirates/, 'EK'],
  [/qatar(?: airways)?/, 'QR'],
  [/virgin atlantic/, 'VS'],
];

/** Two-character codes accepted when spoken as a code ("AA 123"). */
const AIRLINE_CODES = new Set([
  'AA', 'DL', 'UA', 'WN', 'B6', 'AS', 'NK', 'F9', 'HA', 'G4', 'SY',
  'BA', 'AC', 'AF', 'KL', 'LH', 'EK', 'QR', 'EY', 'TK', 'VS', 'IB', 'AZ',
  'QF', 'SQ', 'JL', 'NH', 'CX',
]);

const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
const MONTH_RE = '(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)';

const pad = (n: number) => String(n).padStart(2, '0');
const ymd = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`;
const realDate = (y: number, m: number, d: number) => {
  const t = new Date(y, m - 1, d);
  return t.getFullYear() === y && t.getMonth() === m - 1 && t.getDate() === d;
};

function flightNumber(text: string): string | undefined {
  for (const [name, code] of AIRLINE_NAMES) {
    const m = new RegExp(`\\b${name.source}\\s+(?:flight\\s+)?(?:number\\s+)?(\\d{1,4})\\b`).exec(text);
    if (m) return `${code}${m[1]}`;
  }
  // A spoken code: "aa 123", "b6 45", "flight ua 2210".
  for (const m of text.matchAll(/\b([a-z][a-z0-9]|[0-9][a-z])\s?(\d{1,4})\b/g)) {
    const code = m[1]!.toUpperCase();
    if (AIRLINE_CODES.has(code)) return `${code}${m[2]}`;
  }
  return undefined;
}

/** A spoken place → an airport code, or a note saying why not. */
function airport(raw: string, role: 'Departure' | 'Arrival'): { code?: string; note?: string } {
  const said = raw.trim().replace(/\s+airport$/, '');
  if (!said) return {};
  const letters = said.replace(/[\s.]/g, '');
  // "jfk" or "j f k": three letters is an airport code as given.
  if (/^[a-z]{3}$/.test(letters) && (letters === said || /^([a-z][\s.]+){2}[a-z]\.?$/.test(said))) {
    const code = letters.toUpperCase();
    // A code is taken as said only when it is a real airport; a mis-heard one is not passed on.
    return KNOWN_AIRPORT(code) ? { code } : { note: `${role}: “${code}” isn’t an airport code AFORCE knows. Check it and type it.` };
  }
  const found = resolveDestination(said);
  if (found?.kind === 'featured') {
    const { airports, name } = found.city;
    if (airports.length === 1) return { code: airports[0] };
    return { note: `${role}: ${name} has ${airports.join(', ')}. Type the one you mean.` };
  }
  // A well-known airport or city by name: one airport fills, several are offered, never picked.
  const named = airportsNamed(said);
  if (named) {
    if (named.codes.length === 1) return { code: named.codes[0] };
    return { note: `${role}: ${named.name} has ${named.codes.join(', ')}. Type the one you mean.` };
  }
  return { note: `${role}: “${said}” isn’t an airport AFORCE knows by name. Type its three-letter code.` };
}

function date(text: string, now: Date): string | undefined {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (/\btomorrow\b/.test(text)) {
    const t = new Date(today); t.setDate(t.getDate() + 1);
    return ymd(t.getFullYear(), t.getMonth() + 1, t.getDate());
  }
  if (/\btoday\b|\btonight\b/.test(text)) return ymd(today.getFullYear(), today.getMonth() + 1, today.getDate());
  const a = new RegExp(`\\b${MONTH_RE}\\s+(\\d{1,2})(?:st|nd|rd|th)?(?:,?\\s+(\\d{4}))?\\b`).exec(text);
  const b = a ? null : new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(?:of\\s+)?${MONTH_RE}(?:,?\\s+(\\d{4}))?\\b`).exec(text);
  const monthWord = a ? a[1]! : b ? b[2]! : null;
  const dayText = a ? a[2]! : b ? b[1]! : null;
  const yearText = a ? a[3] : b ? b[3] : undefined;
  if (!monthWord || !dayText) return weekday(text, today).date;
  const month = MONTHS.findIndex((m) => m.startsWith(monthWord.slice(0, 3))) + 1;
  const day = Number(dayText);
  if (yearText) return realDate(Number(yearText), month, day) ? ymd(Number(yearText), month, day) : undefined;
  // No year said: the next time that date comes round, today included.
  for (const y of [today.getFullYear(), today.getFullYear() + 1]) {
    if (realDate(y, month, day) && new Date(y, month - 1, day) >= today) return ymd(y, month, day);
  }
  return undefined;
}

const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const WEEKDAY_RE = '(sunday|monday|tuesday|wednesday|thursday|friday|saturday)';

/**
 * "Friday" or "this Friday" is the coming one. Two cases are not filled,
 * because people mean different dates by them: "next Friday", and a weekday
 * said on that same weekday.
 */
function weekday(text: string, today: Date): { date?: string; note?: string } {
  const m = new RegExp(`\\b(?:(this|next)\\s+)?${WEEKDAY_RE}\\b`).exec(text);
  if (!m) return {};
  const name = m[2]!;
  const said = name.charAt(0).toUpperCase() + name.slice(1);
  if (m[1] === 'next') return { note: `Date: “next ${said}” can mean two different dates. Say the date, like “November 27”.` };
  const offset = (WEEKDAYS.indexOf(name) - today.getDay() + 7) % 7;
  if (offset === 0) return { note: `Date: today is ${said}. Say “today”, or the date you mean.` };
  const t = new Date(today); t.setDate(t.getDate() + offset);
  return { date: ymd(t.getFullYear(), t.getMonth() + 1, t.getDate()) };
}

function time(text: string): string | undefined {
  if (/\bnoon\b/.test(text)) return '12:00';
  if (/\bmidnight\b/.test(text)) return '00:00';
  const m =
    /\b(\d{1,2})[:.](\d{2})\s*([ap])\.?\s?m\b/.exec(text) ??
    /\b(\d{1,2})(\d{2})\s*([ap])\.?\s?m\b/.exec(text) ??
    /\b(\d{1,2})()\s*([ap])\.?\s?m\b/.exec(text);
  if (!m) {
    // "9 in the morning", "7:30 in the evening".
    const part = /\b(\d{1,2})(?:[:.](\d{2}))?\s+(?:o'?clock\s+)?(?:in the (morning|afternoon|evening)|at (night))\b/.exec(text);
    if (part) {
      const hour = Number(part[1]);
      const minute = part[2] ? Number(part[2]) : 0;
      if (hour < 1 || hour > 12 || minute > 59) return undefined;
      const pm = (part[3] ?? part[4]) !== 'morning';
      return `${pad((hour % 12) + (pm ? 12 : 0))}:${pad(minute)}`;
    }
    // A 24-hour time is unambiguous only from 13:00 on, at 00:xx, or written with a leading zero.
    const clock = /\b([01]\d|2[0-3]):([0-5]\d)\b(?!\s*[ap]\.?\s?m)/.exec(text) ?? /\b(1[3-9]|2[0-3])[:.]([0-5]\d)\b/.exec(text);
    if (clock && (Number(clock[1]) >= 13 || clock[1]!.startsWith('0'))) return `${clock[1]}:${clock[2]}`;
    return undefined;
  }
  const h = Number(m[1]);
  const min = m[2] ? Number(m[2]) : 0;
  if (h < 1 || h > 12 || min > 59) return undefined;
  const hour24 = (h % 12) + (m[3] === 'p' ? 12 : 0);
  return `${pad(hour24)}:${pad(min)}`;
}

/** Where a spoken place ends: at the date, the time, or the end of the sentence. */
const PLACE_END = `(?=\\s+(?:on|at|tomorrow|today|tonight|this|next|leaving|departing|arriving|arrives|landing|lands|returning|${WEEKDAY_RE}|${MONTH_RE})\\b|\\s+\\d|$)`;

const ARRIVAL_MARK = /\b(?:arriving|arrives|arrive|landing|lands|land|getting in)\b/;
const RETURN_MARK = /\b(?:returning|coming back|flying back|heading back|and back)\b/;

/** A clock time said with no AM or PM and no part of day: not filled, and the member is told why. */
function bareTimeNote(text: string, label: string): string | undefined {
  const m = /\bat\s+(\d{1,2})(?:[:.](\d{2}))?\b(?!\s*(?:[ap]\.?\s?m|in the|at night|o'?clock))/.exec(text);
  if (!m) return undefined;
  const hour = Number(m[1]);
  if (hour < 1 || hour > 12) return undefined;
  return `${label}: “${m[1]}${m[2] ? `:${m[2]}` : ''}” could be morning or evening. Say AM or PM.`;
}

export function parseSpokenTrip(spoken: string, now: Date): SpokenTrip {
  const text = spoken.toLowerCase().replace(/[,!?;]/g, ' ').replace(/\.(?=\s|$)/g, ' ').replace(/\s+/g, ' ').trim();
  const fields: SpokenTripFields = {};
  const notes: string[] = [];
  if (!text) return { fields, notes };

  // The sentence in parts: the way out, what was said about arriving, and the way back.
  const returnAt = RETURN_MARK.exec(text);
  const outbound = returnAt ? text.slice(0, returnAt.index).trim() : text;
  const back = returnAt ? text.slice(returnAt.index + returnAt[0].length).trim() : '';
  const arrivalAt = ARRIVAL_MARK.exec(outbound);
  const leaving = arrivalAt ? outbound.slice(0, arrivalAt.index).trim() : outbound;
  const arriving = arrivalAt ? outbound.slice(arrivalAt.index + arrivalAt[0].length).trim() : '';
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const flight = flightNumber(outbound);
  if (flight) fields.flightNumber = flight;

  const route = new RegExp(`\\bfrom\\s+(.+?)\\s+to\\s+(.+?)${PLACE_END}`).exec(outbound);
  const toOnly = route ? null : new RegExp(`\\b(?:flying|going|headed|heading|trip)\\s+to\\s+(.+?)${PLACE_END}`).exec(outbound);
  if (route) {
    const from = airport(route[1]!, 'Departure');
    const to = airport(route[2]!, 'Arrival');
    if (from.code) fields.origin = from.code;
    if (to.code) fields.destination = to.code;
    for (const n of [from.note, to.note]) if (n) notes.push(n);
  } else if (toOnly) {
    const to = airport(toOnly[1]!, 'Arrival');
    if (to.code) fields.destination = to.code;
    if (to.note) notes.push(to.note);
  }

  const d = date(leaving, now);
  if (d) fields.date = d;
  else {
    const why = weekday(leaving, today).note;
    if (why) notes.push(why);
  }
  const t = time(leaving);
  if (t) fields.time = t;
  else {
    const why = bareTimeNote(leaving, 'Departure time');
    if (why) notes.push(why);
  }

  if (arriving) {
    const at = time(arriving);
    if (at) fields.arrivalTime = at;
    else {
      const why = bareTimeNote(`at ${arriving.replace(/^at\s+/, '')}`, 'Arrival time');
      if (why) notes.push(why);
    }
    // The arrival date is filled only when it was said; an overnight flight lands on another day.
    const on = date(arriving, now);
    if (on) fields.arrivalDate = on;
  }

  const result: SpokenTrip = { fields, notes };

  if (!flight) {
    const named = AIRLINE_NAMES.find(([name]) => new RegExp(`\\b${name.source}\\b`).test(outbound));
    if (named) result.airline = named[1];
  }

  if (returnAt) {
    const leg: SpokenTripFields = {};
    const returnFlight = flightNumber(back);
    if (returnFlight) leg.flightNumber = returnFlight;
    // The way back swaps the airports, and only when both ends are known.
    if (fields.origin && fields.destination) {
      leg.origin = fields.destination;
      leg.destination = fields.origin;
    }
    const backDate = date(back, now);
    if (backDate) leg.date = backDate;
    else {
      const why = weekday(back, today).note;
      if (why) notes.push(why.replace(/^Date:/, 'Return date:'));
    }
    const backTime = time(back);
    if (backTime) leg.time = backTime;
    else {
      const why = bareTimeNote(back, 'Return time');
      if (why) notes.push(why);
    }
    result.returnLeg = leg;
  }

  return result;
}

/**
 * The trip as today's itinerary form can take it. The form will not save an
 * arrival time without an arrival date, and the date is never assumed, so an
 * arrival time heard on its own is held back with a note instead of filling a
 * field that would then block Confirm.
 */
export function tripForForm(trip: SpokenTrip): SpokenTrip {
  const { arrivalTime, ...rest } = trip.fields;
  if (!arrivalTime || trip.fields.arrivalDate) return trip;
  return { ...trip, fields: rest, notes: [...trip.notes, `Arrival time: heard ${arrivalTime}. Add the arrival date to use it.`] };
}

const LABEL: Record<keyof SpokenTripFields, string> = {
  flightNumber: 'flight number',
  origin: 'departure airport',
  destination: 'arrival airport',
  date: 'departure date',
  time: 'departure time',
  arrivalDate: 'arrival date',
  arrivalTime: 'arrival time',
};

/** "Filled in: flight number, departure airport." — or that nothing was. */
export function spokenTripSummary(trip: SpokenTrip): string {
  const filled = (Object.keys(LABEL) as Array<keyof SpokenTripFields>).filter((k) => trip.fields[k]);
  return filled.length
    ? `Filled in: ${filled.map((k) => LABEL[k]).join(', ')}. Check each one before saving.`
    : 'Nothing was filled in. Try the example, or type the details.';
}

export const SAY_YOUR_TRIP_EXAMPLE = '“Delta 123 from JFK to Los Angeles on November 14 at 9:05 AM”';
