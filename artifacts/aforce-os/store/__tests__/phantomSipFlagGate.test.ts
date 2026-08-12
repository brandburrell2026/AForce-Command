/**
 * Wave-1 P0 regression lock (Score Protection defense-in-depth): the Phantom
 * Band sip listener must only be registered when phantom_wearable_enabled is
 * ON. Without this gate, a stray 'sip' emission would write synthetic intake
 * into a real user's log even though the flag is clamped OFF in production.
 *
 * Source-lock style (same pattern as sensorImportIntegrity): asserts the
 * registration site is guarded, so a refactor that drops the guard fails CI.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const source = readFileSync(resolve(__dirname, "../useAppStore.tsx"), "utf8");
const stripped = source
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/^\s*\/\/.*$/gm, "");

describe("phantom sip listener — flag gate", () => {
  it("registers the sip listener exactly once", () => {
    const matches = stripped.match(/phantomBandService\.on\(\s*['"]sip['"]/g) ?? [];
    expect(matches.length).toBe(1);
  });

  it("registration is guarded by phantom_wearable_enabled", () => {
    const idx = stripped.indexOf("phantomBandService.on(");
    expect(idx).toBeGreaterThan(-1);
    const windowBefore = stripped.slice(Math.max(0, idx - 600), idx);
    expect(windowBefore).toContain("featureFlags.phantom_wearable_enabled");
    expect(windowBefore).toMatch(/if\s*\(\s*!phantomOn\s*\)\s*return/);
  });
});
