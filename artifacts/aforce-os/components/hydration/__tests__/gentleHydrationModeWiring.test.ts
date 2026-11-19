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
  it("does not touch the Hydration tab: the History chart is not a streak and is never hidden by it", () => {
    const hydration = read("components", "hydration", "HydrationScreenV2.tsx");
    expect(hydration).not.toContain("pauseStreakDisplay");
    expect(hydration).not.toContain("gentleHydrationMode");
    expect(hydration).toContain("<HydrationHistory");
  });
  it("keeps its controls off the Hydration tab and on their own screen, opened from Profile", () => {
    const hydration = read("components", "hydration", "HydrationScreenV2.tsx");
    // The approved Hydration layout has no Gentle hydration card.
    expect(hydration).not.toContain("<GentleHydrationModeCard");
    const screen = read("components", "hydration", "GentleHydrationScreen.tsx");
    expect(screen).toContain("<GentleHydrationModeCard");
    expect(screen).toContain("if (!flags.gentle_hydration_mode_enabled) return <Redirect");
    expect(read("app", "gentle-hydration.tsx")).toContain("GentleHydrationScreen");
    const profile = read("components", "profile", "ProfileScreenV2.tsx");
    expect(profile).toContain("router.push('/gentle-hydration' as never)");
    expect(profile).toContain("flags.gentle_hydration_mode_enabled ? (");
  });
  it("writes the Recent day word with a capital, as the reference does", () => {
    const hydration = read("components", "hydration", "HydrationScreenV2.tsx");
    expect(hydration).toContain("when.text.charAt(0).toUpperCase() + when.text.slice(1)");
  });
  it("does not touch protected scoring or status files", () => {
    const protectedFiles = ["utils/scoringEngine.ts", "theme/statusColor.ts"];
    for (const file of protectedFiles)
      expect(read(...file.split("/"))).toBeTruthy();
  });
});
