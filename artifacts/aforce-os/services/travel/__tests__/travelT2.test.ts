import { beforeEach, describe, expect, it } from 'vitest';
import type { TravelSnapshot, TravelTrip } from '@workspace/api-zod';

import {
  getDestinationWeather,
  parseDestinationWeather,
  resetDestinationWeatherCache,
  unavailableWeather,
} from '../destinationWeather';
import {
  arrivalFactMs,
  arrivalPlanLine,
  confirmArrival,
  confirmationsFor,
  legSnapshots,
  markReady,
  nextCommitmentAfter,
  tripArrivalPlan,
  undoArrival,
} from '../arrival';
import {
  createTravelDocuments,
  emptyTravelDocument,
  travelDocumentSchema,
  tripMoments,
  type TravelDocument,
} from '../intelligence';
import { deriveTripTravelState } from '@/utils/travel/travelState';
import { placeForAirport } from '@/utils/travel/cityRegistry';
import { consumerCopyBlocked } from '@/utils/intelligence/languageGate/runtimeClaimScan';
import { evaluateDeliverableCopy } from '@/utils/intelligence/decisionGuard';
import type { Moment } from '@/types/moments';
import { TRAVEL_WEATHER_MAX_AGE_MIN } from '@/config/hydroStateModel';

const at = (iso: string) => Date.parse(iso);
const S = (iso: string) => at(iso) / 1000;
const MIAMI = placeForAirport('MIA', 'America/New_York');

const flight = { flightNumber: 'AA123', departureDate: '2026-11-12', origin: 'JFK', destination: 'MIA' };
const trip: TravelTrip = {
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
  }],
};
const doc = (over: Partial<TravelDocument> = {}): TravelDocument => ({ ...emptyTravelDocument(), trips: [trip], ...over });

const providerBody = {
  current: { time: S('2026-11-12T15:00:00Z'), temperature_2m: 28, relative_humidity_2m: 74, uv_index: 6, weather_code: 1 },
  hourly: {
    time: [S('2026-11-13T15:00:00Z'), S('2026-11-13T16:00:00Z')],
    temperature_2m: [36, 37],
    relative_humidity_2m: [8, 9],
    uv_index: [9, 9],
    weather_code: [0, 0],
  },
  daily: {
    time: [S('2026-11-12T05:00:00Z'), S('2026-11-13T05:00:00Z')],
    sunrise: [S('2026-11-12T11:45:00Z'), S('2026-11-13T11:46:00Z')],
    sunset: [S('2026-11-12T22:33:00Z'), S('2026-11-13T22:33:00Z')],
  },
};

describe('destination weather', () => {
  beforeEach(() => resetDestinationWeatherCache());

  it('current conditions are live, aged by the provider time, and banded', () => {
    const w = parseDestinationWeather(providerBody, at('2026-11-12T15:10:00Z'), at('2026-11-12T15:10:00Z'));
    expect(w.temperatureC).toEqual({ value: 28, source: 'live', observedAtMs: at('2026-11-12T15:00:00Z') });
    expect(w.conditions).toEqual({ heat: 'warm', humidity: 'humid', uv: 'high' });
    expect(w.sun?.sunsetMs).toBe(at('2026-11-12T22:33:00Z'));
    expect(w.stale).toBe(false);
  });

  it('old readings are flagged and never drive the plan', () => {
    const now = at('2026-11-12T15:00:00Z') + (TRAVEL_WEATHER_MAX_AGE_MIN + 1) * 60_000;
    const w = parseDestinationWeather(providerBody, now, now);
    expect(w.stale).toBe(true);
    expect(w.conditions).toEqual({ heat: null, humidity: null, uv: null });
    expect(w.temperatureC.source).toBe('live');
  });

  it('a later arrival uses the hourly forecast, labelled forecast', () => {
    const w = parseDestinationWeather(providerBody, at('2026-11-12T15:00:00Z'), at('2026-11-13T15:20:00Z'));
    expect(w.temperatureC).toMatchObject({ value: 36, source: 'forecast' });
    expect(w.conditions).toEqual({ heat: 'extreme', humidity: 'very_dry', uv: 'very_high' });
    expect(w.sun?.sunriseMs).toBe(at('2026-11-13T11:46:00Z'));
  });

  it('beyond the forecast is unavailable, not guessed', () => {
    const w = parseDestinationWeather(providerBody, at('2026-11-12T15:00:00Z'), at('2026-11-20T15:00:00Z'));
    expect(w.failure).toBe('beyond_forecast');
    expect(w.temperatureC).toEqual({ value: null, source: 'unavailable' });
  });

  it('garbage is unavailable', () => {
    expect(parseDestinationWeather(null, 0, 0).failure).toBe('invalid_response');
    expect(parseDestinationWeather({ current: {} }, 0, 0).failure).toBe('invalid_response');
  });

  it('no coordinates → no request at all', async () => {
    let calls = 0;
    const w = await getDestinationWeather(placeForAirport('LIS', 'Europe/Lisbon'), Date.now(), {
      fetch: async () => { calls++; return { ok: true, json: async () => providerBody }; },
    });
    expect(w).toEqual(unavailableWeather('no_coordinates'));
    expect(calls).toBe(0);
  });

  it('network failure is unavailable — never a mock', async () => {
    const w = await getDestinationWeather(MIAMI, Date.now(), { fetch: async () => { throw new Error('offline'); } });
    expect(w.failure).toBe('network');
    expect(w.temperatureC.source).toBe('unavailable');
    const notOk = await getDestinationWeather(MIAMI, Date.now(), { fetch: async () => ({ ok: false, json: async () => ({}) }) });
    expect(notOk.failure).toBe('network');
  });

  it('caches one response per destination', async () => {
    let calls = 0;
    const now = () => at('2026-11-12T15:10:00Z');
    const f = async (url: string) => {
      calls++;
      expect(url).toContain('latitude=25.7617');
      expect(url).toContain('timezone=auto');
      return { ok: true, json: async () => providerBody };
    };
    await getDestinationWeather(MIAMI, now(), { fetch: f, now });
    const again = await getDestinationWeather(MIAMI, now(), { fetch: f, now });
    expect(calls).toBe(1);
    expect(again.temperatureC.value).toBe(28);
  });
});

describe('arrival confirmations', () => {
  const now = at('2026-11-12T16:00:00Z');

  it('confirm, ready, undo', () => {
    const d1 = confirmArrival(doc(), 'trip1', '2026-11-12T15:20:00Z', now);
    expect(confirmationsFor(d1, 'trip1')).toEqual({ arrivalConfirmedAtIso: '2026-11-12T15:20:00Z', readyAtIso: null });
    const d2 = markReady(d1, 'trip1', '2026-11-12T15:50:00Z', now);
    expect(confirmationsFor(d2, 'trip1').readyAtIso).toBe('2026-11-12T15:50:00Z');
    expect(confirmationsFor(undoArrival(d2, 'trip1'), 'trip1')).toEqual({ arrivalConfirmedAtIso: null, readyAtIso: null });
  });

  it('rejects future times, unknown trips, and ready before arrival', () => {
    expect(() => confirmArrival(doc(), 'trip1', '2026-11-12T17:00:00Z', now)).toThrow();
    expect(() => confirmArrival(doc(), 'nope', '2026-11-12T15:20:00Z', now)).toThrow();
    expect(() => markReady(doc(), 'trip1', '2026-11-12T15:50:00Z', now)).toThrow('Confirm your arrival first.');
    const d1 = confirmArrival(doc(), 'trip1', '2026-11-12T15:20:00Z', now);
    expect(() => markReady(d1, 'trip1', '2026-11-12T15:10:00Z', now)).toThrow();
  });

  it('a provider-reported landing counts as an arrival fact', () => {
    const snapshot: TravelSnapshot = {
      version: 2, provider: 'flightaware', availability: 'available', fetchedAt: '2026-11-12T15:30:00Z',
      flight: {
        ...flight, status: 'landed', scheduledDeparture: null, estimatedDeparture: null,
        departureGate: null, departureTerminal: null, scheduledArrival: null, estimatedArrival: null,
        actualArrival: '2026-11-12T15:05:00Z', actualDeparture: '2026-11-12T12:10:00Z',
        originTimeZone: 'America/New_York', destinationTimeZone: 'America/New_York',
      },
    };
    const d = doc({ observations: { leg1: { identity: 'x', snapshot } } });
    expect(arrivalFactMs(d, trip, now)).toBe(at('2026-11-12T15:05:00Z'));
    expect(() => markReady(d, 'trip1', '2026-11-12T15:40:00Z', now)).not.toThrow();
    const state = deriveTripTravelState(trip, legSnapshots(d), now, confirmationsFor(d, 'trip1'));
    expect(state).toMatchObject({ state: 'acclimating', arrivalSource: 'live' });
  });

  it('old documents without arrivals still parse; confirmations for removed trips are pruned', async () => {
    const legacy = { ...emptyTravelDocument() } as Record<string, unknown>;
    delete legacy.arrivals;
    expect(travelDocumentSchema.parse(legacy).arrivals).toEqual({});

    const data = new Map<string, string>();
    const store = {
      getItem: async (k: string) => data.get(k) ?? null,
      setItem: async (k: string, v: string) => { data.set(k, v); },
      removeItem: async (k: string) => { data.delete(k); },
    };
    const docs = createTravelDocuments(store);
    const d = confirmArrival(doc(), 'trip1', '2026-11-12T15:20:00Z', now);
    await docs.save('owner', { ...d, arrivals: { ...d.arrivals, gone: { arrivalConfirmedAt: null, readyAt: null } } });
    expect(Object.keys((await docs.load('owner')).arrivals)).toEqual(['trip1']);
  });
});

describe('next commitment and the arrival plan', () => {
  const m = (id: string, startAtIso: string, over: Partial<Moment> = {}): Moment => ({
    id, source: 'manual', title: id, type: 'work', importance: 'high', startAtIso, createdAtIso: '2026-11-01T00:00:00Z', ...over,
  });

  it('finds the first real commitment within the horizon', () => {
    const moments = [
      m('travel2:trip1:leg1:arrival', '2026-11-12T16:00:00Z', { type: 'recovery' }),
      m('flight', '2026-11-12T16:30:00Z', { type: 'travel' }),
      m('private', '2026-11-12T16:45:00Z', { masked: true }),
      m('lunch', '2026-11-12T18:00:00Z'),
      m('dinner', '2026-11-12T23:00:00Z'),
      m('tomorrow', '2026-11-13T14:00:00Z'),
    ];
    expect(nextCommitmentAfter(moments, at('2026-11-12T15:12:00Z'))).toBe(at('2026-11-12T18:00:00Z'));
    expect(nextCommitmentAfter([m('late', '2026-11-13T09:00:00Z')], at('2026-11-12T15:12:00Z'))).toBeNull();
  });

  it('Miami plan line in destination time, with LOCK-IN before the 1 PM', () => {
    const plan = tripArrivalPlan(trip, {
      conditions: { heat: 'warm', humidity: 'humid', uv: 'high' },
      nextCommitmentMs: at('2026-11-12T18:00:00Z'),
    })!;
    expect(plan.line).toBe(
      // Warm + humid counts as heat strain in the T1 engine: top of the range.
      'Pause 10:27 AM · Hydrate 10:37 AM: 16 oz + 1 electrolyte · Reset 11:12 AM: 10 min on your feet, in shade · LOCK-IN 12:45 PM',
    );
  });

  it('without context: standard steps, no weather claims, no LOCK-IN', () => {
    const plan = tripArrivalPlan(trip)!;
    expect(plan.line).toBe('Pause 10:27 AM · Hydrate 10:37 AM: 12–16 oz · Reset 11:12 AM: 10 min on your feet');
    expect(arrivalPlanLine([], 'America/New_York')).toBe('');
  });

  it('plan copy passes the consumer copy guards', () => {
    const line = tripArrivalPlan(trip, {
      conditions: { heat: 'hot', humidity: 'very_dry', uv: 'extreme' },
      nextCommitmentMs: at('2026-11-12T19:00:00Z'),
    })!.line;
    const goal = `Destination time Nov 12, 10:12 AM EST. Your arrival plan: ${line}.`;
    expect(consumerCopyBlocked(goal)).toBe(false);
    expect(evaluateDeliverableCopy(goal).verdict).not.toBe('blocked');
  });

  it('the final arrival Moment carries the plan; connections keep the old line', () => {
    const [, arrival] = tripMoments([trip], { trip1: { conditions: { heat: null, humidity: null, uv: null }, nextCommitmentMs: null } });
    expect(arrival.prepGoal).toContain('Your arrival plan: Pause 10:27 AM');
    const twoLeg: TravelTrip = {
      ...trip,
      legs: [
        { ...trip.legs[0], id: 'a', flight: { ...flight, destination: 'ATL' }, arrivalAt: '2026-11-12T14:20:00Z' },
        { ...trip.legs[0], id: 'b', flight: { ...flight, flightNumber: 'DL55', origin: 'ATL' }, departureAt: '2026-11-12T15:30:00Z', arrivalAt: '2026-11-12T17:20:00Z' },
      ],
    };
    const goals = tripMoments([twoLeg]).filter((x) => x.type === 'recovery').map((x) => x.prepGoal);
    expect(goals[0]).toContain('Follow your existing AForce recovery guidance.');
    expect(goals[1]).toContain('Your arrival plan:');
    expect(tripArrivalPlan({ ...trip, legs: [{ ...trip.legs[0], arrivalAt: null }] })).toBeNull();
  });
});
