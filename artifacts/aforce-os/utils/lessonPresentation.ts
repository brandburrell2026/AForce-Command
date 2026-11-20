/**
 * How a lesson and a saved Replay read on "What AFORCE remembers".
 * Pure: every word here comes from what the member wrote or chose.
 */
import type { MomentLesson } from '@/services/momentLessons';
import { MOMENT_LESSON_PLAN_MAX } from '@/config/hydroStateModel';
import type { Moment, MomentPreparation, MomentType } from '@/types/moments';
import { replayNoteLine } from '@/utils/replayFollowUp';

const SCOPE: Record<MomentType, string> = {
  work: 'Work Moments',
  training: 'Training Moments',
  travel: 'Travel Moments',
  recovery: 'Recovery Moments',
  personal: 'Personal Moments',
  performance: 'Performance Moments',
};

export function lessonScopeLabel(type: MomentType | undefined): string {
  return SCOPE[type ?? 'personal'];
}

const day = (iso: string) => {
  const d = new Date(iso);
  return Number.isFinite(d.getTime()) ? d.toLocaleDateString([], { month: 'short', day: 'numeric' }) : null;
};

export interface LessonRow {
  id: string;
  text: string;
  on: boolean;
  /** "On · Training Moments only · from your Replay on Nov 5 · you approved" */
  meta: string;
}

export function lessonRows(lessons: readonly MomentLesson[]): LessonRow[] {
  return lessons
    .slice()
    .reverse()
    .map((l) => {
      const when = l.source ? day(l.source.momentAtIso) : null;
      const from = l.source ? (when ? `from your Replay on ${when}` : 'from your Replay') : 'your own rule';
      return {
        id: l.id,
        text: l.text,
        on: l.on,
        meta: `${l.on ? 'On' : 'Paused'} · ${lessonScopeLabel(l.scope)} only · ${from} · you approved`,
      };
    });
}

export interface ReplayRow {
  id: string;
  title: string;
  /** What the member told Replay, e.g. "Not really · Forgot water". */
  said: string;
  hasLesson: boolean;
}

/** Replays with an answer. A skipped Replay kept no answer, so it is not listed. */
export function replayRows(
  moments: readonly Moment[],
  lessons: readonly MomentLesson[],
  privateLabel: string,
): ReplayRow[] {
  return moments
    .filter((m) => m.preparation?.replay && m.preparation.replay !== 'skipped')
    .slice()
    .sort((a, b) => Date.parse(b.startAtIso) - Date.parse(a.startAtIso))
    .map((m) => {
      const when = day(m.startAtIso);
      const name = m.masked ? privateLabel : m.title;
      return {
        id: m.id,
        title: when ? `${name} · ${when}` : name,
        said: replayNoteLine(m.preparation, m.type) ?? '',
        hasLesson: lessons.some((l) => l.source?.momentId === m.id),
      };
    });
}

export function remembersSummary(learningOn: boolean, count: number): string {
  return `${learningOn ? 'Learning on' : 'Learning off'} · ${count} lesson${count === 1 ? '' : 's'} · only what you approved`;
}

export interface PlanLessonOffer {
  id: string;
  /** The member's wording, exactly as approved. */
  text: string;
  /** Why it is shown on this plan: where it came from and what it is for. */
  reason: string;
  /** True once the member added it to this plan. */
  added: boolean;
}

/**
 * The member's own lessons that fit the plan in front of them.
 *
 * "Fits" means one thing: the lesson is for this kind of Moment. Nothing is
 * inferred from the title, the place, the weather or the body. A paused
 * lesson is never offered, and none is offered while Learning is off.
 * Offering is all this does: `added` is true only for lessons the member
 * already put on this plan themselves.
 */
export function planLessonOffers(input: {
  lessons: readonly MomentLesson[];
  learningOn: boolean;
  type: MomentType | undefined;
  added: MomentPreparation['lessons'];
}): PlanLessonOffer[] {
  const { type } = input;
  if (!input.learningOn || !type) return [];
  const chosen = new Set((input.added ?? []).map((l) => l.id));
  return input.lessons
    .filter((l) => l.on && l.scope === type)
    .slice()
    .reverse()
    .slice(0, MOMENT_LESSON_PLAN_MAX)
    .map((l) => {
      const when = l.source ? day(l.source.momentAtIso) : null;
      const from = l.source
        ? `You wrote this after your Replay${when ? ` on ${when}` : ''}.`
        : 'Your own rule.';
      const kind = lessonScopeLabel(type).replace(/ Moments$/, '');
      return {
        id: l.id,
        text: l.text,
        reason: `${from} It is for ${lessonScopeLabel(type)}, and this is ${/^[AEIOU]/.test(kind) ? 'an' : 'a'} ${kind} Moment.`,
        added: chosen.has(l.id),
      };
    });
}

/** The plan's lessons after the member adds or removes one. Adding copies the
 * wording as it stands; removing leaves no trace. Unknown ids change nothing. */
export function togglePlanLesson(
  added: MomentPreparation['lessons'],
  offer: Pick<PlanLessonOffer, 'id' | 'text'>,
): MomentPreparation['lessons'] {
  const now = added ?? [];
  const next = now.some((l) => l.id === offer.id)
    ? now.filter((l) => l.id !== offer.id)
    : [...now, { id: offer.id, text: offer.text }];
  return next.length > 0 ? next : undefined;
}
