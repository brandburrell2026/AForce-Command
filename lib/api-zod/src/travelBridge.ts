/** Versioned, deliberately small TravelGate ↔ AForce flight-status contract.
 * No account, health, booking, passenger or subscription data crosses this API. */
import { z } from 'zod';

const dateKey = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => {
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}, 'Invalid departure date');
const airport = z.string().regex(/^[A-Z]{3}$/);
const travelFlightFields = {
  flightNumber: z.string().trim().toUpperCase().transform(value => value.replace(/\s/g, '')).pipe(z.string().regex(/^[A-Z0-9]{2,3}\d{1,4}[A-Z]?$/)),
  departureDate: dateKey,
  origin: airport,
  destination: airport,
};
export const travelFlightRequestSchema = z.object(travelFlightFields).strict().refine(input => input.origin !== input.destination, 'Airports must differ');
export type TravelFlightRequest = z.infer<typeof travelFlightRequestSchema>;

export const TRAVEL_FRESHNESS_MS = 120_000;
const timestamp = z.string().datetime({ offset: true });
export const travelFlightObservationSchema = z.object({
  ...travelFlightFields,
  status: z.enum(['scheduled', 'boarding', 'delayed', 'departed', 'in_air', 'landed', 'cancelled', 'diverted', 'unknown']),
  scheduledDeparture: timestamp.nullable(),
  estimatedDeparture: timestamp.nullable(),
  departureGate: z.string().max(40).nullable(),
  departureTerminal: z.string().max(40).nullable(),
}).strict();
export const travelFlightResponseSchema = z.discriminatedUnion('availability', [
  z.object({
    version: z.literal(1), availability: z.enum(['available', 'stale']),
    provider: z.literal('flightaware'), fetchedAt: timestamp,
    flight: travelFlightObservationSchema,
  }).strict(),
  z.object({
    version: z.literal(1), availability: z.literal('unavailable'),
    reason: z.enum(['not_connected', 'provider_unavailable', 'not_found', 'mismatch', 'invalid_response', 'rate_limited', 'unauthorized', 'not_enabled']),
  }).strict(),
]);
export type TravelFlightResponse = z.infer<typeof travelFlightResponseSchema>;
export type TravelFlightObservation = z.infer<typeof travelFlightObservationSchema>;
export function unavailableFlight(reason: Extract<TravelFlightResponse, { availability: 'unavailable' }>['reason']): TravelFlightResponse {
  return { version: 1, availability: 'unavailable', reason };
}
export function matchesTravelFlight(request: TravelFlightRequest, flight: TravelFlightObservation): boolean {
  return request.flightNumber === flight.flightNumber && request.departureDate === flight.departureDate
    && request.origin === flight.origin && request.destination === flight.destination;
}
export function ageTravelFlight(response: TravelFlightResponse, now = Date.now()): TravelFlightResponse {
  if (response.availability === 'unavailable') return response;
  const age = now - Date.parse(response.fetchedAt);
  if (age < -30_000) return unavailableFlight('invalid_response');
  return age >= TRAVEL_FRESHNESS_MS ? { ...response, availability: 'stale' } : response;
}
