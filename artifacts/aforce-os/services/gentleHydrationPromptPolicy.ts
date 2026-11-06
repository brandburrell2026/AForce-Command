/** In-app-banner eligibility only. This module schedules no system notifications. */
export const GENTLE_PROMPT_QUIET_START_HOUR = 21;
export const GENTLE_PROMPT_QUIET_END_HOUR = 8;
export const GENTLE_PROMPT_MIN_GAP_MINUTES = 180;
export const GENTLE_PROMPT_MAX_PER_DAY = 4;

export type GentlePromptBlockReason =
  | "sub_flag_off"
  | "not_opted_in"
  | "app_backgrounded"
  | "quiet_hours"
  | "daily_cap"
  | "min_gap";
export interface GentleHydrationPromptInput {
  promptsFeatureEnabled: boolean;
  promptsEnabled: boolean;
  appIsActive: boolean;
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

export function decideGentleHydrationPrompt(
  input: GentleHydrationPromptInput,
): GentleHydrationPromptDecision {
  const block = (
    reason: GentlePromptBlockReason,
  ): GentleHydrationPromptDecision => ({
    eligible: false,
    reason,
    maxPerDay: GENTLE_PROMPT_MAX_PER_DAY,
    minGapMinutes: GENTLE_PROMPT_MIN_GAP_MINUTES,
  });
  if (!input.promptsFeatureEnabled) return block("sub_flag_off");
  if (!input.promptsEnabled) return block("not_opted_in");
  if (!input.appIsActive) return block("app_backgrounded");
  const hour = input.now.getHours();
  if (
    hour >= GENTLE_PROMPT_QUIET_START_HOUR ||
    hour < GENTLE_PROMPT_QUIET_END_HOUR
  )
    return block("quiet_hours");
  if (input.promptsSentToday >= GENTLE_PROMPT_MAX_PER_DAY)
    return block("daily_cap");
  if (
    input.minutesSinceLastPrompt != null &&
    input.minutesSinceLastPrompt < GENTLE_PROMPT_MIN_GAP_MINUTES
  )
    return block("min_gap");
  return {
    eligible: true,
    maxPerDay: GENTLE_PROMPT_MAX_PER_DAY,
    minGapMinutes: GENTLE_PROMPT_MIN_GAP_MINUTES,
  };
}
