import { describe, it, expect } from 'vitest';

import {
  daypartAt,
  isBigShift,
  isValidTimeZone,
  localTimeParts,
  timeDifferenceHours,
  utcOffsetMinutes,
} from '../travel/travelTime';
import {
  CITY_REGISTRY,
  atmosphereFor,
  cityById,
  cityForAirport,
  placeForAirport,
  normalizePlaceQuery,
  placeFromResolution,
  resolveDestination,
} from '../travel/cityRegistry';
import { deriveTripTravelState } from '../travel/travelState';
import { buildArrivalProtocol } from '../travel/arrivalProtocol';
import airportTimeZones from '../../data/airportTimeZones.json';
import type { TravelSnapshot, TravelTrip } from '@workspace/api-zod';
import {
  MOMENT_LOCK_IN_BEFORE_MIN,
  TRAVEL_ACCLIMATING_MAX_HOURS,
  TRAVEL_ARRIVAL_HYDRATE_OZ,
  TRAVEL_NO_ARRIVAL_TIME_MAX_HOURS,
  TRAVEL_PREPARING_HORIZON_HOURS,
  TRAVEL_READY_SURFACE_HOURS,
  TRAVEL_UNCONFIRMED_ARRIVAL_MAX_HOURS,
} from '../../config/hydroStateModel';

const H = 3_600_000;
const M = 60_000;
const at = (iso: string) => Date.parse(iso);

describe('travelTime — zones and DST', () => {
  it('rejects unknown zones instead of guessing', () => {
    expect(isValidTimeZone('America/New_York')).toBe(true);
    expect(isValidTimeZone('Mars/Olympus_Mons')).toBe(false);
    expect(isValidTimeZone(null)).toBe(false);
    expect(timeDifferenceHours('America/New_York', 'Nowhere/Zone', Date.now())).toBeNull();
  });

  it('New York → London is 5h most of the year, 4h in the March DST gap', () => {
    expect(timeDifferenceHours('America/New_York', 'Europe/London', at('2026-11-12T12:00:00Z'))).toBe(5);
    // US moved clocks 2026-03-08, UK not until 2026-03-29.
    expect(timeDifferenceHours('America/New_York', 'Europe/London', at('2026-03-15T12:00:00Z'))).toBe(4);
  });

  it('New York → Tokyo is +14 in November, Miami is 0, Dubai is +9', () => {
    const nov = at('2026-11-12T14:00:00Z');
    expect(timeDifferenceHours('America/New_York', 'Asia/Tokyo', nov)).toBe(14);
    expect(timeDifferenceHours('America/New_York', 'America/New_York', nov)).toBe(0);
    expect(timeDifferenceHours('America/New_York', 'Asia/Dubai', nov)).toBe(9);
  });

  it('handles half-hour zones and westward (negative) shifts', () => {
    const nov = at('2026-11-12T14:00:00Z');
    expect(timeDifferenceHours('Europe/London', 'Asia/Kolkata', nov)).toBe(5.5);
    expect(timeDifferenceHours('Europe/London', 'America/New_York', nov)).toBe(-5);
    expect(utcOffsetMinutes(nov, 'Asia/Kolkata')).toBe(330);
  });

  it('Phoenix does not observe DST', () => {
    expect(utcOffsetMinutes(at('2026-07-01T12:00:00Z'), 'America/Phoenix')).toBe(-420);
    expect(utcOffsetMinutes(at('2026-12-01T12:00:00Z'), 'America/Phoenix')).toBe(-420);
  });

  it('reads destination wall-clock time', () => {
    const p = localTimeParts(at('2026-11-12T15:24:00Z'), 'America/New_York');
    expect(p).toMatchObject({ hour: 10, minute: 24, day: 12, month: 11 });
  });

  it('big shift threshold', () => {
    expect(isBigShift(0)).toBe(false);
    expect(isBigShift(-5)).toBe(true);
    expect(isBigShift(14)).toBe(true);
    expect(isBigShift(null)).toBe(false);
  });
});

describe('travelTime — dayparts', () => {
  it('falls back to local-hour bands without sun data', () => {
    const tz = 'America/New_York';
    expect(daypartAt(at('2026-11-12T13:42:00Z'), tz)).toBe('morning'); // 8:42 AM
    expect(daypartAt(at('2026-11-12T18:00:00Z'), tz)).toBe('day'); // 1 PM
    expect(daypartAt(at('2026-11-12T23:00:00Z'), tz)).toBe('sunset'); // 6 PM
    expect(daypartAt(at('2026-11-13T03:00:00Z'), tz)).toBe('night'); // 10 PM
  });

  it('prefers provider sunrise/sunset when given', () => {
    const tz = 'Asia/Dubai';
    const sun = { sunriseMs: at('2026-11-12T02:30:00Z'), sunsetMs: at('2026-11-12T13:35:00Z') };
    expect(daypartAt(at('2026-11-12T13:48:00Z'), tz, sun)).toBe('sunset');
    expect(daypartAt(at('2026-11-12T16:00:00Z'), tz, sun)).toBe('night');
    expect(daypartAt(at('2026-11-12T08:00:00Z'), tz, sun)).toBe('day');
  });

  it('returns null for an unknown zone', () => {
    expect(daypartAt(Date.now(), null)).toBeNull();
  });
});

describe('cityRegistry', () => {
  it('has the 20 featured destinations with valid zones and unique ids', () => {
    expect(CITY_REGISTRY).toHaveLength(20);
    expect(new Set(CITY_REGISTRY.map((c) => c.id)).size).toBe(20);
    for (const c of CITY_REGISTRY) {
      expect(isValidTimeZone(c.timezone)).toBe(true);
      expect(Math.abs(c.latitude)).toBeLessThanOrEqual(90);
      expect(Math.abs(c.longitude)).toBeLessThanOrEqual(180);
    }
  });

  it('ships no photo without a licence (none exist yet)', () => {
    for (const c of CITY_REGISTRY) {
      for (const photo of Object.values(c.atmospheres)) {
        expect(photo?.license.trim()).toBeTruthy();
      }
    }
  });

  it('resolves names, airport codes and "City, Country"', () => {
    expect(resolveDestination('Miami')).toMatchObject({ kind: 'featured', city: { id: 'miami' } });
    expect(resolveDestination('JFK')).toMatchObject({ kind: 'featured', city: { id: 'new-york' } });
    expect(resolveDestination('  hnd ')).toMatchObject({ kind: 'featured', city: { id: 'tokyo' } });
    expect(resolveDestination('Paris, France')).toMatchObject({ kind: 'featured', city: { id: 'paris' } });
    expect(normalizePlaceQuery('Zürich')).toBe('zurich');
  });

  it('keeps unsupported cities as typed and never borrows a skyline', () => {
    const r = resolveDestination('Lisbon');
    expect(r).toEqual({ kind: 'fallback', name: 'Lisbon' });
    const place = placeFromResolution(r!);
    expect(place).toEqual({ cityId: null, name: 'Lisbon', timezone: null, latitude: null, longitude: null });
    expect(atmosphereFor(place, 'night')).toEqual({ kind: 'type_only', name: 'Lisbon', daypart: 'night' });
    expect(resolveDestination('   ')).toBeNull();
  });

  it('uses the type-only treatment for a featured city with no licensed photo', () => {
    const miami = placeFromResolution(resolveDestination('Miami')!);
    expect(miami.timezone).toBe('America/New_York');
    expect(atmosphereFor(miami, 'morning')).toEqual({ kind: 'type_only', name: 'Miami', daypart: 'morning' });
    expect(cityById('nope')).toBeNull();
  });
});

describe('cityRegistry — airports from existing flight legs', () => {
  it('maps airport codes to featured cities', () => {
    expect(cityForAirport('jfk')?.id).toBe('new-york');
    expect(cityForAirport('HND')?.id).toBe('tokyo');
    expect(cityForAirport('LIS')).toBeNull();
    expect(cityForAirport(null)).toBeNull();
  });

  it("every registry airport agrees with the app's airport time-zone table", () => {
    const table = airportTimeZones as Record<string, string>;
    for (const city of CITY_REGISTRY) {
      expect(city.airports.length).toBeGreaterThan(0);
      for (const code of city.airports) expect(table[code]).toBe(city.timezone);
    }
  });

  it("keeps the leg's own zone and the airport code for unsupported airports", () => {
    expect(placeForAirport('MIA', 'America/New_York')).toMatchObject({ cityId: 'miami', name: 'Miami', timezone: 'America/New_York' });
    expect(placeForAirport('lis', 'Europe/Lisbon')).toEqual({
      cityId: null, name: 'LIS', timezone: 'Europe/Lisbon', latitude: null, longitude: null,
    });
  });
});

const DEP = at('2026-11-12T12:05:00Z'); // 7:05 AM EST
const ARR = at('2026-11-12T15:12:00Z'); // 10:12 AM EST
const flight = { flightNumber: 'AA123', departureDate: '2026-11-12', origin: 'JFK', destination: 'MIA' };
const trip = (over: Partial<TravelTrip['legs'][number]> = {}, tripOver: Partial<TravelTrip> = {}): TravelTrip => ({
  id: 'trip1',
  title: 'Miami',
  completedAt: null,
  createdAt: '2026-11-01T12:00:00Z',
  legs: [{
    id: 'leg1',
    flight,
    departureAt: '2026-11-12T12:05:00Z',
    arrivalAt: '2026-11-12T15:12:00Z',
    originTimeZone: 'America/New_York',
    destinationTimeZone: 'America/New_York',
    ...over,
  }],
  ...tripOver,
});
const snap = (f: Partial<TravelSnapshot['flight']>, fetchedAt = '2026-11-12T15:00:00Z'): TravelSnapshot => ({
  version: 2,
  provider: 'flightaware',
  availability: 'available',
  fetchedAt,
  flight: {
    ...flight,
    status: 'scheduled',
    scheduledDeparture: '2026-11-12T12:05:00Z',
    estimatedDeparture: null,
    departureGate: null,
    departureTerminal: null,
    scheduledArrival: '2026-11-12T15:12:00Z',
    estimatedArrival: null,
    actualArrival: null,
    actualDeparture: null,
    originTimeZone: 'America/New_York',
    destinationTimeZone: 'America/New_York',
    ...f,
  },
});

describe('deriveTripTravelState — on the existing trip model', () => {
  it('is hidden until the preparing horizon, then preparing', () => {
    expect(deriveTripTravelState(trip(), {}, DEP - (TRAVEL_PREPARING_HORIZON_HOURS + 1) * H).state).toBe('none');
    const r = deriveTripTravelState(trip(), {}, DEP - 13 * H);
    expect(r).toMatchObject({ state: 'preparing', legIndex: 0 });
    expect(r.msToDeparture).toBe(13 * H);
  });

  it('is in transit between planned times, with planned progress only', () => {
    const r = deriveTripTravelState(trip(), {}, DEP + 80 * M);
    expect(r).toMatchObject({ state: 'in_transit', reason: 'scheduled_in_transit' });
    expect(r.plannedProgress).toBeCloseTo(80 / 187, 5);
  });

  it('never assumes arrival from the clock', () => {
    expect(deriveTripTravelState(trip(), {}, ARR - 10 * M).state).toBe('arriving');
    expect(deriveTripTravelState(trip(), {}, ARR + 3 * H)).toMatchObject({ state: 'arriving', reason: 'awaiting_confirmation' });
    expect(deriveTripTravelState(trip(), {}, ARR + (TRAVEL_UNCONFIRMED_ARRIVAL_MAX_HOURS + 1) * H).state).toBe('none');
  });

  it('a provider-reported actual arrival counts as arrived (live)', () => {
    const r = deriveTripTravelState(trip(), { leg1: snap({ status: 'landed', actualArrival: '2026-11-12T15:05:00Z' }) }, ARR + 30 * M);
    expect(r).toMatchObject({ state: 'acclimating', reason: 'arrived', arrivalSource: 'live' });
  });

  it('ignores a snapshot for a different flight', () => {
    const other = snap({ flightNumber: 'AA999', status: 'landed', actualArrival: '2026-11-12T15:05:00Z' });
    expect(deriveTripTravelState(trip(), { leg1: other }, ARR + 30 * M).state).toBe('arriving');
  });

  it('does not apply provider estimates to the plan', () => {
    const delayed = snap({ status: 'delayed', estimatedDeparture: '2026-11-12T14:05:00Z', estimatedArrival: '2026-11-12T17:12:00Z' });
    expect(deriveTripTravelState(trip(), { leg1: delayed }, DEP + 30 * M).state).toBe('in_transit');
  });

  it('a reported actual departure shows in transit even before the planned time', () => {
    const early = snap({ status: 'departed', actualDeparture: '2026-11-12T11:58:00Z' });
    expect(deriveTripTravelState(trip(), { leg1: early }, DEP - 3 * M)).toMatchObject({ state: 'in_transit', reason: 'departed_reported' });
  });

  it('cancelled or diverted reports ask for review instead of changing state', () => {
    const r = deriveTripTravelState(trip(), { leg1: snap({ status: 'cancelled' }) }, DEP - 2 * H);
    expect(r).toMatchObject({ state: 'preparing', needsReview: true });
  });

  it('member confirmation, ready, and expiry', () => {
    const c = { arrivalConfirmedAtIso: '2026-11-12T15:20:00Z' };
    expect(deriveTripTravelState(trip(), {}, ARR + 2 * H, c)).toMatchObject({ state: 'acclimating', arrivalSource: 'member' });
    expect(deriveTripTravelState(trip(), {}, at('2026-11-12T19:00:00Z'), { ...c, readyAtIso: '2026-11-12T18:00:00Z' }))
      .toMatchObject({ state: 'ready', reason: 'marked_ready' });
    const conf = at('2026-11-12T15:20:00Z');
    expect(deriveTripTravelState(trip(), {}, conf + (TRAVEL_ACCLIMATING_MAX_HOURS + 1) * H, c))
      .toMatchObject({ state: 'ready', reason: 'acclimating_elapsed' });
    expect(deriveTripTravelState(trip(), {}, conf + (TRAVEL_ACCLIMATING_MAX_HOURS + TRAVEL_READY_SURFACE_HOURS + 1) * H, c).state).toBe('none');
  });

  it('a confirmation in the future is ignored', () => {
    expect(deriveTripTravelState(trip(), {}, DEP + 30 * M, { arrivalConfirmedAtIso: '2026-11-12T20:00:00Z' }).state).toBe('in_transit');
  });

  it('a leg without an arrival time stays in transit, bounded', () => {
    const t = trip({ arrivalAt: null });
    expect(deriveTripTravelState(t, {}, DEP + 5 * H).state).toBe('in_transit');
    expect(deriveTripTravelState(t, {}, DEP + (TRAVEL_NO_ARRIVAL_TIME_MAX_HOURS + 1) * H).state).toBe('none');
  });

  it('connections: in transit across legs, arrival from the last leg', () => {
    const t: TravelTrip = {
      ...trip(),
      legs: [
        { ...trip().legs[0], id: 'a', flight: { ...flight, destination: 'ATL' }, arrivalAt: '2026-11-12T14:20:00Z', destinationTimeZone: 'America/New_York' },
        { ...trip().legs[0], id: 'b', flight: { ...flight, flightNumber: 'DL55', origin: 'ATL' }, departureAt: '2026-11-12T15:30:00Z', arrivalAt: '2026-11-12T17:20:00Z', originTimeZone: 'America/New_York' },
      ],
    };
    expect(deriveTripTravelState(t, {}, at('2026-11-12T15:00:00Z'))).toMatchObject({ state: 'in_transit', legIndex: 0 });
    expect(deriveTripTravelState(t, {}, at('2026-11-12T16:00:00Z'))).toMatchObject({ state: 'in_transit', legIndex: 1 });
    expect(deriveTripTravelState(t, {}, at('2026-11-12T17:00:00Z')).state).toBe('arriving');
  });

  it('completed trips are not surfaced', () => {
    expect(deriveTripTravelState(trip({}, { completedAt: '2026-11-12T20:00:00Z' }), {}, DEP).reason).toBe('completed');
  });
});

describe('buildArrivalProtocol', () => {
  const land = at('2026-11-12T15:15:00Z');

  it('Miami, warm and humid with a 1 PM commitment: full protocol with LOCK-IN', () => {
    const steps = buildArrivalProtocol({
      arrivalMs: land,
      nextCommitmentMs: at('2026-11-12T18:00:00Z'),
      conditions: { heat: 'warm', humidity: 'humid', uv: 'high' },
    });
    expect(steps.map((s) => s.key)).toEqual(['pause', 'hydrate', 'reset', 'lock_in', 'after']);
    const hydrate = steps.find((s) => s.key === 'hydrate')!;
    expect(hydrate.electrolyte).toBe(true);
    expect(hydrate.factors).toContain('humid');
    expect(steps.find((s) => s.key === 'reset')!.factors).toContain('uv_high');
    expect(steps.find((s) => s.key === 'lock_in')!.atMs).toBe(at('2026-11-12T18:00:00Z') - MOMENT_LOCK_IN_BEFORE_MIN * M);
  });

  it('no commitment → no LOCK-IN step is invented', () => {
    const steps = buildArrivalProtocol({ arrivalMs: land, nextCommitmentMs: null, conditions: { heat: null, humidity: null, uv: null } });
    expect(steps.map((s) => s.key)).toEqual(['pause', 'hydrate', 'reset', 'after']);
  });

  it('a commitment too soon after landing gets no LOCK-IN step', () => {
    const steps = buildArrivalProtocol({ arrivalMs: land, nextCommitmentMs: land + 30 * M, conditions: { heat: null, humidity: null, uv: null } });
    expect(steps.some((s) => s.key === 'lock_in')).toBe(false);
  });

  it('unknown weather lists no weather factors and uses the standard range', () => {
    const hydrate = buildArrivalProtocol({ arrivalMs: land, nextCommitmentMs: null, conditions: { heat: null, humidity: null, uv: null } })
      .find((s) => s.key === 'hydrate')!;
    expect(hydrate.factors).toEqual(['seated_travel']);
    expect(hydrate.electrolyte).toBe(false);
    expect(hydrate.ozRange).toEqual({ ...TRAVEL_ARRIVAL_HYDRATE_OZ });
  });

  it('dry heat (Dubai) uses the top of the range with an electrolyte', () => {
    const hydrate = buildArrivalProtocol({ arrivalMs: land, nextCommitmentMs: null, conditions: { heat: 'hot', humidity: 'very_dry', uv: 'very_high' } })
      .find((s) => s.key === 'hydrate')!;
    expect(hydrate.ozRange).toEqual({ min: 16, max: 16 });
    expect(hydrate.electrolyte).toBe(true);
    expect(hydrate.factors).toEqual(expect.arrayContaining(['heat', 'dry']));
  });

  it('steps are in time order', () => {
    const steps = buildArrivalProtocol({ arrivalMs: land, nextCommitmentMs: land + 5 * H, conditions: { heat: null, humidity: null, uv: null } });
    const times = steps.filter((s) => s.atMs != null).map((s) => s.atMs!);
    expect([...times].sort((a, b) => a - b)).toEqual(times);
  });
});
