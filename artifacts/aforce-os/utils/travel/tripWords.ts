/**
 * Trip words — whether a sentence said to One Breath is a flight, so it can be
 * handed to "Tell AFORCE your trip" with the words carried over (pure).
 *
 * Deliberately narrow. A sentence is a trip only when it names a flight
 * number, or uses a flying word together with an airport, a city AFORCE knows
 * or an airline. "Flight Friday at 6" with no place stays an ordinary Moment,
 * exactly as before, so nothing that plans a Moment today is taken away.
 */
import { parseSpokenTrip } from './spokenTrip';

const FLYING = /\b(fly|flying|flight|flights|flew)\b/;

export function isTripSentence(words: string, now: Date): boolean {
  const trip = parseSpokenTrip(words, now);
  if (trip.fields.flightNumber) return true;
  if (!FLYING.test(words.toLowerCase())) return false;
  return !!(trip.fields.origin || trip.fields.destination || trip.airline || trip.open?.some((g) => g.kind === 'several'));
}
