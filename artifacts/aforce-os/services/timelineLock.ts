/**
 * Timeline Lock — defensive manifest for Rule #6.
 *
 * Spec Rule #6:
 *   DO NOT CHANGE.
 *   Protect: Performance Timeline / 7d / 30d / 90d / Momentum /
 *            Avg Score / Consistency / Streak / Heat map /
 *            Signal curve / Win Moments
 *   Allowed: Tap node / Replay / Day Story / Export
 *   Micro motion only.
 *
 * This module is intentionally a pure manifest: a single source of
 * truth that future rules + code reviews can consult to verify
 * nothing has mutated the protected Timeline surface. No runtime
 * guards, no UI changes, no edits to performanceTimeline.ts or
 * JournalScreen. The point is to enumerate the contract so it's
 * grep-able and assertable, not to enforce it from code.
 *
 * Gate: `spec_timelineLock` (default true — the lock is a core
 * invariant; flipping it off "unlocks" the contract for future
 * release work, it doesn't change visible behavior).
 */
import { useFeatureFlags } from '@/store/useAppStore';

/**
 * Stable identifiers for every protected Timeline surface element.
 * Order matches the spec line order.
 */
export const TIMELINE_PROTECTED_FIELDS = [
  'performanceTimeline',
  '7d',
  '30d',
  '90d',
  'momentum',
  'avgScore',
  'consistency',
  'streak',
  'heatMap',
  'signalCurve',
  'winMoments',
] as const;

export type TimelineProtectedField = (typeof TIMELINE_PROTECTED_FIELDS)[number];

/** Verbatim spec display strings for the protected fields. */
export const TIMELINE_PROTECTED_LABELS: Readonly<
  Record<TimelineProtectedField, string>
> = {
  performanceTimeline: 'Performance Timeline',
  '7d': '7d',
  '30d': '30d',
  '90d': '90d',
  momentum: 'Momentum',
  avgScore: 'Avg Score',
  consistency: 'Consistency',
  streak: 'Streak',
  heatMap: 'Heat map',
  signalCurve: 'Signal curve',
  winMoments: 'Win Moments',
};

/**
 * The only four interactions the spec permits on the locked Timeline.
 * Everything else (edit, delete, reorder, hide, add, etc.) is denied.
 */
export const TIMELINE_ALLOWED_ACTIONS = [
  'tap_node',
  'replay',
  'day_story',
  'export',
] as const;

export type TimelineAllowedAction = (typeof TIMELINE_ALLOWED_ACTIONS)[number];

/** Verbatim spec display strings for the allowed actions. */
export const TIMELINE_ALLOWED_LABELS: Readonly<
  Record<TimelineAllowedAction, string>
> = {
  tap_node: 'Tap node',
  replay: 'Replay',
  day_story: 'Day Story',
  export: 'Export',
};

/**
 * Quantifies "Micro motion only." 250 ms is the conventional
 * threshold between a micro-interaction (perceived as instant
 * feedback) and a full animation. Anything beyond this isn't
 * micro motion and would constitute a redesign.
 */
export const MICRO_MOTION_MAX_DURATION_MS = 250;

/** Pure: is this field name in the protected manifest? */
export function isTimelineFieldProtected(
  field: string,
): field is TimelineProtectedField {
  return (TIMELINE_PROTECTED_FIELDS as readonly string[]).includes(field);
}

/**
 * Pure: is this action one of the four allowed interactions?
 * Denies any verb not in the spec list — edit, delete, reorder,
 * hide, add, share (different from export), etc.
 */
export function isTimelineActionAllowed(
  action: string,
): action is TimelineAllowedAction {
  return (TIMELINE_ALLOWED_ACTIONS as readonly string[]).includes(action);
}

/**
 * Pure: does an animation duration qualify as "Micro motion only"?
 * True for positive durations up to and including the cap. Zero
 * (no motion) and negative values return false — micro motion is
 * a positive lower bound too, not the absence of motion.
 */
export function isMicroMotion(durationMs: number): boolean {
  return durationMs > 0 && durationMs <= MICRO_MOTION_MAX_DURATION_MS;
}

export interface TimelineLockState {
  enabled: boolean;
  protectedFields: typeof TIMELINE_PROTECTED_FIELDS;
  protectedLabels: typeof TIMELINE_PROTECTED_LABELS;
  allowedActions: typeof TIMELINE_ALLOWED_ACTIONS;
  allowedLabels: typeof TIMELINE_ALLOWED_LABELS;
  microMotionMaxMs: number;
}

/**
 * Hidden hook. Exposes the lock manifest plus the `spec_timelineLock`
 * gate. Not consumed by any UI this turn — the existing Journal
 * timeline keeps its current behavior. Future code reviews can
 * import the constants directly to verify nothing has drifted.
 */
export function useTimelineLock(): TimelineLockState {
  const flags = useFeatureFlags();
  return {
    enabled: !!flags.spec_timelineLock,
    protectedFields: TIMELINE_PROTECTED_FIELDS,
    protectedLabels: TIMELINE_PROTECTED_LABELS,
    allowedActions: TIMELINE_ALLOWED_ACTIONS,
    allowedLabels: TIMELINE_ALLOWED_LABELS,
    microMotionMaxMs: MICRO_MOTION_MAX_DURATION_MS,
  };
}
