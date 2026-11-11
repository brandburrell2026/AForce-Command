import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const source = readFileSync(resolve(__dirname, "..", "recordedDrinks.ts"), "utf8");

describe("recorded-drinks route law", () => {
  it("persists a separate record without importing state or score machinery", () => {
    expect(source).toContain("aforceRecordedDrinks");
    const imports = [...source.matchAll(/^import[^;]+;/gm)].map((match) => match[0]).join("\n");
    expect(imports).not.toMatch(/aforceUserState|aforceIntakeLogs|applyIntake|broadcastState/i);
  });

  it("makes client-key retries idempotent without creating a new record", () => {
    expect(source).toContain("onConflictDoNothing");
    expect(source).toContain("replayed: true");
  });
});
