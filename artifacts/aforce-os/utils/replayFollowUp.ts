/**
 * Replay follow-ups — the prototype's "Did that plan work for you?" loop,
 * as far as the member's own answers go.
 *
 * Everything here is the member's private note about one Moment. Nothing in
 * this file suggests a change, writes a rule, alters a future plan, or reads
 * any score, target or intake. Learning is not built.
 */
import type { MomentPreparation, MomentType } from '@/types/moments';

export type ReplayAnswer = NonNullable<MomentPreparation['replay']>;
export type ReplayObstacle = NonNullable<MomentPreparation['replayObstacle']>;

export const REPLAY_NOTE_MAX = 140;

export const REPLAY_ANSWERS: readonly { value: Exclude<ReplayAnswer, 'skipped'>; label: string }[] = [
  { value: 'yes', label: 'Yes, it worked' },
  { value: 'partly', label: 'Partly' },
  { value: 'not_really', label: 'Not really' },
];

type Choice = { value: Exclude<ReplayObstacle, 'skipped'>; label: string };

const EVERYDAY: readonly Choice[] = [
  { value: 'late', label: 'I was rushed' },
  { value: 'drain', label: 'Low energy' },
  { value: 'water', label: 'Forgot water' },
  { value: 'other', label: 'Something else' },
];

const ACTIVE: readonly Choice[] = [
  { value: 'late', label: 'Started late' },
  { value: 'drain', label: 'Ran out of gas' },
  { value: 'water', label: 'Forgot water' },
  { value: 'other', label: 'Something else' },
];

/** The choices under "What got in the way?". Chosen from the Moment's type
 * only, never its title, so a private Moment reads the same as any other. */
export function replayObstacleOptions(type: MomentType | undefined): readonly Choice[] {
  return type === 'training' || type === 'performance' ? ACTIVE : EVERYDAY;
}

export function replayAnswerLabel(answer: ReplayAnswer | undefined): string | null {
  if (!answer || answer === 'skipped') return null;
  return REPLAY_ANSWERS.find((a) => a.value === answer)?.label ?? null;
}

export type ReplayStep = 'ask' | 'yes' | 'skipped' | 'miss' | 'other' | 'noted';

/** Which part of Replay to show. `editing` is the member's place on screen
 * that has not been saved: re-asking the question, or writing their own note. */
export function replayStep(
  preparation: Pick<MomentPreparation, 'replay' | 'replayObstacle'> | undefined,
  editing: 'ask' | 'other' | null,
): ReplayStep {
  const answer = preparation?.replay;
  if (editing === 'ask' || !answer) return 'ask';
  if (answer === 'skipped') return 'skipped';
  if (answer === 'yes') return 'yes';
  if (editing === 'other') return 'other';
  return preparation?.replayObstacle ? 'noted' : 'miss';
}

/** The member's own words, tidied: one line of spacing, capped. Empty is
 * "no note", never an empty string on disk. */
export function cleanReplayNote(text: string): string | undefined {
  const tidy = text.replace(/\s+/g, ' ').trim().slice(0, REPLAY_NOTE_MAX).trim();
  return tidy.length > 0 ? tidy : undefined;
}

/** What the member told Replay, in one line, for the closing card. */
export function replayNoteLine(
  preparation: Pick<MomentPreparation, 'replay' | 'replayObstacle' | 'replayNote'> | undefined,
  type: MomentType | undefined,
): string | null {
  const answer = replayAnswerLabel(preparation?.replay);
  if (!answer) return null;
  const obstacle = preparation?.replayObstacle;
  if (!obstacle || obstacle === 'skipped') return answer;
  if (obstacle === 'other') {
    return preparation?.replayNote ? `${answer} · “${preparation.replayNote}”` : answer;
  }
  const label = replayObstacleOptions(type).find((o) => o.value === obstacle)?.label;
  return label ? `${answer} · ${label}` : answer;
}
