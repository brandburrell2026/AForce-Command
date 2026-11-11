/**
 * LOCK — shareable arrival card carries identity, not data.
 *
 * The card may show the city name, the AFORCE line and the atmosphere. It
 * must never carry a date, time, flight number, origin, weather, health or
 * hydration value (Constitution Principle 7; SS-06 private by default; the
 * founder brief: "a shareable image that excludes private travel and health
 * information").
 *
 * This builds the payload from a real journey view of a trip stuffed with
 * identifying detail and asserts none of it survives. It also scans the card
 * component and the section that feeds it, so a future edit that starts
 * passing the trip, the weather or a confirmation into the card fails here
 * and has to update this lock consciously. Do not loosen it by deleting a
 * pattern.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { TravelTrip } from '@workspace/api-zod';

import {
  ARRIVAL_SHARE_EYEBROW,
  ARRIVAL_SHARE_LINE,
  arrivalSharePayload,
} from '../travel/arrivalShare';
import { journeyView } from '../travel/journeyPresentation';

const trip: TravelTrip = {
  id: 'trip-private-123',
  title: 'Board meeting — Tokyo, confidential',
  completedAt: null,
  createdAt: '2026-11-01T12:00:00Z',
  legs: [{
    id: 'leg-9',
    flight: { flightNumber: 'JL5', departureDate: '2026-11-20', origin: 'JFK', destination: 'HND' },
    departureAt: '2026-11-20T17:00:00Z',
    arrivalAt: '2026-11-21T07:30:00Z',
    originTimeZone: 'America/New_York',
    destinationTimeZone: 'Asia/Tokyo',
  }],
};

const view = journeyView({
  trips: [trip],
  snapshots: {},
  confirmations: () => ({ arrivalConfirmedAtIso: '2026-11-21T07:40:00Z' }),
  nowMs: Date.parse('2026-11-21T08:00:00Z'),
  weather: {
    temperatureC: { value: 15, source: 'live', observedAtMs: 0 },
    humidityPct: { value: 61, source: 'live', observedAtMs: 0 },
    sun: null,
    stale: false,
  },
})!;

const FORBIDDEN = [
  /\d/, // any digit: dates, times, flight numbers, temperatures, oz, scores
  /JL\s?5|JFK|HND|New York/i, // flight + origin
  /trip-private|leg-9|Board meeting|confidential/i, // ids and private titles
  /°|humid|weather|°F|oz|hydrat|HydroState|sleep|steps|readiness/i, // conditions + health
  /Nov|Fri|Sat|AM\b|PM\b|20\d\d/i, // calendar words
];

describe('arrival share payload', () => {
  const payload = arrivalSharePayload({ cityName: view.cityName, atmosphere: view.atmosphere })!;

  it('has exactly the sanctioned fields', () => {
    expect(Object.keys(payload).sort()).toEqual(['cityName', 'eyebrow', 'line', 'message', 'photoUri', 'tone']);
    expect(payload).toMatchObject({ eyebrow: ARRIVAL_SHARE_EYEBROW, cityName: 'Tokyo', line: ARRIVAL_SHARE_LINE });
    expect(payload.message).toBe('Welcome to Tokyo. New city. Same standard.');
  });

  it('carries nothing identifying, even from a trip full of it', () => {
    const text = [payload.eyebrow, payload.cityName, payload.line, payload.message].join(' | ');
    for (const re of FORBIDDEN) expect(text).not.toMatch(re);
  });

  it('strips digits a city name could smuggle in, and refuses an empty name', () => {
    const atmosphere = { kind: 'type_only' as const, name: 'x', daypart: null };
    expect(arrivalSharePayload({ cityName: 'Tokyo 11:20 PM', atmosphere })!.cityName).toBe('Tokyo PM');
    expect(arrivalSharePayload({ cityName: 'Port-au-Prince', atmosphere })!.cityName).toBe('Port-au-Prince');
    expect(arrivalSharePayload({ cityName: 'Zürich', atmosphere })!.cityName).toBe('Zürich');
    expect(arrivalSharePayload({ cityName: '  123 ', atmosphere })).toBeNull();
  });

  it('uses the daypart tone until a licensed photo exists', () => {
    expect(payload.photoUri).toBeNull();
    expect(payload.tone).toMatch(/^#[0-9A-F]{6}$/i);
  });
});

describe('source scan — the card is only fed the payload', () => {
  const root = join(__dirname, '..', '..');
  const section = readFileSync(join(root, 'components/travel/TravelJourneySection.tsx'), 'utf8');
  const card = readFileSync(join(root, 'components/travel/ArrivalShareCard.tsx'), 'utf8');

  it('the section builds the payload from cityName + atmosphere only', () => {
    const call = section.match(/arrivalSharePayload\(\{([^}]*)\}\)/)?.[1] ?? '';
    expect(call.replace(/\s/g, '')).toBe('cityName:view.cityName,atmosphere:view.atmosphere');
  });

  it('the card never reads travel, weather, confirmations or health', () => {
    // Code only: comments, string literals and JSX copy (the on-screen
    // "Never on it" list names these words on purpose) are removed first.
    const code = card
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/.*$/gm, '')
      .replace(/'[^'\n]*'|"[^"\n]*"|`[^`]*`/g, "''")
      .replace(/>[^<{]*</g, '><');
    expect(code).not.toMatch(/TravelTrip|TravelDocument|weather|confirm|arrivalAt|departureAt|flight|hydro|health/i);
  });
});
