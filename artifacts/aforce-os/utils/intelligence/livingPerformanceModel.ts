/**
 * Section 61 — Living Performance Model™ (daily lesson, STEP 1, headless).
 *
 * Reads the Section 59 Personal Response Library and surfaces the single most
 * grounded takeaway for today, framed "your body taught us". When nothing stands
 * out — no ready category with a notable, confident outcome — it returns the
 * Silent Intelligence on-track state ("You're exactly where you should be.")
 * rather than inventing a lesson.
 *
 * HARD LOCKS:
 *  - Pure + RN-free (type-only imports) so it runs under the vitest pure runner.
 *  - Score-Protection: reads a category's derived outcome + Confidence After
 *    Action only; never reads into / awards / mutates / fabricates score.
 *  - No fabrication: an empty / low-confidence / steady library yields on-track,
 *    never a manufactured lesson.
 *
 * Emits STRUCTURED data only; rendered copy is governed by
 * livingPerformanceLanguage.ts and the `livingPerformance.*` locale keys.
 */
import {
  RESPONSE_CATEGORIES,
  type AdaptiveResponseProfile,
  type PersonalResponseEntry,
} from '../../types/adaptiveResponse';
import type { DailyLesson } from '../../types/livingPerformance';
import { LIVING_PERFORMANCE_MIN_LESSON_CONFIDENCE } from '../../config/hydroStateModel';

/** The on-track (Silent Intelligence) lesson — no category, no figures. */
const ON_TRACK: DailyLesson = {
  kind: 'on_track',
  category: null,
  lineKey: 'livingPerformance.on_track',
  categoryLabelKey: null,
  followedPct: null,
  confidence: null,
};

/**
 * A category qualifies as today's lesson only when it is READY, its outcome is
 * notable (improved or declined — not steady/unknown), and its Confidence After
 * Action clears the config floor. Everything else stays on-track (no fabrication).
 */
function qualifies(entry: PersonalResponseEntry): boolean {
  if (entry.status !== 'ready' || entry.whatWorked === null) return false;
  const { outcome } = entry.whatWorked;
  if (outcome !== 'improved' && outcome !== 'declined') return false;
  return (entry.confidenceAfterAction ?? 0) >= LIVING_PERFORMANCE_MIN_LESSON_CONFIDENCE;
}

/**
 * Derive today's single daily lesson from the Personal Response Library. Among
 * qualifying categories, the highest Confidence After Action wins; ties break by
 * the stable RESPONSE_CATEGORIES order (deterministic — first qualifying wins).
 */
export function deriveDailyLesson(profile: AdaptiveResponseProfile): DailyLesson {
  let best: PersonalResponseEntry | null = null;
  for (const category of RESPONSE_CATEGORIES) {
    const entry = profile[category];
    if (!qualifies(entry)) continue;
    if (best === null || (entry.confidenceAfterAction ?? 0) > (best.confidenceAfterAction ?? 0)) {
      best = entry;
    }
  }

  if (best === null || best.whatWorked === null) return ON_TRACK;

  return {
    kind: 'lesson',
    category: best.category,
    lineKey:
      best.whatWorked.outcome === 'improved'
        ? 'livingPerformance.lesson_improved'
        : 'livingPerformance.lesson_declined',
    categoryLabelKey: `adaptiveResponse.category_${best.category}`,
    followedPct: Math.round(best.whatWorked.followedRate * 100),
    confidence: best.confidenceAfterAction,
  };
}
