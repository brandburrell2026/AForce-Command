/**
 * Pre-Workout Support recognition.
 *
 * HydroScan needs to recognize pre-workouts, stimulant-heavy formulas,
 * pump blends, and energy formulas so the AI coach can pair them with
 * supportive guidance — hydration demand goes up during training,
 * recovery support helps after. The framing here is SUPPORT, never
 * attack: pre-workout users are doing the work, and the system's job
 * is to ride alongside them.
 *
 * ── Tone constraint ───────────────────────────────────────────────
 * Pre-workouts are NEVER described as bad, harmful, dangerous,
 * unhealthy, or anything in that direction. The copy talks about the
 * BODY's needs (hydration, recovery) — not about the supplement
 * being a problem. This file is the single source of truth for that
 * phrasing; any caller that surfaces these notes MUST use the
 * exported lines so we don't accidentally regress to judgmental copy.
 *
 * ── Recognition surface ───────────────────────────────────────────
 * Two complementary detectors:
 *
 *   1. By drink-catalog category id — exact match against the
 *      'pre_workout' and 'energy_drink' buckets in DRINK_CATEGORIES.
 *      Triggered when a user logs a pre-workout-class drink through
 *      AddDrinkModal or SmartCaptureModal.
 *
 *   2. By product-name keyword — for scanned products (barcodes, QR,
 *      catalog hits) whose CompareProduct category doesn't carry a
 *      pre-workout bucket. We sniff the brand + product name for
 *      common signals: "pre-workout", "preworkout", "pump", "stim",
 *      "energy formula", "ergogenic". Conservative on purpose — we'd
 *      rather miss a niche product than mislabel a sports drink.
 */

import type { DrinkCategoryId } from '../data/drinkCatalog';
import type { LoadEvent } from './loadSignals';

/** Rolling window for "recent" intake — matches loadSignals. */
const RECENT_WINDOW_HOURS = 6;
const RECENT_WINDOW_MS = RECENT_WINDOW_HOURS * 60 * 60 * 1000;

/**
 * Drink-catalog category ids that count as "pre-workout class". Kept
 * narrow on purpose: only the two categories where the user has
 * explicitly told us "this is a stimulant/ergogenic formula". Coffee
 * is loud about stimulant load (see loadSignals) but isn't a
 * pre-workout product, so it stays out of this set.
 */
const PRE_WORKOUT_CATEGORIES: ReadonlySet<DrinkCategoryId> = new Set<DrinkCategoryId>([
  'pre_workout',
  'energy_drink',
]);

/** Lower-cased substrings that signal a pre-workout / pump / stim formula. */
const NAME_KEYWORDS: readonly string[] = [
  'pre-workout',
  'pre workout',
  'preworkout',
  'pre-train',
  'pre train',
  'pretrain',
  'pump blend',
  'pump formula',
  'pump matrix',
  'stim blend',
  'stim formula',
  'stim matrix',
  'stimulant blend',
  'stimulant matrix',
  'energy formula',
  'energy blend',
  'energy matrix',
  'ergogenic',
];

/** True when the drink-catalog category counts as pre-workout class. */
export function isPreWorkoutClassCategory(id: string | undefined | null): boolean {
  if (!id) return false;
  return PRE_WORKOUT_CATEGORIES.has(id as DrinkCategoryId);
}

/**
 * Keyword-sniff a scanned product's brand + product name for
 * pre-workout / pump / stimulant / energy-formula signals. Case- and
 * whitespace-insensitive. Conservative: only matches our curated
 * keyword list — we'd rather under-trigger than mislabel a sports
 * drink as a pre-workout.
 */
export function isPreWorkoutClassName(text: string | undefined | null): boolean {
  if (!text) return false;
  const haystack = text.toLowerCase().replace(/\s+/g, ' ').trim();
  if (!haystack) return false;
  return NAME_KEYWORDS.some((kw) => haystack.includes(kw));
}

/**
 * True when any IntakeEvent in the rolling 6h window came from a
 * pre-workout-class category. Used by the AI coach to decide whether
 * to surface the supportive-notes block.
 */
export function detectPreWorkoutInIntake(
  events: LoadEvent[] | undefined | null,
  now: number = Date.now(),
): boolean {
  if (!Array.isArray(events) || events.length === 0) return false;
  const since = now - RECENT_WINDOW_MS;
  for (const e of events) {
    if (!isPreWorkoutClassCategory(e.categoryId)) continue;
    const t =
      e.loggedAt instanceof Date
        ? e.loggedAt.getTime()
        : typeof e.loggedAt === 'number'
        ? e.loggedAt
        : Date.parse(String(e.loggedAt));
    if (!Number.isFinite(t)) continue;
    if (t >= since && t <= now) return true;
  }
  return false;
}

// ── Display copy ───────────────────────────────────────────────────
// Canonical user-facing strings. Keep in sync with the product brief:
// pre-workouts are NEVER framed as bad, harmful, dangerous, risky, or
// "too much" — the copy always talks about what the BODY needs next.

export const PRE_WORKOUT_NOTE_STIMULANT =
  'Elevated stimulant load detected.';
export const PRE_WORKOUT_NOTE_TRAINING =
  'Hydration demand may increase during training.';
export const PRE_WORKOUT_NOTE_RECOVERY =
  'Recovery support recommended after activity.';

/**
 * The full three-line supportive-notes block surfaced by the AI coach
 * when a pre-workout-class product is detected (either via a recent
 * intake event or via a scanned product name). Returned in stable
 * order so the UI can render them as a single block without sorting.
 */
export function preWorkoutSupportLines(): readonly string[] {
  return [
    PRE_WORKOUT_NOTE_STIMULANT,
    PRE_WORKOUT_NOTE_TRAINING,
    PRE_WORKOUT_NOTE_RECOVERY,
  ];
}

/**
 * Convenience composite: returns the supportive lines if either
 * detector trips, or `null` if no pre-workout signal is present.
 * Callers can wire this straight into a recommendation surface
 * without thinking about which detector fired.
 */
export function preWorkoutSupportFor(args: {
  recentIntake?: LoadEvent[] | null;
  scannedText?: string | null;
  nowMs?: number;
}): readonly string[] | null {
  const hit =
    detectPreWorkoutInIntake(args.recentIntake ?? null, args.nowMs) ||
    isPreWorkoutClassName(args.scannedText ?? null);
  return hit ? preWorkoutSupportLines() : null;
}
