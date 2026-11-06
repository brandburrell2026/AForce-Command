/**
 * Gentle Hydration containment checks.
 *
 * The Hydration root is store-connected and deliberately not mounted in this
 * test suite. These source guards lock the safety boundaries that matter for
 * this private, opt-in planning layer: it remains dark by default, opens the
 * existing explicit water picker, and does not grow a Circle or notification
 * side effect through a future refactor.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { DEFAULT_FLAGS } from "@/featureFlags/flags";
import { gentleHydrationIsShareable } from "@/services/gentleHydrationMode";

const PKG = join(__dirname, "..", "..", "..");

function code(...segments: string[]): string {
  return readFileSync(join(PKG, ...segments), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/\/\/.*$/gm, "");
}

const HYDRATION = code("components", "hydration", "HydrationScreenV2.tsx");
const CARD = code("components", "hydration", "GentleHydrationModeCard.tsx");
const DEVELOPER_PANE = code(
  "components",
  "profile",
  "panes",
  "DeveloperPane.tsx",
);
const MODE = code("services", "gentleHydrationMode.ts");
const PROMPT_POLICY = code("services", "gentleHydrationPromptPolicy.ts");

describe("Gentle Hydration Mode — private, gated wiring", () => {
  it("is dark in the shipped default flag set", () => {
    expect(DEFAULT_FLAGS.gentle_hydration_mode_enabled).toBe(false);
    expect(HYDRATION).toMatch(
      /flags\.gentle_hydration_mode_enabled\s*\?\s*\(\s*<GentleHydrationModeCard/,
    );
  });

  it("gives internal reviewers a dedicated toggle without changing public defaults", () => {
    expect(DEVELOPER_PANE).toMatch(
      /<FlagRow\s+flag="gentle_hydration_mode_enabled"[\s\S]*?label="Gentle Hydration preview"/,
    );
    expect(DEVELOPER_PANE).toContain("Private, opt-in pacing support.");
  });

  it("routes “Log water” to the established explicit-amount picker", () => {
    expect(HYDRATION).toMatch(
      /<GentleHydrationModeCard[\s\S]*?onLogWater=\{openWaterPicker\}/,
    );
    expect(CARD).toContain("onLogWater: () => void;");
    expect(CARD).toContain("onPress={onLogWater}");
    expect(CARD).not.toContain("logIntake(");
  });

  it("keeps comfort context account-scoped and explicitly non-shareable", () => {
    expect(MODE).toMatch(
      /import \{ scopedSecureKV \} from ["']\.\/scopedStorage["'];/,
    );
    expect(MODE).toContain("scopedSecureKV.setItem");
    expect(MODE).toContain("scopedSecureKV.removeItem");
    expect(gentleHydrationIsShareable()).toBe(false);
    expect(CARD).toContain("It is never shared with Circle.");
    expect(CARD).toMatch(/not shared with Circle or used for\s+ranking/);
  });

  it("does not schedule a native reminder before release review", () => {
    expect(PROMPT_POLICY).toContain("releaseApproved: boolean;");
    expect(PROMPT_POLICY).toMatch(
      /if \(!input\.releaseApproved\) return block\(["']review_required["']\);/,
    );
    expect(PROMPT_POLICY).not.toContain("expo-notifications");
    expect(PROMPT_POLICY).not.toContain("scheduleNotification");
    expect(CARD).not.toContain("expo-notifications");
  });
});
