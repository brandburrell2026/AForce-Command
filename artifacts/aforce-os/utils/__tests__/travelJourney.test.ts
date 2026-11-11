import { describe, expect, it } from 'vitest';
import type { TravelSnapshot, TravelTrip } from '@workspace/api-zod';

import { diffLabel, focusTrip, journeyView, type JourneyInput, type JourneyWeather } from '../travel/journeyPresentation';
import type { TravelConfirmations } from '../travel/travelState';

const at = (iso: string) => Date.parse(iso);
const flight = { flightNumber: 'AA123', departureDate: '2026-11-12', origin: 'JFK', destination: 'MIA' };
const miami: TravelTrip = {
  id: 'mia',
  title: 'Miami',
  completedAt: null,
  createdAt: '2026-11-01T12:00:00Z',
  legs: [{
    id: 'l1', flight,
    departureAt: '2026-11-12T12:05:00Z', arrivalAt: '2026-11-12T15:12:00Z',
    originTimeZone: 'America/New_York', destinationTimeZone: 'America/New_York',
  }],
};
const tokyo: TravelTrip = {
  ...miami,
  id: 'tyo',
  title: 'Tokyo',
  legs: [{
    id: 'l2', flight: { flightNumber: 'JL5', departureDate: '2026-11-20', origin: 'JFK', destination: 'HND' },
    departureAt: '2026-11-20T17:00:00Z', arrivalAt: '2026-11-21T07:30:00Z',
    originTimeZone: 'America/New_York', destinationTimeZone: 'Asia/Tokyo',
  }],
};
const lisbon: TravelTrip = {
  ...miami,
  id: 'lis',
  legs: [{ ...miami.legs[0], id: 'l3', flight: { ...flight, destination: 'LIS' }, destinationTimeZone: 'Europe/Lisbon', arrivalAt: '2026-11-12T22:00:00Z' }],
};

const input = (trips: TravelTrip[], nowIso: string, conf: Record<string, TravelConfirmations> = {}, weather: JourneyWeather | null = null): JourneyInput => ({
  trips, snapshots: {}, confirmations: (id) => conf[id] ?? {}, nowMs: at(nowIso), weather,
});

const liveWeather: JourneyWeather = {
  temperatureC: { value: 28, source: 'live', observedAtMs: at('2026-11-12T15:00:00Z') },
  humidityPct: { value: 74, source: 'live', observedAtMs: at('2026-11-12T15:00:00Z') },
  sun: null,
  stale: false,
};

describe('journeyView', () => {
  it('nothing to show when no trip is surfaced', () => {
    expect(journeyView(input([miami], '2026-10-01T12:00:00Z'))).toBeNull();
    expect(journeyView(input([], '2026-11-12T12:00:00Z'))).toBeNull();
  });

  it('preview: route eyebrow, city, countdown, computed difference, unavailable weather', () => {
    const v = journeyView(input([miami], '2026-11-11T23:05:00Z'))!;
    expect(v.kind).toBe('preview');
    expect(v.eyebrow).toBe('Thu, Nov 12 · 7:05 AM · JFK to MIA');
    expect(v.headline).toBe('Miami');
    expect(v.subline).toBe('Your next destination awaits.');
    expect(v.rows).toEqual([
      { label: 'Departs in', value: '13h 0m', source: 'Your itinerary' },
      { label: 'Time difference', value: 'Same time as New York', source: 'Computed' },
      { label: 'Weather', value: '—', source: 'Unavailable' },
    ]);
    expect(v.atmosphere).toEqual({ kind: 'type_only', name: 'Miami', daypart: 'morning' });
    expect(v.tone).toBe('#1E242A');
  });

  it('lock_in while in transit: planned progress, not live tracking', () => {
    const v = journeyView(input([miami], '2026-11-12T13:25:00Z'))!;
    expect(v.kind).toBe('lock_in');
    expect(v.headline).toBe('LOCK-IN');
    expect(v.progress).toBeCloseTo(80 / 187, 5);
    expect(v.progressCaption).toContain('not live tracking');
    expect(v.rows[0]).toEqual({ label: 'Planned arrival', value: '10:12 AM Miami time', source: 'Your itinerary' });
  });

  it('past planned arrival without confirmation: still lock_in, asks to confirm', () => {
    const v = journeyView(input([miami], '2026-11-12T16:30:00Z'))!;
    expect(v.kind).toBe('lock_in');
    expect(v.subline).toContain('Confirm when you’ve landed');
  });

  it('arrival after confirmation, with live weather in °F', () => {
    const v = journeyView(input([miami], '2026-11-12T15:30:00Z', { mia: { arrivalConfirmedAtIso: '2026-11-12T15:20:00Z' } }, liveWeather))!;
    expect(v.kind).toBe('arrival');
    expect(v.eyebrow).toBe('You’ve arrived · You confirmed');
    expect(v.subline).toBe('New city. Same standard.');
    expect(v.rows).toEqual([
      { label: 'Local time', value: '10:30 AM', source: 'Same time as New York' },
      { label: 'Temperature', value: '82°F', source: 'Live' },
      { label: 'Humidity', value: '74%', source: 'Live' },
    ]);
    expect(v.arrivalMomentId).toBe('travel2:mia:l1:arrival');
  });

  it('old readings say so', () => {
    const v = journeyView(input([miami], '2026-11-12T15:30:00Z', { mia: { arrivalConfirmedAtIso: '2026-11-12T15:20:00Z' } }, { ...liveWeather, stale: true }))!;
    expect(v.rows[1].source).toBe('Live · older reading');
  });

  it('ready after the member says so', () => {
    const v = journeyView(input([miami], '2026-11-12T17:00:00Z', {
      mia: { arrivalConfirmedAtIso: '2026-11-12T15:20:00Z', readyAtIso: '2026-11-12T16:00:00Z' },
    }))!;
    expect(v.kind).toBe('ready');
  });

  it('Tokyo shows the shift; unsupported airports keep their code', () => {
    const v = journeyView(input([tokyo], '2026-11-20T10:00:00Z'))!;
    expect(v.headline).toBe('Tokyo');
    expect(v.rows[1].value).toBe('14h ahead of New York');
    const l = journeyView(input([lisbon], '2026-11-12T10:00:00Z'))!;
    expect(l.headline).toBe('LIS');
    expect(l.atmosphere.kind).toBe('type_only');
  });

  it('in transit beats an upcoming trip', () => {
    const f = focusTrip(input([tokyo, miami], '2026-11-12T13:25:00Z'));
    expect(f?.trip.id).toBe('mia');
  });

  it('cancelled reports surface a review flag', () => {
    const snap = {
      version: 2, provider: 'flightaware', availability: 'available', fetchedAt: '2026-11-12T10:00:00Z',
      flight: {
        ...flight, status: 'cancelled', scheduledDeparture: null, estimatedDeparture: null, departureGate: null,
        departureTerminal: null, scheduledArrival: null, estimatedArrival: null, actualArrival: null,
        actualDeparture: null, originTimeZone: 'America/New_York', destinationTimeZone: 'America/New_York',
      },
    } as TravelSnapshot;
    const v = journeyView({ ...input([miami], '2026-11-12T10:30:00Z'), snapshots: { l1: snap } })!;
    expect(v.needsReview).toBe(true);
  });

  it('time difference labels', () => {
    expect(diffLabel(null, 'X')).toBe('Time difference unavailable');
    expect(diffLabel(-5, 'London')).toBe('5h behind London');
    expect(diffLabel(5.5, 'London')).toBe('5h 30m ahead of London');
  });
});
