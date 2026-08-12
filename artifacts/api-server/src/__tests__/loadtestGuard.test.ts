/**
 * Wave-4 Part 13 — the load-test environment guard must FAIL CLOSED.
 *
 * History that makes this lock non-negotiable: the first version of
 * loadtests/lib/guard.js parsed the host with `new URL()` inside a
 * try/catch that returned '' on failure. k6's JS runtime has no `URL`
 * constructor, so every call threw, every host resolved to '', and the
 * guard let a 250-VU tier ramp against the production host. The guard now
 * regex-parses and treats an unparseable BASE_URL as a refusal.
 *
 * These tests import the real guard module used by the k6 scripts — no
 * copy, no re-implementation.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// @ts-expect-error — plain-JS k6 module, intentionally untyped
import { hostOf, isProductionHost, assertSafeEnvironment, PRODUCTION_HOSTS } from "../../loadtests/lib/guard.js";

const guardSrc = readFileSync(resolve(__dirname, "../../loadtests/lib/guard.js"), "utf8");

describe("production host detection", () => {
  it("recognizes every production host, with or without a path", () => {
    for (const host of PRODUCTION_HOSTS as string[]) {
      expect(isProductionHost(`https://${host}`)).toBe(true);
      expect(isProductionHost(`https://${host}/api/healthz`)).toBe(true);
      expect(isProductionHost(`https://${host}:443/api`)).toBe(true);
    }
  });

  it("is case-insensitive (an uppercased host is still production)", () => {
    expect(isProductionHost("https://API.DrinkAForce.com")).toBe(true);
  });

  it("does not mistake a safe host for production", () => {
    expect(isProductionHost("http://localhost:8080")).toBe(false);
    expect(isProductionHost("http://127.0.0.1:3000")).toBe(false);
    expect(isProductionHost("https://staging.aforce.app")).toBe(false);
  });

  it("does not match a lookalike host that merely contains a production name", () => {
    expect(isProductionHost("https://api.drinkaforce.com.evil.test")).toBe(false);
    expect(isProductionHost("https://notdrinkaforce.com")).toBe(false);
  });
});

describe("assertSafeEnvironment fails CLOSED", () => {
  it("throws for a production target", () => {
    expect(() => assertSafeEnvironment("https://api.drinkaforce.com", "Tier 2")).toThrow(
      /not permitted against production host/,
    );
  });

  it("throws for an unparseable BASE_URL rather than allowing the run", () => {
    for (const bad of ["not-a-url", "", "   ", "ftp://api.drinkaforce.com", "//api.drinkaforce.com"]) {
      expect(() => assertSafeEnvironment(bad, "Tier 2")).toThrow(/guard fails closed/);
    }
  });

  it("permits a safe target", () => {
    expect(() => assertSafeEnvironment("http://localhost:8080", "Tier 2")).not.toThrow();
  });
});

describe("guard wiring (source locks)", () => {
  it("never uses `new URL` — k6's runtime has no URL constructor", () => {
    // Comments deliberately mention the old `new URL()` bug, so strip them
    // and assert against code only.
    const code = guardSrc.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|\s)\/\/.*$/gm, "");
    expect(code).not.toContain("new URL(");
  });

  it("every heavy tier calls the guard in INIT context, not only in setup()", () => {
    // setup() alone is not enough for scripts using per-scenario executors;
    // an init-context call aborts before a single VU is allocated.
    for (const script of ["k6-tier2-steady.js", "k6-tier3-burst.js", "k6-recovery.js"]) {
      const src = readFileSync(resolve(__dirname, `../../loadtests/${script}`), "utf8");
      const importIdx = src.indexOf("from './lib/guard.js'");
      const optionsIdx = src.indexOf("export const options");
      const initCallIdx = src.indexOf("assertSafeEnvironment(BASE_URL", importIdx);
      expect(initCallIdx).toBeGreaterThan(importIdx);
      expect(initCallIdx).toBeLessThan(optionsIdx);
    }
  });

  it("the tier-1 smoke is read-only and therefore ungated", () => {
    const src = readFileSync(resolve(__dirname, "../../loadtests/k6-tier1-smoke.js"), "utf8");
    expect(src).not.toContain("assertSafeEnvironment");
    expect(src).not.toMatch(/http\.(post|put|patch|del)\(/);
  });
});
