/**
 * Gentle Hydration prompt policy.
 *
 * This pure layer is intentionally not an OS-notification scheduler. It makes
 * the release gate explicit: no prompt is eligible unless product safety copy
 * has been approved, the member opted in, and the member did not pause today.
 * A later native bridge must consume this result rather than inventing its own
 * cadence rules.
 */
import type { GentleHydrationCadence } from "./gentleHydrationMode";

export const GENTLE_PROMPT_QUIET_START_HOUR = 22;
export const GENTLE_PROMPT_QUIET_END_HOUR = 7;
export const GENTLE_PROMPT_MIN_GAP_MINUTES = 120;
export const GENTLE_PROMPT_MAX_PER_DAY = 3;

export type GentlePromptBlockReason =
  | "review_required"
  | "not_opted_in"
  | "paused"
  | "goal_complete"
  | "quiet_hours"
  | "daily_cap"
  | "min_gap";

export interface GentleHydrationPromptInput {
  releaseApproved: boolean;
  modeEnabled: boolean;
  paused: boolean;
  goalComplete: boolean;
  cadence: GentleHydrationCadence;
  now: Date;
  promptsSentToday: number;
  minutesSinceLastPrompt: number | null;
}

export type GentleHydrationPromptDecision =
  | { eligible: true; maxPerDay: number; minGapMinutes: number }
  | {
      eligible: false;
      reason: GentlePromptBlockReason;
      maxPerDay: number;
      minGapMinutes: number;
    };

function inQuietHours(hour: number): boolean {
  return (
    hour >= GENTLE_PROMPT_QUIET_START_HOUR ||
    hour < GENTLE_PROMPT_QUIET_END_HOUR
  );
}

/** Cadence never raises the app-wide maximum above the gentle hard cap. */
function cadenceBudget(cadence: GentleHydrationCadence): number {
  switch (cadence) {
    case "steady":
      return 3;
    case "gentle":
      return 2;
    case "minimal":
      return 1;
  }
}

export function decideGentleHydrationPrompt(
  input: GentleHydrationPromptInput,
): GentleHydrationPromptDecision {
  const maxPerDay = Math.min(
    GENTLE_PROMPT_MAX_PER_DAY,
    cadenceBudget(input.cadence),
  );
  const minGapMinutes = GENTLE_PROMPT_MIN_GAP_MINUTES;
  const block = (
    reason: GentlePromptBlockReason,
  ): GentleHydrationPromptDecision => ({
    eligible: false,
    reason,
    maxPerDay,
    minGapMinutes,
  });

  if (!input.releaseApproved) return block("review_required");
  if (!input.modeEnabled) return block("not_opted_in");
  if (input.paused) return block("paused");
  if (input.goalComplete) return block("goal_complete");
  if (inQuietHours(input.now.getHours())) return block("quiet_hours");
  if (input.promptsSentToday >= maxPerDay) return block("daily_cap");
  if (
    input.minutesSinceLastPrompt != null &&
    input.minutesSinceLastPrompt < minGapMinutes
  )
    return block("min_gap");
  return { eligible: true, maxPerDay, minGapMinutes };
}
