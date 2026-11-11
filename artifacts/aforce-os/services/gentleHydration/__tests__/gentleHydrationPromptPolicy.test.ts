import { describe, expect, it } from "vitest";
import {
  decideGentleHydrationPrompt,
  GENTLE_PROMPT_MIN_GAP_MINUTES,
} from "../../gentleHydrationPromptPolicy";

const baseline = {
  releaseApproved: true,
  modeEnabled: true,
  paused: false,
  goalComplete: false,
  cadence: "gentle" as const,
  now: new Date("2026-11-05T14:00:00"),
  promptsSentToday: 0,
  minutesSinceLastPrompt: null,
};

describe("Gentle Hydration prompt policy", () => {
  it("fails closed until the release review explicitly approves prompts", () => {
    expect(
      decideGentleHydrationPrompt({ ...baseline, releaseApproved: false }),
    ).toMatchObject({ eligible: false, reason: "review_required" });
  });

  it("never prompts during quiet hours, after completion, or when paused", () => {
    expect(
      decideGentleHydrationPrompt({
        ...baseline,
        now: new Date("2026-11-05T23:00:00"),
      }),
    ).toMatchObject({ eligible: false, reason: "quiet_hours" });
    expect(
      decideGentleHydrationPrompt({ ...baseline, goalComplete: true }),
    ).toMatchObject({ eligible: false, reason: "goal_complete" });
    expect(
      decideGentleHydrationPrompt({ ...baseline, paused: true }),
    ).toMatchObject({ eligible: false, reason: "paused" });
  });

  it("enforces a two-hour floor and a user-selected daily budget", () => {
    expect(
      decideGentleHydrationPrompt({
        ...baseline,
        minutesSinceLastPrompt: GENTLE_PROMPT_MIN_GAP_MINUTES - 1,
      }),
    ).toMatchObject({ eligible: false, reason: "min_gap" });
    expect(
      decideGentleHydrationPrompt({ ...baseline, promptsSentToday: 2 }),
    ).toMatchObject({ eligible: false, reason: "daily_cap" });
    expect(
      decideGentleHydrationPrompt({
        ...baseline,
        cadence: "minimal",
        promptsSentToday: 1,
      }),
    ).toMatchObject({ eligible: false, reason: "daily_cap" });
  });
});
