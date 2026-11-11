/**
 * Travel Intelligence — travel state (T1, pure engine).
 *
 * Derives which travel state to show for an existing, governed `TravelTrip`
 * (@workspace/api-zod, PR-TRAVEL-INTELLIGENCE) from:
 *  - the member-confirmed leg times (the plan),
 *  - FlightAware snapshots that match a leg (observations), and
 *  - the member's own confirmations (arrived / ready).
 *
 * Honesty rules:
 *  - The PLAN never moves here. A provider's estimated times are not applied;
 *    changed times go through the existing `travelProposal` member review.
 *    Only things that already HAPPENED — an actual departure or actual
 *    arrival reported for the matching flight — are used as observations.
 *  - Arrival is never assumed from the clock. Past the planned arrival the
 *    state stays 'arriving' until the provider reports an actual arrival or
 *    the member confirms it.
 *  - A cancelled or diverted report never changes the state silently; it
 *    sets `needsReview` so the UI asks the member.
 *  - "In transit" means between the trip's first departure and last arrival.
 *    It says nothing about aircraft position.
 */

import {
  matchesTravelFlight,
  type TravelLeg,
  type TravelSnapshot,
  type TravelTrip,
} from '@workspace/api-zod';

import {
  TRAVEL_ACCLIMATING_MAX_HOURS,
  TRAVEL_ARRIVING_WINDOW_MIN,
  TRAVEL_NO_ARRIVAL_TIME_MAX_HOURS,
  TRAVEL_PREPARING_HORIZON_HOURS,
  TRAVEL_READY_SURFACE_HOURS,
  TRAVEL_UNCONFIRMED_ARRIVAL_MAX_HOURS,
} from '../../config/hydroStateModel';
import type { Provenance, TravelState } from './travelTypes';

const HOUR = 3_600_000;
const MIN = 60_000;

export type TravelStateReason =
  | 'invalid_times'
  | 'completed'
  | 'too_early'
  | 'before_departure'
  | 'scheduled_in_transit'
  | 'departed_reported'
  | 'arrival_window'
  | 'awaiting_confirmation'
  | 'unconfirmed_expired'
  | 'arrived'
  | 'marked_ready'
  | 'acclimating_elapsed'
  | 'ready_expired';

/** Member-owned confirmations (stored by the data layer, T2). */
export interface TravelConfirmations {
  arrivalConfirmedAtIso?: string | null;
  readyAtIso?: string | null;
}

export interface TravelStateResult {
  state: TravelState;
  reason: TravelStateReason;
  /** Index of the leg the member is on or about to take; null when none. */
  legIndex: number | null;
  /** ms until first planned departure (negative once past), null if invalid. */
  msToDeparture: number | null;
  /** ms until last planned arrival (negative after), null if unknown. */
  msToArrival: number | null;
  /** 0..1 share of the PLANNED trip elapsed while in transit, else null. */
  plannedProgress: number | null;
  /** Where the arrival fact came from, once arrived. */
  arrivalSource: Extract<Provenance, 'live' | 'member'> | null;
  /** A matching provider report says cancelled or diverted: ask the member. */
  needsReview: boolean;
}

/** Snapshots keyed by leg id, as the data layer stores them. */
export type LegSnapshots = Readonly<Record<string, TravelSnapshot | null | undefined>>;

function ms(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const v = Date.parse(iso);
  return Number.isFinite(v) ? v : null;
}

/** A snapshot is usable only if it reports on exactly this leg's flight. */
function matching(leg: TravelLeg, snapshots: LegSnapshots): TravelSnapshot | null {
  const s = snapshots[leg.id];
  return s && matchesTravelFlight(leg.flight, s.flight) ? s : null;
}

/** An event the provider says already happened (not in the future). */
function happened(iso: string | null | undefined, nowMs: number): number | null {
  const v = ms(iso);
  return v != null && v <= nowMs ? v : null;
}

export function deriveTripTravelState(
  trip: TravelTrip,
  snapshots: LegSnapshots,
  nowMs: number,
  confirmations: TravelConfirmations = {},
): TravelStateResult {
  const none = (reason: TravelStateReason, extra: Partial<TravelStateResult> = {}): TravelStateResult => ({
    state: 'none',
    reason,
    legIndex: null,
    msToDeparture: null,
    msToArrival: null,
    plannedProgress: null,
    arrivalSource: null,
    needsReview: false,
    ...extra,
  });

  const legs = trip.legs;
  const first = legs[0];
  const last = legs[legs.length - 1];
  const depart = first ? ms(first.departureAt) : null;
  if (!first || !last || depart == null || !Number.isFinite(nowMs)) return none('invalid_times');
  if (trip.completedAt) return none('completed');

  const plannedArrival = ms(last.arrivalAt);
  const lastSnap = matching(last, snapshots);
  const needsReview = legs.some((leg) => {
    const s = matching(leg, snapshots);
    return s != null && (s.flight.status === 'cancelled' || s.flight.status === 'diverted');
  });

  // Facts that already happened.
  const memberArrival = happened(confirmations.arrivalConfirmedAtIso, nowMs);
  const providerArrival = lastSnap ? happened(lastSnap.flight.actualArrival, nowMs) : null;
  const arrivedAt = memberArrival ?? providerArrival;
  const arrivalSource: TravelStateResult['arrivalSource'] =
    memberArrival != null ? 'member' : providerArrival != null ? 'live' : null;
  const firstSnap = matching(first, snapshots);
  const departedReported = firstSnap ? happened(firstSnap.flight.actualDeparture, nowMs) != null : false;

  const base = {
    msToDeparture: depart - nowMs,
    msToArrival: plannedArrival != null ? plannedArrival - nowMs : null,
    plannedProgress: null,
    arrivalSource,
    needsReview,
  };

  // Which leg is current: the last one whose departure has passed, else the first.
  let legIndex = 0;
  legs.forEach((leg, i) => {
    const d = ms(leg.departureAt);
    if (d != null && d <= nowMs) legIndex = i;
  });

  if (arrivedAt != null) {
    const ready = happened(confirmations.readyAtIso, nowMs);
    const readyStart =
      ready != null && ready >= arrivedAt
        ? ready
        : nowMs - arrivedAt >= TRAVEL_ACCLIMATING_MAX_HOURS * HOUR
          ? arrivedAt + TRAVEL_ACCLIMATING_MAX_HOURS * HOUR
          : null;
    const lastIdx = legs.length - 1;
    if (readyStart == null) return { ...base, state: 'acclimating', reason: 'arrived', legIndex: lastIdx };
    if (nowMs - readyStart >= TRAVEL_READY_SURFACE_HOURS * HOUR) return none('ready_expired', base);
    return {
      ...base,
      state: 'ready',
      reason: ready != null && readyStart === ready ? 'marked_ready' : 'acclimating_elapsed',
      legIndex: lastIdx,
    };
  }

  if (!departedReported && nowMs < depart - TRAVEL_PREPARING_HORIZON_HOURS * HOUR) {
    return none('too_early', base);
  }
  if (!departedReported && nowMs < depart) {
    return { ...base, state: 'preparing', reason: 'before_departure', legIndex: 0 };
  }

  // Departed (by plan or by report), not yet arrived.
  if (plannedArrival == null) {
    // No arrival time on the plan: in transit until a fact arrives, bounded.
    if (nowMs - depart >= TRAVEL_NO_ARRIVAL_TIME_MAX_HOURS * HOUR) return none('unconfirmed_expired', base);
    return {
      ...base,
      state: 'in_transit',
      reason: departedReported ? 'departed_reported' : 'scheduled_in_transit',
      legIndex,
    };
  }
  if (nowMs < plannedArrival - TRAVEL_ARRIVING_WINDOW_MIN * MIN) {
    return {
      ...base,
      state: 'in_transit',
      reason: departedReported ? 'departed_reported' : 'scheduled_in_transit',
      legIndex,
      plannedProgress: Math.min(1, Math.max(0, (nowMs - depart) / (plannedArrival - depart))),
    };
  }
  if (nowMs < plannedArrival) return { ...base, state: 'arriving', reason: 'arrival_window', legIndex };
  if (nowMs - plannedArrival < TRAVEL_UNCONFIRMED_ARRIVAL_MAX_HOURS * HOUR) {
    return { ...base, state: 'arriving', reason: 'awaiting_confirmation', legIndex };
  }
  return none('unconfirmed_expired', base);
}
