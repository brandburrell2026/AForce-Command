/**
 * Trip hand-off (pure): when words said to One Breath are a trip, where they go.
 *
 * A flight is a trip, not an ordinary Moment. Travel's own entry takes the
 * sentence, fills in what it understood, asks only for what is missing, and
 * saves nothing until the member confirms. One Breath only hands the words
 * over; it reads no flight detail itself and saves nothing.
 *
 * Not handed off: while One Breath is in the middle of something (a plan or a
 * drink it is asking about), where Travel is not available, and when the words
 * are not a trip.
 */
import { isTripSentence } from '@/utils/travel/tripWords';
import type { OneBreathState } from './session';

export type TripRoute = { pathname: '/travel-intelligence'; params: { trip: string } };

export function tripHandoff(
  words: string,
  args: { session: Pick<OneBreathState, 'pendingPlan' | 'asking' | 'askingDrink' | 'scanned'>; travelAvailable: boolean; now: Date },
): TripRoute | null {
  if (!args.travelAvailable) return null;
  const { pendingPlan, asking, askingDrink, scanned } = args.session;
  // An answer to an open question, or a reply to a read-back, is not a new request.
  if (pendingPlan || asking || askingDrink || scanned) return null;
  if (!isTripSentence(words, args.now)) return null;
  return { pathname: '/travel-intelligence', params: { trip: words } };
}
