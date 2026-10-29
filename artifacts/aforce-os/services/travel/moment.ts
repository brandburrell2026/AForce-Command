import type { Moment } from '@/types/moments';
import type { TravelJourney } from './journey';

/** A device-local projection; never duplicate the itinerary in the Moments store. */
export const TRAVEL_MOMENT_ID = 'travel-journey-v1';
export function travelMoment(journey: TravelJourney | null | undefined): Moment | null {
  if (!journey || journey.completedAt) return null;
  return {
    id: TRAVEL_MOMENT_ID, source: 'manual', type: 'travel', importance: 'moderate',
    title: `${journey.details.origin} → ${journey.details.destination} · ${journey.details.flightNumber}`,
    startAtIso: journey.departureAt, createdAtIso: journey.createdAt,
    prepGoal: `Manually entered departure: ${journey.details.departureDate} ${journey.details.departureTime} (UTC${journey.details.utcOffset}). Open Travel for your journey.`,
  };
}
export function mergeTravelMoment(moments: readonly Moment[], journey: TravelJourney | null | undefined): Moment[] {
  const linked = travelMoment(journey);
  // Hide only the explicit manual "Flight to DEST" for the same departure.
  // This is a display merge, never deletion or mutation of the saved Moment.
  const duplicate = (moment: Moment) => !!journey && moment.source === 'manual' && moment.type === 'travel'
    && Date.parse(moment.startAtIso) === Date.parse(journey.departureAt)
    && moment.title.trim().replace(/\s+/g, ' ').toUpperCase() === `FLIGHT TO ${journey.details.destination}`;
  const matching = moments.find(duplicate);
  return [
    ...moments.filter(moment => moment.id !== TRAVEL_MOMENT_ID && !duplicate(moment)),
    ...(linked ? [{ ...linked, ...(matching?.preparedAtIso ? { preparedAtIso: matching.preparedAtIso } : {}) }] : []),
  ];
}
