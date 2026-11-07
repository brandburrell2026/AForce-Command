import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

// Scan authored literals, not comments, identifiers, imported guard vocabulary,
// test fixtures or member-entered words. This supplements rendered flow tests;
// it does not establish correct timing, dynamic advice or device acceptance.
function authoredCopy(source: string): string[] {
  const file = ts.createSourceFile(
    "screen.tsx",
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  const copy: string[] = [];
  function visit(node: ts.Node) {
    if (ts.isJsxText(node) || ts.isStringLiteralLike(node))
      copy.push(node.text);
    if (ts.isTemplateExpression(node)) {
      copy.push(
        node.head.text,
        ...node.templateSpans.map((span) => span.literal.text),
      );
    }
    ts.forEachChild(node, visit);
  }
  visit(file);
  return copy.map((text) => text.replace(/\s+/g, " ").trim()).filter(Boolean);
}
const prohibited = [
  /\b(?:BAC|sober|sobriety|hangover|drunk|wasted|night owl)\b/i,
  /\b(?:safe to drive|party mode|drinking mode|real[ -]time|go be present)\b/i,
  /^(?:status\s*[:·-]\s*)?safe[.!]?$/i,
  /\b(?:drink\s+(?:count|counter|total)|(?:\d+|one|two|three|four|five|six|seven|eight|nine|ten|total)\s+(?:alcoholic\s+)?drinks?)\b/i,
  /\bAForce\b/,
];
function violations(source: string): string[] {
  return authoredCopy(source).filter((text) =>
    prohibited.some((rule) => rule.test(text)),
  );
}
const folder = path.resolve("artifacts/aforce-os/components/oneBreath");
const screens = readdirSync(folder).filter((name) => name.endsWith(".tsx"));
const targets = [
  ...screens.map((name) => path.join(folder, name)),
  path.resolve("artifacts/aforce-os/services/momentPreparation.ts"),
  path.resolve("artifacts/aforce-os/hooks/useOneBreathVoice.native.ts"),
];

describe("Social v0.4 authored copy contract", () => {
  it("checks every shared preparation and fallback One Breath component", () => {
    expect(screens).toContain("MomentPreparationScreen.tsx");
    expect(screens).toContain("ConfirmMomentScreen.tsx");
    const failures = targets.flatMap((file) =>
      violations(readFileSync(file, "utf8")).map((copy) => ({
        file: path.relative(process.cwd(), file),
        copy,
      })),
    );
    expect(failures).toEqual([]);
  });
  it.each([
    "BAC",
    "SOBER",
    "Sobriety",
    "Safe to drive",
    "Status: safe",
    "Hangover",
    "Drunk",
    "Wasted",
    "Party mode",
    "Drinking mode",
    "Night owl",
    "Real-time",
    "2 drinks",
    "Drink count",
    "Go be present.",
    "Return to AForce",
  ])("rejects an introduced UI claim: %s", (copy) => {
    expect(violations(`const Screen = () => <Text>${copy}</Text>`)).toEqual([
      copy,
    ]);
  });
  it("checks conditional labels, accessibility text, errors and template copy", () => {
    expect(
      violations(
        'const screen = <Button accessibilityLabel="Sober"/>; setError("Safe to drive"); button(day ? "Party mode" : "Drinking mode", open); const label = `Real-time ${name}`;',
      ),
    ).toHaveLength(5);
  });
  it("ignores comments and member words while allowing the approved guidance", () => {
    expect(
      violations(
        '// sober is prohibited\nconst screen = <Text>{memberWords}</Text>; button("AFORCE can’t assess whether you’re able to drive.", open); button("Go perform.", lock);',
      ),
    ).toEqual([]);
  });
});
