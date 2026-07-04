/**
 * Section 59 — pure copy mapper for the Personal Response Library.
 *
 * Turns a structured PersonalResponseEntry into the i18n keys + params a surface
 * renders. Pure + RN-free so it is node-testable and so a locale-guard test can
 * assert every string it points at is cause-and-effect only (never risk /
 * injury / diagnosis / prevent — see responseLanguage.ts). This module chooses
 * WHICH key; the strings themselves live in locales/*.json.
 */
import type { PersonalResponseEntry, ResponseCategory, ResponseOutcome } from '../../types/adaptiveResponse';

/** i18n key describing one category's Personal Response Library line + params. */
export interface ResponseLineDescriptor {
  /** Key for the human category label (e.g. "recovery speed"). */
  categoryLabelKey: string;
  /** Key for the cause-and-effect line (outcome-specific, or "building"). */
  lineKey: string;
  /** followed-percentage for interpolation when ready; null while insufficient. */
  followedPct: number | null;
  /** Confidence After Action as a whole percent; null while insufficient. */
  confidencePct: number | null;
}

const OUTCOME_LINE_KEY: Record<ResponseOutcome, string> = {
  improved: 'adaptiveResponse.outcome_improved',
  steady: 'adaptiveResponse.outcome_steady',
  declined: 'adaptiveResponse.outcome_declined',
  unknown: 'adaptiveResponse.outcome_unknown',
};

/** i18n key for a category's human label. */
export function categoryLabelKey(category: ResponseCategory): string {
  return `adaptiveResponse.category_${category}`;
}

/**
 * Describe one entry for rendering. Insufficient entries map to the neutral
 * "building" line with null figures — no fabricated outcome or confidence.
 */
export function describeResponse(entry: PersonalResponseEntry): ResponseLineDescriptor {
  const categoryLabelKey_ = categoryLabelKey(entry.category);
  if (entry.status !== 'ready' || entry.whatWorked === null) {
    return { categoryLabelKey: categoryLabelKey_, lineKey: 'adaptiveResponse.building', followedPct: null, confidencePct: null };
  }
  return {
    categoryLabelKey: categoryLabelKey_,
    lineKey: OUTCOME_LINE_KEY[entry.whatWorked.outcome],
    followedPct: Math.round(entry.whatWorked.followedRate * 100),
    confidencePct: entry.confidenceAfterAction === null ? null : Math.round(entry.confidenceAfterAction * 100),
  };
}
