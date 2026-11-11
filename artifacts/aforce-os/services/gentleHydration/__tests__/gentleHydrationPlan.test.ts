import { describe, expect, it } from "vitest";
import { createGentleHydrationPresentation } from "../../gentleHydrationPlan";
describe("Gentle Hydration presentation", () => {
  it("softens only presentation, never targets or score math", () => {
    expect(createGentleHydrationPresentation(true)).toEqual({
      hideShortfall: true,
      progressLabel: "Today’s progress",
    });
    expect(createGentleHydrationPresentation(false)).toEqual({
      hideShortfall: false,
      progressLabel: null,
    });
  });
});
