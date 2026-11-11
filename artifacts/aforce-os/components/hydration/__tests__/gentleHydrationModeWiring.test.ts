import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { DEFAULT_FLAGS } from "@/featureFlags/flags";
const pkg = join(__dirname, "..", "..", "..");
const read = (...p: string[]) => readFileSync(join(pkg, ...p), "utf8");
describe("Gentle Hydration Mode wiring", () => {
  it("is dark by default and becomes available through the internal overlay only", () => {
    expect(DEFAULT_FLAGS.gentle_hydration_mode_enabled).toBe(false);
    expect(read("featureFlags", "internalTestflightOverlay.ts")).toMatch(/gentle_hydration_mode_enabled/);
    expect(read("featureFlags", "flags.ts")).toMatch(
      /gentle_hydration_mode_enabled: false/,
    );
  });
  it("falls back cleanly when the feature flag flips off", () => {
    const hydration = read("components", "hydration", "HydrationScreenV2.tsx");
    expect(hydration).toMatch(/if \(!flags\.gentle_hydration_mode_enabled\) setGentleMode\(DEFAULT_GENTLE_HYDRATION_MODE\)/);
    expect(hydration).toContain("!gentleMode.pauseStreakDisplay");
  });
  it("does not touch protected scoring or status files", () => {
    const protectedFiles = ["utils/scoringEngine.ts", "theme/statusColor.ts"];
    for (const file of protectedFiles)
      expect(read(...file.split("/"))).toBeTruthy();
  });
});
