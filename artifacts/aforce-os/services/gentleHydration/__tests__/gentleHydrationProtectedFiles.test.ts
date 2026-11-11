import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";
const protectedPaths = [
  "artifacts/aforce-os/utils/scoringEngine.ts",
  "artifacts/aforce-os/theme/statusColor.ts",
];
function changed(args: string[]) {
  return execFileSync("git", args, { encoding: "utf8" })
    .trim()
    .split("\n")
    .filter(Boolean);
}
describe("Gentle Hydration protected files", () => {
  it("never changes scoringEngine.ts or statusColor.ts", () => {
    const files = new Set([
      ...changed(["diff", "--name-only"]),
      ...changed(["diff", "--cached", "--name-only"]),
      ...changed(["diff", "--name-only", "main...HEAD"]),
    ]);
    for (const path of protectedPaths)
      expect(files.has(path), `${path} is permanently protected`).toBe(false);
  });
});
