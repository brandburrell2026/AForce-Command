/**
 * "What's coming up first?" and the "Your first Moment" card on Home, as in
 * the approved prototype. Pure: the words and the rule for when the card
 * shows. The answer only chooses which card a new member sees; it feeds no
 * score, target or plan.
 *
 * The prototype offers five answers. "Sleep before a big day" is not offered
 * here: One Breath plans Moments (training, work, personal, travel…), and
 * there is no bedtime plan behind it to open.
 */

export type FirstMomentChoice = 'train' | 'work' | 'night' | 'travel';

export const FIRST_MOMENT_OPTIONS: ReadonlyArray<{ value: FirstMomentChoice; label: string }> = [
  { value: 'train', label: 'Training or a game' },
  { value: 'work', label: 'A big work moment' },
  { value: 'night', label: 'A night out' },
  { value: 'travel', label: 'A trip' },
];

export function parseFirstMomentChoice(raw: string | null | undefined): FirstMomentChoice | null {
  return FIRST_MOMENT_OPTIONS.some((o) => o.value === raw) ? (raw as FirstMomentChoice) : null;
}

export interface FirstMomentCardModel {
  eyebrow: string;
  title: string;
  note: string;
  action: string;
  /** True when the member chose it at first run: the button is the filled one. */
  lead: boolean;
}

const CARD: Record<FirstMomentChoice, { title: string; note: string }> = {
  train: {
    title: 'Plan your next training or game',
    note: 'Say what it is and when. You get a short plan to seal.',
  },
  work: {
    title: 'Plan your next big work moment',
    note: 'A meeting, a pitch, an exam. Say it, see the plan, seal it.',
  },
  night: {
    title: 'Plan your next night out',
    note: 'Say where and when. You get a short plan to seal. Nothing is shared unless you choose.',
  },
  // The prototype's note promises "Flight, arrival, first night." One Breath
  // does not build that from a sentence, so the note says only what it does.
  travel: {
    title: 'Plan your next trip',
    note: 'Say where and when. You get a short plan to seal.',
  },
};

/**
 * The card for a member who has no Moment yet. Null once they have one, and
 * null until their Moments have loaded, so it never flashes at a member who
 * already has plans.
 */
export function firstMomentCard(
  choice: FirstMomentChoice | null,
  moments: { hydrated: boolean; count: number },
): FirstMomentCardModel | null {
  if (!moments.hydrated || moments.count > 0) return null;
  const copy = choice
    ? CARD[choice]
    : {
        title: 'Plan your first Moment',
        note: 'Something coming up? Say it or type it. You get a short plan to seal.',
      };
  return { eyebrow: 'Your first Moment', ...copy, action: 'Plan it', lead: choice != null };
}
