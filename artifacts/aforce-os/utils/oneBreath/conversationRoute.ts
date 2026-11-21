/**
 * Where One Breath opens (pure).
 *
 * In internal builds One Breath opens on the conversation screen, as the
 * approved prototype does in every state: a new plan, a sealed plan waiting
 * for Lock In, and a plan in Quiet are all shown there.
 *
 * The existing screens are kept for what the conversation does not do: a
 * Moment opened by id (which is also where Replay is), a calendar proposal,
 * and a One Breath plan that was saved but never sealed.
 */
import type { Moment } from '@/types/moments';
import { openOneBreathPlan, openPlanPhase } from './openPlan';

export function oneBreathOpensConversation(args: {
  /** `preparationPreviewEnabled()`: internal builds only. */
  internal: boolean;
  momentId?: string;
  proposal?: string;
  /** The Moments store has loaded. Until it has, nothing is decided. */
  hydrated: boolean;
  moments: readonly Moment[];
}): boolean {
  if (!args.internal || !args.hydrated) return false;
  if (args.momentId || args.proposal) return false;
  const open = openOneBreathPlan(args.moments);
  return !open || openPlanPhase(open) !== 'draft';
}
