import { describe, expect, it } from "vitest";
import {
  decideGentleHydrationPrompt,
  GENTLE_PROMPT_MIN_GAP_MINUTES,
} from "../../gentleHydrationPromptPolicy";
const base = {
  promptsFeatureEnabled: true,
  promptsEnabled: true,
  appIsActive: true,
  now: new Date("2026-11-05T14:00:00"),
  promptsSentToday: 0,
  minutesSinceLastPrompt: null,
};
describe("Gentle Hydration prompt policy", () => {
  it("fails closed behind the sub-flag", () =>
    expect(
      decideGentleHydrationPrompt({ ...base, promptsFeatureEnabled: false }),
    ).toMatchObject({ eligible: false, reason: "sub_flag_off" }));
  it("enforces background, quiet hours, caps, and three-hour gap", () => {
    expect(
      decideGentleHydrationPrompt({ ...base, appIsActive: false }),
    ).toMatchObject({ reason: "app_backgrounded" });
    expect(
      decideGentleHydrationPrompt({
        ...base,
        now: new Date("2026-11-05T21:00:00"),
      }),
    ).toMatchObject({ reason: "quiet_hours" });
    expect(
      decideGentleHydrationPrompt({ ...base, promptsSentToday: 4 }),
    ).toMatchObject({ reason: "daily_cap" });
    expect(
      decideGentleHydrationPrompt({
        ...base,
        minutesSinceLastPrompt: GENTLE_PROMPT_MIN_GAP_MINUTES - 1,
      }),
    ).toMatchObject({ reason: "min_gap" });
  });
});
