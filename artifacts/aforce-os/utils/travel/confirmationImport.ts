/** Device-local extraction of plain-text confirmations. No inbox, model or network access. */
import { resolveSaidAirport } from './spokenTrip';
import type { TripLegFormValues } from './tripCard';

export const MAX_CONFIRMATION_LENGTH = 32_000;
export const MAX_IMPORTED_LEGS = 8;
export interface ConfirmationReview { legs: TripLegFormValues[]; notes: string[] }
const CARRIERS = 'AA|DL|UA|WN|B6|AS|NK|F9|HA|G4|SY|XP|MX|BA|AC|AF|KL|LH|EK|QR|EY|TK|VS|IB|AZ|QF|SQ|JL|NH|CX';
const NAMES: Array<[string, string]> = [
  ['American(?: Airlines)?', 'AA'], ['Delta(?: Air ?Lines)?', 'DL'],
  ['United(?: Airlines)?', 'UA'], ['Southwest(?: Airlines)?', 'WN'],
  ['Jet ?Blue(?: Airways)?', 'B6'], ['Alaska(?: Airlines)?', 'AS'],
  ['Spirit(?: Airlines)?', 'NK'], ['Frontier(?: Airlines)?', 'F9'],
  ['Hawaiian(?: Airlines)?', 'HA'], ['Allegiant(?: Air)?', 'G4'],
  ['Sun Country(?: Airlines)?', 'SY'], ['Avelo(?: Airlines)?', 'XP'], ['Breeze(?: Airways)?', 'MX'],
];
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const MONTH = '(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)';
const unique = <T,>(items: T[]): T[] => [...new Set(items)];
const pad = (n: number) => String(n).padStart(2, '0');
const empty = (): TripLegFormValues => ({ flightNumber: '', origin: '', destination: '', date: '', time: '', arrivalDate: '', arrivalTime: '' });

function explicitDate(text: string): string {
  const dates: string[] = [];
  const add = (year: number, month: number, day: number) => {
    const value = `${year}-${pad(month)}-${pad(day)}`;
    const date = new Date(`${value}T12:00:00Z`);
    if (year >= 2000 && year <= 2199 && Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value) dates.push(value);
  };
  for (const m of text.matchAll(/\b(20\d{2}|21\d{2})-(\d{2})-(\d{2})\b/g)) add(+m[1]!, +m[2]!, +m[3]!);
  for (const m of text.matchAll(new RegExp(`\\b${MONTH}\\s+(\\d{1,2})(?:st|nd|rd|th)?[,]?\\s+(20\\d{2}|21\\d{2})\\b`, 'gi'))) add(+m[3]!, MONTHS.indexOf(m[1]!.slice(0, 3).toLowerCase()) + 1, +m[2]!);
  for (const m of text.matchAll(new RegExp(`\\b(\\d{1,2})\\s+${MONTH}[,]?\\s+(20\\d{2}|21\\d{2})\\b`, 'gi'))) add(+m[3]!, MONTHS.indexOf(m[2]!.slice(0, 3).toLowerCase()) + 1, +m[1]!);
  // A slash date is accepted only if its day/month order is unambiguous.
  for (const m of text.matchAll(/\b(\d{1,2})\/(\d{1,2})\/(20\d{2}|21\d{2})\b/g)) {
    if (+m[2]! > 12) add(+m[3]!, +m[1]!, +m[2]!);
    else if (+m[1]! > 12) add(+m[3]!, +m[2]!, +m[1]!);
  }
  return unique(dates).length === 1 ? dates[0]! : '';
}

function explicitTime(text: string): string {
  // Never reinterpret a UTC/offset timestamp as an airport's local clock.
  if (/\b(?:UTC|GMT)\b|\dT\d{2}:\d{2}|\b\d{1,2}:\d{2}\s*[+-]\d{2}:?\d{2}/i.test(text)) return '';
  const times: string[] = [];
  for (const m of text.matchAll(/\b(\d{1,2})(?::(\d{2}))?\s*([ap])\.?m?\.?(?!\w)/gi)) {
    const hour = +m[1]!, minute = +(m[2] ?? 0);
    if (hour >= 1 && hour <= 12 && minute < 60) times.push(`${pad(hour % 12 + (m[3]!.toLowerCase() === 'p' ? 12 : 0))}:${pad(minute)}`);
  }
  const withoutMeridiem = text.replace(/\b\d{1,2}(?::\d{2})?\s*[ap]\.?m?\.?(?!\w)/gi, '');
  for (const m of withoutMeridiem.matchAll(/\b([01]\d|2[0-3]):([0-5]\d)\b/g)) {
    if (+m[1]! === 0 || +m[1]! > 12 || /24[- ]hour/i.test(text)) times.push(`${m[1]}:${m[2]}`);
  }
  return unique(times).length === 1 ? times[0]! : '';
}

function airport(text: string): string {
  const codes: string[] = [];
  const candidates = [...text.matchAll(/\b([A-Z]{3})\b/g)].map(m => m[1]!);
  for (const value of candidates) {
    const resolved = resolveSaidAirport(value.toLowerCase());
    if (resolved && 'code' in resolved) codes.push(resolved.code);
  }
  if (candidates.length) return unique(codes).length === 1 ? codes[0]! : '';
  const resolved = resolveSaidAirport(text.trim().toLowerCase());
  return resolved && 'code' in resolved ? resolved.code : '';
}

function labeled(lines: string[], label: RegExp): string {
  const found: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const m = label.exec(lines[i]!);
    if (!m) continue;
    const remainder = lines[i]!.slice(m[0].length).trim();
    // A label on its own may have its value on the next line. Never consume
    // another label, passenger/contact detail or reservation number as a value.
    const next = lines[i + 1] ?? '';
    found.push(remainder || (/^[\w ]+\s*:/.test(next) ? '' : next));
  }
  return unique(found.filter(Boolean)).join('\n');
}

export function reviewConfirmation(raw: string): ConfirmationReview {
  if (!raw.trim()) throw new Error('Paste the flight details from your confirmation first.');
  if (raw.length > MAX_CONFIRMATION_LENGTH) throw new Error('This confirmation is too long. Paste only the flight itinerary, up to 32,000 characters.');
  const lines = raw.replace(/\r\n?/g, '\n').replace(/[\u00a0\u202f]/g, ' ').split('\n').map(line => line.trim()).filter(Boolean);
  const namedCarriers = unique(NAMES.filter(([name]) => lines.some(line => new RegExp(`^(?:Airline\\s*:\\s*)?${name}\\s*$`, 'i').test(line))).map(([, code]) => code));
  const markers: Array<{ line: number; flight: string }> = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    if (/confirmation|record locator|booking (?:reference|number)|ticket number|operated by|loyalty|frequent flyer/i.test(line)) continue;
    const code = new RegExp(`^(?:Flight\\s*(?:number|no\\.?)?\\s*[:#]?\\s*)?(${CARRIERS})[ -]?(\\d{1,4})\\b`, 'i').exec(line);
    if (code) { markers.push({ line: i, flight: `${code[1]!.toUpperCase()}${code[2]}` }); continue; }
    for (const [name, carrier] of NAMES) {
      const named = new RegExp(`^${name}\\s*(?:flight\\s*(?:number|no\\.?)?\\s*[:#]?\\s*)?(\\d{1,4})\\b`, 'i').exec(line);
      if (named) { markers.push({ line: i, flight: `${carrier}${named[1]}` }); break; }
    }
    if (!markers.some(marker => marker.line === i) && namedCarriers.length === 1) {
      const bare = /^Flight\s*(?:number|no\.?)?\s*[:#]?\s*(\d{1,4})\b/i.exec(line);
      if (bare) markers.push({ line: i, flight: `${namedCarriers[0]}${bare[1]}` });
    }
  }
  if (!markers.length) throw new Error('No clear flight number found. Paste the itinerary section with a flight number such as AA123, or use Add a trip.');
  if (markers.length > MAX_IMPORTED_LEGS) throw new Error('This itinerary has more than eight flight entries. Import a smaller section; no flights have been saved.');
  const notes = new Set<string>(['Check every flight, date and local airport time against your confirmation. Nothing has been checked with the airline.']);
  const legs = markers.map((marker, index) => {
    // For a single flight, a date printed above the flight number can be read.
    // Multiple flights never borrow headers/dates from a different segment.
    const block = lines.slice(markers.length === 1 ? 0 : marker.line, markers[index + 1]?.line ?? lines.length);
    const departure = labeled(block, /^(?:Depart(?:ure|ing|s)?)(?:\s+(?:date|time))?\s*[:\-]\s*/i);
    const arrival = labeled(block, /^(?:Arriv(?:al|ing|es?))(?:\s+(?:date|time))?\s*[:\-]\s*/i);
    const from = labeled(block, /^From\s*[:\-]\s*/i);
    const to = labeled(block, /^To\s*[:\-]\s*/i);
    const route = unique(block.flatMap(line => [...line.matchAll(/\b([A-Z]{3})\s*(?:→|->|\bto\b)\s*([A-Z]{3})\b/g)].map(m => `${m[1]}:${m[2]}`)));
    const routeParts = route.length === 1 ? route[0]!.split(':') : [];
    const f = empty();
    f.flightNumber = marker.flight;
    f.origin = from ? airport(from) : routeParts[0] ? airport(routeParts[0]) : '';
    f.destination = to ? airport(to) : routeParts[1] ? airport(routeParts[1]) : '';
    if ((from && routeParts[0] && f.origin !== routeParts[0]) || (to && routeParts[1] && f.destination !== routeParts[1])) {
      f.origin = ''; f.destination = '';
    }
    f.date = explicitDate(departure || labeled(block, /^(?:Departure date|Date)\s*:\s*/i));
    f.time = explicitTime(departure);
    f.arrivalDate = explicitDate(arrival);
    f.arrivalTime = explicitTime(arrival);
    if (f.origin && f.origin === f.destination) { f.origin = ''; f.destination = ''; }
    const missing = ([['origin', 'departure airport'], ['destination', 'arrival airport'], ['date', 'departure date including year'], ['time', 'departure time with AM/PM or a clear 24-hour time']] as const).filter(([key]) => !f[key]).map(([, name]) => name);
    if (missing.length) notes.add(`Flight ${index + 1}: enter the ${missing.join(', ')} below.`);
    if (!!f.arrivalDate !== !!f.arrivalTime) notes.add(`Flight ${index + 1}: complete both arrival date and time, or clear both.`);
    return f;
  });
  return { legs, notes: [...notes] };
}
