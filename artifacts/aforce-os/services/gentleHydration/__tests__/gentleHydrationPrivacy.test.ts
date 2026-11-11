import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { GENTLE_HYDRATION_COPY as copy } from "../../gentleHydrationCopy";
import { mayEmitAnalytics } from "../../gentleHydrationPrivacy";
const root = join(__dirname, "..", "..", "..");

describe("Gentle Hydration privacy boundary", () => {
  it("rejects analytics payloads containing mode state, copy, or GLP context", () => {
    expect(
      mayEmitAnalytics("app_opened", {
        enabled: true,
        pauseStreakDisplay: true,
      }),
    ).toBe(false);
    expect(mayEmitAnalytics("app_opened", { text: copy.glp1Context })).toBe(
      false,
    );
    expect(mayEmitAnalytics("app_opened", { topic: "glp-1" })).toBe(false);

    const dispatcher = readFileSync(
      join(root, "analytics", "event_dispatcher.ts"),
      "utf8",
    );
    expect(dispatcher).toContain("if (!mayEmitAnalytics(eventType, payload)) return false;");
  });
  it("uses device-only Keychain accessibility and no plain-storage fallback", () => {
    const source = readFileSync(
      join(root, "services", "gentleHydrationStorage.ts"),
      "utf8",
    );
    expect(source).toContain("WHEN_UNLOCKED_THIS_DEVICE_ONLY");
    expect(source).not.toContain("AsyncStorage");
  });
  it("renders no commerce component in the mode", () => {
    const source = readFileSync(
      join(root, "components", "hydration", "GentleHydrationModeCard.tsx"),
      "utf8",
    );
    expect(source).not.toMatch(/Shop|checkout|product|electrolyte/i);
  });
});
