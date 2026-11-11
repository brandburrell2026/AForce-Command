import { TRAVEL_FRESHNESS_MS } from '@workspace/api-zod';
import type { ReportedFlightStatus } from '@/services/travel/flightStatus';

const STATUS: Record<ReportedFlightStatus['flight']['status'], string> = {
  scheduled: 'Scheduled', boarding: 'Boarding reported', delayed: 'Delayed', departed: 'Departed',
  in_air: 'In the air', landed: 'Landed', cancelled: 'Cancelled', diverted: 'Diverted', unknown: 'Status not reported',
};
export function travelStatusPresentation(input: { data?: ReportedFlightStatus; failed: boolean; reason?: string; now: number }) {
  if (input.data) {
    const age = input.now - Date.parse(input.data.fetchedAt);
    if (age < -30_000) return { title: 'Status unavailable', evidence: 'The provider timestamp could not be verified.', stale: false, showObservation: false };
    const stale = input.failed || input.data.availability === 'stale' || age >= TRAVEL_FRESHNESS_MS;
    return {
      title: STATUS[input.data.flight.status], stale, showObservation: true,
      evidence: `${stale ? 'Last known result' : 'Provider result'} · FlightAware · fetched ${input.data.fetchedAt}`,
    };
  }
  const reasons: Record<string, string> = {
    unauthorized: 'Sign in again to check flight status.',
    not_connected: 'Flight status is not connected for this pilot yet.',
    not_enabled: 'Flight status is not enabled for this pilot yet.',
    not_found: 'No matching flight was found for this date.',
    mismatch: 'The result did not match your flight, airports and departure date.',
    rate_limited: 'Too many checks. Wait a minute and try again.',
    invalid_response: 'The flight result could not be verified.',
  };
  return {
    title: input.failed ? 'Status unavailable' : 'Check your flight', stale: false, showObservation: false,
    evidence: input.failed ? reasons[input.reason ?? ''] ?? 'We couldn’t check flight status. Your saved itinerary is still available.'
      : 'Check FlightAware through TravelGate. This sends your flight number, airports and departure date to the travel service.',
  };
}
