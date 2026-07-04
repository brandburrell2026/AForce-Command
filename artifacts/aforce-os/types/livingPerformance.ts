/**
 * Section 61 — Living Performance Model™ types (daily lesson).
 *
 * The daily lesson is a single, structured takeaway derived from the user's own
 * Personal Response Library (Section 59). It is always framed "your body taught
 * us" — never "what did I learn about [name]" — and, when nothing notable stands
 * out, it resolves to the Silent Intelligence "on track" state rather than
 * inventing a lesson. Copy is governed by livingPerformanceLanguage.ts.
 */
import type { ResponseCategory } from './adaptiveResponse';

/** A real lesson from the user's data, or the Silent Intelligence on-track state. */
export type DailyLessonKind = 'lesson' | 'on_track';

export interface DailyLesson {
  kind: DailyLessonKind;
  /** The category the lesson is about; null for the on-track state. */
  category: ResponseCategory | null;
  /** i18n key for the lesson / on-track line. */
  lineKey: string;
  /** i18n key for the category label; null for the on-track state. */
  categoryLabelKey: string | null;
  /** Follow-through percentage behind the lesson; null for on-track. */
  followedPct: number | null;
  /** Confidence behind the lesson, in (0,1]; null for on-track. */
  confidence: number | null;
}
