/**
 * Travel Intelligence 2.0 — arrival data (T2 data layer).
 *
 *  - Member confirmations ("I've landed", "I'm ready") stored in the
 *    device-local travel document, never synced.
 *  - The bridge from that document to the pure T1 engine (state + snapshots).
 *  - The arrival plan line written into the existing arrival Moment.
 *
 * The plan line is the T1 arrival protocol rendered in destination time. It
 * names only steps the engine produced, and only the conditions that were
 * actually known. No sleep or light advice (pending science review).
 */

import type { TravelTrip } from '@workspace/api-zod';

import {
  TRAVEL_NEXT_COMMITMENT_HORIZON_HOURS,
  TRAVEL_RESET_MINUTES,
} from '@/config/hydroStateModel';
import type { Moment } from '@/types/moments';
import {
  buildArrivalProtocol,
  type ArrivalConditions,
  type ArrivalStep,
} from '@/utils/travel/arrivalProtocol';
import type { LegSnapshots, TravelConfirmations } from '@/utils/travel/travelState';
import type { TravelDocument } from './intelligence';

const HOUR = 3_600_000;

function activeTrip(doc: TravelDocument, tripId: string): TravelTrip {
  const trip = doc.trips.find((t) => t.id === tripId && !t.completedAt);
  if (!trip) throw new Error('Trip changed. Open Travel again.');
  return trip;
}

/** The member confirms they've landed. Never in the future. */
export function confirmArrival(doc: TravelDocument, tripId: string, atIso: string, nowMs = Date.now()): TravelDocument {
  activeTrip(doc, tripId);
  if (!(Date.parse(atIso) <= nowMs)) throw new Error('Arrival time cannot be in the future.');
  const prior = doc.arrivals[tripId];
  return {
    ...doc,
    arrivals: { ...doc.arrivals, [tripId]: { arrivalConfirmedAt: atIso, readyAt: prior?.readyAt ?? null } },
  };
}

/** The member undoes a mistaken arrival confirmation (and any ready mark). */
export function undoArrival(doc: TravelDocument, tripId: string): TravelDocument {
  const { [tripId]: _removed, ...rest } = doc.arrivals;
  return { ...doc, arrivals: rest };
}

/** The member says they're ready. Requires an arrival fact first. */
export function markReady(doc: TravelDocument, tripId: string, atIso: string, nowMs = Date.now()): TravelDocument {
  const trip = activeTrip(doc, tripId);
  const at = Date.parse(atIso);
  if (!(at <= nowMs)) throw new Error('Ready time cannot be in the future.');
  const arrived = arrivalFactMs(doc, trip, nowMs);
  if (arrived == null || at < arrived) throw new Error('Confirm your arrival first.');
  const prior = doc.arrivals[tripId];
  return {
    ...doc,
    arrivals: { ...doc.arrivals, [tripId]: { arrivalConfirmedAt: prior?.arrivalConfirmedAt ?? null, readyAt: atIso } },
  };
}

/** Snapshots by leg id, only where the stored identity still matches. */
export function legSnapshots(doc: TravelDocument): LegSnapshots {
  return Object.fromEntries(Object.entries(doc.observations).map(([legId, o]) => [legId, o.snapshot]));
}

export function confirmationsFor(doc: TravelDocument, tripId: string): TravelConfirmations {
  const a = doc.arrivals[tripId];
  return { arrivalConfirmedAtIso: a?.arrivalConfirmedAt ?? null, readyAtIso: a?.readyAt ?? null };
}

/** Earliest arrival fact: member confirmation or provider actual arrival. */
export function arrivalFactMs(doc: TravelDocument, trip: TravelTrip, nowMs = Date.now()): number | null {
  const facts: number[] = [];
  const member = Date.parse(doc.arrivals[trip.id]?.arrivalConfirmedAt ?? '');
  if (Number.isFinite(member) && member <= nowMs) facts.push(member);
  const last = trip.legs[trip.legs.length - 1];
  const actual = Date.parse(last ? doc.observations[last.id]?.snapshot.flight.actualArrival ?? '' : '');
  if (Number.isFinite(actual) && actual <= nowMs) facts.push(actual);
  return facts.length ? Math.min(...facts) : null;
}

/**
 * The next real commitment after landing: the earliest Moment that is not a
 * travel projection and starts after the arrival reset and within
 * TRAVEL_NEXT_COMMITMENT_HORIZON_HOURS. Null when there is none — the plan
 * then has no LOCK-IN step rather than an invented one.
 */
export function nextCommitmentAfter(moments: readonly Moment[], arrivalMs: number): number | null {
  const horizon = arrivalMs + TRAVEL_NEXT_COMMITMENT_HORIZON_HOURS * HOUR;
  let best: number | null = null;
  for (const m of moments) {
    if (m.id.startsWith('travel2:') || m.type === 'travel' || m.masked) continue;
    const at = Date.parse(m.startAtIso);
    if (!Number.isFinite(at) || at <= arrivalMs || at > horizon) continue;
    if (best == null || at < best) best = at;
  }
  return best;
}

export interface ArrivalContext {
  conditions: ArrivalConditions;
  nextCommitmentMs: number | null;
}

const NO_CONTEXT: ArrivalContext = { conditions: { heat: null, humidity: null, uv: null }, nextCommitmentMs: null };

function clock(ms: number, zone: string): string {
  return new Intl.DateTimeFormat('en-US', { timeZone: zone, hour: 'numeric', minute: '2-digit' }).format(new Date(ms));
}

/** One line per step, in destination time. Plain words; no claims. */
export function arrivalPlanLine(steps: readonly ArrivalStep[], zone: string): string {
  const parts: string[] = [];
  for (const s of steps) {
    if (s.atMs == null) continue;
    const at = clock(s.atMs, zone);
    if (s.key === 'pause') parts.push(`Pause ${at}`);
    if (s.key === 'hydrate' && s.ozRange) {
      const oz = s.ozRange.min === s.ozRange.max ? `${s.ozRange.min} oz` : `${s.ozRange.min}–${s.ozRange.max} oz`;
      parts.push(`Hydrate ${at}: ${oz}${s.electrolyte ? ' + 1 electrolyte' : ''}`);
    }
    if (s.key === 'reset') {
      parts.push(`Reset ${at}: ${TRAVEL_RESET_MINUTES} min on your feet${s.factors.includes('uv_high') ? ', in shade' : ''}`);
    }
    if (s.key === 'lock_in') parts.push(`LOCK-IN ${at}`);
  }
  return parts.join(' · ');
}

/** The arrival plan for a trip's final arrival, or null without an arrival time. */
export function tripArrivalPlan(trip: TravelTrip, context: ArrivalContext = NO_CONTEXT): { steps: ArrivalStep[]; line: string } | null {
  const last = trip.legs[trip.legs.length - 1];
  const arrivalMs = Date.parse(last?.arrivalAt ?? '');
  if (!last || !Number.isFinite(arrivalMs)) return null;
  const steps = buildArrivalProtocol({ arrivalMs, nextCommitmentMs: context.nextCommitmentMs, conditions: context.conditions });
  return { steps, line: arrivalPlanLine(steps, last.destinationTimeZone) };
}
