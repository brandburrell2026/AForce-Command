/**
 * momentClassification — pure calendar-event classifier for AForce Moments
 * (Phase 3b, DR-011). Keyword-based, deliberately transparent, and honest
 * about uncertainty: an event either matches an ENABLED category with enough
 * confidence, is masked (no readable title → PRIVATE EVENT, neutral
 * classification), or is SKIPPED. It never guesses ("Do not pretend
 * certainty" — founder spec). Thresholds live in config/hydroStateModel.ts.
 *
 * All-day events are skipped (no meaningful prep window). Overlaps are fine —
 * each event classifies independently; the notification planner's budget
 * handles collision pressure downstream.
 */

import type { MomentImportance, MomentType } from '@/types/moments';
import {
  MOMENT_CLASSIFY_MIN_CONFIDENCE,
  MOMENT_CALENDAR_DEFAULT_IMPORTANCE,
} from '@/config/hydroStateModel';

/** The founder spec's category vocabulary, lowercased whole-word matching. */
const CATEGORY_KEYWORDS: Record<Exclude<MomentType, 'personal'>, string[]> = {
  work: [
    'meeting', 'call', 'sync', 'standup', 'presentation', 'demo', 'review',
    'interview', 'deadline', 'investor', 'board', 'leadership', '1:1', 'one-on-one',
  ],
  training: [
    'gym', 'run', 'workout', 'training', 'practice', 'lift', 'session',
    'class', 'yoga', 'swim', 'ride', 'spin', 'crossfit',
  ],
  travel: [
    'flight', 'fly', 'airport', 'train', 'drive', 'hotel', 'travel',
    'depart', 'departure', 'trip',
  ],
  recovery: ['massage', 'sauna', 'recovery', 'physio', 'stretch', 'ice bath', 'sleep'],
  performance: ['game', 'race', 'match', 'competition', 'audition', 'exam', 'speech', 'keynote', 'talk'],
};

export interface CalendarEventLike {
  id: string;
  title: string | null | undefined;
  startAtIso: string;
  endAtIso?: string;
  allDay?: boolean;
  calendarId: string;
}

export type MomentCategoryToggle = 'work' | 'training' | 'travel';

/** Which spec categories each user-facing toggle admits. */
const TOGGLE_CATEGORIES: Record<MomentCategoryToggle, MomentType[]> = {
  work: ['work', 'performance'],
  training: ['training', 'recovery'],
  travel: ['travel'],
};

export interface ClassifiedEvent {
  kind: 'moment';
  type: MomentType;
  importance: MomentImportance;
  /** Masked events surface as PRIVATE EVENT (i18n at render). */
  masked: boolean;
  confidence: number;
}

export type ClassificationResult = ClassifiedEvent | { kind: 'skip'; reason: string };

function scoreCategory(title: string, keywords: string[]): number {
  const words = title.toLowerCase();
  let hits = 0;
  for (const k of keywords) {
    // Whole-word-ish: keyword bounded by non-letters (handles "1:1" too).
    const escaped = k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (new RegExp(`(^|[^a-z])${escaped}([^a-z]|$)`, 'i').test(words)) hits += 1;
  }
  if (hits === 0) return 0;
  // One strong keyword is decisive for short titles; extra hits saturate.
  return Math.min(1, 0.7 + 0.15 * (hits - 1) + (title.trim().split(/\s+/).length <= 4 ? 0.1 : 0));
}

/**
 * Classify one calendar event against the user's enabled category toggles.
 * PURE — no I/O, no clocks.
 */
export function classifyCalendarEvent(
  event: CalendarEventLike,
  enabledToggles: readonly MomentCategoryToggle[],
): ClassificationResult {
  if (event.allDay) return { kind: 'skip', reason: 'all_day' };
  if (!Number.isFinite(Date.parse(event.startAtIso))) return { kind: 'skip', reason: 'bad_time' };

  const title = (event.title ?? '').trim();
  const admitted = new Set(enabledToggles.flatMap((tgl) => TOGGLE_CATEGORIES[tgl]));

  if (!title) {
    // No readable title → masked neutral moment; surfaced only when at least
    // one category is enabled at all (a user with everything off gets nothing).
    if (admitted.size === 0) return { kind: 'skip', reason: 'no_categories' };
    return { kind: 'moment', type: 'personal', importance: 'moderate', masked: true, confidence: 1 };
  }

  let best: { type: MomentType; score: number } | null = null;
  for (const [type, keywords] of Object.entries(CATEGORY_KEYWORDS) as [MomentType, string[]][]) {
    const score = scoreCategory(title, keywords);
    if (score > (best?.score ?? 0)) best = { type, score };
  }

  if (!best || best.score < MOMENT_CLASSIFY_MIN_CONFIDENCE) {
    return { kind: 'skip', reason: 'low_confidence' };
  }
  if (!admitted.has(best.type)) return { kind: 'skip', reason: 'category_disabled' };

  return {
    kind: 'moment',
    type: best.type,
    importance: MOMENT_CALENDAR_DEFAULT_IMPORTANCE[best.type as keyof typeof MOMENT_CALENDAR_DEFAULT_IMPORTANCE],
    masked: false,
    confidence: best.score,
  };
}
