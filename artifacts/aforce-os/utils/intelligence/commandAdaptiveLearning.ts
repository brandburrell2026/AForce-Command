/**
 * Command Confidence™ — per-category adaptive-learning derivation (STEP 2).
 *
 * Reads the append-only Command-Event Ledger and learns, per command CATEGORY
 * (VideoCommandType), how often the user actually FOLLOWED that kind of
 * recommendation. This is the data PRIMITIVE that a separate, flag-gated
 * selection policy may later use to re-order candidates WITHIN the same
 * priority band and tune recheck timing. This module itself decides nothing.
 *
 * HARD LOCKS:
 *  - Score-Protection: this module only READS recorded confirmations; it never
 *    reads into, awards, mutates, or fabricates any score. A confirmation's
 *    `delta` is intentionally ignored here — only followed/total is counted.
 *  - No fabrication: a category needs CATEGORY_LEARNING_MIN_SAMPLES (10) total
 *    confirmations in-window before it is `ready`; below that it stays
 *    `insufficient` with a null rate and MUST have no policy effect. Events
 *    whose `commandType` is missing or unknown are ignored (never bucketed).
 *  - Pure + RN-free (type-only imports) so it is testable under the vitest
 *    pure runner.
 *
 * SEPARATE from V1 `deriveCommandConfidence` (data-groundedness high/med/low),
 * which stays display-only and is never inflated by this learning.
 */
import { eventsInWindow, type CommandEvent } from './commandEvents';
import { isCommandCategory, type CommandCategory } from './commandCategory';

/** Minimum total confirmations for a category before its rate is trusted. */
export const CATEGORY_LEARNING_MIN_SAMPLES = 10;

/** Default rolling window for the learning (30 days, in ms). */
export const CATEGORY_LEARNING_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

export interface CategoryLearning {
  category: CommandCategory;
  /** 'insufficient' until >= CATEGORY_LEARNING_MIN_SAMPLES, then 'ready'. */
  status: 'insufficient' | 'ready';
  /** Total in-window confirmations for the category (followed + not). */
  sampleSize: number;
  /** How many of those confirmations were followed. */
  followed: number;
  /** followed / sampleSize in [0,1] when ready; null while insufficient. */
  followedRate: number | null;
}

export type CategoryLearningProfile = Partial<Record<CommandCategory, CategoryLearning>>;

function isFiniteNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

/**
 * Derive the per-category learning profile from the ledger.
 *
 * @param events   full ledger (any kinds; only confirmations are read)
 * @param now      evaluation clock (ms epoch)
 * @param windowMs rolling window; defaults to 30 days, clamped to > 0
 */
export function deriveCategoryLearning(
  events: readonly CommandEvent[],
  now: number = Date.now(),
  windowMs: number = CATEGORY_LEARNING_WINDOW_MS,
): CategoryLearningProfile {
  const profile: CategoryLearningProfile = {};
  if (!isFiniteNumber(now)) return profile;
  const span =
    isFiniteNumber(windowMs) && windowMs > 0 ? windowMs : CATEGORY_LEARNING_WINDOW_MS;

  const inWindow = eventsInWindow(events, now - span, now);
  for (const e of inWindow) {
    if (e.kind !== 'command_confirmation') continue;
    // Unknown / missing commandType cannot be attributed → ignored (no fabrication).
    if (!isCommandCategory(e.commandType)) continue;
    const cat = e.commandType;
    const agg =
      profile[cat] ??
      ({
        category: cat,
        status: 'insufficient',
        sampleSize: 0,
        followed: 0,
        followedRate: null,
      } as CategoryLearning);
    agg.sampleSize += 1;
    if (e.followed) agg.followed += 1;
    profile[cat] = agg;
  }

  // Finalize: only ready (sample-gated) categories expose a numeric rate.
  for (const cat of Object.keys(profile) as CommandCategory[]) {
    const agg = profile[cat]!;
    if (agg.sampleSize >= CATEGORY_LEARNING_MIN_SAMPLES) {
      agg.status = 'ready';
      agg.followedRate = agg.followed / agg.sampleSize;
    } else {
      agg.status = 'insufficient';
      agg.followedRate = null;
    }
  }

  return profile;
}

/** Convenience accessor: a single category's learning, or null if none. */
export function categoryLearning(
  profile: CategoryLearningProfile,
  category: CommandCategory,
): CategoryLearning | null {
  return profile[category] ?? null;
}
