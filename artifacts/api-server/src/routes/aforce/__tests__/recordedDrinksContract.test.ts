import { describe, expect, it } from "vitest";
import { recordedDrinkSchema } from "../recordedDrinksContract";

describe("recorded-drink input contract", () => {
  it("accepts non-water drinks as record-only entries", () => {
    const result = recordedDrinkSchema.safeParse({
      categoryId: "coffee_or_tea",
      displayName: "Coffee or tea",
      ozAmount: 12,
      entrySource: "hydration",
      clientEventId: "drink-123",
    });
    expect(result.success).toBe(true);
  });

  it("rejects water so water can only use the scored intake route", () => {
    expect(recordedDrinkSchema.safeParse({ categoryId: "water", displayName: "Water", ozAmount: 16 }).success)
      .toBe(false);
  });

  it("rejects fabricated amounts and empty labels", () => {
    expect(recordedDrinkSchema.safeParse({ categoryId: "aforce", displayName: " ", ozAmount: 12 }).success)
      .toBe(false);
    expect(recordedDrinkSchema.safeParse({ categoryId: "aforce", displayName: "AFORCE", ozAmount: 65 }).success)
      .toBe(false);
  });
});
