/**
 * Where One Breath opens (pure).
 *
 * In internal builds a NEW plan opens on the conversation screen. Everything
 * that already has a Moment keeps the existing screens: a Moment opened by id,
 * a calendar proposal, and any One Breath plan still open (sealed and waiting
 * for Lock In, in Quiet, or due a Replay). So Lock In, Quiet, Return and
 * Replay are exactly where they were, and there is still one open One Breath
 * plan at a time.
 */
import { preparationClosed } from '@/services/momentPreparationLifecycle';
import type { Moment } from '@/types/moments';

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
  return !args.moments.some((m) => m.preparation?.context === 'one_breath' && !preparationClosed(m.preparation));
}
