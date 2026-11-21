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

  it("removes only the member's own drink, and a repeated removal is not an error", () => {
    const route = source.slice(source.indexOf('router.delete("/drinks/:id"'));
    expect(route).toContain("eq(aforceRecordedDrinks.userId, userId)");
    expect(route).toContain("eq(aforceRecordedDrinks.id, id.data)");
    expect(route).toContain("removed: removed.length > 0");
    // No bulk removal: every delete in this file is scoped to one id and one member.
    expect(source.match(/\.delete\(/g)).toHaveLength(2);
    expect(source).not.toMatch(/aforceUserState|broadcastState/);
  });

  it("makes client-key retries idempotent without creating a new record", () => {
    expect(source).toContain("onConflictDoNothing");
    expect(source).toContain("replayed: true");
  });
});
