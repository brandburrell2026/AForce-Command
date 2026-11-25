/**
 * Trip card — what the itinerary confirmation card shows for a draft, and the
 * form values a confirmed draft becomes (pure).
 *
 * The card states where every line came from: the member's own words. Nothing
 * on it has been checked with an airline, and the card says so. A field that
 * was not said is shown as missing, never filled with a guess.
 */
import type { SpokenTripFields } from './spokenTrip';
import { legComplete, tripDayLabel, tripTimeLabel, type TripDraft } from './tripTurn';

export interface TripCardRow {
  label: string;
  /** Null when the member has not said it yet. */
  value: string | null;
}

export interface TripCardLeg {
  heading: string;
  rows: TripCardRow[];
  /** A line under the rows when something was heard but cannot be saved as it is. */
  note?: string;
  complete: boolean;
}

export const TRIP_CARD_SOURCE = 'From what you said. Not checked with the airline.';
export const TRIP_CARD_MISSING = 'Needs you';

function rows(leg: SpokenTripFields): TripCardRow[] {
  const out: TripCardRow[] = [
    { label: 'Flight', value: leg.flightNumber ?? null },
    { label: 'From', value: leg.origin ?? null },
    { label: 'To', value: leg.destination ?? null },
    { label: 'Day', value: leg.date ? tripDayLabel(leg.date) : null },
    { label: 'Leaves', value: leg.time ? tripTimeLabel(leg.time) : null },
  ];
  // Arrival is optional: it gets a row only when the member said it.
  if (leg.arrivalTime) {
    out.push({ label: 'Arrives', value: `${leg.arrivalDate ? `${tripDayLabel(leg.arrivalDate)} · ` : ''}${tripTimeLabel(leg.arrivalTime)}` });
  }
  return out;
}

export function tripCardLegs(draft: TripDraft): TripCardLeg[] {
  return draft.legs.map((leg, i) => ({
    heading: i === 0 ? (draft.legs.length > 1 ? 'Way out' : 'Flight') : 'Way back',
    rows: rows(leg),
    note: leg.arrivalTime && !leg.arrivalDate ? 'The arrival day wasn’t said, so the arrival time won’t be saved. Add it in Edit details.' : undefined,
    complete: legComplete(leg),
  }));
}

/** "JFK → LAX · Nov 20": the name a saved trip gets, so nobody types one. */
export function legTitle(leg: SpokenTripFields): string {
  if (!leg.origin || !leg.destination) return '';
  return `${leg.origin} → ${leg.destination}${leg.date ? ` · ${tripDayLabel(leg.date).split(', ')[1]}` : ''}`;
}

export interface TripLegFormValues {
  flightNumber: string;
  origin: string;
  destination: string;
  date: string;
  time: string;
  arrivalDate: string;
  arrivalTime: string;
}

/**
 * A leg as the existing itinerary form holds it. An arrival time is carried
 * only with its date: the form will not save one without the other, and the
 * date is never assumed.
 */
export function legFormValues(leg: SpokenTripFields): TripLegFormValues {
  const arrival = !!leg.arrivalDate && !!leg.arrivalTime;
  return {
    flightNumber: leg.flightNumber ?? '',
    origin: leg.origin ?? '',
    destination: leg.destination ?? '',
    date: leg.date ?? '',
    time: leg.time ?? '',
    arrivalDate: arrival ? leg.arrivalDate! : '',
    arrivalTime: arrival ? leg.arrivalTime! : '',
  };
}

/** "Confirm trip", or "Confirm 2 trips" when there is a way back: each way is saved as its own trip. */
export const confirmLabel = (draft: TripDraft): string => (draft.legs.length > 1 ? `Confirm ${draft.legs.length} trips` : 'Confirm trip');
