/**
 * Travel Intelligence 2.0 — journey view model (T3, pure).
 *
 * Picks the trip to show and turns the T1 engine + T2 data into exactly what
 * the journey view renders. No React, no I/O, no Date.now(): the screen
 * passes the instant in. Every number carries its source label; a missing
 * value is a dash with "Unavailable", never a stand-in.
 *
 * Views follow the site's Moment flow (joinaforce.com/aforce-os):
 *   preview  — before departure ("Your next destination awaits.")
 *   lock_in  — in transit / arriving: LOCK-IN, AFORCE goes quiet
 *   arrival  — first open after landing: the city, "New city. Same standard."
 *   ready    — the member said they're ready (or the window ended)
 */

import type { TravelTrip } from '@workspace/api-zod';

import { atmosphereFor, placeForAirport, type Atmosphere } from './cityRegistry';
import { daypartAt, localTimeParts, timeDifferenceHours, type SunTimes } from './travelTime';
import { deriveTripTravelState, type LegSnapshots, type TravelConfirmations, type TravelStateResult } from './travelState';
import type { Sourced, TravelPlace } from './travelTypes';
import { travelTone } from '@/theme/travelTokens';

export type JourneyViewKind = 'preview' | 'lock_in' | 'arrival' | 'ready';

/** Minimal weather shape the view needs (services/travel/destinationWeather). */
export interface JourneyWeather {
  temperatureC: Sourced<number>;
  humidityPct: Sourced<number>;
  sun: SunTimes | null;
  stale: boolean;
}

export interface JourneyRow {
  label: string;
  value: string;
  /** Plain-language source, e.g. "Live", "Forecast", "Your itinerary". */
  source: string;
}

export interface JourneyView {
  kind: JourneyViewKind;
  tripId: string;
  /** Id of the final arrival Moment (the seal flow lives there). */
  arrivalMomentId: string | null;
  needsReview: boolean;
  eyebrow: string;
  cityName: string;
  atmosphere: Atmosphere;
  /** Background tone for the type-only treatment, by daypart. */
  tone: string;
  headline: string;
  subline: string;
  rows: JourneyRow[];
  /** 0..1 planned progress while in transit, else null. */
  progress: number | null;
  progressCaption: string | null;
  state: TravelStateResult;
}

export interface JourneyInput {
  trips: readonly TravelTrip[];
  snapshots: LegSnapshots;
  confirmations: (tripId: string) => TravelConfirmations;
  nowMs: number;
  weather?: JourneyWeather | null;
}

/** Type-only atmosphere tones live in the theme (theme/travelTokens.ts). */
export const DAYPART_TONE = travelTone;

const PRIORITY: Record<string, number> = { in_transit: 0, arriving: 0, acclimating: 1, ready: 2, preparing: 3 };

function clock(ms: number, zone: string): string {
  return new Intl.DateTimeFormat('en-US', { timeZone: zone, hour: 'numeric', minute: '2-digit' }).format(new Date(ms));
}
function dayLabel(ms: number, zone: string): string {
  return new Intl.DateTimeFormat('en-US', { timeZone: zone, weekday: 'short', month: 'short', day: 'numeric' }).format(new Date(ms));
}
function sourceLabel(s: Sourced<unknown>): string {
  return s.source === 'live' ? 'Live' : s.source === 'forecast' ? 'Forecast' : 'Unavailable';
}
const f = (c: number) => Math.round((c * 9) / 5 + 32);

export function diffLabel(hours: number | null, origin: string): string {
  if (hours == null) return 'Time difference unavailable';
  if (hours === 0) return `Same time as ${origin}`;
  const h = Math.abs(hours);
  const n = Number.isInteger(h) ? `${h}h` : `${Math.floor(h)}h ${Math.round((h % 1) * 60)}m`;
  return `${n} ${hours > 0 ? 'ahead of' : 'behind'} ${origin}`;
}

function countdown(ms: number): string {
  const totalMin = Math.max(0, Math.round(ms / 60_000));
  const d = Math.floor(totalMin / 1440);
  const h = Math.floor((totalMin % 1440) / 60);
  const m = totalMin % 60;
  return d > 0 ? `${d}d ${h}h` : h > 0 ? `${h}h ${m}m` : `${m}m`;
}

/** The trip to show: in transit first, then just arrived, ready, preparing. */
export function focusTrip(input: JourneyInput): { trip: TravelTrip; state: TravelStateResult } | null {
  let best: { trip: TravelTrip; state: TravelStateResult; rank: number; dep: number } | null = null;
  for (const trip of input.trips) {
    const state = deriveTripTravelState(trip, input.snapshots, input.nowMs, input.confirmations(trip.id));
    if (state.state === 'none') continue;
    const rank = PRIORITY[state.state] ?? 9;
    const dep = Date.parse(trip.legs[0]?.departureAt ?? '');
    if (!best || rank < best.rank || (rank === best.rank && dep < best.dep)) best = { trip, state, rank, dep };
  }
  return best ? { trip: best.trip, state: best.state } : null;
}

function weatherRows(w: JourneyWeather | null | undefined): JourneyRow[] {
  if (!w) return [{ label: 'Weather', value: '—', source: 'Unavailable' }];
  const t = w.temperatureC;
  const h = w.humidityPct;
  const old = w.stale ? ' · older reading' : '';
  return [
    { label: 'Temperature', value: t.value == null ? '—' : `${f(t.value)}°F`, source: sourceLabel(t) + (t.value == null ? '' : old) },
    { label: 'Humidity', value: h.value == null ? '—' : `${Math.round(h.value)}%`, source: sourceLabel(h) + (h.value == null ? '' : old) },
  ];
}

export function journeyView(input: JourneyInput): JourneyView | null {
  const focus = focusTrip(input);
  if (!focus) return null;
  const { trip, state } = focus;
  const first = trip.legs[0]!;
  const last = trip.legs[trip.legs.length - 1]!;
  const dest: TravelPlace = placeForAirport(last.flight.destination, last.destinationTimeZone);
  const originCity = placeForAirport(first.flight.origin, first.originTimeZone).name;
  const zone = last.destinationTimeZone;
  const now = input.nowMs;
  const departMs = Date.parse(first.departureAt);
  const arriveMs = Date.parse(last.arrivalAt ?? '');

  const viewKind: JourneyViewKind =
    state.state === 'preparing' ? 'preview'
      : state.state === 'in_transit' || state.state === 'arriving' ? 'lock_in'
        : state.state === 'acclimating' ? 'arrival'
          : 'ready';

  // Daypart at the destination for the moment that matters on screen.
  const daypartMs = viewKind === 'preview' && Number.isFinite(arriveMs) ? arriveMs : now;
  const daypart = daypartAt(daypartMs, zone, input.weather?.sun ?? null);
  const atmosphere = atmosphereFor(dest, daypart);
  const tone = daypart ? travelTone[daypart] : travelTone.unknown;

  const diff = timeDifferenceHours(first.originTimeZone, zone, now);
  const route = `${first.flight.origin} to ${last.flight.destination}`;
  const arrivalMomentId = last.arrivalAt ? `travel2:${trip.id}:${last.id}:arrival` : null;
  const base = {
    tripId: trip.id,
    arrivalMomentId,
    needsReview: state.needsReview,
    cityName: dest.name,
    atmosphere,
    tone,
    state,
  };

  if (viewKind === 'preview') {
    return {
      ...base,
      kind: 'preview',
      eyebrow: `${dayLabel(departMs, first.originTimeZone)} · ${clock(departMs, first.originTimeZone)} · ${route}`,
      headline: dest.name,
      subline: 'Your next destination awaits.',
      rows: [
        { label: 'Departs in', value: countdown(departMs - now), source: 'Your itinerary' },
        { label: 'Time difference', value: diffLabel(diff, originCity), source: 'Computed' },
        ...weatherRows(input.weather),
      ],
      progress: null,
      progressCaption: null,
    };
  }

  if (viewKind === 'lock_in') {
    const awaiting = state.reason === 'awaiting_confirmation';
    return {
      ...base,
      kind: 'lock_in',
      eyebrow: `${route} · ${awaiting ? 'landing' : 'in transit'}`,
      headline: 'LOCK-IN',
      subline: awaiting
        ? 'Past your planned arrival. Confirm when you’ve landed.'
        : 'Between cities. Never between standards. AForce goes quiet until you land.',
      rows: Number.isFinite(arriveMs)
        ? [{ label: 'Planned arrival', value: `${clock(arriveMs, zone)} ${dest.name} time`, source: 'Your itinerary' }]
        : [{ label: 'Planned arrival', value: '—', source: 'Not on your itinerary' }],
      progress: state.plannedProgress,
      progressCaption: 'Planned times from your itinerary · not live tracking',
    };
  }

  const p = localTimeParts(now, zone);
  const local = p ? clock(now, zone) : '—';
  const arrivedBy = state.arrivalSource === 'live' ? 'Reported by your airline' : 'You confirmed';
  return {
    ...base,
    kind: viewKind,
    eyebrow: viewKind === 'arrival' ? `You’ve arrived · ${arrivedBy}` : `${dest.name} · ready`,
    headline: dest.name,
    subline: viewKind === 'arrival' ? 'New city. Same standard.' : 'Ready to perform.',
    rows: [
      { label: 'Local time', value: local, source: diffLabel(diff, originCity) },
      ...weatherRows(input.weather),
    ],
    progress: null,
    progressCaption: null,
  };
}
