import type { FeatureFlags } from '@/types';
import { travelPilotAvailable, type UnlockContext } from '@/featureFlags/flags';
import { isTripSentence } from '@/utils/travel/tripWords';
import type { OneBreathState } from './session';

/** A new flight may leave the idle conversation; an unfinished request stays with its owner. */
export function oneBreathTripRoute(args: {
  words: string;
  flags: Pick<FeatureFlags, 'travel_mode_enabled'>;
  session: OneBreathState;
  hasOpenPlan: boolean;
  unsafe: boolean;
  now: Date;
  context?: UnlockContext;
}) {
  const s = args.session;
  if (
    args.unsafe || args.hasOpenPlan || s.pendingPlan || s.asking || s.askingDrink ||
    s.pendingDrink || s.scanned || s.lockedIn || s.outbox.some((item) => item.state === 'pending') ||
    !travelPilotAvailable(args.flags, args.context) || !isTripSentence(args.words, args.now)
  ) return null;

  return { pathname: '/travel-intelligence' as const, params: { trip: args.words } };
}
