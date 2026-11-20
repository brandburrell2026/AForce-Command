/**
 * How a lesson and a saved Replay read on "What AFORCE remembers".
 * Pure: every word here comes from what the member wrote or chose.
 */
import type { MomentLesson } from '@/services/momentLessons';
import type { Moment, MomentType } from '@/types/moments';
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
