import { describe, expect, it } from "vitest";
import {
  DEFAULT_GENTLE_HYDRATION_MODE,
  gentleHydrationCheckInCount,
  clearGentleHydrationMode,
  gentleHydrationIsShareable,
  normalizeGentleHydrationMode,
} from "../../gentleHydrationMode";

describe("Gentle Hydration Mode", () => {
  it("fails closed for malformed stored data", () => {
    expect(normalizeGentleHydrationMode("{not-json}")).toEqual(
      DEFAULT_GENTLE_HYDRATION_MODE,
    );
  });

  it("only accepts the defined private cadence and comfort values", () => {
    expect(
      normalizeGentleHydrationMode({
        enabled: true,
        cadence: "gentle",
        comfort: "mild_nausea",
        updatedAt: "2026-11-05T12:00:00.000Z",
      }),
    ).toMatchObject({
      enabled: true,
      cadence: "gentle",
      comfort: "mild_nausea",
    });
    expect(
      normalizeGentleHydrationMode({ enabled: true, cadence: "prescriptive" }),
    ).toMatchObject({
      cadence: "gentle",
    });
  });

  it("is an opt-in planning layer and cannot be shared with Circle", () => {
    expect(gentleHydrationCheckInCount("gentle")).toBe(5);
    expect(gentleHydrationCheckInCount("steady")).toBe(4);
    expect(gentleHydrationCheckInCount("minimal")).toBe(3);
    expect(gentleHydrationIsShareable()).toBe(false);
    expect(typeof clearGentleHydrationMode).toBe("function");
  });
});
