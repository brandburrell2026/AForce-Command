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
 */

import { resolveDestination } from './cityRegistry';

export interface SpokenTripFields {
  flightNumber?: string;
  origin?: string;
  destination?: string;
  /** YYYY-MM-DD */
  date?: string;
  /** HH:mm, 24-hour */
  time?: string;
}

export interface SpokenTrip {
  fields: SpokenTripFields;
  /** Plain sentences about anything heard but not filled in. */
  notes: string[];
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
    return { code: letters.toUpperCase() };
  }
  const found = resolveDestination(said);
  if (found?.kind === 'featured') {
    const { airports, name } = found.city;
    if (airports.length === 1) return { code: airports[0] };
    return { note: `${role}: ${name} has ${airports.join(', ')}. Type the one you mean.` };
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
  if (!monthWord || !dayText) return undefined;
  const month = MONTHS.findIndex((m) => m.startsWith(monthWord.slice(0, 3))) + 1;
  const day = Number(dayText);
  if (yearText) return realDate(Number(yearText), month, day) ? ymd(Number(yearText), month, day) : undefined;
  // No year said: the next time that date comes round, today included.
  for (const y of [today.getFullYear(), today.getFullYear() + 1]) {
    if (realDate(y, month, day) && new Date(y, month - 1, day) >= today) return ymd(y, month, day);
  }
  return undefined;
}

function time(text: string): string | undefined {
  if (/\bnoon\b/.test(text)) return '12:00';
  if (/\bmidnight\b/.test(text)) return '00:00';
  const m =
    /\b(\d{1,2})[:.](\d{2})\s*([ap])\.?\s?m\b/.exec(text) ??
    /\b(\d{1,2})(\d{2})\s*([ap])\.?\s?m\b/.exec(text) ??
    /\b(\d{1,2})()\s*([ap])\.?\s?m\b/.exec(text);
  if (!m) return undefined;
  const h = Number(m[1]);
  const min = m[2] ? Number(m[2]) : 0;
  if (h < 1 || h > 12 || min > 59) return undefined;
  const hour24 = (h % 12) + (m[3] === 'p' ? 12 : 0);
  return `${pad(hour24)}:${pad(min)}`;
}

/** Where a spoken place ends: at the date, the time, or the end of the sentence. */
const PLACE_END = `(?=\\s+(?:on|at|tomorrow|today|tonight|leaving|departing|arriving|landing|${MONTH_RE})\\b|\\s+\\d|$)`;

export function parseSpokenTrip(spoken: string, now: Date): SpokenTrip {
  const text = spoken.toLowerCase().replace(/[,!?;]/g, ' ').replace(/\.(?=\s|$)/g, ' ').replace(/\s+/g, ' ').trim();
  const fields: SpokenTripFields = {};
  const notes: string[] = [];
  if (!text) return { fields, notes };

  const flight = flightNumber(text);
  if (flight) fields.flightNumber = flight;

  const route = new RegExp(`\\bfrom\\s+(.+?)\\s+to\\s+(.+?)${PLACE_END}`).exec(text);
  const toOnly = route ? null : new RegExp(`\\b(?:flying|going|headed|heading|trip)\\s+to\\s+(.+?)${PLACE_END}`).exec(text);
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

  const d = date(text, now);
  if (d) fields.date = d;
  const t = time(text);
  if (t) fields.time = t;

  return { fields, notes };
}

const LABEL: Record<keyof SpokenTripFields, string> = {
  flightNumber: 'flight number',
  origin: 'departure airport',
  destination: 'arrival airport',
  date: 'departure date',
  time: 'departure time',
};

/** "Filled in: flight number, departure airport." — or that nothing was. */
export function spokenTripSummary(trip: SpokenTrip): string {
  const filled = (Object.keys(LABEL) as Array<keyof SpokenTripFields>).filter((k) => trip.fields[k]);
  return filled.length
    ? `Filled in: ${filled.map((k) => LABEL[k]).join(', ')}. Check each one before saving.`
    : 'Nothing was filled in. Try the example, or type the details.';
}

export const SAY_YOUR_TRIP_EXAMPLE = '“Delta 123 from JFK to Los Angeles on November 14 at 9:05 AM”';
