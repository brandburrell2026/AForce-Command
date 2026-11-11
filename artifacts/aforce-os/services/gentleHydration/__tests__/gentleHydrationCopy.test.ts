import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { GENTLE_HYDRATION_COPY } from "../../gentleHydrationCopy";
const banned = [
  "behind",
  "missed",
  "failed",
  "failure",
  "deficit",
  "should have",
  "goal not met",
];
describe("Gentle Hydration copy", () => {
  it("is centralized and excludes banned pressure language", () => {
    const source = readFileSync(
      join(__dirname, "..", "..", "gentleHydrationCopy.ts"),
      "utf8",
    );
    expect(source).toContain("PENDING MEDICAL + LEGAL APPROVAL");
    const text = Object.values(GENTLE_HYDRATION_COPY).join(" ").toLowerCase();
    for (const word of banned) expect(text).not.toContain(word);
  });
});
