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
function baseRef() {
  // Actions checks out a detached revision; the target is a remote-tracking
  // ref, not a local branch. Missing history must still fail this guard.
  for (const ref of ["origin/main", "main"]) {
    try {
      execFileSync("git", ["rev-parse", "--verify", ref], { stdio: "ignore" });
      return ref;
    } catch { /* try the local checkout's branch */ }
  }
  throw new Error("Protected-file check requires main history; fetch origin/main before testing");
}
describe("Gentle Hydration protected files", () => {
  it("never changes scoringEngine.ts or statusColor.ts", () => {
    const files = new Set([
      ...changed(["diff", "--name-only"]),
      ...changed(["diff", "--cached", "--name-only"]),
      ...changed(["diff", "--name-only", `${baseRef()}...HEAD`]),
    ]);
    for (const path of protectedPaths)
      expect(files.has(path), `${path} is permanently protected`).toBe(false);
  });
});
